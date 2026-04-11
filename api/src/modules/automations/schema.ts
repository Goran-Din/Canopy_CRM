import { z } from 'zod';

export const automationTypes = [
  'booking_confirmation', 'appointment_reminder', 'quote_followup',
  'payment_reminder', 'feedback_request',
] as const;

export const automationTypeParamsSchema = z.object({
  type: z.enum(automationTypes),
});

// --- Update Config ---

export const updateConfigSchema = z.object({
  is_enabled: z.boolean().optional(),
  template_id: z.string().uuid().optional().nullable(),
  delay_minutes: z.coerce.number().int().min(0).optional(),
  send_via: z.enum(['email', 'sms', 'both']).optional(),
  max_repeats: z.coerce.number().int().min(1).max(10).optional(),
  repeat_interval_days: z.coerce.number().int().min(1).max(90).optional(),
  conditions: z.record(z.unknown()).optional(),
});

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

// --- List Logs ---

export const listLogsSchema = z.object({
  automation_type: z.enum(automationTypes).optional(),
  status: z.enum(['sent', 'failed', 'skipped', 'cancelled']).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customer_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListLogsInput = z.infer<typeof listLogsSchema>;

// --- Test Send ---

export const testSendSchema = z.object({
  automation_type: z.enum(automationTypes),
  recipient_email: z.string().email().optional(),
  recipient_phone: z.string().max(30).optional(),
});

export type TestSendInput = z.infer<typeof testSendSchema>;
