import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateJobInput,
  UpdateJobInput,
  JobStatusChangeInput,
  JobQuery,
  ScheduleQuery,
  CreatePhotoInput,
  CreateChecklistInput,
  UpdateChecklistInput,
  CreateJobV2Input,
} from './schema.js';
import * as repo from './repository.js';
import * as diaryRepo from './diary/diary.repository.js';
import * as automationService from '../automations/service.js';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  unscheduled: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled', 'skipped'],
  in_progress: ['completed', 'cancelled'],
  completed: ['verified', 'in_progress'], // reopen
  verified: [],
  cancelled: ['unscheduled'], // re-open
  skipped: ['scheduled'],     // reschedule
  // V2 creation-path statuses
  quote: ['unscheduled', 'cancelled'],
  assessment: ['unscheduled', 'cancelled'],
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function listJobs(tenantId: string, query: JobQuery) {
  const { rows, total } = await repo.findAll(tenantId, query);
  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getJob(tenantId: string, id: string) {
  const job = await repo.findById(tenantId, id);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }
  return job;
}

export async function createJob(
  tenantId: string,
  input: CreateJobInput,
  userId: string,
) {
  // Validate customer exists
  const customerOk = await repo.customerExists(tenantId, input.customer_id);
  if (!customerOk) {
    throw new AppError(404, 'Customer not found in this tenant');
  }

  // Validate property belongs to customer
  const propertyOk = await repo.propertyBelongsToCustomer(
    tenantId,
    input.property_id,
    input.customer_id,
  );
  if (!propertyOk) {
    throw new AppError(400, 'Property does not belong to this customer');
  }

  // Validate contract if provided
  if (input.contract_id) {
    const contractOk = await repo.contractExists(tenantId, input.contract_id);
    if (!contractOk) {
      throw new AppError(404, 'Contract not found in this tenant');
    }
  }

  return repo.create(tenantId, input, userId);
}

export async function updateJob(
  tenantId: string,
  id: string,
  input: UpdateJobInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Job not found');
  }

  // Validate customer if changing
  const effectiveCustomerId = input.customer_id || existing.customer_id;
  if (input.customer_id && input.customer_id !== existing.customer_id) {
    const customerOk = await repo.customerExists(tenantId, input.customer_id);
    if (!customerOk) {
      throw new AppError(404, 'Customer not found in this tenant');
    }
  }

  // Validate property if changing
  if (input.property_id && input.property_id !== existing.property_id) {
    const propertyOk = await repo.propertyBelongsToCustomer(
      tenantId,
      input.property_id,
      effectiveCustomerId,
    );
    if (!propertyOk) {
      throw new AppError(400, 'Property does not belong to this customer');
    }
  }

  const data: Record<string, unknown> = { ...input };
  const updated = await repo.update(tenantId, id, data, userId);
  if (!updated) {
    throw new AppError(409, 'Job was modified by another user. Please refresh and try again.');
  }
  return updated;
}

export async function changeJobStatus(
  tenantId: string,
  id: string,
  input: JobStatusChangeInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Job not found');
  }

  if (existing.status === input.status) {
    return existing;
  }

  if (!isValidTransition(existing.status, input.status)) {
    throw new AppError(
      400,
      `Cannot transition from '${existing.status}' to '${input.status}'`,
    );
  }

  // Record actual_start_time when moving to in_progress
  const extraFields: Record<string, unknown> = {};
  if (input.status === 'in_progress' && !existing.actual_start_time) {
    extraFields.actual_start_time = new Date().toISOString();
  }

  // Record actual_end_time and calculate duration when completed
  if (input.status === 'completed') {
    const now = new Date();
    extraFields.actual_end_time = now.toISOString();

    if (existing.actual_start_time) {
      const start = new Date(existing.actual_start_time);
      extraFields.actual_duration_minutes = Math.round(
        (now.getTime() - start.getTime()) / 60000,
      );
    }
  }

  const updated = await repo.updateStatus(
    tenantId,
    id,
    input.status,
    input.completion_notes || null,
    userId,
    Object.keys(extraFields).length > 0 ? extraFields : undefined,
  );
  if (!updated) {
    throw new AppError(500, 'Failed to update job status');
  }
  return updated;
}

export async function deleteJob(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Job not found');
  }

  if (existing.status !== 'unscheduled' && existing.status !== 'cancelled') {
    throw new AppError(
      409,
      `Cannot delete job with status '${existing.status}'. Only unscheduled or cancelled jobs can be deleted.`,
    );
  }

  return repo.softDelete(tenantId, id);
}

export async function getSchedule(tenantId: string, query: ScheduleQuery) {
  return repo.getByDateRange(tenantId, query);
}

export async function getJobsByProperty(tenantId: string, propertyId: string) {
  return repo.getByProperty(tenantId, propertyId);
}

// --- Photos ---

export async function addPhoto(
  tenantId: string,
  jobId: string,
  input: CreatePhotoInput,
  userId: string,
) {
  const job = await repo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }
  return repo.addPhoto(tenantId, jobId, input, userId);
}

export async function getPhotos(tenantId: string, jobId: string) {
  const job = await repo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }
  return repo.getPhotos(tenantId, jobId);
}

// --- Checklist ---

export async function addChecklistItem(
  tenantId: string,
  jobId: string,
  input: CreateChecklistInput,
) {
  const job = await repo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }
  return repo.addChecklistItem(tenantId, jobId, input);
}

export async function updateChecklistItem(
  tenantId: string,
  itemId: string,
  input: UpdateChecklistInput,
  userId: string,
) {
  const existing = await repo.getChecklistItemById(tenantId, itemId);
  if (!existing) {
    throw new AppError(404, 'Checklist item not found');
  }
  const updated = await repo.updateChecklistItem(tenantId, itemId, input, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update checklist item');
  }
  return updated;
}

export async function getChecklist(tenantId: string, jobId: string) {
  const job = await repo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }
  return repo.getChecklist(tenantId, jobId);
}

export async function getJobStats(tenantId: string) {
  return repo.getStats(tenantId);
}

// --- V2 Functions ---

function formatCreationPath(path: string): string {
  return path.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * V2 Job creation with job_number, creation_path, and mandatory diary entry.
 * All done in a single transaction.
 */
export async function createJobV2(
  tenantId: string,
  input: CreateJobV2Input,
  userId: string,
) {
  // Validate customer exists
  const customerOk = await repo.customerExists(tenantId, input.customer_id);
  if (!customerOk) {
    throw new AppError(404, 'Customer not found in this tenant');
  }

  // Validate property belongs to customer
  const propertyOk = await repo.propertyBelongsToCustomer(
    tenantId,
    input.property_id,
    input.customer_id,
  );
  if (!propertyOk) {
    throw new AppError(400, 'Property does not belong to this customer');
  }

  // Validate contract if provided
  if (input.contract_id) {
    const contractOk = await repo.contractExists(tenantId, input.contract_id);
    if (!contractOk) {
      throw new AppError(404, 'Contract not found in this tenant');
    }
  }

  // Determine initial status from creation path
  const status = input.creation_path === 'instant_work_order'
    ? 'unscheduled'
    : input.creation_path === 'assessment'
      ? 'assessment'
      : 'quote';

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    // Get next job number
    const currentYear = new Date().getFullYear();
    const jobNumber = await repo.getNextJobNumber(client, tenantId, currentYear);

    // Create job with V2 fields
    const job = await repo.createWithClient(client, tenantId, {
      ...input,
      status,
      job_number: jobNumber,
      creation_path: input.creation_path,
    }, userId);

    // Mandatory diary entry
    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: job.id,
      entry_type: 'job_created',
      title: `Job #${jobNumber} created as ${formatCreationPath(input.creation_path)}`,
      metadata: { creation_path: input.creation_path, created_by: userId },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    await client.query('COMMIT');
    return job;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * V2 Status change with mandatory diary entry in same transaction.
 */
export async function changeJobStatusV2(
  tenantId: string,
  id: string,
  input: JobStatusChangeInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Job not found');
  }

  if (existing.status === input.status) {
    return existing;
  }

  if (!isValidTransition(existing.status, input.status)) {
    throw new AppError(
      400,
      `Cannot transition from '${existing.status}' to '${input.status}'`,
    );
  }

  // Record actual_start_time when moving to in_progress
  const extraFields: Record<string, unknown> = {};
  if (input.status === 'in_progress' && !existing.actual_start_time) {
    extraFields.actual_start_time = new Date().toISOString();
  }

  // Record actual_end_time and calculate duration when completed
  if (input.status === 'completed') {
    const now = new Date();
    extraFields.actual_end_time = now.toISOString();

    if (existing.actual_start_time) {
      const start = new Date(existing.actual_start_time);
      extraFields.actual_duration_minutes = Math.round(
        (now.getTime() - start.getTime()) / 60000,
      );
    }
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const updated = await repo.updateStatusWithClient(
      client,
      tenantId,
      id,
      input.status,
      input.completion_notes || null,
      userId,
      Object.keys(extraFields).length > 0 ? extraFields : undefined,
    );

    if (!updated) {
      throw new AppError(500, 'Failed to update job status');
    }

    // Mandatory diary entry for status change
    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: id,
      entry_type: 'status_change',
      title: `Status changed: ${existing.status} → ${input.status}`,
      metadata: {
        from_status: existing.status,
        to_status: input.status,
        changed_by: userId,
      },
      created_by_user_id: userId,
      is_system_entry: true,
    });

    await client.query('COMMIT');

    // Fire booking confirmation automation when job becomes scheduled
    if (input.status === 'scheduled') {
      automationService.handleJobScheduled(tenantId, id).catch(() => {
        // Automation failure should not fail the status change
      });
    }

    // Canopy Quotes outbound webhooks (non-blocking)
    if (['scheduled', 'completed', 'cancelled'].includes(input.status)) {
      const statusMap: Record<string, string> = {
        scheduled: 'job_scheduled',
        completed: 'job_completed',
        cancelled: 'job_cancelled',
      };
      import('../integrations/canopy-quotes/webhook-dispatcher.js').then(({ dispatchStatusWebhook }) => {
        dispatchStatusWebhook(tenantId, id, statusMap[input.status]).catch(() => {});
      }).catch(() => {});
    }

    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Convert assessment job to work order.
 */
export async function convertToWorkOrder(
  tenantId: string,
  id: string,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Job not found');
  }

  if (existing.status !== 'assessment') {
    throw new AppError(400, 'Only assessment jobs can be converted to work orders');
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const updated = await repo.updateStatusWithClient(
      client,
      tenantId,
      id,
      'unscheduled',
      null,
      userId,
      { creation_path: 'instant_work_order' },
    );

    if (!updated) {
      throw new AppError(500, 'Failed to convert job');
    }

    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: id,
      entry_type: 'job_converted_to_wo',
      title: 'Converted from Assessment to Work Order',
      metadata: { converted_by: userId },
      created_by_user_id: userId,
      is_system_entry: true,
    });

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
