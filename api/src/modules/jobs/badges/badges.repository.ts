import { queryDb } from '../../../config/database.js';

export interface JobBadge {
  id: string;
  tenant_id: string;
  badge_name: string;
  badge_color: string;
  badge_icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get all active badges for tenant.
 */
export async function findAll(tenantId: string): Promise<JobBadge[]> {
  const result = await queryDb<JobBadge>(
    `SELECT * FROM job_badges
     WHERE tenant_id = $1 AND is_active = TRUE
     ORDER BY sort_order ASC`,
    [tenantId],
  );
  return result.rows;
}

/**
 * Find badge by ID.
 */
export async function findById(
  tenantId: string,
  badgeId: string,
): Promise<JobBadge | null> {
  const result = await queryDb<JobBadge>(
    `SELECT * FROM job_badges WHERE id = $1 AND tenant_id = $2`,
    [badgeId, tenantId],
  );
  return result.rows[0] || null;
}

/**
 * Create or update badge.
 */
export async function upsert(
  tenantId: string,
  data: Record<string, unknown>,
): Promise<JobBadge> {
  if (data.id) {
    const result = await queryDb<JobBadge>(
      `UPDATE job_badges
       SET badge_name = $1, badge_color = $2, badge_icon = $3,
           sort_order = $4, is_active = $5
       WHERE id = $6 AND tenant_id = $7
       RETURNING *`,
      [
        data.badge_name,
        data.badge_color,
        data.badge_icon ?? null,
        data.sort_order ?? 0,
        data.is_active ?? true,
        data.id,
        tenantId,
      ],
    );
    return result.rows[0];
  }

  const result = await queryDb<JobBadge>(
    `INSERT INTO job_badges (tenant_id, badge_name, badge_color, badge_icon, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      tenantId,
      data.badge_name,
      data.badge_color,
      data.badge_icon ?? null,
      data.sort_order ?? 0,
      data.is_active ?? true,
    ],
  );
  return result.rows[0];
}

/**
 * Assign badges to a job (update badge_ids array).
 */
export async function assignToJob(
  tenantId: string,
  jobId: string,
  badgeIds: string[],
): Promise<void> {
  await queryDb(
    `UPDATE jobs SET badge_ids = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [badgeIds, jobId, tenantId],
  );
}
