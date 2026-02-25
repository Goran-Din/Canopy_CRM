import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateMaterialInput,
  UpdateMaterialInput,
  MaterialQuery,
  CreateTransactionInput,
  TransactionQuery,
} from './schema.js';
import * as repo from './repository.js';

export async function listMaterials(tenantId: string, query: MaterialQuery) {
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

export async function getMaterial(tenantId: string, id: string) {
  const material = await repo.findById(tenantId, id);
  if (!material) {
    throw new AppError(404, 'Material not found');
  }
  return material;
}

export async function createMaterial(tenantId: string, input: CreateMaterialInput, userId: string) {
  return repo.create(tenantId, input as Record<string, unknown>, userId);
}

export async function updateMaterial(tenantId: string, id: string, input: UpdateMaterialInput, userId: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Material not found');
  }
  const updated = await repo.update(tenantId, id, input as Record<string, unknown>, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update material');
  }
  return updated;
}

export async function deleteMaterial(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Material not found');
  }
  return repo.softDelete(tenantId, id);
}

export async function recordTransaction(
  tenantId: string, materialId: string, input: CreateTransactionInput, userId: string,
) {
  const material = await repo.findById(tenantId, materialId);
  if (!material) {
    throw new AppError(404, 'Material not found');
  }

  // Calculate stock delta based on transaction type
  let delta: number;
  switch (input.transaction_type) {
    case 'purchase':
    case 'return':
      delta = input.quantity;
      break;
    case 'usage':
      delta = -input.quantity;
      if (material.current_stock + delta < 0) {
        throw new AppError(400, 'Insufficient stock for this usage');
      }
      break;
    case 'adjustment':
      delta = input.quantity; // positive or negative adjustment handled by sign
      break;
    default:
      delta = 0;
  }

  const transaction = await repo.recordTransaction(
    tenantId, materialId, input as Record<string, unknown>, userId,
  );

  await repo.adjustStock(tenantId, materialId, delta);

  return transaction;
}

export async function listTransactions(
  tenantId: string, materialId: string, query: TransactionQuery,
) {
  const material = await repo.findById(tenantId, materialId);
  if (!material) {
    throw new AppError(404, 'Material not found');
  }
  const { rows, total } = await repo.findTransactions(tenantId, materialId, query);
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

export async function getLowStock(tenantId: string) {
  return repo.getLowStockMaterials(tenantId);
}
