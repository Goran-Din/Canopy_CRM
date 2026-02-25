import type { Request, Response } from 'express';
import { pool } from '../../config/database.js';
import { redis } from '../../config/redis.js';

export async function healthCheck(_req: Request, res: Response) {
  const checks: Record<string, string> = {
    api: 'ok',
    database: 'unknown',
    redis: 'unknown',
  };

  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    if (redis.isOpen) {
      await redis.ping();
      checks.redis = 'ok';
    } else {
      checks.redis = 'disconnected';
    }
  } catch {
    checks.redis = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const status = allOk ? 200 : 503;

  res.status(status).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
}
