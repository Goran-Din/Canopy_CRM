import { z } from 'zod';

const sopCategories = [
  'lawn_care', 'snow_removal', 'hardscape', 'safety',
  'equipment', 'customer_service', 'quality_check', 'seasonal', 'other',
] as const;
const sopStatuses = ['draft', 'active', 'archived'] as const;
const divisionTypes = ['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'] as const;
const assignmentStatuses = ['pending', 'in_progress', 'completed', 'skipped'] as const;

// ======== Templates ========

export const createTemplateSchema = z.object({
  title: z.string().max(255),
  description: z.string().nullish(),
  category: z.enum(sopCategories).default('other'),
  division: z.enum(divisionTypes).nullish(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().nullish(),
  category: z.enum(sopCategories).optional(),
  division: z.enum(divisionTypes).nullish(),
  status: z.enum(sopStatuses).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const templateQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  category: z.enum(sopCategories).optional(),
  division: z.enum(divisionTypes).optional(),
  status: z.enum(sopStatuses).optional(),
  sortBy: z.enum(['title', 'category', 'status', 'version', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type TemplateQuery = z.infer<typeof templateQuerySchema>;

export const templateParamsSchema = z.object({
  id: z.string().uuid('Invalid template ID'),
});

// ======== Steps ========

export const createStepSchema = z.object({
  title: z.string().max(255),
  description: z.string().nullish(),
  estimated_minutes: z.coerce.number().int().min(1).nullish(),
  requires_photo: z.boolean().default(false),
  requires_signature: z.boolean().default(false),
});

export type CreateStepInput = z.infer<typeof createStepSchema>;

export const updateStepSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().nullish(),
  estimated_minutes: z.coerce.number().int().min(1).nullish(),
  requires_photo: z.boolean().optional(),
  requires_signature: z.boolean().optional(),
});

export type UpdateStepInput = z.infer<typeof updateStepSchema>;

export const stepParamsSchema = z.object({
  stepId: z.string().uuid('Invalid step ID'),
});

export const reorderStepsSchema = z.object({
  step_ids: z.array(z.string().uuid()).min(1),
});

export type ReorderStepsInput = z.infer<typeof reorderStepsSchema>;

// ======== Assignments ========

export const createAssignmentSchema = z.object({
  template_id: z.string().uuid(),
  job_id: z.string().uuid().nullish(),
  crew_id: z.string().uuid().nullish(),
  assigned_date: z.string().optional(),
  notes: z.string().nullish(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const assignmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  job_id: z.string().uuid().optional(),
  crew_id: z.string().uuid().optional(),
  status: z.enum(assignmentStatuses).optional(),
  template_id: z.string().uuid().optional(),
  sortBy: z.enum(['assigned_date', 'status', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type AssignmentQuery = z.infer<typeof assignmentQuerySchema>;

export const assignmentParamsSchema = z.object({
  id: z.string().uuid('Invalid assignment ID'),
});

export const assignmentStatusSchema = z.object({
  status: z.enum(assignmentStatuses),
});

export type AssignmentStatusInput = z.infer<typeof assignmentStatusSchema>;

// ======== Step Completions ========

export const completeStepParamsSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID'),
  stepId: z.string().uuid('Invalid step ID'),
});

export const completeStepSchema = z.object({
  photo_url: z.string().nullish(),
  notes: z.string().nullish(),
});

export type CompleteStepInput = z.infer<typeof completeStepSchema>;
