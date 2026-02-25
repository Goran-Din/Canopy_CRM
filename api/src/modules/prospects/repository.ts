import { queryDb } from '../../config/database.js';
import type { ProspectQuery } from './schema.js';

export interface ProspectRow {
  id: string; tenant_id: string; company_name: string | null; first_name: string | null;
  last_name: string | null; email: string | null; phone: string | null; mobile: string | null;
  source: string | null; status: string; assigned_to: string | null;
  estimated_value: number | null; interest_services: string[] | null;
  address_line1: string | null; city: string | null; state: string | null; zip: string | null;
  notes: string | null; next_follow_up_date: string | null; last_contacted_at: string | null;
  lost_reason: string | null; converted_customer_id: string | null;
  mautic_contact_id: string | null;
  created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
}

interface CountRow { count: string; }

const SORT_MAP: Record<string, string> = {
  first_name: 'p.first_name', last_name: 'p.last_name', company_name: 'p.company_name',
  status: 'p.status', estimated_value: 'p.estimated_value', created_at: 'p.created_at',
};

export async function findAll(tenantId: string, query: ProspectQuery): Promise<{ rows: ProspectRow[]; total: number }> {
  const conds: string[] = ['p.tenant_id = $1', 'p.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;
  if (query.search) { conds.push(`(p.first_name ILIKE $${pi} OR p.last_name ILIKE $${pi} OR p.company_name ILIKE $${pi} OR p.email ILIKE $${pi})`); params.push(`%${query.search}%`); pi++; }
  if (query.status) { conds.push(`p.status = $${pi}`); params.push(query.status); pi++; }
  if (query.source) { conds.push(`p.source = $${pi}`); params.push(query.source); pi++; }
  if (query.assigned_to) { conds.push(`p.assigned_to = $${pi}`); params.push(query.assigned_to); pi++; }
  const where = conds.join(' AND ');
  const sort = SORT_MAP[query.sortBy] || 'p.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;
  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM prospects p WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);
  const data = await queryDb<ProspectRow>(
    `SELECT p.* FROM prospects p WHERE ${where} ORDER BY ${sort} ${dir} LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findById(tenantId: string, id: string): Promise<ProspectRow | null> {
  const res = await queryDb<ProspectRow>(`SELECT * FROM prospects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, tenantId]);
  return res.rows[0] || null;
}

export async function create(tenantId: string, data: Record<string, unknown>, userId: string): Promise<ProspectRow> {
  const res = await queryDb<ProspectRow>(
    `INSERT INTO prospects (tenant_id, company_name, first_name, last_name, email, phone, mobile,
       source, assigned_to, estimated_value, interest_services,
       address_line1, city, state, zip, notes, next_follow_up_date, mautic_contact_id,
       created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19) RETURNING *`,
    [tenantId, data.company_name||null, data.first_name||null, data.last_name||null,
     data.email||null, data.phone||null, data.mobile||null, data.source||null,
     data.assigned_to||null, data.estimated_value??null, data.interest_services||null,
     data.address_line1||null, data.city||null, data.state||null, data.zip||null,
     data.notes||null, data.next_follow_up_date||null, data.mautic_contact_id||null, userId],
  );
  return res.rows[0];
}

export async function update(tenantId: string, id: string, data: Record<string, unknown>, userId: string): Promise<ProspectRow | null> {
  const sets: string[] = []; const params: unknown[] = []; let pi = 1;
  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined) { sets.push(`${col} = $${pi}`); params.push(val ?? null); pi++; }
  }
  if (sets.length === 0) return findById(tenantId, id);
  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);
  const res = await queryDb<ProspectRow>(
    `UPDATE prospects SET ${sets.join(', ')} WHERE id = $${pi-1} AND tenant_id = $${pi} AND deleted_at IS NULL RETURNING *`, params,
  );
  return res.rows[0] || null;
}

export async function updateStatus(tenantId: string, id: string, status: string, userId: string, extra?: Record<string, unknown>): Promise<ProspectRow | null> {
  const sets = ['status = $1', 'updated_by = $2']; const params: unknown[] = [status, userId]; let pi = 3;
  if (extra) { for (const [col, val] of Object.entries(extra)) { sets.push(`${col} = $${pi}`); params.push(val??null); pi++; } }
  params.push(id); params.push(tenantId);
  const res = await queryDb<ProspectRow>(`UPDATE prospects SET ${sets.join(', ')} WHERE id = $${pi-1} AND tenant_id = $${pi} AND deleted_at IS NULL RETURNING *`, params);
  return res.rows[0] || null;
}

export async function softDelete(tenantId: string, id: string): Promise<ProspectRow | null> {
  const res = await queryDb<ProspectRow>(`UPDATE prospects SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`, [id, tenantId]);
  return res.rows[0] || null;
}

export async function createCustomerFromProspect(tenantId: string, prospect: ProspectRow, userId: string): Promise<string> {
  const displayName = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ') || prospect.company_name || 'Converted Prospect';
  const res = await queryDb<{ id: string }>(
    `INSERT INTO customers (tenant_id, display_name, company_name, email, phone, mobile,
       address_line1, city, state, zip, customer_type, status, source, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'commercial','active','referral',$11,$11) RETURNING id`,
    [tenantId, displayName, prospect.company_name||null, prospect.email||null,
     prospect.phone||null, prospect.mobile||null, prospect.address_line1||null,
     prospect.city||null, prospect.state||null, prospect.zip||null, userId],
  );
  return res.rows[0].id;
}

export async function getPipelineStats(tenantId: string): Promise<Array<{ status: string; count: string; total_value: string }>> {
  const res = await queryDb<{ status: string; count: string; total_value: string }>(
    `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(estimated_value),0)::text AS total_value
     FROM prospects WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY status ORDER BY status`,
    [tenantId],
  );
  return res.rows;
}
