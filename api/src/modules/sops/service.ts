import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateQuery,
  CreateStepInput,
  UpdateStepInput,
  ReorderStepsInput,
  CreateAssignmentInput,
  AssignmentQuery,
  AssignmentStatusInput,
  CompleteStepInput,
} from './schema.js';
import * as repo from './repository.js';

// ======== Templates ========

export async function listTemplates(tenantId: string, query: TemplateQuery) {
  const { rows, total } = await repo.findAllTemplates(tenantId, query);
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

export async function getTemplate(tenantId: string, id: string) {
  const template = await repo.findTemplateById(tenantId, id);
  if (!template) {
    throw new AppError(404, 'Template not found');
  }
  return template;
}

export async function createTemplate(tenantId: string, input: CreateTemplateInput, userId: string) {
  return repo.createTemplate(tenantId, input as Record<string, unknown>, userId);
}

export async function updateTemplate(tenantId: string, id: string, input: UpdateTemplateInput, userId: string) {
  const existing = await repo.findTemplateById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Template not found');
  }

  // Only draft templates can be freely edited
  if (existing.status !== 'draft') {
    // Allow status changes (e.g. active→archived) but not content changes
    const contentKeys = Object.keys(input).filter(k => k !== 'status');
    if (contentKeys.length > 0) {
      throw new AppError(400, 'Only draft templates can be edited. Duplicate the template to create a new version.');
    }
  }

  const updated = await repo.updateTemplate(tenantId, id, input as Record<string, unknown>, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update template');
  }
  return updated;
}

export async function deleteTemplate(tenantId: string, id: string) {
  const existing = await repo.findTemplateById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Template not found');
  }
  return repo.softDeleteTemplate(tenantId, id);
}

export async function duplicateTemplate(tenantId: string, id: string, userId: string) {
  const existing = await repo.findTemplateById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Template not found');
  }
  return repo.duplicateTemplate(tenantId, id, userId);
}

// ======== Steps ========

export async function addStep(tenantId: string, templateId: string, input: CreateStepInput, userId: string) {
  const template = await repo.findTemplateById(tenantId, templateId);
  if (!template) {
    throw new AppError(404, 'Template not found');
  }
  if (template.status !== 'draft') {
    throw new AppError(400, 'Steps can only be added to draft templates');
  }
  return repo.createStep(tenantId, templateId, input as Record<string, unknown>);
}

export async function updateStep(tenantId: string, stepId: string, input: UpdateStepInput, userId: string) {
  const step = await repo.findStepById(tenantId, stepId);
  if (!step) {
    throw new AppError(404, 'Step not found');
  }

  // Check template is draft
  const template = await repo.findTemplateById(tenantId, step.template_id);
  if (template && template.status !== 'draft') {
    throw new AppError(400, 'Steps can only be edited on draft templates');
  }

  const updated = await repo.updateStep(tenantId, stepId, input as Record<string, unknown>);
  if (!updated) {
    throw new AppError(500, 'Failed to update step');
  }
  return updated;
}

export async function deleteStep(tenantId: string, stepId: string) {
  const step = await repo.findStepById(tenantId, stepId);
  if (!step) {
    throw new AppError(404, 'Step not found');
  }

  const template = await repo.findTemplateById(tenantId, step.template_id);
  if (template && template.status !== 'draft') {
    throw new AppError(400, 'Steps can only be deleted from draft templates');
  }

  return repo.softDeleteStep(tenantId, stepId);
}

export async function reorderSteps(tenantId: string, templateId: string, input: ReorderStepsInput, userId: string) {
  const template = await repo.findTemplateById(tenantId, templateId);
  if (!template) {
    throw new AppError(404, 'Template not found');
  }
  if (template.status !== 'draft') {
    throw new AppError(400, 'Steps can only be reordered on draft templates');
  }
  return repo.reorderSteps(tenantId, templateId, input.step_ids);
}

// ======== Assignments ========

export async function listAssignments(tenantId: string, query: AssignmentQuery) {
  const { rows, total } = await repo.findAllAssignments(tenantId, query);
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

export async function getAssignment(tenantId: string, id: string) {
  const assignment = await repo.findAssignmentById(tenantId, id);
  if (!assignment) {
    throw new AppError(404, 'Assignment not found');
  }
  return assignment;
}

export async function createAssignment(tenantId: string, input: CreateAssignmentInput, userId: string) {
  // Only active templates can be assigned
  const template = await repo.findTemplateById(tenantId, input.template_id);
  if (!template) {
    throw new AppError(404, 'Template not found');
  }
  if (template.status !== 'active') {
    throw new AppError(400, 'Only active templates can be assigned');
  }

  const assignment = await repo.createAssignment(tenantId, input as Record<string, unknown>, userId);

  // Create step completion records for all template steps
  const steps = await repo.findStepsByTemplateId(tenantId, input.template_id);
  if (steps.length > 0) {
    await repo.createStepCompletions(tenantId, assignment.id, steps);
  }

  return assignment;
}

export async function updateAssignmentStatus(
  tenantId: string, id: string, input: AssignmentStatusInput, userId: string,
) {
  const existing = await repo.findAssignmentById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Assignment not found');
  }

  const updated = await repo.updateAssignmentStatus(tenantId, id, input.status, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update assignment status');
  }
  return updated;
}

// ======== Step Completions ========

export async function completeStep(
  tenantId: string, assignmentId: string, stepId: string,
  input: CompleteStepInput, userId: string,
) {
  const assignment = await repo.findAssignmentById(tenantId, assignmentId);
  if (!assignment) {
    throw new AppError(404, 'Assignment not found');
  }

  const completion = await repo.findStepCompletion(tenantId, assignmentId, stepId);
  if (!completion) {
    throw new AppError(404, 'Step completion record not found');
  }

  const updated = await repo.completeStep(
    tenantId, assignmentId, stepId, userId, input as Record<string, unknown>,
  );
  if (!updated) {
    throw new AppError(500, 'Failed to complete step');
  }
  return updated;
}
