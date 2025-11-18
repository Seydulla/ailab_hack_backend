import pool from '../config/db';
import qdrantClient from '../config/qdrant';
import { embedText, buildEmbeddingText, withRetry } from '../utils';
import { WORKOUT_SESSIONS_COLLECTION_NAME } from './qdrant';
import type { ExerciseRow } from '../types';

export async function buildWorkoutEmbeddingText(
  sessionIdDb: string
): Promise<string> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT e.* 
       FROM exercises e
       INNER JOIN session_exercise_results ser ON e.external_id = ser.exercise_id
       WHERE ser.session_id = $1
       ORDER BY ser.order_index`,
      [sessionIdDb]
    );

    const exercises: ExerciseRow[] = result.rows;
    if (exercises.length === 0) {
      return '';
    }

    const embeddingTexts = exercises.map(exercise =>
      buildEmbeddingText(exercise, false)
    );
    return embeddingTexts.join('\n\n');
  } finally {
    client.release();
  }
}

export async function syncWorkoutSessionToQdrant(
  sessionIdDb: string,
  userId: string,
  originalSessionId: string
): Promise<void> {
  return withRetry(
    async () => {
      const embeddingText = await buildWorkoutEmbeddingText(sessionIdDb);

      if (!embeddingText) {
        console.warn(
          `No exercises found for session ${sessionIdDb}, skipping Qdrant sync`
        );
        return;
      }

      const embedding = await embedText(embeddingText);

      await qdrantClient.upsert(WORKOUT_SESSIONS_COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: sessionIdDb,
            vector: embedding,
            payload: {
              user_id: userId,
              session_id: originalSessionId,
            },
          },
        ],
      });

      console.log(`✅ Synced workout session ${sessionIdDb} to Qdrant`);
    },
    {
      operationName: `sync workout session ${sessionIdDb} to Qdrant`,
    }
  );
}

export async function searchSimilarWorkoutSessions(
  userId: string,
  queryEmbedding: number[],
  limit: number = 5
): Promise<string[]> {
  try {
    const searchResults = await qdrantClient.search(
      WORKOUT_SESSIONS_COLLECTION_NAME,
      {
        vector: queryEmbedding,
        limit,
        filter: {
          must: [
            {
              key: 'user_id',
              match: {
                value: userId,
              },
            },
          ],
        },
      }
    );

    const points = Array.isArray(searchResults) ? searchResults : [];
    console.log('[SIMILAR_SESSIONS] Qdrant search results:', {
      userId,
      totalResults: points.length,
      results: points.map(p => ({
        id: p.id,
        score: p.score,
        payload: p.payload,
      })),
    });

    const sessionIds = points
      .map(point => {
        const payload =
          point.payload &&
          typeof point.payload === 'object' &&
          !Array.isArray(point.payload)
            ? (point.payload as Record<string, unknown>)
            : {};
        return {
          sessionId: payload.session_id as string | undefined,
          score: point.score,
        };
      })
      .filter(
        (item): item is { sessionId: string; score: number } =>
          typeof item.sessionId === 'string'
      );

    console.log('[SIMILAR_SESSIONS] Extracted session IDs:', {
      userId,
      sessionIds: sessionIds.map(s => ({
        sessionId: s.sessionId,
        similarityScore: s.score,
      })),
    });

    return sessionIds.map(s => s.sessionId);
  } catch (error) {
    console.error('❌ Failed to search similar workout sessions:', error);
    return [];
  }
}
