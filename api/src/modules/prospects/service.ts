import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateProspectInput,
  UpdateProspectInput,
  ProspectStatusInput,
  ProspectQuery,
} from './schema.js';
import * as repo from './repository.js';

export async function listProspects(tenantId: string, query: ProspectQuery) {
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

export async function getProspect(tenantId: string, id: string) {
  const prospect = await repo.findById(tenantId, id);
  if (!prospect) {
    throw new AppError(404, 'Prospect not found');
  }
  return prospect;
}

export async function createProspect(
  tenantId: string,
  input: CreateProspectInput,
  userId: string,
) {
  return repo.create(tenantId, input as Record<string, unknown>, userId);
}

export async function updateProspect(
  tenantId: string,
  id: string,
  input: UpdateProspectInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Prospect not found');
  }
  const updated = await repo.update(tenantId, id, input as Record<string, unknown>, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update prospect');
  }
  return updated;
}

export async function changeStatus(
  tenantId: string,
  id: string,
  input: ProspectStatusInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Prospect not found');
  }

  if (input.status === 'lost' && !input.lost_reason) {
    throw new AppError(400, 'Lost reason is required when setting status to lost');
  }

  const extra: Record<string, unknown> = {};
  if (input.status === 'lost' && input.lost_reason) {
    extra.lost_reason = input.lost_reason;
  }

  // Won → convert prospect to customer
  if (input.status === 'won' && !existing.converted_customer_id) {
    const customerId = await repo.createCustomerFromProspect(tenantId, existing, userId);
    extra.converted_customer_id = customerId;
  }

  const updated = await repo.updateStatus(
    tenantId, id, input.status, userId,
    Object.keys(extra).length > 0 ? extra : undefined,
  );
  if (!updated) {
    throw new AppError(500, 'Failed to update status');
  }
  return updated;
}

export async function deleteProspect(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Prospect not found');
  }
  return repo.softDelete(tenantId, id);
}

export async function getPipelineStats(tenantId: string) {
  return repo.getPipelineStats(tenantId);
}
