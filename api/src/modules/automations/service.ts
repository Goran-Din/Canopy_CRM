import { logger } from '../../config/logger.js';
import * as repo from './repository.js';
import * as templateRepo from '../templates/repository.js';
import * as customerRepo from '../customers/repository.js';
import * as diaryRepo from '../jobs/diary/diary.repository.js';
import type { UpdateConfigInput, TestSendInput, ListLogsInput } from './schema.js';

const COMPANY_NAME = 'Sunset Services';
const COMPANY_PHONE = '(555) 123-4567';

// === Config Management ===

export async function listConfigs(tenantId: string) {
  return repo.getAllConfigs(tenantId);
}

export async function getConfig(tenantId: string, automationType: string) {
  return repo.getConfig(tenantId, automationType);
}

export async function updateConfig(
  tenantId: string,
  automationType: string,
  input: UpdateConfigInput,
  userId: string,
) {
  return repo.updateConfig(tenantId, automationType, {
    ...input,
    updated_by: userId,
  });
}

// === Log Management ===

export async function listLogs(tenantId: string, input: ListLogsInput) {
  return repo.findLogs(tenantId, {
    automation_type: input.automation_type,
    status: input.status,
    date_from: input.date_from,
    date_to: input.date_to,
    customer_id: input.customer_id,
    page: input.page,
    limit: input.limit,
  });
}

// === Core Engine ===

export interface AutomationContext {
  job_id?: string;
  customer_id?: string;
  property_id?: string;
  invoice_id?: string;
  quote_id?: string;
  scheduled_date?: string;
  signing_link?: string;
  amount?: number;
  due_date?: string;
  days_overdue?: number;
  // Resolved data (filled by the engine)
  customer?: Record<string, unknown>;
}

export async function fireAutomation(
  tenantId: string,
  automationType: string,
  context: AutomationContext,
): Promise<{ status: string; reason?: string }> {
  // 1. Get config: is it enabled?
  const config = await repo.getConfig(tenantId, automationType);
  if (!config || !config.is_enabled) {
    return { status: 'disabled' };
  }

  // 2. Check conditions JSONB
  if (config.conditions && Object.keys(config.conditions).length > 0) {
    // Condition matching would check division, job_type, etc.
    // For now, conditions are stored but not deeply evaluated
  }

  // 3. Deduplication
  const contextId = context.job_id || context.quote_id || context.invoice_id;
  const contextField = context.quote_id ? 'quote_id'
    : context.invoice_id ? 'invoice_id'
    : 'job_id';

  if (contextId) {
    // Payment reminders allow multiple fires (up to max_repeats)
    if (automationType === 'payment_reminder' && context.invoice_id) {
      const fireCount = await repo.countRecentFires(
        tenantId, automationType, context.invoice_id, 'invoice_id',
      );
      if (fireCount >= config.max_repeats) {
        await repo.insertLog({
          tenant_id: tenantId,
          automation_type: automationType,
          job_id: context.job_id,
          customer_id: context.customer_id,
          invoice_id: context.invoice_id,
          channel: 'email',
          status: 'skipped',
          failure_reason: `max_repeats_reached (${config.max_repeats})`,
          attempt_number: fireCount + 1,
        });
        return { status: 'skipped', reason: 'max_repeats_reached' };
      }
    } else {
      const alreadyFired = await repo.hasBeenFiredRecently(
        tenantId, automationType, contextId, contextField,
      );
      if (alreadyFired) {
        return { status: 'skipped', reason: 'already_fired' };
      }
    }
  }

  // 4. Get recipient contact info
  let recipientEmail: string | null = null;
  let recipientPhone: string | null = null;

  if (context.customer_id) {
    const customer = await customerRepo.findById(tenantId, context.customer_id);
    if (customer) {
      const c = customer as unknown as Record<string, unknown>;
      recipientEmail = (c.email as string) ?? null;
      recipientPhone = (c.phone as string) ?? null;
      context.customer = c;
    }
  }

  if (!recipientEmail && !recipientPhone) {
    await repo.insertLog({
      tenant_id: tenantId,
      automation_type: automationType,
      job_id: context.job_id,
      customer_id: context.customer_id,
      invoice_id: context.invoice_id,
      quote_id: context.quote_id,
      channel: config.send_via === 'sms' ? 'sms' : 'email',
      status: 'skipped',
      failure_reason: 'no_contact_info',
    });
    return { status: 'skipped', reason: 'no_contact_info' };
  }

  // 5. Get template content
  let subject = '';
  let body = '';

  if (config.template_id) {
    const template = await templateRepo.findById(config.template_id, tenantId);
    if (template) {
      const content = template.content as unknown as Record<string, unknown>;
      subject = (content.email_subject as string) ?? (content.subject as string) ?? '';
      body = (content.email_body as string) ?? '';
    }
  }

  // 6-7. Resolve merge fields
  subject = resolveMergeFields(subject, context);
  body = resolveMergeFields(body, context);

  // 8. Send message
  try {
    if (config.send_via === 'email' || config.send_via === 'both') {
      if (recipientEmail) {
        // In production: await resend.emails.send({ to: recipientEmail, subject, html: body })
        logger.info('Automation email sent', {
          automation_type: automationType,
          to: recipientEmail,
          subject,
        });
      }
    }
    if (config.send_via === 'sms' || config.send_via === 'both') {
      if (recipientPhone) {
        // In production: await smsProvider.send({ to: recipientPhone, body })
        logger.info('Automation SMS sent', {
          automation_type: automationType,
          to: recipientPhone,
        });
      }
    }

    // 9. Log result as sent
    const attemptCount = contextId && automationType === 'payment_reminder' && context.invoice_id
      ? await repo.countRecentFires(tenantId, automationType, context.invoice_id, 'invoice_id') + 1
      : 1;

    await repo.insertLog({
      tenant_id: tenantId,
      automation_type: automationType,
      job_id: context.job_id,
      customer_id: context.customer_id,
      invoice_id: context.invoice_id,
      quote_id: context.quote_id,
      channel: config.send_via === 'sms' ? 'sms' : 'email',
      recipient_email: recipientEmail,
      recipient_phone: recipientPhone,
      message_subject: subject,
      message_preview: body.substring(0, 500),
      status: 'sent',
      attempt_number: attemptCount,
    });

    // 10. Diary entry if job_id exists
    if (context.job_id) {
      try {
        await diaryRepo.insertStandalone({
          tenant_id: tenantId,
          job_id: context.job_id,
          entry_type: 'automation_fired',
          title: `Automation sent: ${automationType}`,
          metadata: {
            automation_type: automationType,
            channel: config.send_via,
            recipient_email: recipientEmail,
          },
          created_by_user_id: null,
          is_system_entry: true,
        });
      } catch {
        // Diary entry failure should not fail the automation
      }
    }

    return { status: 'sent' };
  } catch (err) {
    // Log as failed
    await repo.insertLog({
      tenant_id: tenantId,
      automation_type: automationType,
      job_id: context.job_id,
      customer_id: context.customer_id,
      invoice_id: context.invoice_id,
      quote_id: context.quote_id,
      channel: config.send_via === 'sms' ? 'sms' : 'email',
      recipient_email: recipientEmail,
      recipient_phone: recipientPhone,
      message_subject: subject,
      status: 'failed',
      failure_reason: (err as Error).message,
    });

    return { status: 'failed', reason: (err as Error).message };
  }
}

// === Trigger Handlers ===

export async function handleJobScheduled(tenantId: string, jobId: string) {
  // Import dynamically to avoid circular dependency
  const { queryDb } = await import('../../config/database.js');
  const jobResult = await queryDb<Record<string, unknown>>(
    `SELECT j.id, j.customer_id, j.property_id
     FROM jobs j WHERE j.id = $1 AND j.tenant_id = $2`,
    [jobId, tenantId],
  );
  const job = jobResult.rows[0];
  if (!job) return;

  await fireAutomation(tenantId, 'booking_confirmation', {
    job_id: jobId,
    customer_id: job.customer_id as string,
    property_id: job.property_id as string,
  });
}

export async function handleInvoicePaid(tenantId: string, invoiceId: string) {
  const { queryDb } = await import('../../config/database.js');
  const invoiceResult = await queryDb<Record<string, unknown>>(
    `SELECT i.id, i.customer_id FROM invoices i
     WHERE i.id = $1 AND i.tenant_id = $2`,
    [invoiceId, tenantId],
  );
  const invoice = invoiceResult.rows[0];
  if (!invoice) return;

  await fireAutomation(tenantId, 'feedback_request', {
    invoice_id: invoiceId,
    customer_id: invoice.customer_id as string,
  });
}

// === Merge Field Resolution ===

export function resolveMergeFields(
  template: string,
  context: AutomationContext,
): string {
  const customer = context.customer as unknown as Record<string, unknown> | undefined;

  const fields: Record<string, string> = {
    client_first_name: (customer?.first_name as string) ?? '',
    client_full_name: customer
      ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
      : '',
    company_name: COMPANY_NAME,
    company_phone: COMPANY_PHONE,
    job_number: '',
    property_address: '',
    scheduled_date: context.scheduled_date ?? '',
    signing_link: context.signing_link ?? '',
    invoice_amount: context.amount != null ? `$${context.amount.toFixed(2)}` : '',
    invoice_due_date: context.due_date ?? '',
    days_overdue: context.days_overdue != null ? String(context.days_overdue) : '',
  };

  let result = template;
  for (const [key, value] of Object.entries(fields)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// === Test Send ===

export async function sendTestMessage(
  tenantId: string,
  input: TestSendInput,
) {
  const config = await repo.getConfig(tenantId, input.automation_type);

  let subject = `[TEST] ${input.automation_type} automation`;
  let body = 'This is a test message from Canopy CRM automation engine.';

  if (config?.template_id) {
    const template = await templateRepo.findById(config.template_id, tenantId);
    if (template) {
      const content = template.content as unknown as Record<string, unknown>;
      subject = `[TEST] ${(content.email_subject as string) ?? (content.subject as string) ?? input.automation_type}`;
      body = (content.email_body as string) ?? body;
    }
  }

  // Resolve with sample data
  const sampleContext: AutomationContext = {
    customer: {
      first_name: 'John',
      last_name: 'Smith',
    },
    scheduled_date: '2026-04-15',
  };
  subject = resolveMergeFields(subject, sampleContext);
  body = resolveMergeFields(body, sampleContext);

  // Send test — do NOT log to automation_log
  logger.info('Test automation message sent', {
    automation_type: input.automation_type,
    to: input.recipient_email ?? input.recipient_phone,
    subject,
  });

  return {
    automation_type: input.automation_type,
    subject,
    body_preview: body.substring(0, 500),
    sent_to: input.recipient_email ?? input.recipient_phone ?? 'none',
  };
}
