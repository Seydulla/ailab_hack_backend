import pool from '../config/db';
import qdrantClient from '../config/qdrant';
import { embedText } from '../utils';
import { EXERCISES_COLLECTION_NAME } from './qdrant';
import type { ExerciseRow } from '../types';

async function fetchExercise(id: string): Promise<ExerciseRow | null> {
  const client = await pool.connect();
  try {
    const exerciseResult = await client.query<ExerciseRow>(
      'SELECT * FROM exercises WHERE id = $1',
      [id]
    );

    if (exerciseResult.rows.length === 0) {
      return null;
    }

    return exerciseResult.rows[0];
  } finally {
    client.release();
  }
}

function buildEmbeddingText(exercise: ExerciseRow): string {
  const parts = [
    exercise.title,
    exercise.description,
    exercise.body_parts,
    exercise.dif_level,
    exercise.common_mistakes,
    exercise.position,
    exercise.steps,
    exercise.tips,
  ].filter(Boolean);

  return parts.join('\n');
}

export async function syncExerciseToQdrant(exerciseId: string): Promise<void> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const exercise = await fetchExercise(exerciseId);

      if (!exercise) {
        console.warn(`Exercise ${exerciseId} not found, skipping sync`);
        return;
      }

      const embeddingText = buildEmbeddingText(exercise);
      const embedding = await embedText(embeddingText);

      const bodyPartsText =
        typeof exercise.body_parts === 'string'
          ? exercise.body_parts
          : String(exercise.body_parts || '');
      const stepsText =
        typeof exercise.steps === 'string'
          ? exercise.steps
          : String(exercise.steps || '');

      const bodyPartsArray = bodyPartsText
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
      const stepsArray = stepsText
        .split('\n')
        .map(step => step.trim())
        .filter(Boolean);

      const payload = {
        external_id: exercise.external_id,
        title: exercise.title,
        description: exercise.description,
        bodyParts: bodyPartsArray,
        difLevel: exercise.dif_level,
        commonMistakes: exercise.common_mistakes,
        position: exercise.position,
        steps: stepsArray,
        tips: exercise.tips,
        createdAt: exercise.created_at.toISOString(),
        updatedAt: exercise.updated_at.toISOString(),
      };

      await qdrantClient.upsert(EXERCISES_COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: exercise.id,
            vector: embedding,
            payload: payload,
          },
        ],
      });

      console.log(`✅ Synced exercise ${exerciseId} to Qdrant`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `❌ Failed to sync exercise ${exerciseId} (attempt ${attempt}/${maxRetries}):`,
        lastError
      );

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('Failed to sync exercise to Qdrant');
}

export async function deleteExerciseFromQdrant(
  exerciseId: string
): Promise<void> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await qdrantClient.delete(EXERCISES_COLLECTION_NAME, {
        wait: true,
        points: [exerciseId],
      });

      console.log(`✅ Deleted exercise ${exerciseId} from Qdrant`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `❌ Failed to delete exercise ${exerciseId} from Qdrant (attempt ${attempt}/${maxRetries}):`,
        lastError
      );

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('Failed to delete exercise from Qdrant');
}
