import { queryDb, getClient } from '../../config/database.js';
import type { CrewQuery, RouteQuery } from './schema.js';

// --- Crew types ---

export interface CrewRow {
  id: string;
  tenant_id: string;
  crew_name: string;
  division: string;
  crew_leader_id: string | null;
  status: string;
  color_code: string | null;
  max_jobs_per_day: number;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CrewMemberRow {
  id: string;
  tenant_id: string;
  crew_id: string;
  user_id: string;
  role_in_crew: string;
  joined_date: string;
  left_date: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  user_first_name?: string;
  user_last_name?: string;
  user_email?: string;
}

// --- Route types ---

export interface RouteRow {
  id: string;
  tenant_id: string;
  route_name: string;
  division: string;
  crew_id: string | null;
  day_of_week: string;
  status: string;
  zone: string | null;
  estimated_duration_hours: number | null;
  notes: string | null;
  color_code: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface RouteStopRow {
  id: string;
  tenant_id: string;
  route_id: string;
  property_id: string;
  stop_order: number;
  estimated_arrival_time: string | null;
  estimated_duration_minutes: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  property_name?: string;
  address_line1?: string;
  city?: string;
}

interface CountRow { count: string; }

const CREW_SORT: Record<string, string> = {
  crew_name: 'c.crew_name',
  created_at: 'c.created_at',
  status: 'c.status',
  division: 'c.division',
};

const ROUTE_SORT: Record<string, string> = {
  route_name: 'r.route_name',
  created_at: 'r.created_at',
  day_of_week: 'r.day_of_week',
  division: 'r.division',
};

// ======== CREWS ========

export async function findAllCrews(
  tenantId: string,
  query: CrewQuery,
): Promise<{ rows: CrewRow[]; total: number }> {
  const conds: string[] = ['c.tenant_id = $1', 'c.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.search) {
    conds.push(`c.crew_name ILIKE $${pi}`);
    params.push(`%${query.search}%`);
    pi++;
  }
  if (query.status) { conds.push(`c.status = $${pi}`); params.push(query.status); pi++; }
  if (query.division) { conds.push(`c.division = $${pi}`); params.push(query.division); pi++; }

  const where = conds.join(' AND ');
  const sort = CREW_SORT[query.sortBy] || 'c.crew_name';
  const dir = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM crews c WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<CrewRow>(
    `SELECT c.* FROM crews c WHERE ${where} ORDER BY ${sort} ${dir} LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findCrewById(
  tenantId: string,
  id: string,
): Promise<(CrewRow & { members: CrewMemberRow[] }) | null> {
  const res = await queryDb<CrewRow>(
    `SELECT * FROM crews WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  if (!res.rows[0]) return null;

  const members = await getCrewMembers(tenantId, id);
  return { ...res.rows[0], members };
}

export async function createCrew(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<CrewRow> {
  const res = await queryDb<CrewRow>(
    `INSERT INTO crews (tenant_id, crew_name, division, crew_leader_id, status, color_code, max_jobs_per_day, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     RETURNING *`,
    [tenantId, data.crew_name, data.division, data.crew_leader_id || null, data.status, data.color_code || null, data.max_jobs_per_day, data.notes || null, userId],
  );
  return res.rows[0];
}

export async function updateCrew(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<CrewRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined && col !== 'updated_at') {
      sets.push(`${col} = $${pi}`);
      params.push(val ?? null);
      pi++;
    }
  }
  if (sets.length === 0) return findCrewByIdSimple(tenantId, id);

  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;

  let cc = '';
  if (data.updated_at) { cc = ` AND updated_at = $${pi}`; params.push(data.updated_at); pi++; }

  params.push(id); params.push(tenantId);

  const res = await queryDb<CrewRow>(
    `UPDATE crews SET ${sets.join(', ')} WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL${cc} RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

async function findCrewByIdSimple(tenantId: string, id: string): Promise<CrewRow | null> {
  const res = await queryDb<CrewRow>(
    `SELECT * FROM crews WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function softDeleteCrew(tenantId: string, id: string): Promise<CrewRow | null> {
  const res = await queryDb<CrewRow>(
    `UPDATE crews SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function hasActiveJobs(tenantId: string, crewId: string): Promise<boolean> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE tenant_id = $1 AND assigned_crew_id = $2
       AND status IN ('scheduled', 'in_progress') AND deleted_at IS NULL`,
    [tenantId, crewId],
  );
  return parseInt(res.rows[0].count, 10) > 0;
}

// --- Crew Members ---

export async function getCrewMembers(tenantId: string, crewId: string): Promise<CrewMemberRow[]> {
  const res = await queryDb<CrewMemberRow>(
    `SELECT cm.*, u.first_name AS user_first_name, u.last_name AS user_last_name, u.email AS user_email
     FROM crew_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.tenant_id = $1 AND cm.crew_id = $2 AND cm.is_active = true
     ORDER BY cm.role_in_crew ASC, cm.joined_date ASC`,
    [tenantId, crewId],
  );
  return res.rows;
}

export async function addCrewMember(
  tenantId: string,
  crewId: string,
  userId: string,
  roleInCrew: string,
): Promise<CrewMemberRow> {
  const res = await queryDb<CrewMemberRow>(
    `INSERT INTO crew_members (tenant_id, crew_id, user_id, role_in_crew)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, crewId, userId, roleInCrew],
  );
  return res.rows[0];
}

export async function removeCrewMember(
  tenantId: string,
  crewId: string,
  userId: string,
): Promise<CrewMemberRow | null> {
  const res = await queryDb<CrewMemberRow>(
    `UPDATE crew_members SET is_active = false, left_date = CURRENT_DATE
     WHERE tenant_id = $1 AND crew_id = $2 AND user_id = $3 AND is_active = true
     RETURNING *`,
    [tenantId, crewId, userId],
  );
  return res.rows[0] || null;
}

export async function isUserActiveMemberOfCrew(
  tenantId: string,
  crewId: string,
  userId: string,
): Promise<boolean> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM crew_members
     WHERE tenant_id = $1 AND crew_id = $2 AND user_id = $3 AND is_active = true`,
    [tenantId, crewId, userId],
  );
  return parseInt(res.rows[0].count, 10) > 0;
}

export async function userExists(tenantId: string, userId: string): Promise<boolean> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
    [userId, tenantId],
  );
  return parseInt(res.rows[0].count, 10) > 0;
}

export async function crewExists(tenantId: string, crewId: string): Promise<boolean> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM crews WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [crewId, tenantId],
  );
  return parseInt(res.rows[0].count, 10) > 0;
}

// ======== ROUTES ========

export async function findAllRoutes(
  tenantId: string,
  query: RouteQuery,
): Promise<{ rows: RouteRow[]; total: number }> {
  const conds: string[] = ['r.tenant_id = $1', 'r.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.search) { conds.push(`r.route_name ILIKE $${pi}`); params.push(`%${query.search}%`); pi++; }
  if (query.division) { conds.push(`r.division = $${pi}`); params.push(query.division); pi++; }
  if (query.day_of_week) { conds.push(`r.day_of_week = $${pi}`); params.push(query.day_of_week); pi++; }
  if (query.crew_id) { conds.push(`r.crew_id = $${pi}`); params.push(query.crew_id); pi++; }
  if (query.status) { conds.push(`r.status = $${pi}`); params.push(query.status); pi++; }

  const where = conds.join(' AND ');
  const sort = ROUTE_SORT[query.sortBy] || 'r.route_name';
  const dir = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM routes r WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<RouteRow>(
    `SELECT r.* FROM routes r WHERE ${where} ORDER BY ${sort} ${dir} LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findRouteById(
  tenantId: string,
  id: string,
): Promise<(RouteRow & { stops: RouteStopRow[] }) | null> {
  const res = await queryDb<RouteRow>(
    `SELECT * FROM routes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  if (!res.rows[0]) return null;

  const stops = await getRouteStops(tenantId, id);
  return { ...res.rows[0], stops };
}

export async function createRoute(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<RouteRow> {
  const res = await queryDb<RouteRow>(
    `INSERT INTO routes (tenant_id, route_name, division, crew_id, day_of_week, status, zone, estimated_duration_hours, notes, color_code, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
     RETURNING *`,
    [tenantId, data.route_name, data.division, data.crew_id || null, data.day_of_week, data.status, data.zone || null, data.estimated_duration_hours ?? null, data.notes || null, data.color_code || null, userId],
  );
  return res.rows[0];
}

export async function updateRoute(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<RouteRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined && col !== 'updated_at') {
      sets.push(`${col} = $${pi}`);
      params.push(val ?? null);
      pi++;
    }
  }
  if (sets.length === 0) return findRouteByIdSimple(tenantId, id);

  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;

  let cc = '';
  if (data.updated_at) { cc = ` AND updated_at = $${pi}`; params.push(data.updated_at); pi++; }

  params.push(id); params.push(tenantId);

  const res = await queryDb<RouteRow>(
    `UPDATE routes SET ${sets.join(', ')} WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL${cc} RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

async function findRouteByIdSimple(tenantId: string, id: string): Promise<RouteRow | null> {
  const res = await queryDb<RouteRow>(
    `SELECT * FROM routes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function softDeleteRoute(tenantId: string, id: string): Promise<RouteRow | null> {
  const res = await queryDb<RouteRow>(
    `UPDATE routes SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

// --- Route Stops ---

export async function getRouteStops(tenantId: string, routeId: string): Promise<RouteStopRow[]> {
  const res = await queryDb<RouteStopRow>(
    `SELECT rs.*, p.property_name, p.address_line1, p.city
     FROM route_stops rs
     LEFT JOIN properties p ON p.id = rs.property_id AND p.deleted_at IS NULL
     WHERE rs.tenant_id = $1 AND rs.route_id = $2 AND rs.is_active = true
     ORDER BY rs.stop_order ASC`,
    [tenantId, routeId],
  );
  return res.rows;
}

export async function addStop(
  tenantId: string,
  routeId: string,
  data: Record<string, unknown>,
): Promise<RouteStopRow> {
  // If no stop_order, get max + 1
  let stopOrder = data.stop_order;
  if (!stopOrder) {
    const maxRes = await queryDb<{ max_order: string | null }>(
      `SELECT MAX(stop_order) AS max_order FROM route_stops
       WHERE tenant_id = $1 AND route_id = $2 AND is_active = true`,
      [tenantId, routeId],
    );
    stopOrder = (parseInt(maxRes.rows[0].max_order || '0', 10)) + 1;
  }

  const res = await queryDb<RouteStopRow>(
    `INSERT INTO route_stops (tenant_id, route_id, property_id, stop_order, estimated_arrival_time, estimated_duration_minutes, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, routeId, data.property_id, stopOrder, data.estimated_arrival_time || null, data.estimated_duration_minutes ?? null, data.notes || null],
  );
  return res.rows[0];
}

export async function updateStop(
  tenantId: string,
  stopId: string,
  data: Record<string, unknown>,
): Promise<RouteStopRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  const fields: Array<[string, unknown]> = [
    ['property_id', data.property_id],
    ['stop_order', data.stop_order],
    ['estimated_arrival_time', data.estimated_arrival_time],
    ['estimated_duration_minutes', data.estimated_duration_minutes],
    ['notes', data.notes],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      sets.push(`${col} = $${pi}`);
      params.push(val ?? null);
      pi++;
    }
  }
  if (sets.length === 0) return null;

  params.push(stopId); params.push(tenantId);

  const res = await queryDb<RouteStopRow>(
    `UPDATE route_stops SET ${sets.join(', ')}
     WHERE id = $${pi} AND tenant_id = $${pi + 1} AND is_active = true
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function removeStop(tenantId: string, stopId: string): Promise<RouteStopRow | null> {
  const res = await queryDb<RouteStopRow>(
    `UPDATE route_stops SET is_active = false
     WHERE id = $1 AND tenant_id = $2 AND is_active = true
     RETURNING *`,
    [stopId, tenantId],
  );
  return res.rows[0] || null;
}

export async function getStopById(tenantId: string, stopId: string): Promise<RouteStopRow | null> {
  const res = await queryDb<RouteStopRow>(
    `SELECT * FROM route_stops WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
    [stopId, tenantId],
  );
  return res.rows[0] || null;
}

export async function reorderStops(
  tenantId: string,
  routeId: string,
  stopIds: string[],
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < stopIds.length; i++) {
      await client.query(
        `UPDATE route_stops SET stop_order = $1
         WHERE id = $2 AND tenant_id = $3 AND route_id = $4 AND is_active = true`,
        [i + 1, stopIds[i], tenantId, routeId],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function propertyExists(tenantId: string, propertyId: string): Promise<boolean> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM properties
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [propertyId, tenantId],
  );
  return parseInt(res.rows[0].count, 10) > 0;
}
