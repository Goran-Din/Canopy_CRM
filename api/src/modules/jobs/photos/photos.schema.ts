import { z } from 'zod';

export const photoTags = [
  'before_work', 'during_work', 'after_work',
  'issue_found', 'customer_signoff', 'property_overview',
] as const;

export const uploadSources = [
  'crew_app', 'staff_web', 'client_portal', 'system',
] as const;

export const addPhotoSchema = z.object({
  file_id: z.string().uuid(),
  photo_tag: z.enum(photoTags),
  caption: z.string().max(500).optional(),
  portal_visible: z.boolean().optional(),
  upload_source: z.enum(uploadSources).default('staff_web'),
});

export type AddPhotoInput = z.infer<typeof addPhotoSchema>;

export const updatePhotoSchema = z.object({
  photo_tag: z.enum(photoTags).optional(),
  caption: z.string().max(500).optional(),
  portal_visible: z.boolean().optional(),
});

export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>;

export const photoParamsSchema = z.object({
  id: z.string().uuid('Invalid job ID'),
  photoId: z.string().uuid('Invalid photo ID'),
});
