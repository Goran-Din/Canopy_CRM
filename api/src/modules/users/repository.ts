import { queryDb } from '../../config/database.js';

export interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithRoles extends UserRow {
  roles: { role: string; division_id: string | null; division_name: string | null }[];
}

export interface UserRoleRow {
  role_name: string;
  division_id: string | null;
  division_name: string | null;
}

export interface UserStatRow {
  role: string;
  count: number;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  first_name: 'u.first_name',
  last_name: 'u.last_name',
  email: 'u.email',
  created_at: 'u.created_at',
  last_login_at: 'u.last_login_at',
};

export async function findAll(
  tenantId: string,
  query: { page: number; limit: number; search?: string; role?: string; status?: string; sortBy?: string; sortOrder?: string },
): Promise<{ rows: UserRow[]; total: number }> {
  const conditions: string[] = ['u.tenant_id = $1', 'u.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.search) {
    conditions.push(
      `(u.first_name ILIKE $${pi} OR u.last_name ILIKE $${pi} OR u.email ILIKE $${pi})`,
    );
    params.push(`%${query.search}%`);
    pi++;
  }

  if (query.status === 'active') {
    conditions.push('u.is_active = true');
  } else if (query.status === 'inactive') {
    conditions.push('u.is_active = false');
  }

  if (query.role) {
    conditions.push(
      `EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND ur.tenant_id = u.tenant_id AND r.name = $${pi})`,
    );
    params.push(query.role);
    pi++;
  }

  const where = conditions.join(' AND ');

  const countResult = await queryDb<{ count: string }>(
    `SELECT COUNT(*) AS count FROM users u WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const sortCol = ALLOWED_SORT_COLUMNS[query.sortBy ?? ''] ?? 'u.created_at';
  const sortDir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const result = await queryDb<UserRow>(
    `SELECT u.id, u.tenant_id, u.email, u.first_name, u.last_name, u.phone,
            u.is_active, u.last_login_at, u.created_at, u.updated_at
     FROM users u
     WHERE ${where}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );

  return { rows: result.rows, total };
}

export async function findById(tenantId: string, id: string): Promise<UserRow | null> {
  const result = await queryDb<UserRow>(
    `SELECT id, tenant_id, email, first_name, last_name, phone,
            is_active, last_login_at, created_at, updated_at
     FROM users
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function getUserRoles(tenantId: string, userId: string): Promise<UserRoleRow[]> {
  const result = await queryDb<UserRoleRow>(
    `SELECT r.name AS role_name, ur.division_id, d.name AS division_name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     LEFT JOIN divisions d ON d.id = ur.division_id
     WHERE ur.user_id = $1 AND ur.tenant_id = $2`,
    [userId, tenantId],
  );
  return result.rows;
}

export async function create(
  tenantId: string,
  data: { email: string; password_hash: string; first_name: string; last_name: string; phone?: string | null },
): Promise<UserRow> {
  const result = await queryDb<UserRow>(
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, tenant_id, email, first_name, last_name, phone, is_active, last_login_at, created_at, updated_at`,
    [tenantId, data.email, data.password_hash, data.first_name, data.last_name, data.phone ?? null],
  );
  return result.rows[0];
}

export async function update(
  tenantId: string,
  id: string,
  data: { first_name?: string; last_name?: string; email?: string; phone?: string | null },
): Promise<UserRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  if (data.first_name !== undefined) {
    sets.push(`first_name = $${pi++}`);
    params.push(data.first_name);
  }
  if (data.last_name !== undefined) {
    sets.push(`last_name = $${pi++}`);
    params.push(data.last_name);
  }
  if (data.email !== undefined) {
    sets.push(`email = $${pi++}`);
    params.push(data.email);
  }
  if (data.phone !== undefined) {
    sets.push(`phone = $${pi++}`);
    params.push(data.phone);
  }

  if (sets.length === 0) return findById(tenantId, id);

  sets.push(`updated_at = NOW()`);

  const result = await queryDb<UserRow>(
    `UPDATE users SET ${sets.join(', ')}
     WHERE id = $${pi} AND tenant_id = $${pi + 1} AND deleted_at IS NULL
     RETURNING id, tenant_id, email, first_name, last_name, phone, is_active, last_login_at, created_at, updated_at`,
    [...params, id, tenantId],
  );
  return result.rows[0] || null;
}

export async function updatePassword(tenantId: string, id: string, passwordHash: string): Promise<boolean> {
  const result = await queryDb(
    `UPDATE users SET password_hash = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [passwordHash, id, tenantId],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function deactivate(tenantId: string, id: string): Promise<UserRow | null> {
  const result = await queryDb<UserRow>(
    `UPDATE users SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING id, tenant_id, email, first_name, last_name, phone, is_active, last_login_at, created_at, updated_at`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function activate(tenantId: string, id: string): Promise<UserRow | null> {
  const result = await queryDb<UserRow>(
    `UPDATE users SET is_active = true, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING id, tenant_id, email, first_name, last_name, phone, is_active, last_login_at, created_at, updated_at`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function assignRole(
  tenantId: string,
  userId: string,
  roleName: string,
  divisionId: string | null = null,
): Promise<void> {
  await queryDb(
    `INSERT INTO user_roles (tenant_id, user_id, role_id, division_id)
     SELECT $1, $2, r.id, $3
     FROM roles r WHERE r.name = $4
     ON CONFLICT DO NOTHING`,
    [tenantId, userId, divisionId, roleName],
  );
}

export async function removeRole(tenantId: string, userId: string, roleName: string): Promise<void> {
  await queryDb(
    `DELETE FROM user_roles
     WHERE tenant_id = $1 AND user_id = $2 AND role_id = (SELECT id FROM roles WHERE name = $3)`,
    [tenantId, userId, roleName],
  );
}

export async function assignDivision(tenantId: string, userId: string, divisionName: string): Promise<void> {
  await queryDb(
    `INSERT INTO user_roles (tenant_id, user_id, role_id, division_id)
     SELECT $1, $2, ur.role_id, d.id
     FROM user_roles ur
     CROSS JOIN divisions d
     WHERE ur.user_id = $2 AND ur.tenant_id = $1 AND ur.division_id IS NULL
       AND d.tenant_id = $1 AND d.name = $3
     LIMIT 1
     ON CONFLICT DO NOTHING`,
    [tenantId, userId, divisionName],
  );
}

export async function removeDivision(tenantId: string, userId: string, divisionName: string): Promise<void> {
  await queryDb(
    `DELETE FROM user_roles
     WHERE tenant_id = $1 AND user_id = $2
       AND division_id = (SELECT id FROM divisions WHERE tenant_id = $1 AND name = $3)`,
    [tenantId, userId, divisionName],
  );
}

export async function countByRole(tenantId: string, roleName: string): Promise<number> {
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(DISTINCT ur.user_id) AS count
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     JOIN users u ON u.id = ur.user_id
     WHERE ur.tenant_id = $1 AND r.name = $2 AND u.deleted_at IS NULL AND u.is_active = true`,
    [tenantId, roleName],
  );
  return parseInt(result.rows[0].count, 10);
}

export async function getStats(tenantId: string): Promise<{
  total: number;
  active: number;
  inactive: number;
  byRole: UserStatRow[];
}> {
  const totalResult = await queryDb<{ total: string; active: string; inactive: string }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE is_active = true) AS active,
       COUNT(*) FILTER (WHERE is_active = false) AS inactive
     FROM users WHERE tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId],
  );

  const byRoleResult = await queryDb<UserStatRow>(
    `SELECT r.name AS role, COUNT(DISTINCT ur.user_id)::int AS count
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     JOIN users u ON u.id = ur.user_id
     WHERE ur.tenant_id = $1 AND u.deleted_at IS NULL
     GROUP BY r.name
     ORDER BY count DESC`,
    [tenantId],
  );

  const t = totalResult.rows[0];
  return {
    total: parseInt(t.total, 10),
    active: parseInt(t.active, 10),
    inactive: parseInt(t.inactive, 10),
    byRole: byRoleResult.rows,
  };
}

export async function emailExists(tenantId: string, email: string, excludeId?: string): Promise<boolean> {
  const params: unknown[] = [tenantId, email];
  let excludeClause = '';
  if (excludeId) {
    excludeClause = ' AND id != $3';
    params.push(excludeId);
  }
  const result = await queryDb<{ count: string }>(
    `SELECT COUNT(*) AS count FROM users WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL${excludeClause}`,
    params,
  );
  return parseInt(result.rows[0].count, 10) > 0;
}
