import { z } from 'zod';

const transitionTypes = ['spring_startup', 'fall_cleanup', 'winter_prep', 'spring_to_summer', 'summer_to_fall'] as const;
const transitionStatuses = ['planned', 'in_progress', 'completed'] as const;

const checklistItemSchema = z.object({
  task: z.string().min(1),
  completed: z.boolean().default(false),
  completed_by: z.string().uuid().nullish(),
  completed_at: z.string().datetime().nullish(),
});

export const createSeasonalSchema = z.object({
  transition_type: z.enum(transitionTypes),
  season_year: z.number().int().min(2000).max(2100),
  status: z.enum(transitionStatuses).default('planned'),
  scheduled_date: z.string().min(1, 'Scheduled date is required'),
  checklist: z.array(checklistItemSchema).default([]),
  notes: z.string().nullish(),
});

export type CreateSeasonalInput = z.infer<typeof createSeasonalSchema>;

export const updateSeasonalSchema = z.object({
  transition_type: z.enum(transitionTypes).optional(),
  season_year: z.number().int().min(2000).max(2100).optional(),
  status: z.enum(transitionStatuses).optional(),
  scheduled_date: z.string().optional(),
  completed_date: z.string().nullish(),
  checklist: z.array(checklistItemSchema).optional(),
  notes: z.string().nullish(),
});

export type UpdateSeasonalInput = z.infer<typeof updateSeasonalSchema>;

export const updateChecklistSchema = z.object({
  checklist: z.array(checklistItemSchema).min(1),
});

export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;

export const seasonalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  transition_type: z.enum(transitionTypes).optional(),
  season_year: z.coerce.number().int().optional(),
  status: z.enum(transitionStatuses).optional(),
});

export type SeasonalQuery = z.infer<typeof seasonalQuerySchema>;

export const seasonalParamsSchema = z.object({
  id: z.string().uuid('Invalid transition ID'),
});
