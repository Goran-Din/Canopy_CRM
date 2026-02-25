import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  StageChangeInput,
  ProjectQuery,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from './schema.js';
import * as repo from './repository.js';

// ======== PROJECTS ========

export async function listProjects(tenantId: string, query: ProjectQuery) {
  const { rows, total } = await repo.findAllProjects(tenantId, query);
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

export async function getProject(tenantId: string, id: string) {
  const project = await repo.findProjectById(tenantId, id);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }
  return project;
}

export async function createProject(
  tenantId: string,
  input: CreateProjectInput,
  userId: string,
) {
  const projectNumber = await repo.generateProjectNumber(tenantId);

  const data = {
    ...input,
    project_number: projectNumber,
  };

  const project = await repo.createProject(tenantId, data, userId);

  // Record initial stage
  await repo.recordStageChange(tenantId, project.id, null, 'lead', userId);

  return project;
}

export async function updateProject(
  tenantId: string,
  id: string,
  input: UpdateProjectInput,
  userId: string,
) {
  const existing = await repo.findProjectById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Project not found');
  }

  const updated = await repo.updateProject(tenantId, id, input as Record<string, unknown>, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update project');
  }
  return updated;
}

export async function changeStage(
  tenantId: string,
  id: string,
  input: StageChangeInput,
  userId: string,
) {
  const existing = await repo.findProjectById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Project not found');
  }

  if (existing.status === input.stage) {
    return existing;
  }

  // Lost requires loss_reason
  if (input.stage === 'lost' && !input.loss_reason) {
    throw new AppError(400, 'Loss reason is required when setting stage to lost');
  }

  const extraFields: Record<string, unknown> = {};

  // Auto-set actual_end_date on completed
  if (input.stage === 'completed' && !existing.actual_end_date) {
    extraFields.actual_end_date = new Date().toISOString().split('T')[0];
  }

  // Set actual_value on approved if provided
  if (input.stage === 'approved' && input.actual_value !== undefined && input.actual_value !== null) {
    extraFields.actual_value = input.actual_value;
  }

  // Set loss_reason if lost
  if (input.stage === 'lost' && input.loss_reason) {
    extraFields.loss_reason = input.loss_reason;
  }

  // Set actual_start_date on in_progress
  if (input.stage === 'in_progress' && !existing.actual_start_date) {
    extraFields.actual_start_date = new Date().toISOString().split('T')[0];
  }

  const updated = await repo.updateStage(
    tenantId, id, input.stage, userId,
    Object.keys(extraFields).length > 0 ? extraFields : undefined,
  );
  if (!updated) {
    throw new AppError(500, 'Failed to update stage');
  }

  // Record stage change history
  await repo.recordStageChange(tenantId, id, existing.status, input.stage, userId, input.notes ?? undefined);

  return updated;
}

export async function deleteProject(tenantId: string, id: string) {
  const existing = await repo.findProjectById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Project not found');
  }
  return repo.softDeleteProject(tenantId, id);
}

// ======== MILESTONES ========

export async function listMilestones(tenantId: string, projectId: string) {
  const project = await repo.findProjectById(tenantId, projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }
  return repo.findMilestonesByProjectId(tenantId, projectId);
}

export async function addMilestone(
  tenantId: string,
  projectId: string,
  input: CreateMilestoneInput,
  userId: string,
) {
  const project = await repo.findProjectById(tenantId, projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  return repo.createMilestone(tenantId, projectId, input as Record<string, unknown>);
}

export async function updateMilestone(
  tenantId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
  userId: string,
) {
  const existing = await repo.findMilestoneById(tenantId, milestoneId);
  if (!existing) {
    throw new AppError(404, 'Milestone not found');
  }

  const updated = await repo.updateMilestone(tenantId, milestoneId, input as Record<string, unknown>);
  if (!updated) {
    throw new AppError(500, 'Failed to update milestone');
  }
  return updated;
}

// ======== STAGE HISTORY ========

export async function getStageHistory(tenantId: string, projectId: string) {
  const project = await repo.findProjectById(tenantId, projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }
  return repo.getStageHistory(tenantId, projectId);
}

// ======== PIPELINE STATS ========

export async function getPipelineStats(tenantId: string) {
  return repo.getPipelineStats(tenantId);
}
