import { Pool } from 'pg';
import { env } from './env';

const getSslConfig = () => {
  if (process.env.DB_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  if (process.env.DB_SSL === 'false') {
    return false;
  }
  const url = env.DATABASE_URL.toLowerCase();
  if (url.includes('sslmode=require') || url.includes('sslmode=prefer')) {
    return { rejectUnauthorized: false };
  }
  return false;
};

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: getSslConfig(),
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;
