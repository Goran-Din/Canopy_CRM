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

// ============================================
// Wave 7 Brief 05 — GPS Analytics (R-GPS-01 .. 04)
// API uses "crew_member_id" but underlying gps_events column is `user_id`.
// ============================================

export const propertyVisitHistoryQuerySchema = z.object({
  property_id: z.string().uuid(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  crew_member_id: z.string().uuid().optional(),
  verified_only: z.coerce.boolean().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type PropertyVisitHistoryQuery = z.infer<typeof propertyVisitHistoryQuerySchema>;

export const payrollCrossCheckQuerySchema = z.object({
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  user_id: z.string().uuid().optional(),
  status: z.enum(['flagged', 'reviewed', 'consistent']).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type PayrollCrossCheckQuery = z.infer<typeof payrollCrossCheckQuerySchema>;

export const resolveCrossCheckSchema = z.object({
  note: z.string().min(1).max(1000),
});

export type ResolveCrossCheckInput = z.infer<typeof resolveCrossCheckSchema>;

export const gpsEventIdParamsSchema = z.object({
  gps_event_id: z.string().uuid('Invalid gps event id'),
});

export const serviceVerificationQuerySchema = z.object({
  season_year: z.coerce.number().int().min(2020).max(2100).default(currentYear),
  service_code: z.string().optional(),
  tier: z.enum(serviceTierFull).optional(),
  verification: z.enum(['verified', 'unverified', 'no_gps']).optional(),
  crew_member_id: z.string().uuid().optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export type ServiceVerificationQuery = z.infer<typeof serviceVerificationQuerySchema>;

export const routePerformanceQuerySchema = z.object({
  season_year: z.coerce.number().int().min(2020).max(2100).default(currentYear),
  division: z.string().optional(),
  crew_id: z.string().uuid().optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  min_visit_count: z.coerce.number().int().min(1).default(3),
  format: z.enum(['json', 'csv']).default('json'),
});

export type RoutePerformanceQuery = z.infer<typeof routePerformanceQuerySchema>;
