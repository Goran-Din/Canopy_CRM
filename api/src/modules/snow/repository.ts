import { queryDb } from '../../config/database.js';
import type { SeasonQuery, RunQuery } from './schema.js';

// --- Types ---

export interface SeasonRow {
  id: string;
  tenant_id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  status: string;
  default_trigger_inches: number;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RunRow {
  id: string;
  tenant_id: string;
  season_id: string;
  run_number: number;
  run_date: string;
  status: string;
  trigger_type: string;
  snowfall_inches: number | null;
  temperature_f: number | null;
  weather_notes: string | null;
  start_time: string | null;
  end_time: string | null;
  total_properties_serviced: number;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  season_name?: string;
}

export interface EntryRow {
  id: string;
  tenant_id: string;
  run_id: string;
  property_id: string;
  contract_id: string | null;
  crew_id: string | null;
  status: string;
  service_type: string;
  arrival_time: string | null;
  departure_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  issue_description: string | null;
  photos_url: string[] | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  property_name?: string;
  crew_name?: string;
}

interface CountRow { count: string; }
interface SeqRow { next_num: string; }

interface SnowContractProperty {
  property_id: string;
  contract_id: string;
}

const SEASON_SORT_MAP: Record<string, string> = {
  season_name: 's.season_name',
  start_date: 's.start_date',
  status: 's.status',
  created_at: 's.created_at',
};

const RUN_SORT_MAP: Record<string, string> = {
  run_number: 'r.run_number',
  run_date: 'r.run_date',
  status: 'r.status',
  created_at: 'r.created_at',
};

// ======== SEASONS ========

export async function findAllSeasons(
  tenantId: string,
  query: SeasonQuery,
): Promise<{ rows: SeasonRow[]; total: number }> {
  const conds: string[] = ['s.tenant_id = $1', 's.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.status) { conds.push(`s.status = $${pi}`); params.push(query.status); pi++; }

  const where = conds.join(' AND ');
  const sort = SEASON_SORT_MAP[query.sortBy] || 's.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM snow_seasons s WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<SeasonRow>(
    `SELECT s.*
     FROM snow_seasons s
     WHERE ${where}
     ORDER BY ${sort} ${dir}
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findSeasonById(tenantId: string, id: string): Promise<SeasonRow | null> {
  const res = await queryDb<SeasonRow>(
    `SELECT * FROM snow_seasons WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function getActiveSeason(tenantId: string): Promise<SeasonRow | null> {
  const res = await queryDb<SeasonRow>(
    `SELECT * FROM snow_seasons
     WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL
     LIMIT 1`,
    [tenantId],
  );
  return res.rows[0] || null;
}

export async function createSeason(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<SeasonRow> {
  const res = await queryDb<SeasonRow>(
    `INSERT INTO snow_seasons (
       tenant_id, season_name, start_date, end_date,
       status, default_trigger_inches, notes,
       created_by, updated_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING *`,
    [
      tenantId,
      data.season_name,
      data.start_date,
      data.end_date,
      data.status || 'planning',
      data.default_trigger_inches ?? 2.0,
      data.notes || null,
      userId,
    ],
  );
  return res.rows[0];
}

export async function updateSeason(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<SeasonRow | null> {
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
  if (sets.length === 0) return findSeasonById(tenantId, id);

  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);

  const res = await queryDb<SeasonRow>(
    `UPDATE snow_seasons SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function softDeleteSeason(tenantId: string, id: string): Promise<SeasonRow | null> {
  const res = await queryDb<SeasonRow>(
    `UPDATE snow_seasons SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

// ======== RUNS ========

export async function findAllRuns(
  tenantId: string,
  query: RunQuery,
): Promise<{ rows: RunRow[]; total: number }> {
  const conds: string[] = ['r.tenant_id = $1', 'r.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.season_id) { conds.push(`r.season_id = $${pi}`); params.push(query.season_id); pi++; }
  if (query.status) { conds.push(`r.status = $${pi}`); params.push(query.status); pi++; }
  if (query.date_from) { conds.push(`r.run_date >= $${pi}`); params.push(query.date_from); pi++; }
  if (query.date_to) { conds.push(`r.run_date <= $${pi}`); params.push(query.date_to); pi++; }

  const where = conds.join(' AND ');
  const sort = RUN_SORT_MAP[query.sortBy] || 'r.run_date';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM snow_runs r WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<RunRow>(
    `SELECT r.*, ss.season_name
     FROM snow_runs r
     LEFT JOIN snow_seasons ss ON ss.id = r.season_id AND ss.deleted_at IS NULL
     WHERE ${where}
     ORDER BY ${sort} ${dir}
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findRunById(
  tenantId: string,
  id: string,
): Promise<(RunRow & { entries: EntryRow[] }) | null> {
  const res = await queryDb<RunRow>(
    `SELECT r.*, ss.season_name
     FROM snow_runs r
     LEFT JOIN snow_seasons ss ON ss.id = r.season_id AND ss.deleted_at IS NULL
     WHERE r.id = $1 AND r.tenant_id = $2 AND r.deleted_at IS NULL`,
    [id, tenantId],
  );
  if (!res.rows[0]) return null;

  const entries = await findEntriesByRunId(tenantId, id);
  return { ...res.rows[0], entries };
}

export async function createRun(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<RunRow> {
  const res = await queryDb<RunRow>(
    `INSERT INTO snow_runs (
       tenant_id, season_id, run_number, run_date,
       status, trigger_type, snowfall_inches, temperature_f,
       weather_notes, notes,
       created_by, updated_by
     ) VALUES ($1, $2, $3, $4, 'planned', $5, $6, $7, $8, $9, $10, $10)
     RETURNING *`,
    [
      tenantId,
      data.season_id,
      data.run_number,
      data.run_date,
      data.trigger_type,
      data.snowfall_inches ?? null,
      data.temperature_f ?? null,
      data.weather_notes || null,
      data.notes || null,
      userId,
    ],
  );
  return res.rows[0];
}

export async function updateRun(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<RunRow | null> {
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
  if (sets.length === 0) return findRunByIdSimple(tenantId, id);

  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);

  const res = await queryDb<RunRow>(
    `UPDATE snow_runs SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

async function findRunByIdSimple(tenantId: string, id: string): Promise<RunRow | null> {
  const res = await queryDb<RunRow>(
    `SELECT * FROM snow_runs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function updateRunStatus(
  tenantId: string,
  id: string,
  status: string,
  userId: string,
): Promise<RunRow | null> {
  const res = await queryDb<RunRow>(
    `UPDATE snow_runs SET status = $1, updated_by = $2
     WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [status, userId, id, tenantId],
  );
  return res.rows[0] || null;
}

export async function generateRunNumber(tenantId: string, seasonId: string): Promise<number> {
  const res = await queryDb<SeqRow>(
    `SELECT COALESCE(MAX(run_number), 0) + 1 AS next_num FROM snow_runs
     WHERE tenant_id = $1 AND season_id = $2`,
    [tenantId, seasonId],
  );
  return parseInt(res.rows[0].next_num, 10);
}

export async function updateTotalPropertiesServiced(
  tenantId: string,
  runId: string,
): Promise<void> {
  await queryDb(
    `UPDATE snow_runs SET total_properties_serviced = (
       SELECT COUNT(*) FROM snow_run_entries
       WHERE tenant_id = $1 AND run_id = $2 AND status = 'completed'
     )
     WHERE id = $2 AND tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId, runId],
  );
}

// ======== ENTRIES ========

export async function findEntriesByRunId(tenantId: string, runId: string): Promise<EntryRow[]> {
  const res = await queryDb<EntryRow>(
    `SELECT e.*,
            p.property_name,
            cr.crew_name
     FROM snow_run_entries e
     LEFT JOIN properties p ON p.id = e.property_id AND p.deleted_at IS NULL
     LEFT JOIN crews cr ON cr.id = e.crew_id AND cr.deleted_at IS NULL
     WHERE e.tenant_id = $1 AND e.run_id = $2
     ORDER BY e.created_at ASC`,
    [tenantId, runId],
  );
  return res.rows;
}

export async function findEntryById(tenantId: string, entryId: string): Promise<EntryRow | null> {
  const res = await queryDb<EntryRow>(
    `SELECT e.*,
            p.property_name,
            cr.crew_name
     FROM snow_run_entries e
     LEFT JOIN properties p ON p.id = e.property_id AND p.deleted_at IS NULL
     LEFT JOIN crews cr ON cr.id = e.crew_id AND cr.deleted_at IS NULL
     WHERE e.id = $1 AND e.tenant_id = $2`,
    [entryId, tenantId],
  );
  return res.rows[0] || null;
}

export async function createEntry(
  tenantId: string,
  runId: string,
  data: Record<string, unknown>,
): Promise<EntryRow> {
  const res = await queryDb<EntryRow>(
    `INSERT INTO snow_run_entries (
       tenant_id, run_id, property_id, contract_id, crew_id,
       status, service_type, notes
     ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
     RETURNING *`,
    [
      tenantId, runId,
      data.property_id,
      data.contract_id || null,
      data.crew_id || null,
      data.service_type || 'combination',
      data.notes || null,
    ],
  );
  return res.rows[0];
}

export async function updateEntry(
  tenantId: string,
  entryId: string,
  data: Record<string, unknown>,
): Promise<EntryRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  const fields = [
    'crew_id', 'service_type', 'arrival_time', 'departure_time',
    'notes', 'issue_description', 'photos_url',
  ];

  for (const col of fields) {
    if (data[col] !== undefined) {
      sets.push(`${col} = $${pi}`);
      params.push(data[col] ?? null);
      pi++;
    }
  }

  // Auto-calculate duration if both times present
  if (data.duration_minutes !== undefined) {
    sets.push(`duration_minutes = $${pi}`);
    params.push(data.duration_minutes);
    pi++;
  }

  if (sets.length === 0) return findEntryById(tenantId, entryId);

  params.push(entryId); params.push(tenantId);

  const res = await queryDb<EntryRow>(
    `UPDATE snow_run_entries SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi}
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function updateEntryStatus(
  tenantId: string,
  entryId: string,
  status: string,
  userId: string | null,
): Promise<EntryRow | null> {
  const completedBy = status === 'completed' ? userId : null;
  const res = await queryDb<EntryRow>(
    `UPDATE snow_run_entries SET status = $1, completed_by = $2
     WHERE id = $3 AND tenant_id = $4
     RETURNING *`,
    [status, completedBy, entryId, tenantId],
  );
  return res.rows[0] || null;
}

export async function getSnowContractProperties(tenantId: string): Promise<SnowContractProperty[]> {
  const res = await queryDb<SnowContractProperty>(
    `SELECT DISTINCT sc.property_id, sc.id AS contract_id
     FROM service_contracts sc
     WHERE sc.tenant_id = $1
       AND sc.division = 'snow_removal'
       AND sc.status = 'active'
       AND sc.deleted_at IS NULL
       AND sc.property_id IS NOT NULL`,
    [tenantId],
  );
  return res.rows;
}

export async function bulkCreateEntries(
  tenantId: string,
  runId: string,
  entries: Array<{ property_id: string; contract_id: string }>,
): Promise<EntryRow[]> {
  if (entries.length === 0) return [];

  const values: string[] = [];
  const params: unknown[] = [tenantId, runId];
  let pi = 3;

  for (const entry of entries) {
    values.push(`($1, $2, $${pi}, $${pi + 1}, 'pending', 'combination')`);
    params.push(entry.property_id, entry.contract_id);
    pi += 2;
  }

  const res = await queryDb<EntryRow>(
    `INSERT INTO snow_run_entries (tenant_id, run_id, property_id, contract_id, status, service_type)
     VALUES ${values.join(', ')}
     RETURNING *`,
    params,
  );
  return res.rows;
}

// ======== STATS ========

export async function getStats(tenantId: string, seasonId?: string): Promise<{
  totalRuns: string;
  avgPropertiesPerRun: string;
  totalSnowfall: string;
  completedEntries: string;
}> {
  const seasonFilter = seasonId
    ? ' AND r.season_id = $2'
    : '';
  const seasonParams = seasonId ? [tenantId, seasonId] : [tenantId];

  const runsRes = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM snow_runs r
     WHERE r.tenant_id = $1 AND r.deleted_at IS NULL${seasonFilter}`,
    seasonParams,
  );

  const avgRes = await queryDb<{ avg_props: string }>(
    `SELECT COALESCE(AVG(r.total_properties_serviced), 0)::text AS avg_props
     FROM snow_runs r
     WHERE r.tenant_id = $1 AND r.status = 'completed' AND r.deleted_at IS NULL${seasonFilter}`,
    seasonParams,
  );

  const snowfallRes = await queryDb<{ total: string }>(
    `SELECT COALESCE(SUM(r.snowfall_inches), 0)::text AS total
     FROM snow_runs r
     WHERE r.tenant_id = $1 AND r.deleted_at IS NULL${seasonFilter}`,
    seasonParams,
  );

  const entriesRes = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM snow_run_entries e
     JOIN snow_runs r ON r.id = e.run_id AND r.deleted_at IS NULL${seasonFilter}
     WHERE e.tenant_id = $1 AND e.status = 'completed'`,
    seasonParams,
  );

  return {
    totalRuns: runsRes.rows[0].count,
    avgPropertiesPerRun: avgRes.rows[0].avg_props,
    totalSnowfall: snowfallRes.rows[0].total,
    completedEntries: entriesRes.rows[0].count,
  };
}
