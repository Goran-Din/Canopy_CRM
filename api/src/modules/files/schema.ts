import { z } from 'zod';

const fileCategories = [
  'quote_pdf', 'contract_pdf', 'signature', 'invoice_pdf',
  'property_photo', 'project_render', 'general', 'internal',
] as const;

const uploadSources = [
  'crew_app', 'staff_web', 'client_portal', 'system',
] as const;

const folderTypes = [
  'agreements', 'quotes', 'invoices', 'photos', 'renders', 'internal', 'custom',
] as const;

// --- Upload flow ---

export const uploadUrlSchema = z.object({
  customer_id: z.string().uuid(),
  folder_id: z.string().uuid(),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1),
  file_size_bytes: z.coerce.number().int().min(1),
});

export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;

export const confirmUploadSchema = z.object({
  r2_key: z.string().min(1),
  customer_id: z.string().uuid(),
  folder_id: z.string().uuid(),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1),
  file_size_bytes: z.coerce.number().int().min(1),
  file_category: z.enum(fileCategories).default('general'),
  portal_visible: z.boolean().default(false),
  upload_source: z.enum(uploadSources).default('staff_web'),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

// --- File management ---

export const updateFileSchema = z.object({
  portal_visible: z.boolean().optional(),
  file_category: z.enum(fileCategories).optional(),
});

export type UpdateFileInput = z.infer<typeof updateFileSchema>;

export const fileQuerySchema = z.object({
  folder_id: z.string().uuid().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type FileQuery = z.infer<typeof fileQuerySchema>;

export const fileIdParamsSchema = z.object({
  id: z.string().uuid('Invalid file ID'),
});

export const customerIdParamsSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
});

// --- Folders ---

export const createFolderSchema = z.object({
  customer_id: z.string().uuid(),
  folder_name: z.string().min(1).max(100),
  folder_type: z.literal('custom'),
  internal_only: z.boolean().default(false),
  portal_visible: z.boolean().default(false),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
