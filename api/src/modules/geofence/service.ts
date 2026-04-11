import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../config/logger.js';
import * as repo from './repository.js';
import type {
  GpsEventInput,
  UpdateGeofenceInput,
  ResolveFlagInput,
  PropertyEventsInput,
  CrossCheckFlagsInput,
} from './schema.js';

// Default geofence radius by property_category
const RADIUS_BY_CATEGORY: Record<string, number> = {
  'RES-S': 30,
  'RES-M': 40,
  'RES-L': 60,
  'COM-S': 50,
  'COM-M': 80,
  'COM-L': 80,
  'HOA-S': 100,
  'HOA-M': 100,
  'HOA-L': 100,
};
const DEFAULT_RADIUS = 40;
const SPEED_THRESHOLD_KMH = 25;

// === Geofence Settings ===

export async function getPropertyGeofence(propertyId: string, tenantId: string) {
  const geofence = await repo.getPropertyGeofence(propertyId, tenantId);
  if (!geofence) throw new AppError(404, 'Property not found');
  return geofence;
}

export async function updatePropertyGeofence(
  propertyId: string,
  tenantId: string,
  input: UpdateGeofenceInput,
  userId: string,
) {
  const existing = await repo.getPropertyGeofence(propertyId, tenantId);
  if (!existing) throw new AppError(404, 'Property not found');

  return repo.updatePropertyGeofence(propertyId, tenantId, {
    ...input,
    geofence_last_set_at: new Date(),
    geofence_set_by: userId,
  });
}

export async function getGeofenceSetupStatus(tenantId: string) {
  return repo.getGeofenceSetupStatus(tenantId);
}

// === Default Geofence (called from PropertiesService on property creation) ===

export function getDefaultRadius(propertyCategory: string | null | undefined): number {
  if (!propertyCategory) return DEFAULT_RADIUS;
  return RADIUS_BY_CATEGORY[propertyCategory] ?? DEFAULT_RADIUS;
}

export async function setDefaultGeofence(
  propertyId: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
  propertyCategory: string | null | undefined,
) {
  if (lat == null || lng == null) return;

  const radius = getDefaultRadius(propertyCategory);
  await repo.updatePropertyGeofence(propertyId, '', {
    geofence_lat: lat,
    geofence_lng: lng,
    geofence_radius_metres: radius,
    geofence_enabled: true,
    geofence_last_set_at: new Date(),
  });
}

// === GPS Event Processing ===

export async function processArrivalEvent(
  tenantId: string,
  crewMemberId: string,
  input: GpsEventInput,
) {
  // Validate property geofence
  const geofence = await repo.getPropertyGeofence(input.property_id, tenantId);
  if (!geofence || !geofence.geofence_enabled) {
    throw new AppError(422, 'Property geofence is not enabled');
  }

  // Speed check: flag drive-by
  const isFlagged = (input.speed_kmh ?? 0) > SPEED_THRESHOLD_KMH;
  const flagReason = isFlagged ? `Speed ${input.speed_kmh} km/h exceeds ${SPEED_THRESHOLD_KMH} km/h threshold` : null;

  // Find scheduled job for today
  let jobId: string | null = null;
  try {
    const { queryDb } = await import('../../config/database.js');
    const jobResult = await queryDb<Record<string, unknown>>(
      `SELECT j.id FROM jobs j
       JOIN job_crew_assignments jca ON jca.job_id = j.id
       WHERE j.tenant_id = $1
         AND j.property_id = $2
         AND jca.crew_member_id = $3
         AND j.scheduled_date::date = CURRENT_DATE
         AND j.status IN ('scheduled', 'in_progress')
       LIMIT 1`,
      [tenantId, input.property_id, crewMemberId],
    );
    jobId = (jobResult.rows[0]?.id as string) ?? null;
  } catch {
    // Job lookup failure is non-fatal
  }

  if (!jobId) {
    logger.info('Unscheduled property visit detected', {
      crew_member_id: crewMemberId,
      property_id: input.property_id,
    });
  }

  const event = await repo.insertGpsEvent({
    tenant_id: tenantId,
    crew_member_id: crewMemberId,
    property_id: input.property_id,
    job_id: jobId,
    event_type: 'arrival',
    event_at: input.event_at ?? new Date(),
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy_metres: input.accuracy_metres,
    speed_kmh: input.speed_kmh,
    heading_degrees: input.heading_degrees,
    source: 'geofence',
    is_flagged: isFlagged,
    flag_reason: flagReason,
    geofence_radius_at_trigger: geofence.geofence_radius_metres,
    distance_from_centre_metres: input.distance_from_centre_metres,
  });

  return event;
}

export async function processDepartureEvent(
  tenantId: string,
  crewMemberId: string,
  input: GpsEventInput,
) {
  // Find unmatched arrival
  const arrival = await repo.findUnmatchedArrival(tenantId, crewMemberId, input.property_id);

  let dwellMinutes: number | null = null;
  let pairedEventId: string | null = null;

  if (arrival) {
    const arrivalTime = new Date(arrival.event_at).getTime();
    const departureTime = (input.event_at ? new Date(input.event_at).getTime() : Date.now());
    dwellMinutes = Math.round((departureTime - arrivalTime) / 60000);
    pairedEventId = arrival.id;
  } else {
    logger.warn('Departure without matching arrival', {
      crew_member_id: crewMemberId,
      property_id: input.property_id,
    });
  }

  const event = await repo.insertGpsEvent({
    tenant_id: tenantId,
    crew_member_id: crewMemberId,
    property_id: input.property_id,
    job_id: arrival?.job_id ?? null,
    event_type: 'departure',
    event_at: input.event_at ?? new Date(),
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy_metres: input.accuracy_metres,
    speed_kmh: input.speed_kmh,
    heading_degrees: input.heading_degrees,
    source: 'geofence',
    paired_event_id: pairedEventId,
    is_flagged: false,
    dwell_minutes: dwellMinutes,
    geofence_radius_at_trigger: arrival ? Number(arrival.geofence_radius_at_trigger) : null,
    distance_from_centre_metres: input.distance_from_centre_metres,
  });

  // Pair the arrival to this departure
  if (arrival) {
    await repo.pairEvents(arrival.id, event.id);
  }

  // Run payroll cross-check asynchronously
  if (dwellMinutes != null && dwellMinutes > 5) {
    const workDate = (input.event_at ?? new Date()).toString().split('T')[0]
      ?? new Date().toISOString().split('T')[0];
    runPayrollCrossCheck(tenantId, crewMemberId, workDate).catch(() => {
      // Non-blocking
    });
  }

  return event;
}

export async function recordGpsEvent(
  tenantId: string,
  crewMemberId: string,
  input: GpsEventInput,
) {
  if (input.event_type === 'arrival') {
    return processArrivalEvent(tenantId, crewMemberId, input);
  }
  if (input.event_type === 'departure') {
    return processDepartureEvent(tenantId, crewMemberId, input);
  }

  // Waypoint — simple insert
  return repo.insertGpsEvent({
    tenant_id: tenantId,
    crew_member_id: crewMemberId,
    property_id: input.property_id,
    event_type: 'waypoint',
    event_at: input.event_at ?? new Date(),
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy_metres: input.accuracy_metres,
    speed_kmh: input.speed_kmh,
    heading_degrees: input.heading_degrees,
    source: 'geofence',
    is_flagged: false,
    distance_from_centre_metres: input.distance_from_centre_metres,
  });
}

// === Payroll Cross-Check ===

export async function runPayrollCrossCheck(
  tenantId: string,
  crewMemberId: string,
  workDate: string,
) {
  try {
    const { queryDb } = await import('../../config/database.js');

    // Layer 1: crew_day_log
    const cdlResult = await queryDb<Record<string, unknown>>(
      `SELECT clock_in, clock_out, total_minutes
       FROM crew_day_logs
       WHERE tenant_id = $1 AND user_id = $2 AND work_date = $3
       LIMIT 1`,
      [tenantId, crewMemberId, workDate],
    );

    const cdl = cdlResult.rows[0];
    if (!cdl || !cdl.clock_out) return; // No clock-out yet, skip

    const layer1Minutes = Number(cdl.total_minutes ?? 0);
    if (layer1Minutes === 0) return;

    // Layer 2: sum of dwell_minutes from departures
    const departures = await repo.findDeparturesForDay(tenantId, crewMemberId, workDate);
    const layer2Minutes = departures.reduce((sum, d) => sum + (d.dwell_minutes ?? 0), 0);
    if (layer2Minutes === 0) return;

    const absDiff = Math.abs(layer1Minutes - layer2Minutes);
    const pctDiff = (absDiff / layer1Minutes) * 100;

    // Flag if BOTH: diff > 30 min AND diff > 20%
    const isFlagged = absDiff > 30 && pctDiff > 20;
    const status = isFlagged ? 'flagged' : 'consistent';

    for (const dep of departures) {
      await repo.updateGpsEvent(dep.id, {
        payroll_cross_check_status: status,
      });
    }

    if (isFlagged) {
      logger.warn('Payroll cross-check flagged', {
        crew_member_id: crewMemberId,
        work_date: workDate,
        layer1_minutes: layer1Minutes,
        layer2_minutes: layer2Minutes,
        diff_minutes: absDiff,
        diff_percent: Math.round(pctDiff),
      });
    }
  } catch (err) {
    logger.error('Payroll cross-check failed', { error: (err as Error).message });
  }
}

// === Query Endpoints ===

export async function getLiveCrewPositions(tenantId: string) {
  return repo.getLiveCrewPositions(tenantId);
}

export async function getEventsByJob(jobId: string, tenantId: string) {
  return repo.getEventsByJob(jobId, tenantId);
}

export async function getEventsByProperty(
  propertyId: string,
  tenantId: string,
  input: PropertyEventsInput,
) {
  return repo.getEventsByProperty(
    propertyId, tenantId,
    input.date_from, input.date_to,
    input.page, input.limit,
  );
}

export async function getCrossCheckFlags(tenantId: string, input: CrossCheckFlagsInput) {
  return repo.getCrossCheckFlags(tenantId, input);
}

export async function resolveCrossCheckFlag(
  eventId: string,
  tenantId: string,
  input: ResolveFlagInput,
) {
  return repo.resolveCrossCheckFlag(eventId, tenantId, input.note);
}
