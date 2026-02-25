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
