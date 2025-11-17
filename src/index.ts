import app from './app';
import { env } from './config/env';
import pool from './config/db';

async function startServer() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');

    app.listen(env.PORT, () => {
      console.log(`🚀 Server is running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }
}

void startServer();
