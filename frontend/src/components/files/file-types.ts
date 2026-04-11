export interface FileRecord {
  id: string;
  tenant_id: string;
  customer_id: string;
  folder_id: string | null;
  original_filename: string;
  file_size: number;
  mime_type: string;
  file_category: string;
  portal_visible: boolean;
  is_signed_document: boolean;
  photo_tag?: string;
  created_at: string;
  created_by_name?: string;
}

export interface Folder {
  id: string;
  folder_name: string;
  folder_slug: string;
  is_internal: boolean;
  file_count: number;
}

export const STANDARD_FOLDERS = [
  { name: 'Agreements & Contracts', slug: 'agreements', icon: 'FileText' },
  { name: 'Quotes & Proposals', slug: 'quotes', icon: 'FileSignature' },
  { name: 'Invoices', slug: 'invoices', icon: 'Receipt' },
  { name: 'Property Photos', slug: 'photos', icon: 'Image' },
  { name: 'Project Renders & Plans', slug: 'renders', icon: 'PenTool' },
  { name: 'Internal', slug: 'internal', icon: 'Lock', staffOnly: true },
] as const;

export const PHOTO_TAGS = [
  'before_work',
  'during_work',
  'after_work',
  'issue_found',
  'sign_off',
] as const;

export type PhotoTag = (typeof PHOTO_TAGS)[number];

export const PHOTO_TAG_LABELS: Record<PhotoTag, string> = {
  before_work: 'Before Work',
  during_work: 'During Work',
  after_work: 'After Work',
  issue_found: 'Issue Found',
  sign_off: 'Sign-off',
};

export const FILE_CATEGORIES = [
  'contract_pdf',
  'quote_pdf',
  'signed_quote_pdf',
  'invoice_pdf',
  'property_photo',
  'project_render',
  'internal_doc',
  'client_upload',
  'other',
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  contract_pdf: 'Contract PDF',
  quote_pdf: 'Quote PDF',
  signed_quote_pdf: 'Signed Quote PDF',
  invoice_pdf: 'Invoice PDF',
  property_photo: 'Property Photo',
  project_render: 'Project Render',
  internal_doc: 'Internal Document',
  client_upload: 'Client Upload',
  other: 'Other',
};

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const MAX_FILE_SIZE_STAFF = 50 * 1024 * 1024; // 50MB
export const MAX_FILE_SIZE_PORTAL = 10 * 1024 * 1024; // 10MB

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getMimeIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'FileText';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.includes('word')) return 'FileText';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Table2';
  return 'File';
}
