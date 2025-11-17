import app from './app';
import { env } from './config/env';
import pool from './config/db';
import qdrantClient from './config/qdrant';

async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully');

    await qdrantClient.getCollections();
    console.log('✅ Qdrant connected successfully');

    app.listen(env.PORT, () => {
      console.log(`🚀 Server is running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to services:', error);
    process.exit(1);
  }
}

void startServer();
