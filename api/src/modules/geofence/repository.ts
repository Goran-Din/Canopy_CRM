import { queryDb } from '../../config/database.js';

// === Interfaces ===

export interface PropertyGeofence {
  id: string;
  property_name: string;
  geofence_lat: string | null;
  geofence_lng: string | null;
  geofence_radius_metres: number;
  geofence_enabled: boolean;
  geofence_last_set_at: Date | null;
  geofence_set_by: string | null;
}

export interface GpsEventV2 {
  id: string;
  tenant_id: string;
  crew_member_id: string;
  property_id: string | null;
  job_id: string | null;
  route_stop_id: string | null;
  event_type: string;
  event_at: Date;
  latitude: string;
  longitude: string;
  accuracy_metres: string | null;
  speed_kmh: string | null;
  heading_degrees: string | null;
  source: string;
  paired_event_id: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  geofence_radius_at_trigger: number | null;
  distance_from_centre_metres: string | null;
  dwell_minutes: number | null;
  service_occurrence_id: string | null;
  payroll_cross_check_status: string | null;
  payroll_cross_check_note: string | null;
}

export interface GeofenceSetupStatus {
  id: string;
  property_name: string;
  address_line1: string | null;
  geofence_lat: string | null;
  geofence_lng: string | null;
  geofence_radius_metres: number;
  geofence_enabled: boolean;
  status: string;
}

export interface LiveCrewPosition {
  crew_member_id: string;
  first_name: string;
  last_name: string;
  latitude: string;
  longitude: string;
  event_at: Date;
  speed_kmh: string | null;
  property_name: string | null;
}

export interface CrossCheckFlag {
  id: string;
  tenant_id: string;
  crew_member_id: string;
  crew_name: string;
  event_at: Date;
  property_name: string | null;
  dwell_minutes: number | null;
  payroll_cross_check_status: string;
  payroll_cross_check_note: string | null;
}

interface CountRow { count: string }

// === Property Geofence ===

export async function getPropertyGeofence(
  propertyId: string,
  tenantId: string,
): Promise<PropertyGeofence | null> {
  const result = await queryDb<PropertyGeofence>(
    `SELECT id, property_name, geofence_lat, geofence_lng,
            geofence_radius_metres, geofence_enabled,
            geofence_last_set_at, geofence_set_by
     FROM properties
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [propertyId, tenantId],
  );
  return result.rows[0] || null;
}

export async function updatePropertyGeofence(
  propertyId: string,
  tenantId: string,
  data: Record<string, unknown>,
): Promise<PropertyGeofence> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['geofence_lat', data.geofence_lat],
    ['geofence_lng', data.geofence_lng],
    ['geofence_radius_metres', data.geofence_radius_metres],
    ['geofence_enabled', data.geofence_enabled],
    ['geofence_last_set_at', data.geofence_last_set_at ?? new Date()],
    ['geofence_set_by', data.geofence_set_by],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  params.push(propertyId, tenantId);
  const result = await queryDb<PropertyGeofence>(
    `UPDATE properties SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx} AND tenant_id = $${paramIdx + 1} AND deleted_at IS NULL
     RETURNING id, property_name, geofence_lat, geofence_lng,
               geofence_radius_metres, geofence_enabled,
               geofence_last_set_at, geofence_set_by`,
    params,
  );
  return result.rows[0];
}

export async function getGeofenceSetupStatus(
  tenantId: string,
): Promise<GeofenceSetupStatus[]> {
  const result = await queryDb<GeofenceSetupStatus>(
    `SELECT id, property_name, address_line1,
            geofence_lat, geofence_lng, geofence_radius_metres, geofence_enabled,
            CASE
              WHEN geofence_lat IS NOT NULL AND geofence_lng IS NOT NULL AND geofence_enabled = TRUE THEN 'ready'
              WHEN geofence_lat IS NULL OR geofence_lng IS NULL THEN 'no_gps'
              ELSE 'disabled'
            END AS status
     FROM properties
     WHERE tenant_id = $1 AND deleted_at IS NULL
     ORDER BY property_name ASC`,
    [tenantId],
  );
  return result.rows;
}

export async function bulkConfirmGeofences(
  tenantId: string,
  propertyIds: string[],
): Promise<number> {
  if (propertyIds.length === 0) return 0;
  const placeholders = propertyIds.map((_, i) => `$${i + 2}`).join(', ');
  const result = await queryDb(
    `UPDATE properties
     SET geofence_enabled = TRUE, geofence_last_set_at = NOW()
     WHERE tenant_id = $1 AND id IN (${placeholders}) AND deleted_at IS NULL`,
    [tenantId, ...propertyIds],
  );
  return result.rowCount ?? 0;
}

// === GPS Events V2 ===

export async function insertGpsEvent(
  data: Record<string, unknown>,
): Promise<GpsEventV2> {
  const result = await queryDb<GpsEventV2>(
    `INSERT INTO gps_events
     (tenant_id, crew_member_id, property_id, job_id, event_type, event_at,
      latitude, longitude, accuracy_metres, speed_kmh, heading_degrees, source,
      paired_event_id, is_flagged, flag_reason,
      geofence_radius_at_trigger, distance_from_centre_metres, dwell_minutes,
      service_occurrence_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING *`,
    [
      data.tenant_id,
      data.crew_member_id,
      data.property_id ?? null,
      data.job_id ?? null,
      data.event_type,
      data.event_at ?? new Date(),
      data.latitude,
      data.longitude,
      data.accuracy_metres ?? null,
      data.speed_kmh ?? null,
      data.heading_degrees ?? null,
      data.source ?? 'geofence',
      data.paired_event_id ?? null,
      data.is_flagged ?? false,
      data.flag_reason ?? null,
      data.geofence_radius_at_trigger ?? null,
      data.distance_from_centre_metres ?? null,
      data.dwell_minutes ?? null,
      data.service_occurrence_id ?? null,
    ],
  );
  return result.rows[0];
}

export async function findUnmatchedArrival(
  tenantId: string,
  crewMemberId: string,
  propertyId: string,
): Promise<GpsEventV2 | null> {
  const result = await queryDb<GpsEventV2>(
    `SELECT * FROM gps_events
     WHERE tenant_id = $1
       AND crew_member_id = $2
       AND property_id = $3
       AND event_type = 'arrival'
       AND paired_event_id IS NULL
     ORDER BY event_at DESC
     LIMIT 1`,
    [tenantId, crewMemberId, propertyId],
  );
  return result.rows[0] || null;
}

export async function pairEvents(
  arrivalId: string,
  departureId: string,
): Promise<void> {
  await queryDb(
    `UPDATE gps_events SET paired_event_id = $1 WHERE id = $2`,
    [departureId, arrivalId],
  );
}

export async function getLiveCrewPositions(
  tenantId: string,
): Promise<LiveCrewPosition[]> {
  const result = await queryDb<LiveCrewPosition>(
    `SELECT DISTINCT ON (ge.crew_member_id)
            ge.crew_member_id, u.first_name, u.last_name,
            ge.latitude, ge.longitude, ge.event_at, ge.speed_kmh,
            p.property_name
     FROM gps_events ge
     JOIN users u ON u.id = ge.crew_member_id
     LEFT JOIN properties p ON p.id = ge.property_id
     JOIN crew_day_logs cdl ON cdl.user_id = ge.crew_member_id
       AND cdl.work_date = CURRENT_DATE
       AND cdl.clock_out IS NULL
     WHERE ge.tenant_id = $1
       AND u.is_active = TRUE
       AND ge.event_at > NOW() - INTERVAL '1 hour'
     ORDER BY ge.crew_member_id, ge.event_at DESC`,
    [tenantId],
  );
  return result.rows;
}

export async function getEventsByJob(
  jobId: string,
  tenantId: string,
): Promise<GpsEventV2[]> {
  const result = await queryDb<GpsEventV2>(
    `SELECT * FROM gps_events
     WHERE job_id = $1 AND tenant_id = $2
     ORDER BY event_at ASC`,
    [jobId, tenantId],
  );
  return result.rows;
}

export async function getEventsByProperty(
  propertyId: string,
  tenantId: string,
  dateFrom?: string,
  dateTo?: string,
  page = 1,
  limit = 50,
): Promise<{ data: GpsEventV2[]; total: number }> {
  const conditions = ['tenant_id = $1', 'property_id = $2'];
  const params: unknown[] = [tenantId, propertyId];
  let paramIdx = 3;

  if (dateFrom) {
    conditions.push(`event_at >= $${paramIdx}`);
    params.push(dateFrom);
    paramIdx++;
  }
  if (dateTo) {
    conditions.push(`event_at <= $${paramIdx}`);
    params.push(dateTo);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM gps_events WHERE ${where}`, params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<GpsEventV2>(
    `SELECT * FROM gps_events WHERE ${where}
     ORDER BY event_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );
  return { data: dataResult.rows, total };
}

export async function getCrossCheckFlags(
  tenantId: string,
  filters: { date_from?: string; date_to?: string; crew_member_id?: string; page?: number; limit?: number },
): Promise<{ data: CrossCheckFlag[]; total: number }> {
  const conditions: string[] = ['ge.tenant_id = $1', "ge.payroll_cross_check_status = 'flagged'", "ge.event_type = 'departure'"];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (filters.date_from) {
    conditions.push(`ge.event_at >= $${paramIdx}`);
    params.push(filters.date_from);
    paramIdx++;
  }
  if (filters.date_to) {
    conditions.push(`ge.event_at <= $${paramIdx}`);
    params.push(filters.date_to);
    paramIdx++;
  }
  if (filters.crew_member_id) {
    conditions.push(`ge.crew_member_id = $${paramIdx}`);
    params.push(filters.crew_member_id);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM gps_events ge WHERE ${where}`, params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<CrossCheckFlag>(
    `SELECT ge.id, ge.tenant_id, ge.crew_member_id,
            CONCAT(u.first_name, ' ', u.last_name) AS crew_name,
            ge.event_at, p.property_name, ge.dwell_minutes,
            ge.payroll_cross_check_status, ge.payroll_cross_check_note
     FROM gps_events ge
     JOIN users u ON u.id = ge.crew_member_id
     LEFT JOIN properties p ON p.id = ge.property_id
     WHERE ${where}
     ORDER BY ge.event_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );
  return { data: dataResult.rows, total };
}

export async function resolveCrossCheckFlag(
  eventId: string,
  tenantId: string,
  note: string,
): Promise<GpsEventV2> {
  const result = await queryDb<GpsEventV2>(
    `UPDATE gps_events
     SET payroll_cross_check_status = 'reviewed', payroll_cross_check_note = $1
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [note, eventId, tenantId],
  );
  return result.rows[0];
}

export async function findDeparturesForDay(
  tenantId: string,
  crewMemberId: string,
  workDate: string,
): Promise<GpsEventV2[]> {
  const result = await queryDb<GpsEventV2>(
    `SELECT * FROM gps_events
     WHERE tenant_id = $1
       AND crew_member_id = $2
       AND event_type = 'departure'
       AND event_at::date = $3
     ORDER BY event_at ASC`,
    [tenantId, crewMemberId, workDate],
  );
  return result.rows;
}

export async function updateGpsEvent(
  eventId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }
  if (setClauses.length === 0) return;

  params.push(eventId);
  await queryDb(
    `UPDATE gps_events SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
    params,
  );
}
