import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from './env';

const qdrantClient = new QdrantClient({
  url: env.QDRANT_URL as string,
  apiKey: env.QDRANT_API_KEY || undefined,
});

export default qdrantClient;
