import { queryDb } from '../../config/database.js';
import type { ProjectQuery } from './schema.js';

// --- Types ---

export interface ProjectRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string;
  contract_id: string | null;
  project_number: string;
  title: string;
  description: string | null;
  status: string;
  stage_entered_at: string;
  estimated_value: number | null;
  actual_value: number | null;
  estimated_start_date: string | null;
  actual_start_date: string | null;
  estimated_end_date: string | null;
  actual_end_date: string | null;
  project_type: string;
  assigned_to: string | null;
  division: string;
  source: string | null;
  loss_reason: string | null;
  notes: string | null;
  tags: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer_display_name?: string;
  property_name?: string;
}

export interface MilestoneRow {
  id: string;
  tenant_id: string;
  project_id: string;
  milestone_name: string;
  description: string | null;
  due_date: string | null;
  completed_date: string | null;
  status: string;
  sort_order: number;
  payment_amount: number | null;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

export interface StageHistoryRow {
  id: string;
  tenant_id: string;
  project_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
}

interface CountRow { count: string; }
interface SeqRow { next_num: string; }

const SORT_MAP: Record<string, string> = {
  project_number: 'hp.project_number',
  title: 'hp.title',
  status: 'hp.status',
  estimated_value: 'hp.estimated_value',
  created_at: 'hp.created_at',
};

// ======== PROJECTS ========

export async function findAllProjects(
  tenantId: string,
  query: ProjectQuery,
): Promise<{ rows: ProjectRow[]; total: number }> {
  const conds: string[] = ['hp.tenant_id = $1', 'hp.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.search) {
    conds.push(`(hp.project_number ILIKE $${pi} OR hp.title ILIKE $${pi} OR hp.description ILIKE $${pi})`);
    params.push(`%${query.search}%`);
    pi++;
  }
  if (query.status) { conds.push(`hp.status = $${pi}`); params.push(query.status); pi++; }
  if (query.project_type) { conds.push(`hp.project_type = $${pi}`); params.push(query.project_type); pi++; }
  if (query.assigned_to) { conds.push(`hp.assigned_to = $${pi}`); params.push(query.assigned_to); pi++; }
  if (query.customer_id) { conds.push(`hp.customer_id = $${pi}`); params.push(query.customer_id); pi++; }
  if (query.source) { conds.push(`hp.source = $${pi}`); params.push(query.source); pi++; }
  if (query.value_min !== undefined) { conds.push(`hp.estimated_value >= $${pi}`); params.push(query.value_min); pi++; }
  if (query.value_max !== undefined) { conds.push(`hp.estimated_value <= $${pi}`); params.push(query.value_max); pi++; }

  const where = conds.join(' AND ');
  const sort = SORT_MAP[query.sortBy] || 'hp.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM hardscape_projects hp WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<ProjectRow>(
    `SELECT hp.*,
            c.display_name AS customer_display_name,
            p.property_name
     FROM hardscape_projects hp
     LEFT JOIN customers c ON c.id = hp.customer_id AND c.deleted_at IS NULL
     LEFT JOIN properties p ON p.id = hp.property_id AND p.deleted_at IS NULL
     WHERE ${where}
     ORDER BY ${sort} ${dir}
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findProjectById(
  tenantId: string,
  id: string,
): Promise<(ProjectRow & { milestones: MilestoneRow[]; stage_history: StageHistoryRow[] }) | null> {
  const res = await queryDb<ProjectRow>(
    `SELECT hp.*,
            c.display_name AS customer_display_name,
            p.property_name
     FROM hardscape_projects hp
     LEFT JOIN customers c ON c.id = hp.customer_id AND c.deleted_at IS NULL
     LEFT JOIN properties p ON p.id = hp.property_id AND p.deleted_at IS NULL
     WHERE hp.id = $1 AND hp.tenant_id = $2 AND hp.deleted_at IS NULL`,
    [id, tenantId],
  );
  if (!res.rows[0]) return null;

  const milestones = await findMilestonesByProjectId(tenantId, id);
  const stageHistory = await getStageHistory(tenantId, id);

  return { ...res.rows[0], milestones, stage_history: stageHistory };
}

export async function createProject(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<ProjectRow> {
  const res = await queryDb<ProjectRow>(
    `INSERT INTO hardscape_projects (
       tenant_id, customer_id, property_id, contract_id,
       project_number, title, description, status, stage_entered_at,
       estimated_value, estimated_start_date, estimated_end_date,
       project_type, assigned_to, division, source,
       notes, tags,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, 'lead', NOW(),
       $8, $9, $10,
       $11, $12, 'hardscape', $13,
       $14, $15,
       $16, $16
     ) RETURNING *`,
    [
      tenantId,
      data.customer_id,
      data.property_id,
      data.contract_id || null,
      data.project_number,
      data.title,
      data.description || null,
      data.estimated_value ?? null,
      data.estimated_start_date || null,
      data.estimated_end_date || null,
      data.project_type || 'other',
      data.assigned_to || null,
      data.source || null,
      data.notes || null,
      data.tags || null,
      userId,
    ],
  );
  return res.rows[0];
}

export async function updateProject(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<ProjectRow | null> {
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
  if (sets.length === 0) return findProjectByIdSimple(tenantId, id);

  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);

  const res = await queryDb<ProjectRow>(
    `UPDATE hardscape_projects SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

async function findProjectByIdSimple(tenantId: string, id: string): Promise<ProjectRow | null> {
  const res = await queryDb<ProjectRow>(
    `SELECT * FROM hardscape_projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function updateStage(
  tenantId: string,
  id: string,
  stage: string,
  userId: string,
  extraFields?: Record<string, unknown>,
): Promise<ProjectRow | null> {
  const sets = ['status = $1', 'stage_entered_at = NOW()', 'updated_by = $2'];
  const params: unknown[] = [stage, userId];
  let pi = 3;

  if (extraFields) {
    for (const [col, val] of Object.entries(extraFields)) {
      sets.push(`${col} = $${pi}`);
      params.push(val ?? null);
      pi++;
    }
  }

  params.push(id); params.push(tenantId);

  const res = await queryDb<ProjectRow>(
    `UPDATE hardscape_projects SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function softDeleteProject(tenantId: string, id: string): Promise<ProjectRow | null> {
  const res = await queryDb<ProjectRow>(
    `UPDATE hardscape_projects SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function generateProjectNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const res = await queryDb<SeqRow>(
    `SELECT COUNT(*) + 1 AS next_num FROM hardscape_projects
     WHERE tenant_id = $1 AND project_number LIKE $2`,
    [tenantId, `HP-${year}-%`],
  );
  const nextNum = parseInt(res.rows[0].next_num, 10);
  return `HP-${year}-${String(nextNum).padStart(4, '0')}`;
}

// ======== MILESTONES ========

export async function findMilestonesByProjectId(tenantId: string, projectId: string): Promise<MilestoneRow[]> {
  const res = await queryDb<MilestoneRow>(
    `SELECT * FROM hardscape_milestones
     WHERE tenant_id = $1 AND project_id = $2
     ORDER BY sort_order ASC, created_at ASC`,
    [tenantId, projectId],
  );
  return res.rows;
}

export async function findMilestoneById(tenantId: string, milestoneId: string): Promise<MilestoneRow | null> {
  const res = await queryDb<MilestoneRow>(
    `SELECT * FROM hardscape_milestones WHERE id = $1 AND tenant_id = $2`,
    [milestoneId, tenantId],
  );
  return res.rows[0] || null;
}

export async function createMilestone(
  tenantId: string,
  projectId: string,
  data: Record<string, unknown>,
): Promise<MilestoneRow> {
  const res = await queryDb<MilestoneRow>(
    `INSERT INTO hardscape_milestones (
       tenant_id, project_id, milestone_name, description,
       due_date, sort_order, payment_amount
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      tenantId, projectId,
      data.milestone_name,
      data.description || null,
      data.due_date || null,
      data.sort_order ?? 0,
      data.payment_amount ?? null,
    ],
  );
  return res.rows[0];
}

export async function updateMilestone(
  tenantId: string,
  milestoneId: string,
  data: Record<string, unknown>,
): Promise<MilestoneRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  const fields = [
    'milestone_name', 'description', 'due_date', 'completed_date',
    'status', 'sort_order', 'payment_amount', 'payment_status',
  ];

  for (const col of fields) {
    if (data[col] !== undefined) {
      sets.push(`${col} = $${pi}`);
      params.push(data[col] ?? null);
      pi++;
    }
  }
  if (sets.length === 0) return findMilestoneById(tenantId, milestoneId);

  params.push(milestoneId); params.push(tenantId);

  const res = await queryDb<MilestoneRow>(
    `UPDATE hardscape_milestones SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi}
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

// ======== STAGE HISTORY ========

export async function getStageHistory(tenantId: string, projectId: string): Promise<StageHistoryRow[]> {
  const res = await queryDb<StageHistoryRow>(
    `SELECT * FROM hardscape_stage_history
     WHERE tenant_id = $1 AND project_id = $2
     ORDER BY changed_at ASC`,
    [tenantId, projectId],
  );
  return res.rows;
}

export async function recordStageChange(
  tenantId: string,
  projectId: string,
  fromStage: string | null,
  toStage: string,
  userId: string,
  notes?: string,
): Promise<StageHistoryRow> {
  const res = await queryDb<StageHistoryRow>(
    `INSERT INTO hardscape_stage_history (
       tenant_id, project_id, from_stage, to_stage, changed_by, notes
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [tenantId, projectId, fromStage, toStage, userId, notes || null],
  );
  return res.rows[0];
}

// ======== PIPELINE STATS ========

export async function getPipelineStats(tenantId: string): Promise<{
  byStage: Array<{ stage: string; count: string; total_value: string }>;
  winLoss: { completed: string; lost: string };
  byType: Array<{ project_type: string; count: string; total_value: string }>;
}> {
  const stageRes = await queryDb<{ stage: string; count: string; total_value: string }>(
    `SELECT status AS stage,
            COUNT(*)::text AS count,
            COALESCE(SUM(estimated_value), 0)::text AS total_value
     FROM hardscape_projects
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY status
     ORDER BY status`,
    [tenantId],
  );

  const winLossRes = await queryDb<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM hardscape_projects
     WHERE tenant_id = $1 AND status IN ('completed', 'lost') AND deleted_at IS NULL
     GROUP BY status`,
    [tenantId],
  );
  const winLoss = { completed: '0', lost: '0' };
  for (const row of winLossRes.rows) {
    if (row.status === 'completed') winLoss.completed = row.count;
    if (row.status === 'lost') winLoss.lost = row.count;
  }

  const typeRes = await queryDb<{ project_type: string; count: string; total_value: string }>(
    `SELECT project_type,
            COUNT(*)::text AS count,
            COALESCE(SUM(COALESCE(actual_value, estimated_value)), 0)::text AS total_value
     FROM hardscape_projects
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY project_type
     ORDER BY project_type`,
    [tenantId],
  );

  return {
    byStage: stageRes.rows,
    winLoss,
    byType: typeRes.rows,
  };
}
