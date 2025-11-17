import {
  encode,
  decode,
  type EncodeOptions,
  type DecodeOptions,
} from '@toon-format/toon';
import genAI from './config/gemini';

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

export { toonEncode, toonDecode, embedText, embedTexts };
export { encode, decode };
export type { EncodeOptions, DecodeOptions };
