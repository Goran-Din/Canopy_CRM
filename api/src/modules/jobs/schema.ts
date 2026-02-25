import { z } from 'zod';

const jobTypes = ['scheduled_service', 'one_time', 'emergency', 'inspection', 'estimate'] as const;
const jobStatuses = ['unscheduled', 'scheduled', 'in_progress', 'completed', 'verified', 'cancelled', 'skipped'] as const;
const jobPriorities = ['low', 'normal', 'high', 'urgent'] as const;
const photoTypes = ['before', 'during', 'after', 'issue'] as const;
const divisionTypes = ['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'] as const;

// --- Job schemas ---

export const createJobSchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID').nullish(),
  customer_id: z.string().uuid('Invalid customer ID'),
  property_id: z.string().uuid('Invalid property ID'),
  division: z.enum(divisionTypes),
  job_type: z.enum(jobTypes).default('scheduled_service'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().nullish(),
  scheduled_date: z.string().nullish(),
  scheduled_start_time: z.string().nullish(),
  estimated_duration_minutes: z.coerce.number().int().min(0).nullish(),
  priority: z.enum(jobPriorities).default('normal'),
  assigned_crew_id: z.string().uuid().nullish(),
  assigned_to: z.string().uuid().nullish(),
  notes: z.string().nullish(),
  requires_photos: z.boolean().default(false),
  weather_condition: z.string().max(100).nullish(),
  tags: z.array(z.string()).default([]),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = z.object({
  contract_id: z.string().uuid().nullish(),
  customer_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  division: z.enum(divisionTypes).optional(),
  job_type: z.enum(jobTypes).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullish(),
  scheduled_date: z.string().nullish(),
  scheduled_start_time: z.string().nullish(),
  estimated_duration_minutes: z.coerce.number().int().min(0).nullish(),
  priority: z.enum(jobPriorities).optional(),
  assigned_crew_id: z.string().uuid().nullish(),
  assigned_to: z.string().uuid().nullish(),
  notes: z.string().nullish(),
  completion_notes: z.string().nullish(),
  requires_photos: z.boolean().optional(),
  weather_condition: z.string().max(100).nullish(),
  tags: z.array(z.string()).optional(),
  updated_at: z.string().datetime().optional(),
});

export type UpdateJobInput = z.infer<typeof updateJobSchema>;

export const jobStatusChangeSchema = z.object({
  status: z.enum(jobStatuses),
  completion_notes: z.string().nullish(),
});

export type JobStatusChangeInput = z.infer<typeof jobStatusChangeSchema>;

export const jobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(jobStatuses).optional(),
  division: z.enum(divisionTypes).optional(),
  customer_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  contract_id: z.string().uuid().optional(),
  assigned_crew_id: z.string().uuid().optional(),
  priority: z.enum(jobPriorities).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  sortBy: z
    .enum(['title', 'scheduled_date', 'created_at', 'updated_at', 'status', 'priority'])
    .default('scheduled_date'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type JobQuery = z.infer<typeof jobQuerySchema>;

export const scheduleQuerySchema = z.object({
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  division: z.enum(divisionTypes).optional(),
  assigned_crew_id: z.string().uuid().optional(),
});

export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;

export const jobParamsSchema = z.object({
  id: z.string().uuid('Invalid job ID'),
});

export const propertyParamsSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
});

export const checklistItemParamsSchema = z.object({
  itemId: z.string().uuid('Invalid checklist item ID'),
});

// --- Photo schemas ---

export const createPhotoSchema = z.object({
  photo_url: z.string().url('Invalid photo URL'),
  photo_type: z.enum(photoTypes).default('after'),
  caption: z.string().max(255).nullish(),
});

export type CreatePhotoInput = z.infer<typeof createPhotoSchema>;

// --- Checklist schemas ---

export const createChecklistSchema = z.object({
  description: z.string().min(1, 'Description is required').max(255),
  sort_order: z.coerce.number().int().default(0),
});

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;

export const updateChecklistSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  is_completed: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});

export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
