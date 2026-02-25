import { z } from 'zod';

const subcontractorStatuses = ['active', 'inactive', 'blacklisted'] as const;
const rateTypes = ['hourly', 'per_job', 'per_visit', 'contract'] as const;

export const createSubcontractorSchema = z.object({
  company_name: z.string().max(255),
  contact_name: z.string().max(200).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().max(50).nullish(),
  mobile: z.string().max(50).nullish(),
  specialty: z.array(z.string()).nullish(),
  insurance_expiry: z.string().nullish(),
  license_number: z.string().max(100).nullish(),
  rate_type: z.enum(rateTypes).nullish(),
  default_rate: z.coerce.number().min(0).nullish(),
  rating: z.coerce.number().int().min(1).max(5).nullish(),
  notes: z.string().nullish(),
});

export type CreateSubcontractorInput = z.infer<typeof createSubcontractorSchema>;

export const updateSubcontractorSchema = createSubcontractorSchema.partial().extend({
  status: z.enum(subcontractorStatuses).optional(),
});

export type UpdateSubcontractorInput = z.infer<typeof updateSubcontractorSchema>;

export const subcontractorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(subcontractorStatuses).optional(),
  specialty: z.string().optional(),
  sortBy: z.enum(['company_name', 'contact_name', 'status', 'rating', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type SubcontractorQuery = z.infer<typeof subcontractorQuerySchema>;

export const subcontractorParamsSchema = z.object({
  id: z.string().uuid('Invalid subcontractor ID'),
});
