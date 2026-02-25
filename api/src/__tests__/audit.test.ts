import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'canopy_crm',
  user: process.env.DB_USER || 'canopy',
  password: process.env.DB_PASSWORD || 'canopy_dev',
});

interface AuditRow {
  id: string;
  tenant_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
}

describe('Audit log triggers (integration)', () => {
  let client: pg.PoolClient;
  let tenantId: string;

  beforeAll(async () => {
    client = await pool.connect();
    await client.query('BEGIN');

    // Create a test tenant
    const tenantResult = await client.query<{ id: string }>(
      `INSERT INTO tenants (name, slug)
       VALUES ('Audit Test Tenant', 'audit-test-' || substr(gen_random_uuid()::text, 1, 8))
       RETURNING id`,
    );
    tenantId = tenantResult.rows[0].id;
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    await pool.end();
  });

  it('should log INSERT operations', async () => {
    const insertResult = await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
       VALUES ($1, 'audit-insert@test.com', 'hash123', 'Insert', 'Test')
       RETURNING id`,
      [tenantId],
    );
    const userId = insertResult.rows[0].id;

    const auditResult = await client.query<AuditRow>(
      `SELECT * FROM audit_log
       WHERE table_name = 'users' AND action = 'INSERT' AND record_id = $1`,
      [userId],
    );

    expect(auditResult.rows.length).toBe(1);
    expect(auditResult.rows[0].tenant_id).toBe(tenantId);
    expect(auditResult.rows[0].new_values).toBeDefined();
    expect(auditResult.rows[0].new_values!.email).toBe('audit-insert@test.com');
    // password_hash should be stripped from audit log
    expect(auditResult.rows[0].new_values!.password_hash).toBeUndefined();
  });

  it('should log UPDATE operations with old and new values', async () => {
    // Get the user we just inserted
    const userResult = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = 'audit-insert@test.com'`,
      [tenantId],
    );
    const userId = userResult.rows[0].id;

    await client.query(
      `UPDATE users SET first_name = 'Updated' WHERE id = $1`,
      [userId],
    );

    const auditResult = await client.query<AuditRow>(
      `SELECT * FROM audit_log
       WHERE table_name = 'users' AND action = 'UPDATE' AND record_id = $1`,
      [userId],
    );

    expect(auditResult.rows.length).toBe(1);
    expect(auditResult.rows[0].old_values!.first_name).toBe('Insert');
    expect(auditResult.rows[0].new_values!.first_name).toBe('Updated');
    // password_hash stripped from both old and new
    expect(auditResult.rows[0].old_values!.password_hash).toBeUndefined();
    expect(auditResult.rows[0].new_values!.password_hash).toBeUndefined();
  });

  it('should log DELETE operations', async () => {
    const userResult = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = 'audit-insert@test.com'`,
      [tenantId],
    );
    const userId = userResult.rows[0].id;

    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);

    const auditResult = await client.query<AuditRow>(
      `SELECT * FROM audit_log
       WHERE table_name = 'users' AND action = 'DELETE' AND record_id = $1`,
      [userId],
    );

    expect(auditResult.rows.length).toBe(1);
    expect(auditResult.rows[0].old_values).toBeDefined();
    expect(auditResult.rows[0].old_values!.email).toBe('audit-insert@test.com');
    expect(auditResult.rows[0].new_values).toBeNull();
  });

  it('should log tenant table changes with own id as tenant_id', async () => {
    const auditResult = await client.query<AuditRow>(
      `SELECT * FROM audit_log
       WHERE table_name = 'tenants' AND action = 'INSERT' AND record_id = $1`,
      [tenantId],
    );

    expect(auditResult.rows.length).toBe(1);
    // For tenants table, tenant_id should equal the record's own id
    expect(auditResult.rows[0].tenant_id).toBe(tenantId);
    expect(auditResult.rows[0].new_values!.name).toBe('Audit Test Tenant');
  });
});
