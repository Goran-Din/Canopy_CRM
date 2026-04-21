import { z } from 'zod';

const divisions = ['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'] as const;

export const reportQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  division: z.enum(divisions).optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const revenueByCustomerQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type RevenueByCustomerQuery = z.infer<typeof revenueByCustomerQuerySchema>;

export const contractRenewalQuerySchema = z.object({
  days_ahead: z.coerce.number().int().min(1).max(365).default(90),
});

export type ContractRenewalQuery = z.infer<typeof contractRenewalQuerySchema>;

export const snowProfitQuerySchema = z.object({
  season_id: z.string().uuid().optional(),
});

export type SnowProfitQuery = z.infer<typeof snowProfitQuerySchema>;

export const materialUsageQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export type MaterialUsageQuery = z.infer<typeof materialUsageQuerySchema>;

// ============================================
// Wave 7 Brief 04 — I-5 Service Package Analytics (R-PKG-01 .. 04)
// ============================================

const serviceTierLandscapeOnly = ['gold', 'silver'] as const;
const serviceTierFull = ['gold', 'silver', 'bronze'] as const;

const currentYear = new Date().getFullYear();

export const seasonCompletionQuerySchema = z.object({
  season_year: z.coerce.number().int().min(2020).max(2100).default(currentYear),
  division: z.enum(['landscaping_maintenance', 'landscaping_projects']).optional(),
  tier: z.enum(serviceTierLandscapeOnly).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type SeasonCompletionQuery = z.infer<typeof seasonCompletionQuerySchema>;

export const occurrenceStatusQuerySchema = z.object({
  service_code: z.string().min(1),
  occurrence_number: z.coerce.number().int().min(1).optional(),
  season_year: z.coerce.number().int().min(2020).max(2100).default(currentYear),
  status: z.enum(['pending', 'assigned', 'completed', 'skipped']).optional(),
  category: z.string().optional(),
  crew_id: z.string().uuid().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type OccurrenceStatusQuery = z.infer<typeof occurrenceStatusQuerySchema>;

export const skippedVisitsQuerySchema = z.object({
  season_year: z.coerce.number().int().min(2020).max(2100).default(currentYear),
  tier: z.enum(serviceTierFull).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type SkippedVisitsQuery = z.infer<typeof skippedVisitsQuerySchema>;

export const tierPerformanceQuerySchema = z.object({
  season_year: z.coerce.number().int().min(2020).max(2100).default(currentYear),
  format: z.enum(['json', 'csv']).default('json'),
});

export type TierPerformanceQuery = z.infer<typeof tierPerformanceQuerySchema>;

