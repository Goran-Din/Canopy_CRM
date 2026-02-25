import { AppError } from '../../middleware/errorHandler.js';
import type { CreateSeasonalInput, UpdateSeasonalInput, UpdateChecklistInput, SeasonalQuery } from './schema.js';
import * as repo from './repository.js';
import type { ChecklistItem } from './repository.js';

export async function listTransitions(tenantId: string, query: SeasonalQuery) {
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

export async function getTransition(tenantId: string, id: string) {
  const transition = await repo.findById(tenantId, id);
  if (!transition) {
    throw new AppError(404, 'Seasonal transition not found');
  }
  return transition;
}

export async function createTransition(tenantId: string, input: CreateSeasonalInput, userId: string) {
  return repo.create(tenantId, input, userId);
}

export async function updateTransition(
  tenantId: string,
  id: string,
  input: UpdateSeasonalInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Seasonal transition not found');
  }

  const updated = await repo.update(tenantId, id, input, userId);
  if (!updated) {
    throw new AppError(409, 'Failed to update transition');
  }
  return updated;
}

export async function updateChecklist(
  tenantId: string,
  id: string,
  input: UpdateChecklistInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Seasonal transition not found');
  }

  const checklist: ChecklistItem[] = input.checklist;

  // Auto-complete status when all checklist items are done
  const allCompleted = checklist.length > 0 && checklist.every((item) => item.completed);

  const updated = await repo.updateChecklist(tenantId, id, checklist, userId);
  if (!updated) {
    throw new AppError(409, 'Failed to update checklist');
  }

  // Auto-set status to completed if all items are done
  if (allCompleted && updated.status !== 'completed') {
    const completed = await repo.update(
      tenantId,
      id,
      { status: 'completed', completed_date: new Date().toISOString().split('T')[0] },
      userId,
    );
    return completed || updated;
  }

  return updated;
}

export async function deleteTransition(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Seasonal transition not found');
  }
  return repo.softDelete(tenantId, id);
}
