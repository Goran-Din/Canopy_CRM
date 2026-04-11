import { z } from 'zod';

export const quoteStatuses = [
  'draft', 'sent', 'viewed', 'signed', 'expired', 'superseded', 'converted', 'declined',
] as const;

// --- Quote ---

export const createQuoteSchema = z.object({
  valid_until: z.coerce.date().optional(),
  client_notes: z.string().max(5000).optional(),
  payment_terms: z.string().max(2000).optional(),
  internal_notes: z.string().max(5000).optional(),
  tax_enabled: z.boolean().default(false),
  tax_rate: z.coerce.number().min(0).max(1).default(0),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const updateQuoteSchema = z.object({
  client_notes: z.string().max(5000).optional(),
  payment_terms: z.string().max(2000).optional(),
  internal_notes: z.string().max(5000).optional(),
  valid_until: z.coerce.date().optional(),
  tax_enabled: z.boolean().optional(),
  tax_rate: z.coerce.number().min(0).max(1).optional(),
  discount_amount: z.coerce.number().min(0).optional(),
});

export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

// --- Section ---

export const addSectionSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().max(5000).optional(),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type AddSectionInput = z.infer<typeof addSectionSchema>;

export const updateSectionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  body: z.string().max(5000).optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
});

export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

// --- Line Item ---

export const addLineItemSchema = z.object({
  xero_item_id: z.string().uuid().optional(),
  item_name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().max(50).default('each'),
  unit_price: z.coerce.number().min(0), // ALWAYS manually entered
  is_taxable: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type AddLineItemInput = z.infer<typeof addLineItemSchema>;

export const updateLineItemSchema = z.object({
  item_name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().max(50).optional(),
  unit_price: z.coerce.number().min(0).optional(),
  is_taxable: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
});

export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>;

// --- PDF & Send ---

export const generatePdfSchema = z.object({
  auto_send: z.boolean().default(false),
  send_via: z.enum(['email', 'sms', 'both']).default('email'),
});

export type GeneratePdfInput = z.infer<typeof generatePdfSchema>;

export const sendQuoteSchema = z.object({
  send_via: z.enum(['email', 'sms', 'both']),
  recipient_email: z.string().email().optional(),
  recipient_phone: z.string().optional(),
});

export type SendQuoteInput = z.infer<typeof sendQuoteSchema>;

// --- Xero Item Search ---

export const xeroItemSearchSchema = z.object({
  search: z.string().min(1).max(100),
});

export type XeroItemSearchInput = z.infer<typeof xeroItemSearchSchema>;

// --- Param Schemas ---

export const jobIdParamsSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
});

export const quoteIdParamsSchema = z.object({
  id: z.string().uuid('Invalid quote ID'),
});

export const sectionParamsSchema = z.object({
  quoteId: z.string().uuid('Invalid quote ID'),
  sectionId: z.string().uuid('Invalid section ID'),
});

export const sectionItemParamsSchema = z.object({
  quoteId: z.string().uuid('Invalid quote ID'),
  sectionId: z.string().uuid('Invalid section ID'),
});

export const lineItemParamsSchema = z.object({
  quoteId: z.string().uuid('Invalid quote ID'),
  sectionId: z.string().uuid('Invalid section ID'),
  itemId: z.string().uuid('Invalid item ID'),
});

// --- Send Quote ---

export const sendQuoteV2Schema = z.object({
  channel: z.enum(['email', 'sms', 'both']),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  message_override: z.string().max(500).optional(),
});

export type SendQuoteV2Input = z.infer<typeof sendQuoteV2Schema>;

// --- Resend Quote ---

export const resendQuoteSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export type ResendQuoteInput = z.infer<typeof resendQuoteSchema>;

// --- Convert to Invoice ---

export const convertToInvoiceSchema = z.object({
  adjustments: z.array(z.object({
    line_item_id: z.string().uuid(),
    quantity: z.coerce.number().positive().optional(),
    unit_price: z.coerce.number().min(0).optional(),
    remove: z.boolean().optional(),
  })).optional(),
  due_days: z.coerce.number().int().positive().default(30),
});

export type ConvertToInvoiceInput = z.infer<typeof convertToInvoiceSchema>;

// --- Load Template ---

export const loadTemplateSchema = z.object({
  template_id: z.string().uuid(),
});

export type LoadTemplateInput = z.infer<typeof loadTemplateSchema>;

// --- Save as Template ---

export const saveAsTemplateSchema = z.object({
  template_name: z.string().min(1).max(200),
  tags: z.array(z.string()).optional(),
});

export type SaveAsTemplateInput = z.infer<typeof saveAsTemplateSchema>;

// --- Decline Quote ---

export const declineQuoteSchema = z.object({
  decline_reason: z.string().max(500).optional(),
});

export type DeclineQuoteInput = z.infer<typeof declineQuoteSchema>;

// --- Xero Items GET ---

export const xeroItemsGetSchema = z.object({
  search: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
