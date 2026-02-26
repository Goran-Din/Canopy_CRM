import { z } from 'zod';

export const boardQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  division: z
    .enum([
      'landscaping_maintenance',
      'landscaping_projects',
      'hardscape',
      'snow_removal',
    ])
    .optional(),
});

export const assignJobSchema = z.object({
  job_id: z.string().uuid(),
  crew_id: z.string().uuid(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  scheduled_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS'),
});

export const rescheduleJobSchema = z.object({
  job_id: z.string().uuid(),
  crew_id: z.string().uuid().optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  scheduled_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS').optional(),
});

export const unassignJobSchema = z.object({
  job_id: z.string().uuid(),
});

export type BoardQuery = z.infer<typeof boardQuerySchema>;
export type AssignJobData = z.infer<typeof assignJobSchema>;
export type RescheduleJobData = z.infer<typeof rescheduleJobSchema>;
export type UnassignJobData = z.infer<typeof unassignJobSchema>;
