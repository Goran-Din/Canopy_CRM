import { logger } from '../../../config/logger.js';
import { queryDb } from '../../../config/database.js';
import { CanopyQuotesClient } from './quotes-client.js';

const RETRY_DELAYS_MS = [30_000, 120_000, 600_000]; // 30s, 2min, 10min

/**
 * Dispatch a status webhook to Canopy Quotes.
 * NON-BLOCKING — CRM operations always complete regardless of delivery.
 */
export async function dispatchStatusWebhook(
  tenantId: string,
  jobId: string,
  status: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    // Get job — check if it came from Canopy Quotes
    const jobResult = await queryDb<Record<string, unknown>>(
      `SELECT id, job_number, source_quote_number, source_system
       FROM jobs WHERE id = $1 AND tenant_id = $2`,
      [jobId, tenantId],
    );
    const job = jobResult.rows[0];
    if (!job || !job.source_quote_number || job.source_system !== 'canopy_quotes') {
      return; // Not a Canopy Quotes job — skip
    }

    // Get integration config
    const configResult = await queryDb<Record<string, unknown>>(
      `SELECT config_data, status AS config_status FROM integration_configs
       WHERE tenant_id = $1 AND provider = 'canopy_quotes' AND status = 'active'`,
      [tenantId],
    );
    const config = configResult.rows[0];
    if (!config) return; // Not configured

    const configData = config.config_data as Record<string, unknown>;
    const baseUrl = configData.webhook_url as string;
    const apiKey = configData.api_key as string;
    if (!baseUrl || !apiKey) return;

    const client = new CanopyQuotesClient({ baseUrl, apiKey });
    const payload = {
      source_quote_number: job.source_quote_number as string,
      crm_job_id: job.id as string,
      job_number: job.job_number as string,
      status,
      updated_at: new Date().toISOString(),
      details,
    };

    // Try with retries
    let success = false;
    let lastError = '';

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
      }

      const result = await client.sendStatusWebhook(payload);
      if (result.success) {
        success = true;
        break;
      }
      lastError = result.error ?? 'Unknown error';
    }

    // Log result
    await queryDb(
      `INSERT INTO integration_sync_log
       (tenant_id, provider, direction, entity_type, entity_id, external_id, status, error_message)
       VALUES ($1, 'canopy_quotes', 'outbound', $2, $3, $4, $5, $6)`,
      [
        tenantId,
        `webhook.${status}`,
        jobId,
        job.source_quote_number,
        success ? 'success' : 'failed',
        success ? null : lastError,
      ],
    );

    if (!success) {
      logger.error('Canopy Quotes webhook delivery failed after retries', {
        job_id: jobId, status, error: lastError,
      });
    }
  } catch (err) {
    logger.error('Canopy Quotes webhook dispatch error', { error: (err as Error).message });
  }
}
