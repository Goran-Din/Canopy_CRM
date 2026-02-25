import { queryDb } from '../../config/database.js';
import type { MaterialQuery, TransactionQuery } from './schema.js';

export interface MaterialRow {
  id: string; tenant_id: string; material_name: string; category: string;
  unit_of_measure: string; current_stock: number; reorder_level: number | null;
  cost_per_unit: number | null; preferred_supplier: string | null;
  storage_location: string | null; notes: string | null;
  created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
}

export interface TransactionRow {
  id: string; tenant_id: string; material_id: string;
  transaction_type: string; quantity: number; unit_cost: number | null;
  job_id: string | null; notes: string | null; recorded_by: string | null;
  created_at: string;
}

interface CountRow { count: string; }

const SORT_MAP: Record<string, string> = {
  material_name: 'm.material_name', category: 'm.category',
  current_stock: 'm.current_stock', created_at: 'm.created_at',
};

export async function findAll(tenantId: string, query: MaterialQuery): Promise<{ rows: MaterialRow[]; total: number }> {
  const conds: string[] = ['m.tenant_id = $1', 'm.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;
  if (query.search) { conds.push(`(m.material_name ILIKE $${pi} OR m.preferred_supplier ILIKE $${pi})`); params.push(`%${query.search}%`); pi++; }
  if (query.category) { conds.push(`m.category = $${pi}`); params.push(query.category); pi++; }
  if (query.low_stock) { conds.push(`m.reorder_level IS NOT NULL AND m.current_stock <= m.reorder_level`); }
  const where = conds.join(' AND ');
  const sort = SORT_MAP[query.sortBy] || 'm.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;
  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM materials m WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);
  const data = await queryDb<MaterialRow>(
    `SELECT m.* FROM materials m WHERE ${where} ORDER BY ${sort} ${dir} LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findById(tenantId: string, id: string): Promise<MaterialRow | null> {
  const res = await queryDb<MaterialRow>(`SELECT * FROM materials WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, tenantId]);
  return res.rows[0] || null;
}

export async function create(tenantId: string, data: Record<string, unknown>, userId: string): Promise<MaterialRow> {
  const res = await queryDb<MaterialRow>(
    `INSERT INTO materials (tenant_id, material_name, category, unit_of_measure, current_stock,
       reorder_level, cost_per_unit, preferred_supplier, storage_location, notes,
       created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,
    [tenantId, data.material_name, data.category||'other', data.unit_of_measure||'other',
     data.current_stock??0, data.reorder_level??null, data.cost_per_unit??null,
     data.preferred_supplier||null, data.storage_location||null, data.notes||null, userId],
  );
  return res.rows[0];
}

export async function update(tenantId: string, id: string, data: Record<string, unknown>, userId: string): Promise<MaterialRow | null> {
  const sets: string[] = []; const params: unknown[] = []; let pi = 1;
  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined) { sets.push(`${col} = $${pi}`); params.push(val ?? null); pi++; }
  }
  if (sets.length === 0) return findById(tenantId, id);
  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);
  const res = await queryDb<MaterialRow>(
    `UPDATE materials SET ${sets.join(', ')} WHERE id = $${pi-1} AND tenant_id = $${pi} AND deleted_at IS NULL RETURNING *`, params,
  );
  return res.rows[0] || null;
}

export async function softDelete(tenantId: string, id: string): Promise<MaterialRow | null> {
  const res = await queryDb<MaterialRow>(`UPDATE materials SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`, [id, tenantId]);
  return res.rows[0] || null;
}

export async function recordTransaction(
  tenantId: string, materialId: string, data: Record<string, unknown>, userId: string,
): Promise<TransactionRow> {
  const res = await queryDb<TransactionRow>(
    `INSERT INTO material_transactions (tenant_id, material_id, transaction_type, quantity, unit_cost, job_id, notes, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [tenantId, materialId, data.transaction_type, data.quantity,
     data.unit_cost??null, data.job_id||null, data.notes||null, userId],
  );
  return res.rows[0];
}

export async function adjustStock(tenantId: string, materialId: string, delta: number): Promise<void> {
  await queryDb(
    `UPDATE materials SET current_stock = current_stock + $1 WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [delta, materialId, tenantId],
  );
}

export async function findTransactions(
  tenantId: string, materialId: string, query: TransactionQuery,
): Promise<{ rows: TransactionRow[]; total: number }> {
  const conds: string[] = ['t.tenant_id = $1', 't.material_id = $2'];
  const params: unknown[] = [tenantId, materialId];
  let pi = 3;
  if (query.transaction_type) { conds.push(`t.transaction_type = $${pi}`); params.push(query.transaction_type); pi++; }
  const where = conds.join(' AND ');
  const offset = (query.page - 1) * query.limit;
  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM material_transactions t WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);
  const data = await queryDb<TransactionRow>(
    `SELECT t.* FROM material_transactions t WHERE ${where} ORDER BY t.created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function getLowStockMaterials(tenantId: string): Promise<MaterialRow[]> {
  const res = await queryDb<MaterialRow>(
    `SELECT * FROM materials WHERE tenant_id = $1 AND deleted_at IS NULL
     AND reorder_level IS NOT NULL AND current_stock <= reorder_level
     ORDER BY material_name`,
    [tenantId],
  );
  return res.rows;
}
