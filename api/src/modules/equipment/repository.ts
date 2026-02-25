import { queryDb } from '../../config/database.js';
import type { EquipmentQuery } from './schema.js';

export interface EquipmentRow {
  id: string; tenant_id: string; equipment_name: string; equipment_type: string;
  status: string; make: string | null; model: string | null; year: number | null;
  serial_number: string | null; license_plate: string | null; vin: string | null;
  purchase_date: string | null; purchase_price: number | null; current_value: number | null;
  assigned_crew_id: string | null; assigned_division: string | null;
  last_maintenance_date: string | null; next_maintenance_date: string | null;
  mileage: number | null; hours_used: number | null; notes: string | null;
  created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
}

interface CountRow { count: string; }

const SORT_MAP: Record<string, string> = {
  equipment_name: 'e.equipment_name', equipment_type: 'e.equipment_type',
  status: 'e.status', created_at: 'e.created_at',
};

export async function findAll(tenantId: string, query: EquipmentQuery): Promise<{ rows: EquipmentRow[]; total: number }> {
  const conds: string[] = ['e.tenant_id = $1', 'e.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;
  if (query.search) { conds.push(`(e.equipment_name ILIKE $${pi} OR e.make ILIKE $${pi} OR e.model ILIKE $${pi} OR e.serial_number ILIKE $${pi})`); params.push(`%${query.search}%`); pi++; }
  if (query.equipment_type) { conds.push(`e.equipment_type = $${pi}`); params.push(query.equipment_type); pi++; }
  if (query.status) { conds.push(`e.status = $${pi}`); params.push(query.status); pi++; }
  if (query.assigned_crew_id) { conds.push(`e.assigned_crew_id = $${pi}`); params.push(query.assigned_crew_id); pi++; }
  const where = conds.join(' AND ');
  const sort = SORT_MAP[query.sortBy] || 'e.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;
  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM equipment e WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);
  const data = await queryDb<EquipmentRow>(
    `SELECT e.* FROM equipment e WHERE ${where} ORDER BY ${sort} ${dir} LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findById(tenantId: string, id: string): Promise<EquipmentRow | null> {
  const res = await queryDb<EquipmentRow>(`SELECT * FROM equipment WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, tenantId]);
  return res.rows[0] || null;
}

export async function create(tenantId: string, data: Record<string, unknown>, userId: string): Promise<EquipmentRow> {
  const res = await queryDb<EquipmentRow>(
    `INSERT INTO equipment (tenant_id, equipment_name, equipment_type, make, model, year,
       serial_number, license_plate, vin, purchase_date, purchase_price, current_value,
       assigned_crew_id, assigned_division, last_maintenance_date, next_maintenance_date,
       mileage, hours_used, notes, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20) RETURNING *`,
    [tenantId, data.equipment_name, data.equipment_type||'other',
     data.make||null, data.model||null, data.year??null,
     data.serial_number||null, data.license_plate||null, data.vin||null,
     data.purchase_date||null, data.purchase_price??null, data.current_value??null,
     data.assigned_crew_id||null, data.assigned_division||null,
     data.last_maintenance_date||null, data.next_maintenance_date||null,
     data.mileage??null, data.hours_used??null, data.notes||null, userId],
  );
  return res.rows[0];
}

export async function update(tenantId: string, id: string, data: Record<string, unknown>, userId: string): Promise<EquipmentRow | null> {
  const sets: string[] = []; const params: unknown[] = []; let pi = 1;
  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined) { sets.push(`${col} = $${pi}`); params.push(val ?? null); pi++; }
  }
  if (sets.length === 0) return findById(tenantId, id);
  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);
  const res = await queryDb<EquipmentRow>(
    `UPDATE equipment SET ${sets.join(', ')} WHERE id = $${pi-1} AND tenant_id = $${pi} AND deleted_at IS NULL RETURNING *`, params,
  );
  return res.rows[0] || null;
}

export async function softDelete(tenantId: string, id: string): Promise<EquipmentRow | null> {
  const res = await queryDb<EquipmentRow>(`UPDATE equipment SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`, [id, tenantId]);
  return res.rows[0] || null;
}
