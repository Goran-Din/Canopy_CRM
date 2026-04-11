import type { Request, Response, NextFunction } from 'express';
import { queryDb } from '../config/database.js';

export function apiKeyAuth(integrationName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      res.status(401).json({ error: 'unauthorized', message: 'API key required' });
      return;
    }

    try {
      const result = await queryDb<Record<string, unknown>>(
        `SELECT tenant_id, config_data, status
         FROM integration_configs
         WHERE provider = $1 AND status = 'active'`,
        [integrationName],
      );

      // Find config where api_key in config_data matches
      const config = result.rows.find(row => {
        const data = row.config_data as Record<string, unknown>;
        return data.api_key === apiKey;
      });

      if (!config) {
        res.status(401).json({ error: 'unauthorized', message: 'Invalid API key' });
        return;
      }

      req.tenantId = config.tenant_id as string;
      next();
    } catch {
      res.status(500).json({ error: 'server_error', message: 'Authentication failed' });
    }
  };
}
