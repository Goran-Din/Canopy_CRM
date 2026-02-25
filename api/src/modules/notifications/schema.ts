import { z } from 'zod';

const notificationTypes = [
  'job_assigned', 'job_completed', 'invoice_overdue', 'payment_received',
  'dispute_opened', 'contract_expiring', 'snow_run_started',
  'equipment_maintenance_due', 'low_stock_alert', 'prospect_follow_up',
  'schedule_change', 'system_alert',
] as const;

const priorities = ['low', 'normal', 'high', 'urgent'] as const;
const deliveryMethods = ['in_app', 'email', 'sms', 'push'] as const;

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  unread_only: z.coerce.boolean().optional(),
  type: z.enum(notificationTypes).optional(),
  priority: z.enum(priorities).optional(),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export const createNotificationSchema = z.object({
  user_id: z.string().uuid(),
  type: z.enum(notificationTypes),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  entity_type: z.string().max(50).nullish(),
  entity_id: z.string().uuid().nullish(),
  priority: z.enum(priorities).default('normal'),
  delivery_method: z.enum(deliveryMethods).default('in_app'),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const notificationParamsSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});

export const preferenceInputSchema = z.object({
  notification_type: z.string().min(1),
  in_app: z.boolean().optional(),
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  push: z.boolean().optional(),
});

export type PreferenceInput = z.infer<typeof preferenceInputSchema>;

export const updatePreferencesSchema = z.object({
  preferences: z.array(preferenceInputSchema).min(1),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
