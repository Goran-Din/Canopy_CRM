import type pg from 'pg';
import { queryDb, getClient } from '../../config/database.js';
import type { JobQuery, ScheduleQuery } from './schema.js';

export interface JobRow {
  id: string;
  tenant_id: string;
  contract_id: string | null;
  customer_id: string;
  property_id: string;
  division: string;
  job_type: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  estimated_duration_minutes: number | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  actual_duration_minutes: number | null;
  assigned_crew_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  completion_notes: string | null;
  requires_photos: boolean;
  invoice_id: string | null;
  weather_condition: string | null;
  tags: string[];
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  // V2 fields
  job_number: string | null;
  creation_path: string | null;
  badge_ids: string[];
}

export interface JobWithRelations extends JobRow {
  customer_display_name: string | null;
  property_name: string | null;
  contract_title: string | null;
}

export interface PhotoRow {
  id: string;
  tenant_id: string;
  job_id: string;
  photo_url: string;
  photo_type: string;
  caption: string | null;
  uploaded_by: string | null;
  uploaded_at: Date;
  deleted_at: Date | null;
}

export interface ChecklistRow {
  id: string;
  tenant_id: string;
  job_id: string;
  description: string;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: Date | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface CountRow {
  count: string;
}

export interface StatRow {
  label: string;
  count: string;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  title: 'j.title',
  scheduled_date: 'j.scheduled_date',
  created_at: 'j.created_at',
  updated_at: 'j.updated_at',
  status: 'j.status',
  priority: 'j.priority',
};

export async function findAll(
  tenantId: string,
  query: JobQuery,
): Promise<{ rows: JobRow[]; total: number }> {
  const conditions: string[] = ['j.tenant_id = $1', 'j.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (query.search) {
    conditions.push(
      `(j.title ILIKE $${paramIdx} OR j.description ILIKE $${paramIdx})`,
    );
    params.push(`%${query.search}%`);
    paramIdx++;
  }

  if (query.status) {
    conditions.push(`j.status = $${paramIdx}`);
    params.push(query.status);
    paramIdx++;
  }

  if (query.division) {
    conditions.push(`j.division = $${paramIdx}`);
    params.push(query.division);
    paramIdx++;
  }

  if (query.customer_id) {
    conditions.push(`j.customer_id = $${paramIdx}`);
    params.push(query.customer_id);
    paramIdx++;
  }

  if (query.property_id) {
    conditions.push(`j.property_id = $${paramIdx}`);
    params.push(query.property_id);
    paramIdx++;
  }

  if (query.contract_id) {
    conditions.push(`j.contract_id = $${paramIdx}`);
    params.push(query.contract_id);
    paramIdx++;
  }

  if (query.assigned_crew_id) {
    conditions.push(`j.assigned_crew_id = $${paramIdx}`);
    params.push(query.assigned_crew_id);
    paramIdx++;
  }

  if (query.priority) {
    conditions.push(`j.priority = $${paramIdx}`);
    params.push(query.priority);
    paramIdx++;
  }

  if (query.date_from) {
    conditions.push(`j.scheduled_date >= $${paramIdx}`);
    params.push(query.date_from);
    paramIdx++;
  }

  if (query.date_to) {
    conditions.push(`j.scheduled_date <= $${paramIdx}`);
    params.push(query.date_to);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const sortCol = ALLOWED_SORT_COLUMNS[query.sortBy] || 'j.scheduled_date';
  const sortDir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM jobs j WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<JobRow>(
    `SELECT j.* FROM jobs j
     WHERE ${where}
     ORDER BY ${sortCol} ${sortDir} NULLS LAST
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, query.limit, offset],
  );

  return { rows: dataResult.rows, total };
}

export async function findById(
  tenantId: string,
  id: string,
): Promise<(JobWithRelations & { photos: PhotoRow[]; checklist: ChecklistRow[] }) | null> {
  const result = await queryDb<JobWithRelations>(
    `SELECT j.*,
            c.display_name AS customer_display_name,
            p.property_name AS property_name,
            sc.title AS contract_title
     FROM jobs j
     LEFT JOIN customers c ON c.id = j.customer_id AND c.deleted_at IS NULL
     LEFT JOIN properties p ON p.id = j.property_id AND p.deleted_at IS NULL
     LEFT JOIN service_contracts sc ON sc.id = j.contract_id AND sc.deleted_at IS NULL
     WHERE j.id = $1 AND j.tenant_id = $2 AND j.deleted_at IS NULL`,
    [id, tenantId],
  );

  if (!result.rows[0]) return null;

  const photos = await getPhotos(tenantId, id);
  const checklist = await getChecklist(tenantId, id);

  return { ...result.rows[0], photos, checklist };
}

export async function create(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<JobRow> {
  const result = await queryDb<JobRow>(
    `INSERT INTO jobs (
       tenant_id, contract_id, customer_id, property_id,
       division, job_type, status, priority,
       title, description,
       scheduled_date, scheduled_start_time, estimated_duration_minutes,
       assigned_crew_id, assigned_to,
       notes, requires_photos, weather_condition, tags,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10,
       $11, $12, $13,
       $14, $15,
       $16, $17, $18, $19,
       $20, $20
     )
     RETURNING *`,
    [
      tenantId,
      data.contract_id || null,
      data.customer_id,
      data.property_id,
      data.division,
      data.job_type,
      data.scheduled_date ? 'scheduled' : 'unscheduled',
      data.priority,
      data.title,
      data.description || null,
      data.scheduled_date || null,
      data.scheduled_start_time || null,
      data.estimated_duration_minutes ?? null,
      data.assigned_crew_id || null,
      data.assigned_to || null,
      data.notes || null,
      data.requires_photos ?? false,
      data.weather_condition || null,
      data.tags || [],
      userId,
    ],
  );
  return result.rows[0];
}

export async function update(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<JobRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['contract_id', data.contract_id],
    ['customer_id', data.customer_id],
    ['property_id', data.property_id],
    ['division', data.division],
    ['job_type', data.job_type],
    ['title', data.title],
    ['description', data.description],
    ['scheduled_date', data.scheduled_date],
    ['scheduled_start_time', data.scheduled_start_time],
    ['estimated_duration_minutes', data.estimated_duration_minutes],
    ['priority', data.priority],
    ['assigned_crew_id', data.assigned_crew_id],
    ['assigned_to', data.assigned_to],
    ['notes', data.notes],
    ['completion_notes', data.completion_notes],
    ['requires_photos', data.requires_photos],
    ['weather_condition', data.weather_condition],
    ['tags', data.tags],
    ['actual_start_time', data.actual_start_time],
    ['actual_end_time', data.actual_end_time],
    ['actual_duration_minutes', data.actual_duration_minutes],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) return findByIdSimple(tenantId, id);

  setClauses.push(`updated_by = $${paramIdx}`);
  params.push(userId);
  paramIdx++;

  let concurrencyClause = '';
  if (data.updated_at) {
    concurrencyClause = ` AND j.updated_at = $${paramIdx}`;
    params.push(data.updated_at);
    paramIdx++;
  }

  params.push(id);
  params.push(tenantId);

  const result = await queryDb<JobRow>(
    `UPDATE jobs j SET ${setClauses.join(', ')}
     WHERE j.id = $${paramIdx - 1} AND j.tenant_id = $${paramIdx} AND j.deleted_at IS NULL${concurrencyClause}
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

async function findByIdSimple(tenantId: string, id: string): Promise<JobRow | null> {
  const result = await queryDb<JobRow>(
    `SELECT * FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function updateStatus(
  tenantId: string,
  id: string,
  newStatus: string,
  completionNotes: string | null,
  userId: string,
  extraFields?: Record<string, unknown>,
): Promise<JobRow | null> {
  const setClauses = ['status = $1', 'updated_by = $2'];
  const params: unknown[] = [newStatus, userId];
  let paramIdx = 3;

  if (completionNotes !== undefined && completionNotes !== null) {
    setClauses.push(`completion_notes = $${paramIdx}`);
    params.push(completionNotes);
    paramIdx++;
  }

  if (extraFields) {
    for (const [col, val] of Object.entries(extraFields)) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val);
      paramIdx++;
    }
  }

  params.push(id);
  params.push(tenantId);

  const result = await queryDb<JobRow>(
    `UPDATE jobs SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx - 1} AND tenant_id = $${paramIdx} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

export async function softDelete(
  tenantId: string,
  id: string,
): Promise<JobRow | null> {
  const result = await queryDb<JobRow>(
    `UPDATE jobs SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function getByDateRange(
  tenantId: string,
  query: ScheduleQuery,
): Promise<JobRow[]> {
  const conditions: string[] = [
    'j.tenant_id = $1',
    'j.deleted_at IS NULL',
    'j.scheduled_date >= $2',
    'j.scheduled_date <= $3',
  ];
  const params: unknown[] = [tenantId, query.start_date, query.end_date];
  let paramIdx = 4;

  if (query.division) {
    conditions.push(`j.division = $${paramIdx}`);
    params.push(query.division);
    paramIdx++;
  }

  if (query.assigned_crew_id) {
    conditions.push(`j.assigned_crew_id = $${paramIdx}`);
    params.push(query.assigned_crew_id);
    paramIdx++;
  }

  const result = await queryDb<JobRow>(
    `SELECT j.* FROM jobs j
     WHERE ${conditions.join(' AND ')}
     ORDER BY j.scheduled_date ASC, j.scheduled_start_time ASC NULLS LAST`,
    params,
  );
  return result.rows;
}

export async function getByProperty(
  tenantId: string,
  propertyId: string,
): Promise<JobRow[]> {
  const result = await queryDb<JobRow>(
    `SELECT * FROM jobs
     WHERE tenant_id = $1 AND property_id = $2 AND deleted_at IS NULL
     ORDER BY scheduled_date DESC NULLS LAST, created_at DESC`,
    [tenantId, propertyId],
  );
  return result.rows;
}

// --- Photos ---

export async function addPhoto(
  tenantId: string,
  jobId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<PhotoRow> {
  const result = await queryDb<PhotoRow>(
    `INSERT INTO job_photos (tenant_id, job_id, photo_url, photo_type, caption, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [tenantId, jobId, data.photo_url, data.photo_type, data.caption || null, userId],
  );
  return result.rows[0];
}

export async function getPhotos(
  tenantId: string,
  jobId: string,
): Promise<PhotoRow[]> {
  const result = await queryDb<PhotoRow>(
    `SELECT * FROM job_photos
     WHERE tenant_id = $1 AND job_id = $2 AND deleted_at IS NULL
     ORDER BY uploaded_at ASC`,
    [tenantId, jobId],
  );
  return result.rows;
}

// --- Checklist ---

export async function addChecklistItem(
  tenantId: string,
  jobId: string,
  data: Record<string, unknown>,
): Promise<ChecklistRow> {
  const result = await queryDb<ChecklistRow>(
    `INSERT INTO job_checklist_items (tenant_id, job_id, description, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, jobId, data.description, data.sort_order ?? 0],
  );
  return result.rows[0];
}

export async function updateChecklistItem(
  tenantId: string,
  itemId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<ChecklistRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (data.description !== undefined) {
    setClauses.push(`description = $${paramIdx}`);
    params.push(data.description);
    paramIdx++;
  }

  if (data.is_completed !== undefined) {
    setClauses.push(`is_completed = $${paramIdx}`);
    params.push(data.is_completed);
    paramIdx++;

    if (data.is_completed) {
      setClauses.push(`completed_by = $${paramIdx}`);
      params.push(userId);
      paramIdx++;
      setClauses.push(`completed_at = NOW()`);
    } else {
      setClauses.push(`completed_by = NULL`);
      setClauses.push(`completed_at = NULL`);
    }
  }

  if (data.sort_order !== undefined) {
    setClauses.push(`sort_order = $${paramIdx}`);
    params.push(data.sort_order);
    paramIdx++;
  }

  if (setClauses.length === 0) return null;

  params.push(itemId);
  params.push(tenantId);

  const result = await queryDb<ChecklistRow>(
    `UPDATE job_checklist_items SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx - 1} AND tenant_id = $${paramIdx}
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

export async function getChecklist(
  tenantId: string,
  jobId: string,
): Promise<ChecklistRow[]> {
  const result = await queryDb<ChecklistRow>(
    `SELECT * FROM job_checklist_items
     WHERE tenant_id = $1 AND job_id = $2
     ORDER BY sort_order ASC, created_at ASC`,
    [tenantId, jobId],
  );
  return result.rows;
}

export async function getChecklistItemById(
  tenantId: string,
  itemId: string,
): Promise<ChecklistRow | null> {
  const result = await queryDb<ChecklistRow>(
    `SELECT * FROM job_checklist_items
     WHERE id = $1 AND tenant_id = $2`,
    [itemId, tenantId],
  );
  return result.rows[0] || null;
}

// --- Stats ---

export async function getStats(
  tenantId: string,
): Promise<{ byStatus: StatRow[]; byDivision: StatRow[]; todayCount: number }> {
  const statusResult = await queryDb<StatRow>(
    `SELECT status AS label, COUNT(*)::text AS count
     FROM jobs WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY status ORDER BY status`,
    [tenantId],
  );

  const divisionResult = await queryDb<StatRow>(
    `SELECT division AS label, COUNT(*)::text AS count
     FROM jobs WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY division ORDER BY division`,
    [tenantId],
  );

  const todayResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM jobs
     WHERE tenant_id = $1 AND deleted_at IS NULL
       AND scheduled_date = CURRENT_DATE`,
    [tenantId],
  );

  return {
    byStatus: statusResult.rows,
    byDivision: divisionResult.rows,
    todayCount: parseInt(todayResult.rows[0].count, 10),
  };
}

// --- Validation helpers ---

export async function customerExists(
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM customers
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [customerId, tenantId],
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

export async function propertyBelongsToCustomer(
  tenantId: string,
  propertyId: string,
  customerId: string,
): Promise<boolean> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM properties
     WHERE id = $1 AND tenant_id = $2 AND customer_id = $3 AND deleted_at IS NULL`,
    [propertyId, tenantId, customerId],
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

export async function contractExists(
  tenantId: string,
  contractId: string,
): Promise<boolean> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM service_contracts
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [contractId, tenantId],
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

// --- V2 Functions ---

interface JobNumberRow {
  job_number: string;
}

/**
 * Get next job number using the atomic next_job_number() function.
 */
export async function getNextJobNumber(
  client: pg.PoolClient,
  tenantId: string,
  year: number,
): Promise<string> {
  const result = await client.query<JobNumberRow>(
    `SELECT next_job_number($1, $2::SMALLINT) AS job_number`,
    [tenantId, year],
  );
  return result.rows[0].job_number;
}

/**
 * Create job within a transaction client (V2 — includes job_number and creation_path).
 */
export async function createWithClient(
  client: pg.PoolClient,
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<JobRow> {
  const result = await client.query<JobRow>(
    `INSERT INTO jobs (
       tenant_id, contract_id, customer_id, property_id,
       division, job_type, status, priority,
       title, description,
       scheduled_date, scheduled_start_time, estimated_duration_minutes,
       assigned_crew_id, assigned_to,
       notes, requires_photos, weather_condition, tags,
       created_by, updated_by,
       job_number, creation_path
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10,
       $11, $12, $13,
       $14, $15,
       $16, $17, $18, $19,
       $20, $20,
       $21, $22
     )
     RETURNING *`,
    [
      tenantId,
      data.contract_id || null,
      data.customer_id,
      data.property_id,
      data.division,
      data.job_type,
      data.status,
      data.priority,
      data.title,
      data.description || null,
      data.scheduled_date || null,
      data.scheduled_start_time || null,
      data.estimated_duration_minutes ?? null,
      data.assigned_crew_id || null,
      data.assigned_to || null,
      data.notes || null,
      data.requires_photos ?? false,
      data.weather_condition || null,
      data.tags || [],
      userId,
      data.job_number || null,
      data.creation_path || null,
    ],
  );
  return result.rows[0];
}

/**
 * Update job status within a transaction client (V2 — for diary integration).
 */
export async function updateStatusWithClient(
  client: pg.PoolClient,
  tenantId: string,
  id: string,
  newStatus: string,
  completionNotes: string | null,
  userId: string,
  extraFields?: Record<string, unknown>,
): Promise<JobRow | null> {
  const setClauses = ['status = $1', 'updated_by = $2'];
  const params: unknown[] = [newStatus, userId];
  let paramIdx = 3;

  if (completionNotes !== undefined && completionNotes !== null) {
    setClauses.push(`completion_notes = $${paramIdx}`);
    params.push(completionNotes);
    paramIdx++;
  }

  if (extraFields) {
    for (const [col, val] of Object.entries(extraFields)) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val);
      paramIdx++;
    }
  }

  params.push(id);
  params.push(tenantId);

  const result = await client.query<JobRow>(
    `UPDATE jobs SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx - 1} AND tenant_id = $${paramIdx} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

/**
 * Acquire a database client for transactions.
 */
export async function acquireClient(): Promise<pg.PoolClient> {
  return getClient();
}
