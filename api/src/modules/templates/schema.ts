import { z } from 'zod';

export const templateCategories = ['quote', 'contract', 'email', 'automation'] as const;
export const automationTypes = [
  'booking_confirmation', 'appointment_reminder', 'quote_followup',
  'payment_reminder', 'feedback_request',
] as const;
export const channels = ['email', 'sms', 'both'] as const;

// --- Create Template ---

export const createTemplateSchema = z.object({
  template_category: z.enum(templateCategories),
  template_name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().default(true),
  is_system: z.boolean().default(false),
  content: z.record(z.unknown()),
  channel: z.enum(channels).optional(),
  automation_type: z.enum(automationTypes).optional(),
  tags: z.array(z.string().max(100)).default([]),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

// --- Update Template ---

export const updateTemplateSchema = z.object({
  template_name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().optional(),
  content: z.record(z.unknown()).optional(),
  channel: z.enum(channels).optional(),
  automation_type: z.enum(automationTypes).optional(),
  tags: z.array(z.string().max(100)).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// --- List Templates ---

export const listTemplatesSchema = z.object({
  template_category: z.enum(templateCategories).optional(),
  is_active: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  automation_type: z.enum(automationTypes).optional(),
  tags: z.string().optional(), // comma-separated
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;

// --- Load Template Into Quote ---

export const loadTemplateSchema = z.object({
  template_id: z.string().uuid(),
});

export type LoadTemplateInput = z.infer<typeof loadTemplateSchema>;

// --- Save From Quote ---

export const saveFromQuoteSchema = z.object({
  quote_id: z.string().uuid(),
  template_name: z.string().min(1).max(255),
  tags: z.array(z.string().max(100)).default([]),
});

export type SaveFromQuoteInput = z.infer<typeof saveFromQuoteSchema>;

// --- Update Automation Config ---

export const updateAutomationConfigSchema = z.object({
  content: z.record(z.unknown()),
  channel: z.enum(channels).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateAutomationConfigInput = z.infer<typeof updateAutomationConfigSchema>;

// --- Param Schemas ---

export const templateIdParamsSchema = z.object({
  id: z.string().uuid('Invalid template ID'),
});

export const quoteIdParamsSchema = z.object({
  id: z.string().uuid('Invalid quote ID'),
});

export const automationTypeParamsSchema = z.object({
  type: z.enum(automationTypes),
});
