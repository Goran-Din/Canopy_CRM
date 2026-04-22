import { z } from 'zod';

export const diaryEntryTypes = [
  'status_change', 'quote_created', 'quote_sent', 'quote_viewed',
  'quote_signed', 'quote_expired', 'quote_version_created',
  'invoice_created', 'invoice_pushed_xero', 'invoice_paid',
  'email_sent', 'sms_sent', 'northchat_thread_linked',
  'automation_fired', 'photo_uploaded', 'crew_assigned',
  'crew_clocked_in', 'crew_clocked_out', 'note_added',
  'job_created', 'job_converted_to_wo',
  // Wave 5-7 additions — NOT YET in the Postgres CHECK constraint
  // (migration 022). A follow-up migration must ALTER the constraint
  // before these code paths run against a real DB. Tracked for Wave 8.
  'milestone_setup', 'milestone_invoiced', 'milestone_cancelled',
  'quote_resent', 'invoice_from_quote', 'quote_declined',
] as const;

export type DiaryEntryType = typeof diaryEntryTypes[number];

export const addDiaryNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type AddDiaryNoteInput = z.infer<typeof addDiaryNoteSchema>;

export const diaryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entry_type: z.string().optional(),
});

export type DiaryQuery = z.infer<typeof diaryQuerySchema>;
