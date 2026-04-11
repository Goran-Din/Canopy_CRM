import { z } from 'zod';

// --- Submit Feedback (public) ---

export const submitFeedbackSchema = z.object({
  feedback_token: z.string().min(1).max(64),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

// --- Review Clicked (public) ---

export const tokenParamsSchema = z.object({
  token: z.string().min(1).max(64),
});

// --- List Feedback (staff) ---

export const listFeedbackSchema = z.object({
  status: z.enum(['sent', 'responded', 'expired']).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customer_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListFeedbackInput = z.infer<typeof listFeedbackSchema>;

// --- Add Staff Note ---

export const addStaffNoteSchema = z.object({
  note: z.string().min(1).max(2000),
});

export type AddStaffNoteInput = z.infer<typeof addStaffNoteSchema>;

// --- Feedback ID Params ---

export const feedbackIdParamsSchema = z.object({
  id: z.string().uuid('Invalid feedback ID'),
});
