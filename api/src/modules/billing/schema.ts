import { z } from 'zod';

export const generateDraftsSchema = z.object({
  billing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type GenerateDraftsInput = z.infer<typeof generateDraftsSchema>;

export const updateDraftSchema = z.object({
  line_items: z.array(z.object({
    xero_item_code: z.string().optional(),
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unit_price: z.coerce.number().min(0),
    line_total: z.coerce.number().min(0),
    is_taxable: z.boolean().default(false),
  })).optional(),
  subtotal: z.coerce.number().min(0).optional(),
  total_amount: z.coerce.number().min(0).optional(),
  description: z.string().max(5000).optional(),
});

export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;

export const rejectDraftSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export type RejectDraftInput = z.infer<typeof rejectDraftSchema>;

export const draftQuerySchema = z.object({
  status: z.enum(['pending_review', 'reviewed', 'approved', 'rejected', 'pushed_to_xero']).optional(),
  customer_id: z.string().uuid().optional(),
  contract_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type DraftQuery = z.infer<typeof draftQuerySchema>;

export const scheduleQuerySchema = z.object({
  contract_id: z.string().uuid().optional(),
  status: z.enum(['scheduled', 'draft', 'approved', 'skipped']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;

export const draftIdParamsSchema = z.object({
  id: z.string().uuid('Invalid draft ID'),
});

export const milestoneIdParamsSchema = z.object({
  id: z.string().uuid('Invalid milestone ID'),
});

export const jobIdParamsSchema = z.object({
  id: z.string().uuid('Invalid job ID'),
});

// --- Milestones ---

const milestoneEntrySchema = z.object({
  milestone_name: z.string().min(1).max(255),
  milestone_description: z.string().max(2000).optional(),
  amount_type: z.enum(['fixed', 'percentage']),
  amount_value: z.coerce.number().positive(),
  sort_order: z.coerce.number().int().min(0).default(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const setupMilestonesSchema = z.object({
  project_total: z.coerce.number().positive(),
  milestones: z.array(milestoneEntrySchema).min(1),
});

export type SetupMilestonesInput = z.infer<typeof setupMilestonesSchema>;

export const addMilestoneSchema = milestoneEntrySchema;

export type AddMilestoneInput = z.infer<typeof addMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  milestone_name: z.string().min(1).max(255).optional(),
  milestone_description: z.string().max(2000).optional(),
  amount_type: z.enum(['fixed', 'percentage']).optional(),
  amount_value: z.coerce.number().positive().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

export const cancelMilestoneSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export type CancelMilestoneInput = z.infer<typeof cancelMilestoneSchema>;

export const recalculateMilestonesSchema = z.object({
  project_total: z.coerce.number().positive(),
});

export type RecalculateMilestonesInput = z.infer<typeof recalculateMilestonesSchema>;
