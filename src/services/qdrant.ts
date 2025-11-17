import qdrantClient from '../config/qdrant';

const EXERCISES_COLLECTION_NAME = 'exercises';
const VECTOR_SIZE = 768;

export async function initializeExercisesCollection(): Promise<void> {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      col => col.name === EXERCISES_COLLECTION_NAME
    );

    if (!collectionExists) {
      await qdrantClient.createCollection(EXERCISES_COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
      });
      console.log(`✅ Created Qdrant collection: ${EXERCISES_COLLECTION_NAME}`);
    } else {
      console.log(
        `✅ Qdrant collection already exists: ${EXERCISES_COLLECTION_NAME}`
      );
    }
  } catch (error) {
    console.error('❌ Failed to initialize Qdrant collection:', error);
    throw error;
  }
}

export { EXERCISES_COLLECTION_NAME };
