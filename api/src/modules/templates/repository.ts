import { queryDb, getClient } from '../../config/database.js';

// === Interfaces ===

export interface Template {
  id: string;
  tenant_id: string;
  template_category: string;
  template_name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  content: Record<string, unknown>;
  channel: string | null;
  automation_type: string | null;
  tags: string[];
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  content: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
}

interface CountRow {
  count: string;
}

// === Templates ===

export interface FindAllFilters {
  template_category?: string;
  is_active?: boolean;
  automation_type?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export async function findAll(
  tenantId: string,
  filters: FindAllFilters,
): Promise<{ data: Template[]; total: number; page: number; limit: number }> {
  const conditions: string[] = ['tenant_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (filters.template_category) {
    conditions.push(`template_category = $${paramIdx}`);
    params.push(filters.template_category);
    paramIdx++;
  }

  if (filters.is_active !== undefined) {
    conditions.push(`is_active = $${paramIdx}`);
    params.push(filters.is_active);
    paramIdx++;
  }

  if (filters.automation_type) {
    conditions.push(`automation_type = $${paramIdx}`);
    params.push(filters.automation_type);
    paramIdx++;
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`tags && $${paramIdx}`);
    params.push(filters.tags);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM templates WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limit, offset];
  const dataResult = await queryDb<Template>(
    `SELECT * FROM templates
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    dataParams,
  );

  return { data: dataResult.rows, total, page, limit };
}

export async function findById(
  id: string,
  tenantId: string,
): Promise<Template | null> {
  const result = await queryDb<Template>(
    `SELECT * FROM templates
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function create(
  data: Record<string, unknown>,
): Promise<Template> {
  const result = await queryDb<Template>(
    `INSERT INTO templates
     (tenant_id, template_category, template_name, description,
      is_active, is_system, content, channel, automation_type, tags,
      created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
     RETURNING *`,
    [
      data.tenant_id,
      data.template_category,
      data.template_name,
      data.description ?? null,
      data.is_active ?? true,
      data.is_system ?? false,
      JSON.stringify(data.content),
      data.channel ?? null,
      data.automation_type ?? null,
      data.tags ?? [],
      data.created_by ?? null,
    ],
  );
  return result.rows[0];
}

export async function update(
  id: string,
  tenantId: string,
  data: Record<string, unknown>,
): Promise<Template> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['template_name', data.template_name],
    ['description', data.description],
    ['is_active', data.is_active],
    ['content', data.content !== undefined ? JSON.stringify(data.content) : undefined],
    ['channel', data.channel],
    ['automation_type', data.automation_type],
    ['tags', data.tags],
    ['updated_by', data.updated_by],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) {
    const result = await queryDb<Template>(
      `SELECT * FROM templates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    return result.rows[0];
  }

  params.push(id, tenantId);

  const result = await queryDb<Template>(
    `UPDATE templates SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx} AND tenant_id = $${paramIdx + 1} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return result.rows[0];
}

export async function softDelete(
  id: string,
  tenantId: string,
): Promise<void> {
  await queryDb(
    `UPDATE templates SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
}

export async function findAutomationTemplates(
  tenantId: string,
): Promise<Template[]> {
  const result = await queryDb<Template>(
    `SELECT * FROM templates
     WHERE tenant_id = $1
       AND template_category = 'automation'
       AND deleted_at IS NULL
     ORDER BY automation_type ASC`,
    [tenantId],
  );
  return result.rows;
}

export async function saveFromQuote(
  tenantId: string,
  quoteData: Record<string, unknown>,
): Promise<Template> {
  const result = await queryDb<Template>(
    `INSERT INTO templates
     (tenant_id, template_category, template_name, description,
      content, tags, created_by)
     VALUES ($1, 'quote', $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      tenantId,
      quoteData.template_name,
      quoteData.description ?? null,
      JSON.stringify(quoteData.content),
      quoteData.tags ?? [],
      quoteData.created_by ?? null,
    ],
  );
  return result.rows[0];
}

// === Template Versions ===

export async function createVersion(
  data: Record<string, unknown>,
): Promise<TemplateVersion> {
  const result = await queryDb<TemplateVersion>(
    `INSERT INTO template_versions (template_id, version_number, content, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.template_id, data.version_number, JSON.stringify(data.content), data.created_by ?? null],
  );
  return result.rows[0];
}

export async function getLatestVersionNumber(
  templateId: string,
): Promise<number> {
  const result = await queryDb<{ max: number | null }>(
    `SELECT MAX(version_number) AS max FROM template_versions WHERE template_id = $1`,
    [templateId],
  );
  return result.rows[0]?.max ?? 0;
}

// === Helpers ===

export async function acquireClient() {
  return getClient();
}
