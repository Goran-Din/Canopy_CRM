import { z } from 'zod';

const contractTypes = ['maintenance', 'landscape_project', 'snow_removal', 'hardscape'] as const;
const contractStatuses = ['draft', 'pending_approval', 'active', 'on_hold', 'completed', 'cancelled', 'expired'] as const;
const billingFrequencies = ['per_visit', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'project_complete', 'per_event'] as const;
const divisionTypes = ['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'] as const;

// --- Line item schemas ---

export const createLineItemSchema = z.object({
  service_name: z.string().min(1, 'Service name is required').max(255),
  description: z.string().nullish(),
  quantity: z.coerce.number().min(0).default(1),
  unit_price: z.coerce.number().min(0),
  frequency: z.enum(billingFrequencies).nullish(),
  division: z.enum(divisionTypes).nullish(),
  sort_order: z.coerce.number().int().default(0),
});

export type CreateLineItemInput = z.infer<typeof createLineItemSchema>;

export const updateLineItemSchema = z.object({
  service_name: z.string().min(1).max(255).optional(),
  description: z.string().nullish(),
  quantity: z.coerce.number().min(0).optional(),
  unit_price: z.coerce.number().min(0).optional(),
  frequency: z.enum(billingFrequencies).nullish(),
  division: z.enum(divisionTypes).nullish(),
  sort_order: z.coerce.number().int().optional(),
});

export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>;

// --- Contract schemas ---

export const createContractSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  property_id: z.string().uuid('Invalid property ID'),
  contract_type: z.enum(contractTypes),
  division: z.enum(divisionTypes),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().nullish(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().nullish(),
  billing_frequency: z.enum(billingFrequencies).default('monthly'),
  contract_value: z.coerce.number().min(0).nullish(),
  recurring_amount: z.coerce.number().min(0).nullish(),
  auto_renew: z.boolean().default(false),
  renewal_increase_percent: z.coerce.number().min(0).max(100).default(0),
  signed_date: z.string().nullish(),
  signed_by: z.string().max(255).nullish(),
  notes: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  xero_repeating_invoice_id: z.string().max(255).nullish(),
  line_items: z.array(createLineItemSchema).default([]),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID').optional(),
  property_id: z.string().uuid('Invalid property ID').optional(),
  contract_type: z.enum(contractTypes).optional(),
  division: z.enum(divisionTypes).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullish(),
  start_date: z.string().optional(),
  end_date: z.string().nullish(),
  billing_frequency: z.enum(billingFrequencies).optional(),
  contract_value: z.coerce.number().min(0).nullish(),
  recurring_amount: z.coerce.number().min(0).nullish(),
  auto_renew: z.boolean().optional(),
  renewal_increase_percent: z.coerce.number().min(0).max(100).optional(),
  signed_date: z.string().nullish(),
  signed_by: z.string().max(255).nullish(),
  notes: z.string().nullish(),
  tags: z.array(z.string()).optional(),
  xero_repeating_invoice_id: z.string().max(255).nullish(),
  updated_at: z.string().datetime().optional(),
});

export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(contractStatuses),
});

export type StatusChangeInput = z.infer<typeof statusChangeSchema>;

export const contractQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(contractStatuses).optional(),
  type: z.enum(contractTypes).optional(),
  division: z.enum(divisionTypes).optional(),
  customer_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  sortBy: z
    .enum(['title', 'contract_number', 'created_at', 'updated_at', 'status', 'start_date', 'contract_value'])
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ContractQuery = z.infer<typeof contractQuerySchema>;

export const contractParamsSchema = z.object({
  id: z.string().uuid('Invalid contract ID'),
});

export const lineItemParamsSchema = z.object({
  lineItemId: z.string().uuid('Invalid line item ID'),
});
