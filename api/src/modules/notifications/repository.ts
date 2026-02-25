import { queryDb } from '../../config/database.js';
import type { NotificationQuery, PreferenceInput } from './schema.js';

// --- Types ---

export interface NotificationRow {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  priority: string;
  delivery_method: string;
  delivered_at: string | null;
  created_at: string;
}

export interface NotificationPreferenceRow {
  id: string;
  tenant_id: string;
  user_id: string;
  notification_type: string;
  in_app: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  created_at: string;
  updated_at: string;
}

interface CountRow { count: string; }

// ============================================
// Notifications CRUD
// ============================================

export async function findAll(
  tenantId: string,
  userId: string,
  query: NotificationQuery,
): Promise<{ rows: NotificationRow[]; total: number }> {
  const conds: string[] = ['tenant_id = $1', 'user_id = $2'];
  const params: unknown[] = [tenantId, userId];
  let pi = 3;

  if (query.unread_only) {
    conds.push('is_read = FALSE');
  }
  if (query.type) {
    conds.push(`type = $${pi}::notification_type`);
    params.push(query.type);
    pi++;
  }
  if (query.priority) {
    conds.push(`priority = $${pi}::notification_priority`);
    params.push(query.priority);
    pi++;
  }

  const where = conds.join(' AND ');
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM notifications WHERE ${where}`,
    params,
  );
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<NotificationRow>(
    `SELECT * FROM notifications
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );

  return { rows: data.rows, total };
}

export async function findById(
  tenantId: string,
  userId: string,
  id: string,
): Promise<NotificationRow | null> {
  const res = await queryDb<NotificationRow>(
    `SELECT * FROM notifications
     WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
    [id, tenantId, userId],
  );
  return res.rows[0] || null;
}

export async function create(
  tenantId: string,
  data: Record<string, unknown>,
): Promise<NotificationRow> {
  const res = await queryDb<NotificationRow>(
    `INSERT INTO notifications (
       tenant_id, user_id, type, title, message,
       entity_type, entity_id, priority, delivery_method
     ) VALUES (
       $1, $2, $3::notification_type, $4, $5,
       $6, $7, $8::notification_priority, $9::notification_delivery
     ) RETURNING *`,
    [
      tenantId,
      data.user_id,
      data.type,
      data.title,
      data.message,
      data.entity_type || null,
      data.entity_id || null,
      data.priority || 'normal',
      data.delivery_method || 'in_app',
    ],
  );
  return res.rows[0];
}

export async function markAsRead(
  tenantId: string,
  userId: string,
  id: string,
): Promise<NotificationRow | null> {
  const res = await queryDb<NotificationRow>(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND is_read = FALSE
     RETURNING *`,
    [id, tenantId, userId],
  );
  return res.rows[0] || null;
}

export async function markAllAsRead(
  tenantId: string,
  userId: string,
): Promise<number> {
  const res = await queryDb<NotificationRow>(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE tenant_id = $1 AND user_id = $2 AND is_read = FALSE`,
    [tenantId, userId],
  );
  return res.rowCount ?? 0;
}

export async function getUnreadCount(
  tenantId: string,
  userId: string,
): Promise<number> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM notifications
     WHERE tenant_id = $1 AND user_id = $2 AND is_read = FALSE`,
    [tenantId, userId],
  );
  return parseInt(res.rows[0].count, 10);
}

// ============================================
// Notification Preferences
// ============================================

export async function getUserPreferences(
  tenantId: string,
  userId: string,
): Promise<NotificationPreferenceRow[]> {
  const res = await queryDb<NotificationPreferenceRow>(
    `SELECT * FROM notification_preferences
     WHERE tenant_id = $1 AND user_id = $2
     ORDER BY notification_type`,
    [tenantId, userId],
  );
  return res.rows;
}

export async function upsertPreference(
  tenantId: string,
  userId: string,
  pref: PreferenceInput,
): Promise<NotificationPreferenceRow> {
  const res = await queryDb<NotificationPreferenceRow>(
    `INSERT INTO notification_preferences (
       tenant_id, user_id, notification_type,
       in_app, email, sms, push
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, notification_type)
     DO UPDATE SET
       in_app = EXCLUDED.in_app,
       email = EXCLUDED.email,
       sms = EXCLUDED.sms,
       push = EXCLUDED.push
     RETURNING *`,
    [
      tenantId,
      userId,
      pref.notification_type,
      pref.in_app ?? true,
      pref.email ?? false,
      pref.sms ?? false,
      pref.push ?? false,
    ],
  );
  return res.rows[0];
}
