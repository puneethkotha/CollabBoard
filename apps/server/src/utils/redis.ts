import { createClient } from 'redis';
import { config } from '../config';
import { logger } from './logger';

export const redisClient = createClient({
  url: config.redis.url,
});

redisClient.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

export async function connectRedis() {
  await redisClient.connect();
}

export async function disconnectRedis() {
  await redisClient.quit();
  logger.info('Redis disconnected');
}
