import { z } from 'zod';

const prospectSources = ['mautic', 'website', 'referral', 'cold_call', 'trade_show', 'other'] as const;
const prospectStatuses = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost', 'dormant'] as const;

export const createProspectSchema = z.object({
  company_name: z.string().max(255).nullish(),
  first_name: z.string().max(100).nullish(),
  last_name: z.string().max(100).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().max(50).nullish(),
  mobile: z.string().max(50).nullish(),
  source: z.enum(prospectSources).nullish(),
  assigned_to: z.string().uuid().nullish(),
  estimated_value: z.coerce.number().min(0).nullish(),
  interest_services: z.array(z.string()).nullish(),
  address_line1: z.string().max(255).nullish(),
  city: z.string().max(100).nullish(),
  state: z.string().max(50).nullish(),
  zip: z.string().max(20).nullish(),
  notes: z.string().nullish(),
  next_follow_up_date: z.string().nullish(),
  mautic_contact_id: z.string().nullish(),
});

export type CreateProspectInput = z.infer<typeof createProspectSchema>;

export const updateProspectSchema = z.object({
  company_name: z.string().max(255).nullish(),
  first_name: z.string().max(100).nullish(),
  last_name: z.string().max(100).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().max(50).nullish(),
  mobile: z.string().max(50).nullish(),
  source: z.enum(prospectSources).nullish(),
  assigned_to: z.string().uuid().nullish(),
  estimated_value: z.coerce.number().min(0).nullish(),
  interest_services: z.array(z.string()).nullish(),
  address_line1: z.string().max(255).nullish(),
  city: z.string().max(100).nullish(),
  state: z.string().max(50).nullish(),
  zip: z.string().max(20).nullish(),
  notes: z.string().nullish(),
  next_follow_up_date: z.string().nullish(),
  last_contacted_at: z.string().nullish(),
  mautic_contact_id: z.string().nullish(),
});

export type UpdateProspectInput = z.infer<typeof updateProspectSchema>;

export const prospectStatusSchema = z.object({
  status: z.enum(prospectStatuses),
  lost_reason: z.string().nullish(),
});

export type ProspectStatusInput = z.infer<typeof prospectStatusSchema>;

export const prospectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(prospectStatuses).optional(),
  source: z.enum(prospectSources).optional(),
  assigned_to: z.string().uuid().optional(),
  sortBy: z.enum(['first_name', 'last_name', 'company_name', 'status', 'estimated_value', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ProspectQuery = z.infer<typeof prospectQuerySchema>;

export const prospectParamsSchema = z.object({
  id: z.string().uuid('Invalid prospect ID'),
});
