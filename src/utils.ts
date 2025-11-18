import {
  encode,
  decode,
  type EncodeOptions,
  type DecodeOptions,
} from '@toon-format/toon';
import genAI from './config/gemini';
import type { ExerciseRow } from './types';

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

export {
  toonEncode,
  toonDecode,
  embedText,
  embedTexts,
  buildEmbeddingText,
  withRetry,
};
export { encode, decode };
export type { EncodeOptions, DecodeOptions };
