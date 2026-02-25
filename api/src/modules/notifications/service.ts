import { AppError } from '../../middleware/errorHandler.js';
import type { NotificationQuery, CreateNotificationInput, UpdatePreferencesInput } from './schema.js';
import * as repo from './repository.js';

export async function listNotifications(tenantId: string, userId: string, query: NotificationQuery) {
  const { rows, total } = await repo.findAll(tenantId, userId, query);
  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getUnreadCount(tenantId: string, userId: string) {
  const count = await repo.getUnreadCount(tenantId, userId);
  return { count };
}

export async function markAsRead(tenantId: string, userId: string, id: string) {
  const notification = await repo.findById(tenantId, userId, id);
  if (!notification) {
    throw new AppError(404, 'Notification not found');
  }
  if (notification.is_read) {
    return notification;
  }
  const updated = await repo.markAsRead(tenantId, userId, id);
  return updated || notification;
}

export async function markAllAsRead(tenantId: string, userId: string) {
  const count = await repo.markAllAsRead(tenantId, userId);
  return { marked: count };
}

export async function createNotification(tenantId: string, input: CreateNotificationInput) {
  // Check user preferences to determine if they want this type
  const prefs = await repo.getUserPreferences(tenantId, input.user_id);
  const pref = prefs.find((p) => p.notification_type === input.type);

  // If user has explicitly disabled in_app for this type, skip
  if (pref && !pref.in_app && input.delivery_method === 'in_app') {
    return null;
  }

  return repo.create(tenantId, input);
}

export async function bulkCreateNotifications(
  tenantId: string,
  userIds: string[],
  baseInput: Omit<CreateNotificationInput, 'user_id'>,
) {
  const results = [];
  for (const userId of userIds) {
    const notification = await createNotification(tenantId, { ...baseInput, user_id: userId });
    if (notification) results.push(notification);
  }
  return results;
}

export async function getPreferences(tenantId: string, userId: string) {
  return repo.getUserPreferences(tenantId, userId);
}

export async function updatePreferences(
  tenantId: string,
  userId: string,
  input: UpdatePreferencesInput,
) {
  const results = [];
  for (const pref of input.preferences) {
    const updated = await repo.upsertPreference(tenantId, userId, pref);
    results.push(updated);
  }
  return results;
}
