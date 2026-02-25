import { AppError } from '../../middleware/errorHandler.js';
import type { CreateEquipmentInput, UpdateEquipmentInput, EquipmentQuery } from './schema.js';
import * as repo from './repository.js';

export async function listEquipment(tenantId: string, query: EquipmentQuery) {
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

export async function getEquipment(tenantId: string, id: string) {
  const equipment = await repo.findById(tenantId, id);
  if (!equipment) {
    throw new AppError(404, 'Equipment not found');
  }
  return equipment;
}

export async function createEquipment(tenantId: string, input: CreateEquipmentInput, userId: string) {
  return repo.create(tenantId, input as Record<string, unknown>, userId);
}

export async function updateEquipment(tenantId: string, id: string, input: UpdateEquipmentInput, userId: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Equipment not found');
  }
  const updated = await repo.update(tenantId, id, input as Record<string, unknown>, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update equipment');
  }
  return updated;
}

export async function deleteEquipment(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Equipment not found');
  }
  return repo.softDelete(tenantId, id);
}
