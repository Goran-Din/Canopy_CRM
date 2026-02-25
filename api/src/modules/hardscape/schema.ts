import { z } from 'zod';

const projectStatuses = [
  'lead', 'estimate_scheduled', 'estimate_sent', 'negotiation',
  'approved', 'in_progress', 'on_hold', 'completed', 'cancelled', 'lost',
] as const;
const projectTypes = [
  'patio', 'retaining_wall', 'walkway', 'driveway',
  'fire_pit', 'outdoor_kitchen', 'full_landscape', 'other',
] as const;
const sources = ['referral', 'website', 'mautic', 'walk_in', 'repeat_customer', 'other'] as const;
const milestoneStatuses = ['pending', 'in_progress', 'completed', 'skipped'] as const;
const paymentStatuses = ['not_due', 'invoiced', 'paid'] as const;

// --- Project schemas ---

export const createProjectSchema = z.object({
  customer_id: z.string().uuid(),
  property_id: z.string().uuid(),
  contract_id: z.string().uuid().nullish(),
  title: z.string().min(1).max(255),
  description: z.string().nullish(),
  estimated_value: z.coerce.number().min(0).nullish(),
  estimated_start_date: z.string().nullish(),
  estimated_end_date: z.string().nullish(),
  project_type: z.enum(projectTypes).default('other'),
  assigned_to: z.string().uuid().nullish(),
  source: z.enum(sources).nullish(),
  notes: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  customer_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  contract_id: z.string().uuid().nullish(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullish(),
  estimated_value: z.coerce.number().min(0).nullish(),
  actual_value: z.coerce.number().min(0).nullish(),
  estimated_start_date: z.string().nullish(),
  actual_start_date: z.string().nullish(),
  estimated_end_date: z.string().nullish(),
  actual_end_date: z.string().nullish(),
  project_type: z.enum(projectTypes).optional(),
  assigned_to: z.string().uuid().nullish(),
  source: z.enum(sources).nullish(),
  notes: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const stageChangeSchema = z.object({
  stage: z.enum(projectStatuses),
  notes: z.string().nullish(),
  loss_reason: z.string().nullish(),
  actual_value: z.coerce.number().min(0).nullish(),
});

export type StageChangeInput = z.infer<typeof stageChangeSchema>;

export const projectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(projectStatuses).optional(),
  project_type: z.enum(projectTypes).optional(),
  assigned_to: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  source: z.enum(sources).optional(),
  value_min: z.coerce.number().min(0).optional(),
  value_max: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['project_number', 'title', 'status', 'estimated_value', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ProjectQuery = z.infer<typeof projectQuerySchema>;

export const projectParamsSchema = z.object({
  id: z.string().uuid('Invalid project ID'),
});

// --- Milestone schemas ---

export const createMilestoneSchema = z.object({
  milestone_name: z.string().min(1).max(255),
  description: z.string().nullish(),
  due_date: z.string().nullish(),
  sort_order: z.coerce.number().int().default(0),
  payment_amount: z.coerce.number().min(0).nullish(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  milestone_name: z.string().min(1).max(255).optional(),
  description: z.string().nullish(),
  due_date: z.string().nullish(),
  completed_date: z.string().nullish(),
  status: z.enum(milestoneStatuses).optional(),
  sort_order: z.coerce.number().int().optional(),
  payment_amount: z.coerce.number().min(0).nullish(),
  payment_status: z.enum(paymentStatuses).optional(),
});

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

export const milestoneParamsSchema = z.object({
  milestoneId: z.string().uuid('Invalid milestone ID'),
});
