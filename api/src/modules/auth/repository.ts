import { queryDb } from '../../config/database.js';

interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

interface UserRoleRow {
  role_name: string;
  division_id: string | null;
  division_name: string | null;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  tenant_id: string;
  token: string;
  expires_at: Date;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await queryDb<UserRow>(
    `SELECT id, tenant_id, email, password_hash, first_name, last_name, is_active
     FROM users
     WHERE email = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );
  return result.rows[0] || null;
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const result = await queryDb<UserRow>(
    `SELECT id, tenant_id, email, password_hash, first_name, last_name, is_active
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  return result.rows[0] || null;
}

export async function findUserRoles(
  userId: string,
  tenantId: string,
): Promise<UserRoleRow[]> {
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

export async function saveRefreshToken(
  userId: string,
  tenantId: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await queryDb(
    `INSERT INTO refresh_tokens (user_id, tenant_id, token, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tenantId, token, expiresAt],
  );
}

export async function findRefreshToken(token: string): Promise<RefreshTokenRow | null> {
  const result = await queryDb<RefreshTokenRow>(
    `SELECT id, user_id, tenant_id, token, expires_at
     FROM refresh_tokens
     WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [token],
  );
  return result.rows[0] || null;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await queryDb(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1`,
    [token],
  );
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await queryDb(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}

export async function updateLastLogin(userId: string): Promise<void> {
  await queryDb(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId]);
}
