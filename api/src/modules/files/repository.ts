import type pg from 'pg';
import { queryDb, getClient } from '../../config/database.js';
import type { FileQuery } from './schema.js';

// === Interfaces ===

export interface FileFolder {
  id: string;
  tenant_id: string;
  customer_id: string;
  folder_name: string;
  folder_type: string;
  description: string | null;
  sort_order: number;
  portal_visible: boolean;
  internal_only: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ClientFile {
  id: string;
  tenant_id: string;
  customer_id: string;
  folder_id: string | null;
  job_id: string | null;
  property_id: string | null;
  r2_key: string;
  r2_bucket: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  file_category: string;
  photo_tag: string | null;
  portal_visible: boolean;
  is_signed_document: boolean;
  related_quote_id: string | null;
  version: number;
  superseded_by: string | null;
  uploaded_by: string | null;
  uploaded_by_client: boolean;
  upload_source: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface FileInsert {
  tenant_id: string;
  customer_id: string;
  folder_id?: string | null;
  job_id?: string | null;
  property_id?: string | null;
  r2_key: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  file_category?: string;
  portal_visible?: boolean;
  uploaded_by_user_id?: string | null;
  uploaded_by_client?: boolean;
  upload_source?: string;
}

export interface AccessLogInsert {
  tenant_id: string;
  file_id: string;
  accessed_by_user_id?: string | null;
  accessed_by_client?: boolean;
  client_ip_address?: string | null;
  access_type: string;
  source_context?: string | null;
  signed_url_expiry?: Date | null;
}

interface CountRow {
  count: string;
}

// === File Folders ===

const STANDARD_FOLDERS = [
  { folder_name: 'Agreements & Contracts', folder_type: 'agreements', internal_only: false, portal_visible: true, sort_order: 0 },
  { folder_name: 'Quotes & Proposals', folder_type: 'quotes', internal_only: false, portal_visible: true, sort_order: 1 },
  { folder_name: 'Invoices', folder_type: 'invoices', internal_only: false, portal_visible: true, sort_order: 2 },
  { folder_name: 'Property Photos', folder_type: 'photos', internal_only: false, portal_visible: true, sort_order: 3 },
  { folder_name: 'Project Renders & Plans', folder_type: 'renders', internal_only: false, portal_visible: true, sort_order: 4 },
  { folder_name: 'Internal', folder_type: 'internal', internal_only: true, portal_visible: false, sort_order: 5 },
];

/**
 * Create standard folders for a new customer.
 */
export async function createStandardFolders(
  client: pg.PoolClient,
  tenantId: string,
  customerId: string,
  userId?: string,
): Promise<FileFolder[]> {
  const folders: FileFolder[] = [];

  for (const f of STANDARD_FOLDERS) {
    const result = await client.query<FileFolder>(
      `INSERT INTO file_folders
       (tenant_id, customer_id, folder_name, folder_type, internal_only, portal_visible, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenantId, customerId, f.folder_name, f.folder_type, f.internal_only, f.portal_visible, f.sort_order, userId ?? null],
    );
    folders.push(result.rows[0]);
  }

  return folders;
}

/**
 * Create a custom folder.
 */
export async function createFolder(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<FileFolder> {
  const result = await queryDb<FileFolder>(
    `INSERT INTO file_folders
     (tenant_id, customer_id, folder_name, folder_type, internal_only, portal_visible, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      tenantId,
      data.customer_id,
      data.folder_name,
      data.folder_type,
      data.internal_only ?? false,
      data.portal_visible ?? false,
      userId,
    ],
  );
  return result.rows[0];
}

/**
 * List folders for customer.
 * CRITICAL: if includeInternal=false, filter out internal_only folders.
 */
export async function findFoldersByCustomerId(
  tenantId: string,
  customerId: string,
  includeInternal: boolean,
): Promise<FileFolder[]> {
  const conditions = ['tenant_id = $1', 'customer_id = $2', 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId, customerId];

  if (!includeInternal) {
    conditions.push('internal_only = FALSE');
  }

  const result = await queryDb<FileFolder>(
    `SELECT * FROM file_folders
     WHERE ${conditions.join(' AND ')}
     ORDER BY sort_order ASC, folder_name ASC`,
    params,
  );
  return result.rows;
}

/**
 * Find folder by ID.
 */
export async function findFolderById(
  tenantId: string,
  folderId: string,
): Promise<FileFolder | null> {
  const result = await queryDb<FileFolder>(
    `SELECT * FROM file_folders
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [folderId, tenantId],
  );
  return result.rows[0] || null;
}

// === Client Files ===

/**
 * Insert file metadata (after R2 upload confirmed).
 */
export async function insertFile(
  client: pg.PoolClient,
  file: FileInsert,
): Promise<ClientFile> {
  const result = await client.query<ClientFile>(
    `INSERT INTO client_files
     (tenant_id, customer_id, folder_id, job_id, property_id,
      r2_key, file_name, file_size_bytes, mime_type,
      file_category, portal_visible, uploaded_by, uploaded_by_client, upload_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      file.tenant_id,
      file.customer_id,
      file.folder_id ?? null,
      file.job_id ?? null,
      file.property_id ?? null,
      file.r2_key,
      file.file_name,
      file.file_size_bytes,
      file.mime_type,
      file.file_category ?? 'document',
      file.portal_visible ?? false,
      file.uploaded_by_user_id ?? null,
      file.uploaded_by_client ?? false,
      file.upload_source ?? 'staff_crm',
    ],
  );
  return result.rows[0];
}

/**
 * Insert file metadata without transaction client (standalone).
 */
export async function insertFileStandalone(file: FileInsert): Promise<ClientFile> {
  const result = await queryDb<ClientFile>(
    `INSERT INTO client_files
     (tenant_id, customer_id, folder_id, job_id, property_id,
      r2_key, file_name, file_size_bytes, mime_type,
      file_category, portal_visible, uploaded_by, uploaded_by_client, upload_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      file.tenant_id,
      file.customer_id,
      file.folder_id ?? null,
      file.job_id ?? null,
      file.property_id ?? null,
      file.r2_key,
      file.file_name,
      file.file_size_bytes,
      file.mime_type,
      file.file_category ?? 'document',
      file.portal_visible ?? false,
      file.uploaded_by_user_id ?? null,
      file.uploaded_by_client ?? false,
      file.upload_source ?? 'staff_crm',
    ],
  );
  return result.rows[0];
}

/**
 * Get file by ID.
 */
export async function getFileById(
  tenantId: string,
  fileId: string,
): Promise<ClientFile | null> {
  const result = await queryDb<ClientFile>(
    `SELECT * FROM client_files
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [fileId, tenantId],
  );
  return result.rows[0] || null;
}

/**
 * List files for customer with folder/category/portal filtering.
 */
export async function findFilesByCustomerId(
  tenantId: string,
  customerId: string,
  options: FileQuery & { portalOnly?: boolean },
): Promise<{ rows: ClientFile[]; total: number }> {
  const conditions: string[] = [
    'cf.tenant_id = $1',
    'cf.customer_id = $2',
    'cf.deleted_at IS NULL',
  ];
  const params: unknown[] = [tenantId, customerId];
  let paramIdx = 3;
  let joinClause = '';

  if (options.portalOnly) {
    joinClause = 'LEFT JOIN file_folders ff ON ff.id = cf.folder_id';
    conditions.push('cf.portal_visible = TRUE');
    conditions.push('(ff.id IS NULL OR ff.internal_only = FALSE)');
  }

  if (options.folder_id) {
    conditions.push(`cf.folder_id = $${paramIdx}`);
    params.push(options.folder_id);
    paramIdx++;
  }

  if (options.category) {
    conditions.push(`cf.file_category = $${paramIdx}`);
    params.push(options.category);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const offset = (options.page - 1) * options.limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM client_files cf ${joinClause} WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<ClientFile>(
    `SELECT cf.* FROM client_files cf ${joinClause}
     WHERE ${where}
     ORDER BY cf.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, options.limit, offset],
  );

  return { rows: dataResult.rows, total };
}

/**
 * Update file metadata.
 */
export async function updateFile(
  tenantId: string,
  fileId: string,
  data: Record<string, unknown>,
): Promise<ClientFile | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (data.portal_visible !== undefined) {
    setClauses.push(`portal_visible = $${paramIdx}`);
    params.push(data.portal_visible);
    paramIdx++;
  }

  if (data.file_category !== undefined) {
    setClauses.push(`file_category = $${paramIdx}`);
    params.push(data.file_category);
    paramIdx++;
  }

  if (setClauses.length === 0) return getFileById(tenantId, fileId);

  params.push(fileId);
  params.push(tenantId);

  const result = await queryDb<ClientFile>(
    `UPDATE client_files SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx - 1} AND tenant_id = $${paramIdx} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

/**
 * Soft-delete file (BLOCKED for signed documents).
 * Returns null if the file is a signed document (WHERE clause excludes it).
 */
export async function softDeleteFile(
  tenantId: string,
  fileId: string,
): Promise<ClientFile | null> {
  const result = await queryDb<ClientFile>(
    `UPDATE client_files SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND is_signed_document = FALSE
     RETURNING *`,
    [fileId, tenantId],
  );
  return result.rows[0] || null;
}

// === File Access Log (append-only) ===

/**
 * Log file access event.
 */
export async function logAccess(entry: AccessLogInsert): Promise<void> {
  await queryDb(
    `INSERT INTO file_access_log
     (tenant_id, file_id, accessed_by_user_id, accessed_by_client,
      client_ip_address, access_type, source_context, signed_url_expiry)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.tenant_id,
      entry.file_id,
      entry.accessed_by_user_id ?? null,
      entry.accessed_by_client ?? false,
      entry.client_ip_address ?? null,
      entry.access_type,
      entry.source_context ?? null,
      entry.signed_url_expiry ?? null,
    ],
  );
}

/**
 * Acquire a database client for transactions.
 */
export async function acquireClient(): Promise<pg.PoolClient> {
  return getClient();
}
