import { createClient } from 'redis';
import { env } from './env';

const redisConfig: { url?: string; password?: string } = {};

if (env.REDIS_URL) {
  redisConfig.url = env.REDIS_URL;
}

if (env.REDIS_PASSWORD) {
  redisConfig.password = env.REDIS_PASSWORD;
}

const redisClient = createClient(redisConfig);

redisClient.on('error', err => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

export default redisClient;
