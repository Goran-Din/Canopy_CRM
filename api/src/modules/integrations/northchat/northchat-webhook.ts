import { logger } from '../../../config/logger.js';
import { queryDb } from '../../../config/database.js';
import { AppError } from '../../../middleware/errorHandler.js';

export interface NorthChatWebhookPayload {
  northchat_thread_id: string;
  customer_email?: string;
  customer_phone?: string;
  customer_name?: string;
  thread_url: string;
  thread_summary?: string;
  job_id?: string;
  job_number?: string;
}

export async function handleNorthChatWebhook(
  tenantId: string,
  payload: NorthChatWebhookPayload,
) {
  // V1: Customer thread linking
  let customerId: string | null = null;

  if (payload.customer_email) {
    const result = await queryDb<Record<string, unknown>>(
      `SELECT c.id FROM customers c
       JOIN contacts ct ON ct.customer_id = c.id
       WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
         AND LOWER(ct.email) = LOWER($2)
       LIMIT 1`,
      [tenantId, payload.customer_email],
    );
    customerId = (result.rows[0]?.id as string) ?? null;
  }

  if (!customerId && payload.customer_phone) {
    const digits = payload.customer_phone.replace(/\D/g, '').slice(-10);
    if (digits.length === 10) {
      const result = await queryDb<Record<string, unknown>>(
        `SELECT c.id FROM customers c
         JOIN contacts ct ON ct.customer_id = c.id
         WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
           AND RIGHT(REGEXP_REPLACE(ct.phone, '[^0-9]', '', 'g'), 10) = $2
         LIMIT 1`,
        [tenantId, digits],
      );
      customerId = (result.rows[0]?.id as string) ?? null;
    }
  }

  // V2: Job linking
  let jobId: string | null = null;

  if (payload.job_id) {
    const result = await queryDb<Record<string, unknown>>(
      `SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [payload.job_id, tenantId],
    );
    if (!result.rows[0]) {
      throw new AppError(404, 'Job not found');
    }
    jobId = result.rows[0].id as string;
  } else if (payload.job_number) {
    const result = await queryDb<Record<string, unknown>>(
      `SELECT id FROM jobs WHERE job_number = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [payload.job_number, tenantId],
    );
    if (!result.rows[0]) {
      throw new AppError(404, 'Job not found');
    }
    jobId = result.rows[0].id as string;
  }

  // Idempotency checks
  if (jobId) {
    const dupCheck = await queryDb<Record<string, unknown>>(
      `SELECT id FROM job_diary_entries
       WHERE job_id = $1 AND tenant_id = $2
         AND entry_type = 'northchat_thread_linked'
         AND metadata->>'northchat_thread_id' = $3
       LIMIT 1`,
      [jobId, tenantId, payload.northchat_thread_id],
    );
    if (dupCheck.rows[0]) {
      throw new AppError(409, 'Thread already linked to this job');
    }
  }

  // Create job diary entry if job is linked
  if (jobId) {
    const body = `Thread: ${payload.thread_url}${payload.thread_summary ? `\n${payload.thread_summary}` : ''}`;

    await queryDb(
      `INSERT INTO job_diary_entries
       (tenant_id, job_id, entry_type, title, body, metadata, is_system_entry)
       VALUES ($1, $2, 'northchat_thread_linked', 'NorthChat conversation linked', $3, $4, TRUE)`,
      [
        tenantId,
        jobId,
        body,
        JSON.stringify({
          northchat_thread_id: payload.northchat_thread_id,
          thread_url: payload.thread_url,
          customer_id: customerId,
        }),
      ],
    );

    // Log to sync log
    await queryDb(
      `INSERT INTO integration_sync_log
       (tenant_id, provider, direction, entity_type, entity_id, external_id, status)
       VALUES ($1, 'northchat', 'inbound', 'thread.job_linked', $2, $3, 'success')`,
      [tenantId, jobId, payload.northchat_thread_id],
    );
  }

  // V1: Log customer thread link
  if (customerId && !jobId) {
    await queryDb(
      `INSERT INTO integration_sync_log
       (tenant_id, provider, direction, entity_type, entity_id, external_id, status)
       VALUES ($1, 'northchat', 'inbound', 'thread.customer_linked', $2, $3, 'success')`,
      [tenantId, customerId, payload.northchat_thread_id],
    );
  }

  logger.info('NorthChat webhook processed', {
    thread_id: payload.northchat_thread_id,
    customer_id: customerId,
    job_id: jobId,
  });

  return {
    status: 'linked',
    customer_id: customerId,
    job_id: jobId,
  };
}

export async function lookupJob(tenantId: string, jobNumber: string) {
  const result = await queryDb<Record<string, unknown>>(
    `SELECT id, job_number, status, customer_id
     FROM jobs
     WHERE job_number = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [jobNumber, tenantId],
  );

  if (!result.rows[0]) {
    throw new AppError(404, 'Job not found');
  }

  const job = result.rows[0];
  return {
    crm_job_id: job.id,
    job_number: job.job_number,
    status: job.status,
    customer_id: job.customer_id,
  };
}
