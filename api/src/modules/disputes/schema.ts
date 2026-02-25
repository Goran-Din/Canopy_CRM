import { z } from 'zod';

const disputeStatuses = [
  'open', 'under_review', 'resolved_credit', 'resolved_adjusted',
  'resolved_no_action', 'closed',
] as const;
const disputeReasons = [
  'service_not_performed', 'poor_quality', 'billing_error',
  'duplicate_charge', 'unauthorized_charge', 'other',
] as const;
const disputePriorities = ['low', 'normal', 'high'] as const;
const creditNoteStatuses = ['draft', 'approved', 'applied', 'voided'] as const;

// --- Dispute schemas ---

export const createDisputeSchema = z.object({
  invoice_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  reason: z.enum(disputeReasons),
  description: z.string().min(1, 'Description is required'),
  disputed_amount: z.coerce.number().min(0.01, 'Disputed amount must be positive'),
  priority: z.enum(disputePriorities).default('normal'),
  assigned_to: z.string().uuid().nullish(),
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

export const updateDisputeSchema = z.object({
  reason: z.enum(disputeReasons).optional(),
  description: z.string().min(1).optional(),
  disputed_amount: z.coerce.number().min(0.01).optional(),
  priority: z.enum(disputePriorities).optional(),
  assigned_to: z.string().uuid().nullish(),
  status: z.enum(['open', 'under_review'] as const).optional(),
});

export type UpdateDisputeInput = z.infer<typeof updateDisputeSchema>;

export const resolveDisputeSchema = z.object({
  status: z.enum(['resolved_credit', 'resolved_adjusted', 'resolved_no_action'] as const),
  resolution_notes: z.string().min(1, 'Resolution notes are required'),
  credit_amount: z.coerce.number().min(0.01).optional(),
  credit_reason: z.string().min(1).optional(),
});

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export const disputeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(disputeStatuses).optional(),
  customer_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  priority: z.enum(disputePriorities).optional(),
  assigned_to: z.string().uuid().optional(),
  sortBy: z.enum(['dispute_number', 'status', 'priority', 'disputed_amount', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type DisputeQuery = z.infer<typeof disputeQuerySchema>;

export const disputeParamsSchema = z.object({
  id: z.string().uuid('Invalid dispute ID'),
});

// --- Credit Note schemas ---

export const createCreditNoteSchema = z.object({
  invoice_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  reason: z.string().min(1, 'Reason is required'),
  dispute_id: z.string().uuid().nullish(),
});

export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;

export const creditNoteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(creditNoteStatuses).optional(),
  customer_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  sortBy: z.enum(['credit_note_number', 'amount', 'status', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreditNoteQuery = z.infer<typeof creditNoteQuerySchema>;

export const creditNoteParamsSchema = z.object({
  id: z.string().uuid('Invalid credit note ID'),
});
