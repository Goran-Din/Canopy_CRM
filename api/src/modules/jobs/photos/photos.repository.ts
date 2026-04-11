import type pg from 'pg';
import { queryDb } from '../../../config/database.js';

export interface JobPhoto {
  id: string;
  tenant_id: string;
  job_id: string;
  file_id: string;
  property_id: string | null;
  photo_tag: string;
  caption: string | null;
  uploaded_by: string | null;
  upload_source: string;
  portal_visible: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface PhotoInsert {
  tenant_id: string;
  job_id: string;
  file_id: string;
  property_id?: string | null;
  photo_tag: string;
  caption?: string | null;
  uploaded_by?: string | null;
  upload_source?: string;
  portal_visible?: boolean;
}

/**
 * Insert photo record using a transaction client.
 */
export async function insert(
  client: pg.PoolClient,
  photo: PhotoInsert,
): Promise<JobPhoto> {
  const result = await client.query<JobPhoto>(
    `INSERT INTO job_photos
     (tenant_id, job_id, file_id, property_id, photo_tag, caption,
      uploaded_by, upload_source, portal_visible)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      photo.tenant_id,
      photo.job_id,
      photo.file_id,
      photo.property_id ?? null,
      photo.photo_tag,
      photo.caption ?? null,
      photo.uploaded_by ?? null,
      photo.upload_source ?? 'staff_web',
      photo.portal_visible ?? false,
    ],
  );
  return result.rows[0];
}

/**
 * Insert photo record without a transaction client.
 */
export async function insertStandalone(photo: PhotoInsert): Promise<JobPhoto> {
  const result = await queryDb<JobPhoto>(
    `INSERT INTO job_photos
     (tenant_id, job_id, file_id, property_id, photo_tag, caption,
      uploaded_by, upload_source, portal_visible)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      photo.tenant_id,
      photo.job_id,
      photo.file_id,
      photo.property_id ?? null,
      photo.photo_tag,
      photo.caption ?? null,
      photo.uploaded_by ?? null,
      photo.upload_source ?? 'staff_web',
      photo.portal_visible ?? false,
    ],
  );
  return result.rows[0];
}

/**
 * List photos by job (filterable by tag).
 */
export async function findByJobId(
  tenantId: string,
  jobId: string,
  tag?: string,
): Promise<JobPhoto[]> {
  const conditions: string[] = [
    'tenant_id = $1',
    'job_id = $2',
    'deleted_at IS NULL',
  ];
  const params: unknown[] = [tenantId, jobId];

  if (tag) {
    conditions.push('photo_tag = $3');
    params.push(tag);
  }

  const result = await queryDb<JobPhoto>(
    `SELECT * FROM job_photos
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC`,
    params,
  );
  return result.rows;
}

/**
 * Find photo by ID.
 */
export async function findById(
  tenantId: string,
  photoId: string,
): Promise<JobPhoto | null> {
  const result = await queryDb<JobPhoto>(
    `SELECT * FROM job_photos
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [photoId, tenantId],
  );
  return result.rows[0] || null;
}

/**
 * Update photo metadata (tag, caption, portal_visible).
 */
export async function update(
  tenantId: string,
  photoId: string,
  data: Record<string, unknown>,
): Promise<JobPhoto | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (data.photo_tag !== undefined) {
    setClauses.push(`photo_tag = $${paramIdx}`);
    params.push(data.photo_tag);
    paramIdx++;
  }

  if (data.caption !== undefined) {
    setClauses.push(`caption = $${paramIdx}`);
    params.push(data.caption);
    paramIdx++;
  }

  if (data.portal_visible !== undefined) {
    setClauses.push(`portal_visible = $${paramIdx}`);
    params.push(data.portal_visible);
    paramIdx++;
  }

  if (setClauses.length === 0) return findById(tenantId, photoId);

  params.push(photoId);
  params.push(tenantId);

  const result = await queryDb<JobPhoto>(
    `UPDATE job_photos SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx - 1} AND tenant_id = $${paramIdx} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

/**
 * Soft-delete photo.
 */
export async function softDelete(
  tenantId: string,
  photoId: string,
): Promise<JobPhoto | null> {
  const result = await queryDb<JobPhoto>(
    `UPDATE job_photos SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [photoId, tenantId],
  );
  return result.rows[0] || null;
}
