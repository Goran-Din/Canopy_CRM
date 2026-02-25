import { z } from 'zod';

const crewStatuses = ['active', 'inactive', 'on_leave', 'seasonal'] as const;
const crewRoles = ['leader', 'member'] as const;
const routeStatuses = ['active', 'inactive', 'seasonal'] as const;
const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const divisionTypes = ['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'] as const;

// --- Crew schemas ---

export const createCrewSchema = z.object({
  crew_name: z.string().min(1, 'Crew name is required').max(100),
  division: z.enum(divisionTypes),
  crew_leader_id: z.string().uuid().nullish(),
  status: z.enum(crewStatuses).default('active'),
  color_code: z.string().max(20).nullish(),
  max_jobs_per_day: z.coerce.number().int().min(1).default(12),
  notes: z.string().nullish(),
});

export type CreateCrewInput = z.infer<typeof createCrewSchema>;

export const updateCrewSchema = z.object({
  crew_name: z.string().min(1).max(100).optional(),
  division: z.enum(divisionTypes).optional(),
  crew_leader_id: z.string().uuid().nullish(),
  status: z.enum(crewStatuses).optional(),
  color_code: z.string().max(20).nullish(),
  max_jobs_per_day: z.coerce.number().int().min(1).optional(),
  notes: z.string().nullish(),
  updated_at: z.string().datetime().optional(),
});

export type UpdateCrewInput = z.infer<typeof updateCrewSchema>;

export const crewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(crewStatuses).optional(),
  division: z.enum(divisionTypes).optional(),
  sortBy: z.enum(['crew_name', 'created_at', 'status', 'division']).default('crew_name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CrewQuery = z.infer<typeof crewQuerySchema>;

export const crewParamsSchema = z.object({
  id: z.string().uuid('Invalid crew ID'),
});

export const crewMemberSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  role_in_crew: z.enum(crewRoles).default('member'),
});

export type CrewMemberInput = z.infer<typeof crewMemberSchema>;

export const memberParamsSchema = z.object({
  id: z.string().uuid('Invalid crew ID'),
  userId: z.string().uuid('Invalid user ID'),
});

// --- Route schemas ---

export const createRouteSchema = z.object({
  route_name: z.string().min(1, 'Route name is required').max(100),
  division: z.enum(divisionTypes),
  crew_id: z.string().uuid().nullish(),
  day_of_week: z.enum(daysOfWeek),
  status: z.enum(routeStatuses).default('active'),
  zone: z.string().max(50).nullish(),
  estimated_duration_hours: z.coerce.number().min(0).nullish(),
  notes: z.string().nullish(),
  color_code: z.string().max(20).nullish(),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const updateRouteSchema = z.object({
  route_name: z.string().min(1).max(100).optional(),
  division: z.enum(divisionTypes).optional(),
  crew_id: z.string().uuid().nullish(),
  day_of_week: z.enum(daysOfWeek).optional(),
  status: z.enum(routeStatuses).optional(),
  zone: z.string().max(50).nullish(),
  estimated_duration_hours: z.coerce.number().min(0).nullish(),
  notes: z.string().nullish(),
  color_code: z.string().max(20).nullish(),
  updated_at: z.string().datetime().optional(),
});

export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;

export const routeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  division: z.enum(divisionTypes).optional(),
  day_of_week: z.enum(daysOfWeek).optional(),
  crew_id: z.string().uuid().optional(),
  status: z.enum(routeStatuses).optional(),
  sortBy: z.enum(['route_name', 'created_at', 'day_of_week', 'division']).default('route_name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type RouteQuery = z.infer<typeof routeQuerySchema>;

export const routeParamsSchema = z.object({
  id: z.string().uuid('Invalid route ID'),
});

export const createStopSchema = z.object({
  property_id: z.string().uuid('Invalid property ID'),
  stop_order: z.coerce.number().int().min(1).optional(),
  estimated_arrival_time: z.string().nullish(),
  estimated_duration_minutes: z.coerce.number().int().min(0).nullish(),
  notes: z.string().nullish(),
});

export type CreateStopInput = z.infer<typeof createStopSchema>;

export const updateStopSchema = z.object({
  property_id: z.string().uuid().optional(),
  stop_order: z.coerce.number().int().min(1).optional(),
  estimated_arrival_time: z.string().nullish(),
  estimated_duration_minutes: z.coerce.number().int().min(0).nullish(),
  notes: z.string().nullish(),
});

export type UpdateStopInput = z.infer<typeof updateStopSchema>;

export const stopParamsSchema = z.object({
  stopId: z.string().uuid('Invalid stop ID'),
});

export const routeStopParamsSchema = z.object({
  id: z.string().uuid('Invalid route ID'),
  stopId: z.string().uuid('Invalid stop ID'),
});

export const reorderStopsSchema = z.object({
  stop_ids: z.array(z.string().uuid()).min(1, 'At least one stop ID required'),
});

export type ReorderStopsInput = z.infer<typeof reorderStopsSchema>;
