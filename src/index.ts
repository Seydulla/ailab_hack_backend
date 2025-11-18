import app from './app';
import { env } from './config/env';
import pool from './config/db';
import qdrantClient from './config/qdrant';
import redisClient from './config/redis';
import {
  initializeExercisesCollection,
  initializeWorkoutSessionsCollection,
} from './services/qdrant';
import {
  startNotificationListener,
  stopNotificationListener,
} from './services/triggerListener';

async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully');

    await qdrantClient.getCollections();
    console.log('✅ Qdrant connected successfully');

    await redisClient.connect();
    console.log('✅ Redis connected successfully');

    await initializeExercisesCollection();
    await initializeWorkoutSessionsCollection();
    await startNotificationListener();

    app.listen(env.PORT, () => {
      console.log(`🚀 Server is running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to services:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  void stopNotificationListener()
    .then(() => redisClient.quit())
    .then(() => pool.end())
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  void stopNotificationListener()
    .then(() => redisClient.quit())
    .then(() => pool.end())
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    });
});

void startServer();
