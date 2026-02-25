import { z } from 'zod';

const seasonStatuses = ['planning', 'active', 'completed', 'archived'] as const;
const runStatuses = ['planned', 'in_progress', 'completed', 'cancelled'] as const;
const triggerTypes = ['snowfall', 'ice', 'pretreat', 'emergency', 'scheduled'] as const;
const entryStatuses = ['pending', 'in_progress', 'completed', 'skipped', 'issue_reported'] as const;
const serviceTypes = ['plow', 'salt', 'sand', 'shovel', 'pretreat', 'ice_melt', 'combination'] as const;

// --- Season schemas ---

export const createSeasonSchema = z.object({
  season_name: z.string().min(1).max(100),
  start_date: z.string(),
  end_date: z.string(),
  status: z.enum(seasonStatuses).default('planning'),
  default_trigger_inches: z.coerce.number().min(0).default(2.0),
  notes: z.string().nullish(),
});

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;

export const updateSeasonSchema = z.object({
  season_name: z.string().min(1).max(100).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(seasonStatuses).optional(),
  default_trigger_inches: z.coerce.number().min(0).optional(),
  notes: z.string().nullish(),
});

export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;

export const seasonQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(seasonStatuses).optional(),
  sortBy: z.enum(['season_name', 'start_date', 'status', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type SeasonQuery = z.infer<typeof seasonQuerySchema>;

export const seasonParamsSchema = z.object({
  id: z.string().uuid('Invalid season ID'),
});

// --- Run schemas ---

export const createRunSchema = z.object({
  season_id: z.string().uuid(),
  run_date: z.string(),
  trigger_type: z.enum(triggerTypes),
  snowfall_inches: z.coerce.number().min(0).nullish(),
  temperature_f: z.coerce.number().nullish(),
  weather_notes: z.string().nullish(),
  notes: z.string().nullish(),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;

export const updateRunSchema = z.object({
  run_date: z.string().optional(),
  trigger_type: z.enum(triggerTypes).optional(),
  snowfall_inches: z.coerce.number().min(0).nullish(),
  temperature_f: z.coerce.number().nullish(),
  weather_notes: z.string().nullish(),
  start_time: z.string().nullish(),
  end_time: z.string().nullish(),
  notes: z.string().nullish(),
});

export type UpdateRunInput = z.infer<typeof updateRunSchema>;

export const runStatusSchema = z.object({
  status: z.enum(runStatuses),
});

export type RunStatusInput = z.infer<typeof runStatusSchema>;

export const runQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  season_id: z.string().uuid().optional(),
  status: z.enum(runStatuses).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  sortBy: z.enum(['run_number', 'run_date', 'status', 'created_at']).default('run_date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type RunQuery = z.infer<typeof runQuerySchema>;

export const runParamsSchema = z.object({
  id: z.string().uuid('Invalid run ID'),
});

// --- Entry schemas ---

export const createEntrySchema = z.object({
  property_id: z.string().uuid(),
  contract_id: z.string().uuid().nullish(),
  crew_id: z.string().uuid().nullish(),
  service_type: z.enum(serviceTypes).default('combination'),
  notes: z.string().nullish(),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const updateEntrySchema = z.object({
  crew_id: z.string().uuid().nullish(),
  service_type: z.enum(serviceTypes).optional(),
  arrival_time: z.string().nullish(),
  departure_time: z.string().nullish(),
  notes: z.string().nullish(),
  issue_description: z.string().nullish(),
  photos_url: z.array(z.string()).nullish(),
});

export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export const entryStatusSchema = z.object({
  status: z.enum(entryStatuses),
});

export type EntryStatusInput = z.infer<typeof entryStatusSchema>;

export const entryParamsSchema = z.object({
  entryId: z.string().uuid('Invalid entry ID'),
});

// Combined params for /v1/snow/runs/:id/entries (run ID in path)
export const runEntryParamsSchema = z.object({
  id: z.string().uuid('Invalid run ID'),
});
