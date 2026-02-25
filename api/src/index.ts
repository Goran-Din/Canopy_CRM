import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { testConnection } from './config/database.js';
import { connectRedis } from './config/redis.js';

async function bootstrap() {
  logger.info('Starting Canopy CRM API...', { env: env.NODE_ENV });

  const dbOk = await testConnection();
  if (!dbOk) {
    logger.warn('Database not available - starting in degraded mode');
  }

  try {
    await connectRedis();
  } catch (err) {
    logger.warn('Redis not available - starting in degraded mode', {
      error: (err as Error).message,
    });
  }

  app.listen(env.PORT, () => {
    logger.info(`API server listening on port ${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
