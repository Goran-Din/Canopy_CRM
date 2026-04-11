import { logger } from '../config/logger.js';
import { queryDb } from '../config/database.js';
import { pushBronzeUpsellFlag } from '../modules/integrations/mautic/mautic-service.js';

/**
 * Bronze upsell detection and Mautic push.
 * Cron: 0 4 1 * * (4:00 AM UTC on 1st of each month)
 *
 * Setup in index.ts:
 *   import cron from 'node-cron';
 *   import { runBronzeUpsellDetection } from './cron/mautic-bronze-upsell.js';
 *   cron.schedule('0 4 1 * *', runBronzeUpsellDetection);
 */
export async function runBronzeUpsellDetection() {
  if (process.env.MAUTIC_ENABLED !== 'true') return;

  logger.info('Running Bronze upsell detection cron');

  try {
    const tenants = await queryDb<{ tenant_id: string }>(
      `SELECT DISTINCT tenant_id FROM integration_configs
       WHERE provider = 'mautic' AND status = 'active'`,
    );

    let pushed = 0;
    for (const { tenant_id: tenantId } of tenants.rows) {
      const bronzeCustomers = await queryDb<{ id: string }>(
        `SELECT DISTINCT c.id FROM customers c
         JOIN service_contracts sc ON sc.customer_id = c.id AND sc.tenant_id = c.tenant_id
         WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
           AND sc.service_tier = 'bronze' AND sc.deleted_at IS NULL`,
        [tenantId],
      );

      for (const customer of bronzeCustomers.rows) {
        try {
          await pushBronzeUpsellFlag(tenantId, customer.id);
          pushed++;
        } catch (err) {
          logger.error('Bronze upsell push failed', {
            customer_id: customer.id, error: (err as Error).message,
          });
        }
      }
    }

    logger.info('Bronze upsell detection complete', { pushed });
  } catch (err) {
    logger.error('Bronze upsell cron failed', { error: (err as Error).message });
  }
}
