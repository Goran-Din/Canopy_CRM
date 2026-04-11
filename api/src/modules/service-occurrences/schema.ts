import { z } from 'zod';

const occurrenceStatuses = ['pending', 'assigned', 'completed', 'skipped'] as const;

export const generateOccurrencesSchema = z.object({
  season_year: z.coerce.number().int().min(2024).max(2030),
});

export type GenerateOccurrencesInput = z.infer<typeof generateOccurrencesSchema>;

export const assignOccurrenceSchema = z.object({
  assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional(),
});

export type AssignOccurrenceInput = z.infer<typeof assignOccurrenceSchema>;

export const bulkAssignSchema = z.object({
  occurrence_ids: z.array(z.string().uuid()).min(1).max(200),
  assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional(),
});

export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;

export const skipOccurrenceSchema = z.object({
  skipped_reason: z.string().min(1).max(255),
  skipped_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recovery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type SkipOccurrenceInput = z.infer<typeof skipOccurrenceSchema>;

export const occurrenceQuerySchema = z.object({
  season_year: z.coerce.number().int().optional(),
  service_code: z.string().optional(),
  status: z.enum(occurrenceStatuses).optional(),
  contract_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type OccurrenceQuery = z.infer<typeof occurrenceQuerySchema>;

export const serviceListQuerySchema = z.object({
  season_year: z.coerce.number().int().default(new Date().getFullYear()),
});

export type ServiceListQuery = z.infer<typeof serviceListQuerySchema>;

export const serviceDetailQuerySchema = z.object({
  occurrence_number: z.coerce.number().int().min(1),
  season_year: z.coerce.number().int().default(new Date().getFullYear()),
});

export type ServiceDetailQuery = z.infer<typeof serviceDetailQuerySchema>;

export const occurrenceIdParamsSchema = z.object({
  id: z.string().uuid('Invalid occurrence ID'),
});

export const contractIdParamsSchema = z.object({
  contractId: z.string().uuid('Invalid contract ID'),
});

export const serviceCodeParamsSchema = z.object({
  serviceCode: z.string().min(1).max(100),
});
