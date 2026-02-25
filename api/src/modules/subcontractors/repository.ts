import { queryDb } from '../../config/database.js';
import type { SubcontractorQuery } from './schema.js';

export interface SubcontractorRow {
  id: string; tenant_id: string; company_name: string; contact_name: string | null;
  email: string | null; phone: string | null; mobile: string | null;
  specialty: string[] | null; status: string; insurance_expiry: string | null;
  license_number: string | null; rate_type: string | null; default_rate: number | null;
  rating: number | null; notes: string | null;
  created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
}

interface CountRow { count: string; }

const SORT_MAP: Record<string, string> = {
  company_name: 's.company_name', contact_name: 's.contact_name',
  status: 's.status', rating: 's.rating', created_at: 's.created_at',
};

export async function findAll(tenantId: string, query: SubcontractorQuery): Promise<{ rows: SubcontractorRow[]; total: number }> {
  const conds: string[] = ['s.tenant_id = $1', 's.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;
  if (query.search) { conds.push(`(s.company_name ILIKE $${pi} OR s.contact_name ILIKE $${pi} OR s.email ILIKE $${pi})`); params.push(`%${query.search}%`); pi++; }
  if (query.status) { conds.push(`s.status = $${pi}`); params.push(query.status); pi++; }
  if (query.specialty) { conds.push(`$${pi} = ANY(s.specialty)`); params.push(query.specialty); pi++; }
  const where = conds.join(' AND ');
  const sort = SORT_MAP[query.sortBy] || 's.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;
  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM subcontractors s WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);
  const data = await queryDb<SubcontractorRow>(
    `SELECT s.* FROM subcontractors s WHERE ${where} ORDER BY ${sort} ${dir} LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findById(tenantId: string, id: string): Promise<SubcontractorRow | null> {
  const res = await queryDb<SubcontractorRow>(`SELECT * FROM subcontractors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, tenantId]);
  return res.rows[0] || null;
}

export async function create(tenantId: string, data: Record<string, unknown>, userId: string): Promise<SubcontractorRow> {
  const res = await queryDb<SubcontractorRow>(
    `INSERT INTO subcontractors (tenant_id, company_name, contact_name, email, phone, mobile,
       specialty, insurance_expiry, license_number, rate_type, default_rate, rating, notes,
       created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *`,
    [tenantId, data.company_name, data.contact_name||null, data.email||null,
     data.phone||null, data.mobile||null, data.specialty||null,
     data.insurance_expiry||null, data.license_number||null, data.rate_type||null,
     data.default_rate??null, data.rating??null, data.notes||null, userId],
  );
  return res.rows[0];
}

export async function update(tenantId: string, id: string, data: Record<string, unknown>, userId: string): Promise<SubcontractorRow | null> {
  const sets: string[] = []; const params: unknown[] = []; let pi = 1;
  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined) { sets.push(`${col} = $${pi}`); params.push(val ?? null); pi++; }
  }
  if (sets.length === 0) return findById(tenantId, id);
  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);
  const res = await queryDb<SubcontractorRow>(
    `UPDATE subcontractors SET ${sets.join(', ')} WHERE id = $${pi-1} AND tenant_id = $${pi} AND deleted_at IS NULL RETURNING *`, params,
  );
  return res.rows[0] || null;
}

export async function softDelete(tenantId: string, id: string): Promise<SubcontractorRow | null> {
  const res = await queryDb<SubcontractorRow>(`UPDATE subcontractors SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`, [id, tenantId]);
  return res.rows[0] || null;
}
