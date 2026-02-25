import { createClient } from 'redis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        logger.warn('Redis max reconnect attempts reached — giving up');
        return false;
      }
      return Math.min(retries * 200, 2000);
    },
  },
});

redis.on('error', (err) => {
  if (!redis.isOpen) return;
  logger.error('Redis client error', { error: err.message });
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) {
    await redis.connect();
  }
}
