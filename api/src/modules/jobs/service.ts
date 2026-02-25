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
} from './schema.js';
import * as repo from './repository.js';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  unscheduled: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled', 'skipped'],
  in_progress: ['completed', 'cancelled'],
  completed: ['verified', 'in_progress'], // reopen
  verified: [],
  cancelled: ['unscheduled'], // re-open
  skipped: ['scheduled'],     // reschedule
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
