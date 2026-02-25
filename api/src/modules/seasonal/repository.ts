import { queryDb } from '../../config/database.js';
import type { SeasonalQuery } from './schema.js';

// --- Types ---

export interface SeasonalTransitionRow {
  id: string;
  tenant_id: string;
  transition_type: string;
  season_year: number;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
  checklist: ChecklistItem[];
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChecklistItem {
  task: string;
  completed: boolean;
  completed_by?: string | null;
  completed_at?: string | null;
}

interface CountRow { count: string; }

// ============================================
// CRUD
// ============================================

export async function findAll(
  tenantId: string,
  query: SeasonalQuery,
): Promise<{ rows: SeasonalTransitionRow[]; total: number }> {
  const conds: string[] = ['tenant_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.transition_type) {
    conds.push(`transition_type = $${pi}::transition_type`);
    params.push(query.transition_type);
    pi++;
  }
  if (query.season_year) {
    conds.push(`season_year = $${pi}`);
    params.push(query.season_year);
    pi++;
  }
  if (query.status) {
    conds.push(`status = $${pi}::transition_status`);
    params.push(query.status);
    pi++;
  }

  const where = conds.join(' AND ');
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM seasonal_transitions WHERE ${where}`,
    params,
  );
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<SeasonalTransitionRow>(
    `SELECT * FROM seasonal_transitions
     WHERE ${where}
     ORDER BY scheduled_date DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );

  return { rows: data.rows, total };
}

export async function findById(
  tenantId: string,
  id: string,
): Promise<SeasonalTransitionRow | null> {
  const res = await queryDb<SeasonalTransitionRow>(
    `SELECT * FROM seasonal_transitions
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function create(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<SeasonalTransitionRow> {
  const res = await queryDb<SeasonalTransitionRow>(
    `INSERT INTO seasonal_transitions (
       tenant_id, transition_type, season_year, status,
       scheduled_date, checklist, notes,
       created_by, updated_by
     ) VALUES (
       $1, $2::transition_type, $3, $4::transition_status,
       $5, $6::jsonb, $7,
       $8, $8
     ) RETURNING *`,
    [
      tenantId,
      data.transition_type,
      data.season_year,
      data.status || 'planned',
      data.scheduled_date,
      JSON.stringify(data.checklist || []),
      data.notes || null,
      userId,
    ],
  );
  return res.rows[0];
}

export async function update(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<SeasonalTransitionRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  const fields: Array<[string, unknown, string?]> = [
    ['transition_type', data.transition_type, '::transition_type'],
    ['season_year', data.season_year],
    ['status', data.status, '::transition_status'],
    ['scheduled_date', data.scheduled_date],
    ['completed_date', data.completed_date],
    ['notes', data.notes],
  ];

  for (const [col, val, cast] of fields) {
    if (val !== undefined) {
      sets.push(`${col} = $${pi}${cast || ''}`);
      params.push(val ?? null);
      pi++;
    }
  }

  if (data.checklist !== undefined) {
    sets.push(`checklist = $${pi}::jsonb`);
    params.push(JSON.stringify(data.checklist));
    pi++;
  }

  if (sets.length === 0) return findById(tenantId, id);

  sets.push(`updated_by = $${pi}`);
  params.push(userId);
  pi++;

  params.push(id);
  params.push(tenantId);

  const res = await queryDb<SeasonalTransitionRow>(
    `UPDATE seasonal_transitions SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function updateChecklist(
  tenantId: string,
  id: string,
  checklist: ChecklistItem[],
  userId: string,
): Promise<SeasonalTransitionRow | null> {
  const res = await queryDb<SeasonalTransitionRow>(
    `UPDATE seasonal_transitions
     SET checklist = $1::jsonb, updated_by = $2
     WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [JSON.stringify(checklist), userId, id, tenantId],
  );
  return res.rows[0] || null;
}

export async function softDelete(
  tenantId: string,
  id: string,
): Promise<SeasonalTransitionRow | null> {
  const res = await queryDb<SeasonalTransitionRow>(
    `UPDATE seasonal_transitions SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}
