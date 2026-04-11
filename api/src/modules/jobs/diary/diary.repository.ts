import type pg from 'pg';
import { queryDb } from '../../../config/database.js';
import type { DiaryEntryType } from './diary.schema.js';

export interface DiaryEntry {
  id: string;
  tenant_id: string;
  job_id: string;
  entry_type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  is_system_entry: boolean;
  northchat_thread_id: string | null;
  created_at: Date;
}

export interface DiaryInsert {
  tenant_id: string;
  job_id: string;
  entry_type: DiaryEntryType;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
  created_by_user_id?: string | null;
  is_system_entry?: boolean;
  northchat_thread_id?: string | null;
}

interface CountRow {
  count: string;
}

/**
 * Insert diary entry using a transaction client.
 * Append-only — no update, no delete.
 */
export async function insert(
  client: pg.PoolClient,
  entry: DiaryInsert,
): Promise<DiaryEntry> {
  const result = await client.query<DiaryEntry>(
    `INSERT INTO job_diary_entries
     (tenant_id, job_id, entry_type, title, body, metadata,
      created_by_user_id, is_system_entry, northchat_thread_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      entry.tenant_id,
      entry.job_id,
      entry.entry_type,
      entry.title,
      entry.body ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : '{}',
      entry.created_by_user_id ?? null,
      entry.is_system_entry ?? true,
      entry.northchat_thread_id ?? null,
    ],
  );
  return result.rows[0];
}

/**
 * Insert diary entry without a transaction client (standalone).
 */
export async function insertStandalone(entry: DiaryInsert): Promise<DiaryEntry> {
  const result = await queryDb<DiaryEntry>(
    `INSERT INTO job_diary_entries
     (tenant_id, job_id, entry_type, title, body, metadata,
      created_by_user_id, is_system_entry, northchat_thread_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      entry.tenant_id,
      entry.job_id,
      entry.entry_type,
      entry.title,
      entry.body ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : '{}',
      entry.created_by_user_id ?? null,
      entry.is_system_entry ?? true,
      entry.northchat_thread_id ?? null,
    ],
  );
  return result.rows[0];
}

/**
 * List diary entries (newest first, paginated).
 */
export async function findByJobId(
  tenantId: string,
  jobId: string,
  page: number,
  limit: number,
  entryType?: string,
): Promise<{ rows: DiaryEntry[]; total: number }> {
  const conditions: string[] = ['tenant_id = $1', 'job_id = $2'];
  const params: unknown[] = [tenantId, jobId];
  let paramIdx = 3;

  if (entryType) {
    conditions.push(`entry_type = $${paramIdx}`);
    params.push(entryType);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM job_diary_entries WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<DiaryEntry>(
    `SELECT * FROM job_diary_entries
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );

  return { rows: dataResult.rows, total };
}
