import { queryDb } from '../../config/database.js';
import type { EntryQuery } from './schema.js';

// --- Time Entry types ---

export interface TimeEntryRow {
  id: string;
  tenant_id: string;
  user_id: string;
  job_id: string | null;
  crew_id: string | null;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_minutes: number | null;
  status: string;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_method: string;
  clock_out_method: string | null;
  notes: string | null;
  admin_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  user_first_name?: string;
  user_last_name?: string;
  job_title?: string;
  crew_name?: string;
}

export interface GpsEventRow {
  id: string;
  tenant_id: string;
  user_id: string;
  job_id: string | null;
  crew_id: string | null;
  event_type: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
  device_info: string | null;
  created_at: string;
}

interface CountRow { count: string; }

const ENTRY_SORT: Record<string, string> = {
  clock_in: 'te.clock_in',
  created_at: 'te.created_at',
  status: 'te.status',
  total_minutes: 'te.total_minutes',
};

// ======== TIME ENTRIES ========

export async function findAllEntries(
  tenantId: string,
  query: EntryQuery,
): Promise<{ rows: TimeEntryRow[]; total: number }> {
  const conds: string[] = ['te.tenant_id = $1', 'te.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.user_id) { conds.push(`te.user_id = $${pi}`); params.push(query.user_id); pi++; }
  if (query.job_id) { conds.push(`te.job_id = $${pi}`); params.push(query.job_id); pi++; }
  if (query.crew_id) { conds.push(`te.crew_id = $${pi}`); params.push(query.crew_id); pi++; }
  if (query.status) { conds.push(`te.status = $${pi}`); params.push(query.status); pi++; }
  if (query.date_from) { conds.push(`te.clock_in >= $${pi}`); params.push(query.date_from); pi++; }
  if (query.date_to) { conds.push(`te.clock_in <= $${pi}::date + INTERVAL '1 day'`); params.push(query.date_to); pi++; }

  const where = conds.join(' AND ');
  const sort = ENTRY_SORT[query.sortBy] || 'te.clock_in';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM time_entries te WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<TimeEntryRow>(
    `SELECT te.*,
            u.first_name AS user_first_name, u.last_name AS user_last_name,
            j.title AS job_title,
            c.crew_name
     FROM time_entries te
     LEFT JOIN users u ON u.id = te.user_id
     LEFT JOIN jobs j ON j.id = te.job_id
     LEFT JOIN crews c ON c.id = te.crew_id
     WHERE ${where}
     ORDER BY ${sort} ${dir}
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findEntryById(
  tenantId: string,
  id: string,
): Promise<TimeEntryRow | null> {
  const res = await queryDb<TimeEntryRow>(
    `SELECT te.*,
            u.first_name AS user_first_name, u.last_name AS user_last_name,
            j.title AS job_title,
            c.crew_name
     FROM time_entries te
     LEFT JOIN users u ON u.id = te.user_id
     LEFT JOIN jobs j ON j.id = te.job_id
     LEFT JOIN crews c ON c.id = te.crew_id
     WHERE te.id = $1 AND te.tenant_id = $2 AND te.deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function clockIn(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<TimeEntryRow> {
  const res = await queryDb<TimeEntryRow>(
    `INSERT INTO time_entries
       (tenant_id, user_id, job_id, crew_id, clock_in, status,
        clock_in_latitude, clock_in_longitude, clock_in_method, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, 'clocked_in', $6, $7, $8, $9, $10, $10)
     RETURNING *`,
    [
      tenantId,
      data.user_id,
      data.job_id || null,
      data.crew_id || null,
      data.clock_in,
      data.clock_in_latitude ?? null,
      data.clock_in_longitude ?? null,
      data.clock_in_method || 'manual',
      data.notes || null,
      userId,
    ],
  );
  return res.rows[0];
}

export async function clockOut(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<TimeEntryRow | null> {
  const res = await queryDb<TimeEntryRow>(
    `UPDATE time_entries
     SET clock_out = $1,
         break_minutes = $2,
         total_minutes = $3,
         status = 'clocked_out',
         clock_out_latitude = $4,
         clock_out_longitude = $5,
         clock_out_method = $6,
         notes = COALESCE($7, notes),
         updated_by = $8
     WHERE id = $9 AND tenant_id = $10 AND deleted_at IS NULL AND status = 'clocked_in'
     RETURNING *`,
    [
      data.clock_out,
      data.break_minutes ?? 0,
      data.total_minutes,
      data.clock_out_latitude ?? null,
      data.clock_out_longitude ?? null,
      data.clock_out_method || 'manual',
      data.notes || null,
      userId,
      id,
      tenantId,
    ],
  );
  return res.rows[0] || null;
}

export async function updateEntry(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<TimeEntryRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined) {
      sets.push(`${col} = $${pi}`);
      params.push(val ?? null);
      pi++;
    }
  }
  if (sets.length === 0) return findEntryById(tenantId, id);

  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);

  const res = await queryDb<TimeEntryRow>(
    `UPDATE time_entries SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function approveEntry(
  tenantId: string,
  id: string,
  approvedBy: string,
): Promise<TimeEntryRow | null> {
  const res = await queryDb<TimeEntryRow>(
    `UPDATE time_entries
     SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
       AND status IN ('clocked_out', 'adjusted', 'disputed')
     RETURNING *`,
    [approvedBy, id, tenantId],
  );
  return res.rows[0] || null;
}

export async function getActiveClockIn(
  tenantId: string,
  userId: string,
): Promise<TimeEntryRow | null> {
  const res = await queryDb<TimeEntryRow>(
    `SELECT * FROM time_entries
     WHERE tenant_id = $1 AND user_id = $2 AND status = 'clocked_in' AND deleted_at IS NULL
     ORDER BY clock_in DESC LIMIT 1`,
    [tenantId, userId],
  );
  return res.rows[0] || null;
}

export async function getByUserDateRange(
  tenantId: string,
  userId: string,
  dateFrom: string,
  dateTo: string,
): Promise<TimeEntryRow[]> {
  const res = await queryDb<TimeEntryRow>(
    `SELECT te.*,
            j.title AS job_title,
            c.crew_name
     FROM time_entries te
     LEFT JOIN jobs j ON j.id = te.job_id
     LEFT JOIN crews c ON c.id = te.crew_id
     WHERE te.tenant_id = $1 AND te.user_id = $2
       AND te.clock_in >= $3 AND te.clock_in <= $4::date + INTERVAL '1 day'
       AND te.deleted_at IS NULL
     ORDER BY te.clock_in ASC`,
    [tenantId, userId, dateFrom, dateTo],
  );
  return res.rows;
}

export async function getDailySummary(
  tenantId: string,
  date: string,
  crewId?: string,
): Promise<Array<{ user_id: string; user_first_name: string; user_last_name: string; total_minutes: string; entry_count: string }>> {
  const conds = ['te.tenant_id = $1', 'te.clock_in::date = $2::date', 'te.deleted_at IS NULL'];
  const params: unknown[] = [tenantId, date];
  let pi = 3;

  if (crewId) { conds.push(`te.crew_id = $${pi}`); params.push(crewId); pi++; }

  const res = await queryDb<{ user_id: string; user_first_name: string; user_last_name: string; total_minutes: string; entry_count: string }>(
    `SELECT te.user_id,
            u.first_name AS user_first_name,
            u.last_name AS user_last_name,
            COALESCE(SUM(te.total_minutes), 0) AS total_minutes,
            COUNT(te.id) AS entry_count
     FROM time_entries te
     JOIN users u ON u.id = te.user_id
     WHERE ${conds.join(' AND ')}
     GROUP BY te.user_id, u.first_name, u.last_name
     ORDER BY u.last_name ASC`,
    params,
  );
  return res.rows;
}

export async function getWeeklySummary(
  tenantId: string,
  userId: string,
  weekStart: string,
): Promise<Array<{ day: string; total_minutes: string; entry_count: string }>> {
  const res = await queryDb<{ day: string; total_minutes: string; entry_count: string }>(
    `SELECT te.clock_in::date AS day,
            COALESCE(SUM(te.total_minutes), 0) AS total_minutes,
            COUNT(te.id) AS entry_count
     FROM time_entries te
     WHERE te.tenant_id = $1 AND te.user_id = $2
       AND te.clock_in >= $3::date AND te.clock_in < $3::date + INTERVAL '7 days'
       AND te.deleted_at IS NULL
     GROUP BY te.clock_in::date
     ORDER BY day ASC`,
    [tenantId, userId, weekStart],
  );
  return res.rows;
}

export async function userExists(tenantId: string, userId: string): Promise<boolean> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
    [userId, tenantId],
  );
  return parseInt(res.rows[0].count, 10) > 0;
}

export async function isUserInCrew(
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

// ======== GPS EVENTS ========

export async function recordGpsEvent(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<GpsEventRow> {
  const res = await queryDb<GpsEventRow>(
    `INSERT INTO gps_events
       (tenant_id, user_id, job_id, crew_id, event_type, latitude, longitude,
        accuracy_meters, recorded_at, device_info)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      tenantId,
      userId,
      data.job_id || null,
      data.crew_id || null,
      data.event_type,
      data.latitude,
      data.longitude,
      data.accuracy_meters ?? null,
      data.recorded_at || new Date().toISOString(),
      data.device_info || null,
    ],
  );
  return res.rows[0];
}

export async function getEventsByJob(
  tenantId: string,
  jobId: string,
): Promise<GpsEventRow[]> {
  const res = await queryDb<GpsEventRow>(
    `SELECT * FROM gps_events
     WHERE tenant_id = $1 AND job_id = $2
     ORDER BY recorded_at ASC`,
    [tenantId, jobId],
  );
  return res.rows;
}

export async function getEventsByUser(
  tenantId: string,
  userId: string,
  dateFrom: string,
  dateTo: string,
): Promise<GpsEventRow[]> {
  const res = await queryDb<GpsEventRow>(
    `SELECT * FROM gps_events
     WHERE tenant_id = $1 AND user_id = $2
       AND recorded_at >= $3 AND recorded_at <= $4::date + INTERVAL '1 day'
     ORDER BY recorded_at ASC`,
    [tenantId, userId, dateFrom, dateTo],
  );
  return res.rows;
}

export async function getLatestByUser(
  tenantId: string,
  userId: string,
): Promise<GpsEventRow | null> {
  const res = await queryDb<GpsEventRow>(
    `SELECT * FROM gps_events
     WHERE tenant_id = $1 AND user_id = $2
     ORDER BY recorded_at DESC LIMIT 1`,
    [tenantId, userId],
  );
  return res.rows[0] || null;
}
