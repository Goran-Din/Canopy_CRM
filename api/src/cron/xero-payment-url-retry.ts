import { logger } from '../config/logger.js';
import { queryDb } from '../config/database.js';
import { findMissingPaymentUrls, retrievePaymentUrl } from '../modules/integrations/xero/xero-payment-url.js';

/**
 * Retry missing payment URLs.
 * Cron: 0 3 * * * (daily at 3:00 AM UTC)
 *
 * Setup in index.ts:
 *   import cron from 'node-cron';
 *   import { retryMissingPaymentUrls } from './cron/xero-payment-url-retry.js';
 *   cron.schedule('0 3 * * *', retryMissingPaymentUrls);
 */
export async function retryMissingPaymentUrls() {
  logger.info('Running payment URL retry cron');

  try {
    // Get active tenants with Xero connected
    const tenants = await queryDb<{ tenant_id: string }>(
      `SELECT DISTINCT tenant_id FROM integration_configs
       WHERE provider = 'xero' AND status = 'active'`,
    );

    let total = 0;
    let retrieved = 0;

    for (const { tenant_id: tenantId } of tenants.rows) {
      const missing = await findMissingPaymentUrls(tenantId);
      total += missing.length;

      for (const inv of missing) {
        const url = await retrievePaymentUrl(
          tenantId,
          inv.xero_invoice_id as string,
          inv.id as string,
        );
        if (url) retrieved++;
      }
    }

    logger.info('Payment URL retry cron complete', { total, retrieved });
  } catch (err) {
    logger.error('Payment URL retry cron failed', { error: (err as Error).message });
  }
}
