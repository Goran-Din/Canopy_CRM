import { z } from 'zod';

// --- GPS Event ---

export const gpsEventSchema = z.object({
  event_type: z.enum(['arrival', 'departure', 'waypoint']),
  property_id: z.string().uuid(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy_metres: z.coerce.number().min(0).optional(),
  distance_from_centre_metres: z.coerce.number().min(0).optional(),
  speed_kmh: z.coerce.number().min(0).optional(),
  heading_degrees: z.coerce.number().min(0).max(360).optional(),
  event_at: z.coerce.date().optional(),
});

export type GpsEventInput = z.infer<typeof gpsEventSchema>;

// --- Update Geofence ---

export const updateGeofenceSchema = z.object({
  geofence_lat: z.coerce.number().min(-90).max(90).optional(),
  geofence_lng: z.coerce.number().min(-180).max(180).optional(),
  geofence_radius_metres: z.coerce.number().int().min(10).max(500).optional(),
  geofence_enabled: z.boolean().optional(),
});

export type UpdateGeofenceInput = z.infer<typeof updateGeofenceSchema>;

// --- Resolve Flag ---

export const resolveFlagSchema = z.object({
  note: z.string().min(1).max(2000),
});

export type ResolveFlagInput = z.infer<typeof resolveFlagSchema>;

// --- Property Events Query ---

export const propertyEventsSchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PropertyEventsInput = z.infer<typeof propertyEventsSchema>;

// --- Cross-Check Flags Query ---

export const crossCheckFlagsSchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  crew_member_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CrossCheckFlagsInput = z.infer<typeof crossCheckFlagsSchema>;

// --- Param Schemas ---

export const propertyIdParamsSchema = z.object({
  id: z.string().uuid('Invalid property ID'),
});

export const jobIdParamsSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
});

export const eventIdParamsSchema = z.object({
  id: z.string().uuid('Invalid event ID'),
});
