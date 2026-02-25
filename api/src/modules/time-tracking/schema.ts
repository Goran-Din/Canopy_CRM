import { z } from 'zod';

const timeEntryStatuses = ['clocked_in', 'clocked_out', 'approved', 'disputed', 'adjusted'] as const;
const clockMethods = ['mobile_gps', 'manual', 'qr_code', 'auto'] as const;
const gpsEventTypes = ['arrival', 'departure', 'location_update', 'geofence_enter', 'geofence_exit'] as const;

// --- Time Entry schemas ---

export const clockInSchema = z.object({
  job_id: z.string().uuid().nullish(),
  crew_id: z.string().uuid().nullish(),
  clock_in: z.string().datetime().optional(), // defaults to now in service
  clock_in_latitude: z.coerce.number().min(-90).max(90).nullish(),
  clock_in_longitude: z.coerce.number().min(-180).max(180).nullish(),
  clock_in_method: z.enum(clockMethods).default('manual'),
  notes: z.string().nullish(),
});

export type ClockInInput = z.infer<typeof clockInSchema>;

export const clockOutSchema = z.object({
  clock_out: z.string().datetime().optional(), // defaults to now in service
  clock_out_latitude: z.coerce.number().min(-90).max(90).nullish(),
  clock_out_longitude: z.coerce.number().min(-180).max(180).nullish(),
  clock_out_method: z.enum(clockMethods).default('manual'),
  break_minutes: z.coerce.number().int().min(0).default(0),
  notes: z.string().nullish(),
});

export type ClockOutInput = z.infer<typeof clockOutSchema>;

export const updateEntrySchema = z.object({
  clock_in: z.string().datetime().optional(),
  clock_out: z.string().datetime().nullish(),
  break_minutes: z.coerce.number().int().min(0).optional(),
  status: z.enum(timeEntryStatuses).optional(),
  job_id: z.string().uuid().nullish(),
  crew_id: z.string().uuid().nullish(),
  admin_notes: z.string().nullish(),
  notes: z.string().nullish(),
});

export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export const entryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  user_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  crew_id: z.string().uuid().optional(),
  status: z.enum(timeEntryStatuses).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  sortBy: z.enum(['clock_in', 'created_at', 'status', 'total_minutes']).default('clock_in'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type EntryQuery = z.infer<typeof entryQuerySchema>;

export const entryParamsSchema = z.object({
  id: z.string().uuid('Invalid time entry ID'),
});

export const timesheetQuerySchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
});

export type TimesheetQuery = z.infer<typeof timesheetQuerySchema>;

export const dailySummaryQuerySchema = z.object({
  date: z.string(),
  crew_id: z.string().uuid().optional(),
});

export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;

export const weeklySummaryQuerySchema = z.object({
  user_id: z.string().uuid(),
  week_start: z.string(),
});

export type WeeklySummaryQuery = z.infer<typeof weeklySummaryQuerySchema>;

// --- GPS Event schemas ---

export const createGpsEventSchema = z.object({
  job_id: z.string().uuid().nullish(),
  crew_id: z.string().uuid().nullish(),
  event_type: z.enum(gpsEventTypes),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy_meters: z.coerce.number().min(0).nullish(),
  recorded_at: z.string().datetime().optional(),
  device_info: z.string().max(255).nullish(),
});

export type CreateGpsEventInput = z.infer<typeof createGpsEventSchema>;

export const gpsJobParamsSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
});

export const gpsUserParamsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export const gpsUserQuerySchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
});

export type GpsUserQuery = z.infer<typeof gpsUserQuerySchema>;
