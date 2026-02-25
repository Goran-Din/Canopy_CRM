import { z } from 'zod';

const invoiceStatuses = [
  'draft', 'pending', 'sent', 'viewed', 'paid',
  'partially_paid', 'overdue', 'disputed', 'cancelled', 'written_off',
] as const;
const paymentMethods = ['bank_transfer', 'check', 'credit_card', 'cash', 'other'] as const;
const xeroSyncStatuses = ['not_synced', 'pending', 'synced', 'error'] as const;
const divisionTypes = ['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'] as const;

// --- Line item sub-schema ---

const lineItemInputSchema = z.object({
  job_id: z.string().uuid().nullish(),
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().min(0).default(1),
  unit_price: z.coerce.number(),
  tax_rate: z.coerce.number().min(0).default(0),
  sort_order: z.coerce.number().int().default(0),
});

export type LineItemInput = z.infer<typeof lineItemInputSchema>;

// --- Invoice schemas ---

export const createInvoiceSchema = z.object({
  customer_id: z.string().uuid(),
  property_id: z.string().uuid().nullish(),
  contract_id: z.string().uuid().nullish(),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  tax_rate: z.coerce.number().min(0).default(0),
  discount_amount: z.coerce.number().min(0).default(0),
  currency: z.string().max(3).default('USD'),
  division: z.enum(divisionTypes).nullish(),
  billing_period_start: z.string().nullish(),
  billing_period_end: z.string().nullish(),
  notes: z.string().nullish(),
  internal_notes: z.string().nullish(),
  line_items: z.array(lineItemInputSchema).default([]),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = z.object({
  customer_id: z.string().uuid().optional(),
  property_id: z.string().uuid().nullish(),
  contract_id: z.string().uuid().nullish(),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  tax_rate: z.coerce.number().min(0).optional(),
  discount_amount: z.coerce.number().min(0).optional(),
  currency: z.string().max(3).optional(),
  division: z.enum(divisionTypes).nullish(),
  billing_period_start: z.string().nullish(),
  billing_period_end: z.string().nullish(),
  notes: z.string().nullish(),
  internal_notes: z.string().nullish(),
  updated_at: z.string().datetime().optional(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const invoiceStatusSchema = z.object({
  status: z.enum(invoiceStatuses),
});

export type InvoiceStatusInput = z.infer<typeof invoiceStatusSchema>;

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(invoiceStatuses).optional(),
  customer_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  contract_id: z.string().uuid().optional(),
  division: z.enum(divisionTypes).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  xero_sync_status: z.enum(xeroSyncStatuses).optional(),
  sortBy: z.enum(['invoice_number', 'invoice_date', 'due_date', 'total', 'status', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;

export const invoiceParamsSchema = z.object({
  id: z.string().uuid('Invalid invoice ID'),
});

// --- Line item schemas ---

export const addLineItemSchema = z.object({
  job_id: z.string().uuid().nullish(),
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().min(0).default(1),
  unit_price: z.coerce.number(),
  tax_rate: z.coerce.number().min(0).default(0),
  sort_order: z.coerce.number().int().default(0),
});

export type AddLineItemInput = z.infer<typeof addLineItemSchema>;

export const updateLineItemSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  quantity: z.coerce.number().min(0).optional(),
  unit_price: z.coerce.number().optional(),
  tax_rate: z.coerce.number().min(0).optional(),
  sort_order: z.coerce.number().int().optional(),
});

export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>;

export const lineItemParamsSchema = z.object({
  lineItemId: z.string().uuid('Invalid line item ID'),
});

// --- Payment schemas ---

export const recordPaymentSchema = z.object({
  payment_date: z.string(),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  payment_method: z.enum(paymentMethods),
  reference_number: z.string().max(100).nullish(),
  notes: z.string().nullish(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// --- Generate schemas ---

export const generateFromContractSchema = z.object({
  contract_id: z.string().uuid(),
  billing_period_start: z.string(),
  billing_period_end: z.string(),
  due_date: z.string().optional(),
  tax_rate: z.coerce.number().min(0).default(0),
});

export type GenerateFromContractInput = z.infer<typeof generateFromContractSchema>;

export const generateFromJobsSchema = z.object({
  job_ids: z.array(z.string().uuid()).min(1, 'At least one job ID required'),
  customer_id: z.string().uuid(),
  due_date: z.string().optional(),
  tax_rate: z.coerce.number().min(0).default(0),
});

export type GenerateFromJobsInput = z.infer<typeof generateFromJobsSchema>;
