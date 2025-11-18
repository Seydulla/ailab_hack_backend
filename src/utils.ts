import {
  encode,
  decode,
  type EncodeOptions,
  type DecodeOptions,
} from '@toon-format/toon';
import genAI from './config/gemini';
import pool from './config/db';
import type {
  ExerciseRow,
  IUserProfile,
  Gender,
  IExercise,
  ExerciseResults,
} from './types';
import {
  SEARCH_QUERY_REFINEMENT_SYSTEM_PROMPT,
  EXERCISE_SUMMARY_SYSTEM_PROMPT,
} from './constants';

async function fetchExerciseByExternalId(
  externalId: string
): Promise<ExerciseRow | null> {
  const client = await pool.connect();
  try {
    const exerciseResult = await client.query<ExerciseRow>(
      'SELECT * FROM exercises WHERE external_id = $1',
      [externalId]
    );

    if (exerciseResult.rows.length === 0) {
      return null;
    }

    return exerciseResult.rows[0];
  } finally {
    client.release();
  }
}

function toonEncode(data: unknown, options?: EncodeOptions): string {
  return encode(data, options);
}

function toonDecode(input: string, options?: DecodeOptions): unknown {
  return decode(input, options);
}

async function embedText(
  text: string,
  model: string = 'text-embedding-004'
): Promise<number[]> {
  const response = await genAI.models.embedContent({
    model,
    contents: [text],
  });

  const embedding = response.embeddings?.[0];
  if (!embedding?.values) {
    throw new Error('Failed to generate embedding');
  }

  return embedding.values;
}

async function embedTexts(
  texts: string[],
  model: string = 'text-embedding-004'
): Promise<number[][]> {
  const response = await genAI.models.embedContent({
    model,
    contents: texts,
  });

  if (!response.embeddings) {
    throw new Error('Failed to generate embeddings');
  }

  return response.embeddings.map(emb => {
    if (!emb.values) {
      throw new Error('Embedding missing values');
    }
    return emb.values;
  });
}

function buildEmbeddingText(
  exercise: ExerciseRow,
  includeCommonMistakes: boolean = true
): string {
  const parts = [
    exercise.title,
    exercise.description,
    exercise.body_parts,
    exercise.dif_level,
    ...(includeCommonMistakes ? [exercise.common_mistakes] : []),
    exercise.position,
    exercise.steps,
    exercise.tips,
  ].filter(Boolean);

  return parts.join('\n');
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    operationName = 'Operation',
  } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `❌ Failed ${operationName} (attempt ${attempt}/${maxRetries}):`,
        lastError
      );

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw (
    lastError ||
    new Error(`Failed ${operationName} after ${maxRetries} attempts`)
  );
}

interface ProfileDataJSON {
  age: number | null;
  weight: number | null;
  height: number | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  goals: string | null;
  injuries: string | null;
  lifestyle: string | null;
  equipment: string | null;
}

function extractProfileData(text: string): Partial<IUserProfile> | null {
  const profileData: Partial<IUserProfile> = {};

  const profileDataMatch = text.match(
    /<PROFILE_DATA>([\s\S]*?)<\/PROFILE_DATA>/
  );
  if (!profileDataMatch) {
    return null;
  }

  try {
    const toonStr = profileDataMatch[1].trim();
    let parsed: ProfileDataJSON;

    try {
      parsed = toonDecode(toonStr) as ProfileDataJSON;
    } catch {
      const jsonStr = toonStr;
      parsed = JSON.parse(jsonStr);
    }

    if (parsed.age !== null && typeof parsed.age === 'number') {
      profileData.age = parsed.age;
    }
    if (parsed.weight !== null && typeof parsed.weight === 'number') {
      profileData.weight = parsed.weight;
    }
    if (parsed.height !== null && typeof parsed.height === 'number') {
      profileData.height = parsed.height;
    }
    if (
      parsed.gender !== null &&
      ['MALE', 'FEMALE', 'OTHER'].includes(parsed.gender)
    ) {
      profileData.gender = parsed.gender as Gender;
    }
    if (
      parsed.goals !== null &&
      typeof parsed.goals === 'string' &&
      parsed.goals.trim().length > 0 &&
      parsed.goals.trim().toUpperCase() !== 'N/A'
    ) {
      profileData.goals = parsed.goals.trim();
    }
    if (
      parsed.injuries !== null &&
      typeof parsed.injuries === 'string' &&
      parsed.injuries.trim().length > 0 &&
      parsed.injuries.trim().toUpperCase() !== 'N/A'
    ) {
      profileData.injuries = parsed.injuries.trim();
    }
    if (
      parsed.lifestyle !== null &&
      typeof parsed.lifestyle === 'string' &&
      parsed.lifestyle.trim().length > 0 &&
      parsed.lifestyle.trim().toUpperCase() !== 'N/A'
    ) {
      profileData.lifestyle = parsed.lifestyle.trim();
    }
    if (
      parsed.equipment !== null &&
      typeof parsed.equipment === 'string' &&
      parsed.equipment.trim().length > 0 &&
      parsed.equipment.trim().toUpperCase() !== 'N/A'
    ) {
      profileData.equipment = parsed.equipment.trim();
    }

    return Object.keys(profileData).length > 0 ? profileData : null;
  } catch (error) {
    console.error('Failed to parse profile data JSON:', error);
    return null;
  }
}

function isProfileComplete(profileData: Partial<IUserProfile>): boolean {
  return (
    typeof profileData.age === 'number' &&
    typeof profileData.weight === 'number' &&
    typeof profileData.height === 'number' &&
    profileData.gender !== undefined &&
    typeof profileData.goals === 'string' &&
    profileData.goals.length > 0 &&
    typeof profileData.injuries === 'string' &&
    profileData.injuries.length > 0
  );
}

function stripDataFromResponse(text: string): string {
  let cleaned = text;

  if (cleaned.includes('<START_DATA>') && cleaned.includes('<END_DATA>')) {
    const startIndex = cleaned.indexOf('<START_DATA>');
    const endIndex = cleaned.indexOf('<END_DATA>');
    if (startIndex < endIndex) {
      cleaned =
        cleaned.substring(0, startIndex).trim() +
        cleaned.substring(endIndex + '<END_DATA>'.length).trim();
    }
  } else if (cleaned.includes('<END_DATA>')) {
    cleaned = cleaned.split('<END_DATA>')[0].trim();
  } else if (cleaned.includes('<START_DATA>')) {
    cleaned = cleaned.split('<START_DATA>')[0].trim();
  }

  cleaned = cleaned.replace(/<START_DATA>[\s\S]*/gi, '');
  cleaned = cleaned.replace(/<END_DATA>[\s\S]*/gi, '');
  cleaned = cleaned.replace(/<PROFILE_DATA>[\s\S]*?<\/PROFILE_DATA>/gi, '');
  cleaned = cleaned.replace(/<WORKOUT_DATA>[\s\S]*?<\/WORKOUT_DATA>/gi, '');
  cleaned = cleaned.replace(/<EXERCISES_DATA>[\s\S]*?<\/EXERCISES_DATA>/gi, '');

  cleaned = cleaned.replace(/```json\n[\s\S]*?\n```/g, '');

  cleaned = cleaned.replace(/```\n[\s\S]*?\n```/g, '');

  cleaned = cleaned.replace(/```json[\s\S]*?```/g, '');

  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

  const jsonBlockPattern = /\{[\s\S]{20,}\}/g;
  cleaned = cleaned.replace(jsonBlockPattern, match => {
    try {
      const parsed = JSON.parse(match);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return '';
      }
      return match;
    } catch {
      return match;
    }
  });

  return cleaned.trim();
}

function isConfirmMessage(content: string): boolean {
  const normalized = content.trim().toUpperCase();
  return (
    normalized === 'CONFIRM' || normalized === 'YES' || normalized === 'OK'
  );
}

function isCancelMessage(content: string): boolean {
  const normalized = content.trim().toUpperCase();
  return (
    normalized === 'CANCEL' ||
    normalized === 'NO' ||
    normalized.startsWith('CANCEL') ||
    normalized.includes('CHANGE') ||
    normalized.includes('MODIFY')
  );
}

interface SearchQueryRefinement {
  refinedQuery: string;
  excludeBodyParts: string[];
}

async function refineSearchQueryWithGemini(
  profileText: string,
  injuries: string
): Promise<SearchQueryRefinement> {
  const chat = genAI.chats.create({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: {
        parts: [{ text: SEARCH_QUERY_REFINEMENT_SYSTEM_PROMPT }],
      },
    },
  });

  const prompt = `User profile: ${profileText}\nInjuries: ${injuries}\n\nCreate a refined search query and identify body parts to exclude based on injuries.`;
  const response = await chat.sendMessage({ message: prompt });
  const responseText = response.text || '';

  console.log('[SEARCH_QUERY_REFINEMENT] Raw Gemini response:', {
    injuries,
    responseLength: responseText.length,
    responseText,
    hasSearchRefinement: responseText.includes('<SEARCH_REFINEMENT>'),
    hasStartData: responseText.includes('<START_DATA>'),
  });

  try {
    const refinementMatch = responseText.match(
      /<SEARCH_REFINEMENT>([\s\S]*?)<\/SEARCH_REFINEMENT>/
    );
    const dataMatch =
      responseText.match(/<START_DATA>([\s\S]*?)<END_DATA>/) ||
      responseText.match(/```json\n([\s\S]*?)\n```/) ||
      responseText.match(/```\n([\s\S]*?)\n```/) ||
      responseText.match(/\{[\s\S]*\}/);

    if (refinementMatch || dataMatch) {
      const dataStr = refinementMatch
        ? refinementMatch[1].trim()
        : dataMatch?.[1].trim() || '';
      let parsed: SearchQueryRefinement;

      try {
        parsed = toonDecode(dataStr) as SearchQueryRefinement;
      } catch {
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Could not parse refinement response');
          }
        }
      }

      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.refinedQuery === 'string'
      ) {
        let excludeBodyParts: string[] = [];
        if (Array.isArray(parsed.excludeBodyParts)) {
          excludeBodyParts = parsed.excludeBodyParts;
        } else if (typeof parsed.excludeBodyParts === 'string') {
          try {
            const parsedArray = JSON.parse(parsed.excludeBodyParts);
            if (Array.isArray(parsedArray)) {
              excludeBodyParts = parsedArray;
            }
          } catch {
            console.warn(
              '[SEARCH_QUERY_REFINEMENT] Failed to parse excludeBodyParts string as JSON:',
              parsed.excludeBodyParts
            );
          }
        }

        const result = {
          refinedQuery: parsed.refinedQuery,
          excludeBodyParts,
        };
        console.log('[SEARCH_QUERY_REFINEMENT] Parsed result:', {
          injuries,
          refinedQuery: result.refinedQuery,
          excludeBodyParts: result.excludeBodyParts,
          excludeBodyPartsType: typeof parsed.excludeBodyParts,
          excludeBodyPartsIsArray: Array.isArray(parsed.excludeBodyParts),
          rawParsed: parsed,
        });
        return result;
      } else {
        console.warn(
          '[SEARCH_QUERY_REFINEMENT] Parsed object missing refinedQuery:',
          {
            injuries,
            parsed,
            hasRefinedQuery:
              parsed && typeof parsed === 'object' && 'refinedQuery' in parsed,
          }
        );
      }
    } else {
      console.warn(
        '[SEARCH_QUERY_REFINEMENT] No data match found in response:',
        {
          injuries,
          responseText,
        }
      );
    }
  } catch (error) {
    console.error(
      '[SEARCH_QUERY_REFINEMENT] Failed to parse search query refinement:',
      {
        injuries,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    );
  }

  return {
    refinedQuery: profileText,
    excludeBodyParts: [],
  };
}

async function generateAISummary(
  exerciseResults: ExerciseResults,
  selectedExercises: IExercise[]
): Promise<string> {
  const chat = genAI.chats.create({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: {
        parts: [{ text: EXERCISE_SUMMARY_SYSTEM_PROMPT }],
      },
    },
  });

  const exerciseListData = selectedExercises.map((e: IExercise) => ({
    title: e.title,
  }));
  const exerciseListToon = toonEncode(exerciseListData);
  const resultsToon = toonEncode(exerciseResults);

  const prompt = `User completed these exercises (TOON format):\n${exerciseListToon}\n\nExercise results (TOON format):\n${resultsToon}\n\nCreate an encouraging summary.`;

  const response = await chat.sendMessage({ message: prompt });
  return response.text || '';
}

export {
  fetchExerciseByExternalId,
  toonEncode,
  toonDecode,
  embedText,
  embedTexts,
  buildEmbeddingText,
  withRetry,
  extractProfileData,
  isProfileComplete,
  stripDataFromResponse,
  isConfirmMessage,
  isCancelMessage,
  refineSearchQueryWithGemini,
  generateAISummary,
};
export { encode, decode };
export type { EncodeOptions, DecodeOptions };
export type { SearchQueryRefinement };
