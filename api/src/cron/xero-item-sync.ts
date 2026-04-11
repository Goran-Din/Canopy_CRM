import { logger } from '../config/logger.js';
import { queryDb } from '../config/database.js';
import { syncXeroItems } from '../modules/integrations/xero/xero-items.js';

/**
 * Nightly Xero item catalog sync.
 * Cron: 0 2 * * * (daily at 2:00 AM UTC, configurable via XERO_ITEMS_SYNC_CRON)
 *
 * Setup in index.ts:
 *   import cron from 'node-cron';
 *   import { runXeroItemSync } from './cron/xero-item-sync.js';
 *   const syncSchedule = process.env.XERO_ITEMS_SYNC_CRON || '0 2 * * *';
 *   cron.schedule(syncSchedule, runXeroItemSync);
 */
export async function runXeroItemSync() {
  logger.info('Running nightly Xero item sync');

  try {
    const tenants = await queryDb<{ tenant_id: string }>(
      `SELECT DISTINCT tenant_id FROM integration_configs
       WHERE provider = 'xero' AND status = 'active'`,
    );

    for (const { tenant_id: tenantId } of tenants.rows) {
      try {
        await syncXeroItems(tenantId, false);
      } catch (err) {
        logger.error('Xero item sync failed for tenant', {
          tenant_id: tenantId,
          error: (err as Error).message,
        });
      }
    }

    logger.info('Nightly Xero item sync complete');
  } catch (err) {
    logger.error('Nightly Xero item sync failed', { error: (err as Error).message });
  }
}
