import { queryDb } from '../../config/database.js';
import type { TemplateQuery, AssignmentQuery } from './schema.js';

// ======== Row Types ========

export interface TemplateRow {
  id: string; tenant_id: string; title: string; description: string | null;
  category: string; division: string | null; status: string; version: number;
  created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
}

export interface StepRow {
  id: string; tenant_id: string; template_id: string;
  step_number: number; title: string; description: string | null;
  estimated_minutes: number | null; requires_photo: boolean;
  requires_signature: boolean; sort_order: number;
  created_at: string; updated_at: string; deleted_at: string | null;
}

export interface AssignmentRow {
  id: string; tenant_id: string; template_id: string;
  job_id: string | null; crew_id: string | null;
  assigned_date: string; status: string;
  completed_at: string | null; completed_by: string | null;
  notes: string | null; created_by: string | null;
  created_at: string; updated_at: string;
}

export interface StepCompletionRow {
  id: string; tenant_id: string; assignment_id: string; step_id: string;
  is_completed: boolean; completed_by: string | null;
  completed_at: string | null; photo_url: string | null;
  notes: string | null; created_at: string;
}

interface CountRow { count: string; }

// ======== Templates ========

const TEMPLATE_SORT_MAP: Record<string, string> = {
  title: 't.title', category: 't.category', status: 't.status',
  version: 't.version', created_at: 't.created_at',
};

export async function findAllTemplates(tenantId: string, query: TemplateQuery): Promise<{ rows: TemplateRow[]; total: number }> {
  const conds: string[] = ['t.tenant_id = $1', 't.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;
  if (query.search) { conds.push(`(t.title ILIKE $${pi} OR t.description ILIKE $${pi})`); params.push(`%${query.search}%`); pi++; }
  if (query.category) { conds.push(`t.category = $${pi}`); params.push(query.category); pi++; }
  if (query.division) { conds.push(`t.division = $${pi}`); params.push(query.division); pi++; }
  if (query.status) { conds.push(`t.status = $${pi}`); params.push(query.status); pi++; }
  const where = conds.join(' AND ');
  const sort = TEMPLATE_SORT_MAP[query.sortBy] || 't.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;
  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM sop_templates t WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);
  const data = await queryDb<TemplateRow>(
    `SELECT t.* FROM sop_templates t WHERE ${where} ORDER BY ${sort} ${dir} LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findTemplateById(tenantId: string, id: string): Promise<(TemplateRow & { steps: StepRow[] }) | null> {
  const res = await queryDb<TemplateRow>(
    `SELECT * FROM sop_templates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, tenantId],
  );
  if (!res.rows[0]) return null;
  const steps = await findStepsByTemplateId(tenantId, id);
  return { ...res.rows[0], steps };
}

export async function createTemplate(tenantId: string, data: Record<string, unknown>, userId: string): Promise<TemplateRow> {
  const res = await queryDb<TemplateRow>(
    `INSERT INTO sop_templates (tenant_id, title, description, category, division, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`,
    [tenantId, data.title, data.description||null, data.category||'other',
     data.division||null, userId],
  );
  return res.rows[0];
}

export async function updateTemplate(tenantId: string, id: string, data: Record<string, unknown>, userId: string): Promise<TemplateRow | null> {
  const sets: string[] = []; const params: unknown[] = []; let pi = 1;
  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined) { sets.push(`${col} = $${pi}`); params.push(val ?? null); pi++; }
  }
  if (sets.length === 0) {
    const r = await queryDb<TemplateRow>(`SELECT * FROM sop_templates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, tenantId]);
    return r.rows[0] || null;
  }
  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);
  const res = await queryDb<TemplateRow>(
    `UPDATE sop_templates SET ${sets.join(', ')} WHERE id = $${pi-1} AND tenant_id = $${pi} AND deleted_at IS NULL RETURNING *`, params,
  );
  return res.rows[0] || null;
}

export async function softDeleteTemplate(tenantId: string, id: string): Promise<TemplateRow | null> {
  const res = await queryDb<TemplateRow>(
    `UPDATE sop_templates SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function duplicateTemplate(tenantId: string, sourceId: string, userId: string): Promise<TemplateRow> {
  // Get max version for this template's title
  const src = await queryDb<TemplateRow>(
    `SELECT * FROM sop_templates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [sourceId, tenantId],
  );
  if (!src.rows[0]) throw new Error('Template not found');
  const source = src.rows[0];

  const maxV = await queryDb<{ max_version: string }>(
    `SELECT COALESCE(MAX(version), 0)::text AS max_version FROM sop_templates WHERE tenant_id = $1 AND title = $2 AND deleted_at IS NULL`,
    [tenantId, source.title],
  );
  const newVersion = parseInt(maxV.rows[0].max_version, 10) + 1;

  const newTpl = await queryDb<TemplateRow>(
    `INSERT INTO sop_templates (tenant_id, title, description, category, division, status, version, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$7) RETURNING *`,
    [tenantId, source.title, source.description, source.category, source.division, newVersion, userId],
  );
  const newId = newTpl.rows[0].id;

  // Clone steps
  const steps = await findStepsByTemplateId(tenantId, sourceId);
  for (const step of steps) {
    await queryDb(
      `INSERT INTO sop_steps (tenant_id, template_id, step_number, title, description, estimated_minutes, requires_photo, requires_signature, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [tenantId, newId, step.step_number, step.title, step.description,
       step.estimated_minutes, step.requires_photo, step.requires_signature, step.sort_order],
    );
  }

  return newTpl.rows[0];
}

// ======== Steps ========

export async function findStepsByTemplateId(tenantId: string, templateId: string): Promise<StepRow[]> {
  const res = await queryDb<StepRow>(
    `SELECT * FROM sop_steps WHERE tenant_id = $1 AND template_id = $2 AND deleted_at IS NULL ORDER BY sort_order`,
    [tenantId, templateId],
  );
  return res.rows;
}

export async function findStepById(tenantId: string, stepId: string): Promise<StepRow | null> {
  const res = await queryDb<StepRow>(
    `SELECT * FROM sop_steps WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [stepId, tenantId],
  );
  return res.rows[0] || null;
}

export async function createStep(tenantId: string, templateId: string, data: Record<string, unknown>): Promise<StepRow> {
  // Get next step_number and sort_order
  const maxRes = await queryDb<{ max_num: string; max_sort: string }>(
    `SELECT COALESCE(MAX(step_number), 0)::text AS max_num, COALESCE(MAX(sort_order), -1)::text AS max_sort
     FROM sop_steps WHERE tenant_id = $1 AND template_id = $2 AND deleted_at IS NULL`,
    [tenantId, templateId],
  );
  const stepNumber = parseInt(maxRes.rows[0].max_num, 10) + 1;
  const sortOrder = parseInt(maxRes.rows[0].max_sort, 10) + 1;

  const res = await queryDb<StepRow>(
    `INSERT INTO sop_steps (tenant_id, template_id, step_number, title, description,
       estimated_minutes, requires_photo, requires_signature, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [tenantId, templateId, stepNumber, data.title, data.description||null,
     data.estimated_minutes??null, data.requires_photo??false,
     data.requires_signature??false, sortOrder],
  );
  return res.rows[0];
}

export async function updateStep(tenantId: string, stepId: string, data: Record<string, unknown>): Promise<StepRow | null> {
  const sets: string[] = []; const params: unknown[] = []; let pi = 1;
  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined) { sets.push(`${col} = $${pi}`); params.push(val ?? null); pi++; }
  }
  if (sets.length === 0) return findStepById(tenantId, stepId);
  params.push(stepId); params.push(tenantId);
  const res = await queryDb<StepRow>(
    `UPDATE sop_steps SET ${sets.join(', ')} WHERE id = $${pi} AND tenant_id = $${pi+1} AND deleted_at IS NULL RETURNING *`, params,
  );
  return res.rows[0] || null;
}

export async function softDeleteStep(tenantId: string, stepId: string): Promise<StepRow | null> {
  const res = await queryDb<StepRow>(
    `UPDATE sop_steps SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`,
    [stepId, tenantId],
  );
  return res.rows[0] || null;
}

export async function reorderSteps(tenantId: string, templateId: string, stepIds: string[]): Promise<StepRow[]> {
  for (let i = 0; i < stepIds.length; i++) {
    await queryDb(
      `UPDATE sop_steps SET sort_order = $1, step_number = $2
       WHERE id = $3 AND tenant_id = $4 AND template_id = $5 AND deleted_at IS NULL`,
      [i, i + 1, stepIds[i], tenantId, templateId],
    );
  }
  return findStepsByTemplateId(tenantId, templateId);
}

// ======== Assignments ========

const ASSIGNMENT_SORT_MAP: Record<string, string> = {
  assigned_date: 'a.assigned_date', status: 'a.status', created_at: 'a.created_at',
};

export async function findAllAssignments(tenantId: string, query: AssignmentQuery): Promise<{ rows: AssignmentRow[]; total: number }> {
  const conds: string[] = ['a.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let pi = 2;
  if (query.job_id) { conds.push(`a.job_id = $${pi}`); params.push(query.job_id); pi++; }
  if (query.crew_id) { conds.push(`a.crew_id = $${pi}`); params.push(query.crew_id); pi++; }
  if (query.status) { conds.push(`a.status = $${pi}`); params.push(query.status); pi++; }
  if (query.template_id) { conds.push(`a.template_id = $${pi}`); params.push(query.template_id); pi++; }
  const where = conds.join(' AND ');
  const sort = ASSIGNMENT_SORT_MAP[query.sortBy] || 'a.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;
  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM sop_assignments a WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);
  const data = await queryDb<AssignmentRow>(
    `SELECT a.* FROM sop_assignments a WHERE ${where} ORDER BY ${sort} ${dir} LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findAssignmentById(tenantId: string, id: string): Promise<(AssignmentRow & { step_completions: StepCompletionRow[]; completion_percentage: number }) | null> {
  const res = await queryDb<AssignmentRow>(
    `SELECT * FROM sop_assignments WHERE id = $1 AND tenant_id = $2`, [id, tenantId],
  );
  if (!res.rows[0]) return null;

  const completions = await getCompletionsByAssignment(tenantId, id);
  const totalSteps = completions.length;
  const completedSteps = completions.filter(c => c.is_completed).length;
  const completionPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return { ...res.rows[0], step_completions: completions, completion_percentage: completionPercentage };
}

export async function createAssignment(tenantId: string, data: Record<string, unknown>, userId: string): Promise<AssignmentRow> {
  const res = await queryDb<AssignmentRow>(
    `INSERT INTO sop_assignments (tenant_id, template_id, job_id, crew_id, assigned_date, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [tenantId, data.template_id, data.job_id||null, data.crew_id||null,
     data.assigned_date||new Date().toISOString().split('T')[0], data.notes||null, userId],
  );
  return res.rows[0];
}

export async function updateAssignmentStatus(
  tenantId: string, id: string, status: string, userId: string,
): Promise<AssignmentRow | null> {
  const extra = status === 'completed'
    ? `, completed_at = NOW(), completed_by = $4`
    : '';
  const params: unknown[] = [status, id, tenantId];
  if (status === 'completed') params.push(userId);

  const res = await queryDb<AssignmentRow>(
    `UPDATE sop_assignments SET status = $1${extra} WHERE id = $2 AND tenant_id = $3 RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

// ======== Step Completions ========

export async function createStepCompletions(tenantId: string, assignmentId: string, steps: StepRow[]): Promise<void> {
  for (const step of steps) {
    await queryDb(
      `INSERT INTO sop_step_completions (tenant_id, assignment_id, step_id) VALUES ($1,$2,$3)`,
      [tenantId, assignmentId, step.id],
    );
  }
}

export async function getCompletionsByAssignment(tenantId: string, assignmentId: string): Promise<StepCompletionRow[]> {
  const res = await queryDb<StepCompletionRow>(
    `SELECT sc.* FROM sop_step_completions sc
     JOIN sop_steps s ON s.id = sc.step_id
     WHERE sc.tenant_id = $1 AND sc.assignment_id = $2
     ORDER BY s.sort_order`,
    [tenantId, assignmentId],
  );
  return res.rows;
}

export async function findStepCompletion(tenantId: string, assignmentId: string, stepId: string): Promise<StepCompletionRow | null> {
  const res = await queryDb<StepCompletionRow>(
    `SELECT * FROM sop_step_completions WHERE tenant_id = $1 AND assignment_id = $2 AND step_id = $3`,
    [tenantId, assignmentId, stepId],
  );
  return res.rows[0] || null;
}

export async function completeStep(
  tenantId: string, assignmentId: string, stepId: string,
  userId: string, data: Record<string, unknown>,
): Promise<StepCompletionRow | null> {
  const res = await queryDb<StepCompletionRow>(
    `UPDATE sop_step_completions
     SET is_completed = TRUE, completed_by = $1, completed_at = NOW(),
         photo_url = COALESCE($2, photo_url), notes = COALESCE($3, notes)
     WHERE tenant_id = $4 AND assignment_id = $5 AND step_id = $6
     RETURNING *`,
    [userId, data.photo_url||null, data.notes||null, tenantId, assignmentId, stepId],
  );
  return res.rows[0] || null;
}

export async function uncompleteStep(
  tenantId: string, assignmentId: string, stepId: string,
): Promise<StepCompletionRow | null> {
  const res = await queryDb<StepCompletionRow>(
    `UPDATE sop_step_completions
     SET is_completed = FALSE, completed_by = NULL, completed_at = NULL
     WHERE tenant_id = $1 AND assignment_id = $2 AND step_id = $3
     RETURNING *`,
    [tenantId, assignmentId, stepId],
  );
  return res.rows[0] || null;
}
