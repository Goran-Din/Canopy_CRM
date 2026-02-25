import { AppError } from '../../middleware/errorHandler.js';
import type { CreateSubcontractorInput, UpdateSubcontractorInput, SubcontractorQuery } from './schema.js';
import * as repo from './repository.js';

export async function listSubcontractors(tenantId: string, query: SubcontractorQuery) {
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

export async function getSubcontractor(tenantId: string, id: string) {
  const sub = await repo.findById(tenantId, id);
  if (!sub) {
    throw new AppError(404, 'Subcontractor not found');
  }
  return sub;
}

export async function createSubcontractor(tenantId: string, input: CreateSubcontractorInput, userId: string) {
  return repo.create(tenantId, input as Record<string, unknown>, userId);
}

export async function updateSubcontractor(tenantId: string, id: string, input: UpdateSubcontractorInput, userId: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Subcontractor not found');
  }
  const updated = await repo.update(tenantId, id, input as Record<string, unknown>, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update subcontractor');
  }
  return updated;
}

export async function deleteSubcontractor(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Subcontractor not found');
  }
  return repo.softDelete(tenantId, id);
}
