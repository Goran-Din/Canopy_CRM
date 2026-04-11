# Wave 2, Task 2: File Management Module (D-33)

> **Branch:** `feature/wave2-file-management`
> **Source docs:** D-33 (File Management Module)
> **Dependencies:** Wave 1 complete (migration 026 — file_folders, client_files, file_access_log)
> **Build order:** Build alongside or right after Job Pipeline (D-23 depends on this for photos)

---

## Overview

Unified file storage, retrieval, and access control. All files stored in Cloudflare R2 with signed URLs (1-hour expiry). Two-step upload flow (presigned URL → confirm). Internal folders never visible in portal. Signed documents can never be deleted.

## Files to Create

```
api/src/modules/files/
├── controller.ts
├── service.ts
├── repository.ts
├── schema.ts
├── routes.ts
├── r2.client.ts          ← R2 SDK wrapper (presigned URLs, upload, download)
└── __tests__/
```

---

## Part A: R2 Client Wrapper

### `r2.client.ts`

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 is S3-compatible — use AWS SDK with R2 endpoint
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,  // https://<account_id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

// Generate presigned upload URL (10-minute expiry)
export async function getPresignedUploadUrl(r2Key: string, mimeType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    ContentType: mimeType,
  });
  return getSignedUrl(r2Client, command, { expiresIn: 600 }); // 10 min
}

// Generate presigned download URL (1-hour expiry)
export async function getPresignedDownloadUrl(r2Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
  });
  return getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 hour
}

// Direct upload (for system-generated files like PDFs, signatures)
export async function uploadBuffer(r2Key: string, buffer: Buffer, mimeType: string): Promise<void> {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: buffer,
    ContentType: mimeType,
  }));
}
```

### Environment Variables (add to `.env.example`)
```
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=canopy-crm
```

---

## Part B: Repository

### `repository.ts`

```typescript
// === File Folders ===

// Create standard folders for new customer (called on customer creation)
export async function createStandardFolders(client: PoolClient, tenantId: string, customerId: string): Promise<FileFolder[]> {
  const standardFolders = [
    { folder_name: 'Agreements & Contracts', folder_type: 'agreements', internal_only: false, portal_visible: true },
    { folder_name: 'Quotes & Proposals', folder_type: 'quotes', internal_only: false, portal_visible: true },
    { folder_name: 'Invoices', folder_type: 'invoices', internal_only: false, portal_visible: true },
    { folder_name: 'Property Photos', folder_type: 'photos', internal_only: false, portal_visible: true },
    { folder_name: 'Project Renders & Plans', folder_type: 'renders', internal_only: false, portal_visible: true },
    { folder_name: 'Internal', folder_type: 'internal', internal_only: true, portal_visible: false },
  ];

  // INSERT INTO file_folders (tenant_id, customer_id, folder_name, folder_type, internal_only, portal_visible, is_system_folder)
  // VALUES ... RETURNING *
  // is_system_folder = TRUE for standard folders (cannot be deleted)
}

// List folders for customer
export async function findFoldersByCustomerId(tenantId: string, customerId: string, includeInternal: boolean): Promise<FileFolder[]> {
  // CRITICAL: if includeInternal=false, add WHERE internal_only = FALSE
  // Portal API always passes includeInternal=false
  // Staff API passes includeInternal=true
}

// === Client Files ===

// Insert file metadata (after R2 upload confirmed)
export async function insertFile(client: PoolClient, file: FileInsert): Promise<ClientFile> {
  // INSERT INTO client_files (tenant_id, customer_id, folder_id, r2_key, file_name, ...)
  // r2_key has UNIQUE constraint — prevents duplicate uploads
}

// Get file by ID
export async function getFileById(tenantId: string, fileId: string): Promise<ClientFile | null> {
  // WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL
}

// List files for customer (with folder filtering, portal filtering)
export async function findFilesByCustomerId(
  tenantId: string, customerId: string, options: FileQueryOptions
): Promise<{ rows: ClientFile[]; total: number }> {
  // Build WHERE clause dynamically
  // If options.portalOnly: JOIN file_folders AND filter internal_only=FALSE AND portal_visible=TRUE
  // If options.folderId: AND folder_id=$N
  // If options.category: AND file_category=$N
  // ORDER BY created_at DESC, LIMIT, OFFSET
}

// Soft-delete file (BLOCKED for signed documents)
export async function softDeleteFile(client: PoolClient, tenantId: string, fileId: string): Promise<void> {
  // UPDATE client_files SET deleted_at=NOW() WHERE id=$1 AND tenant_id=$2 AND is_signed_document=FALSE
  // If is_signed_document=TRUE, the WHERE clause won't match → return 0 rows → service throws 422
}

// === File Access Log (append-only) ===
export async function logAccess(entry: AccessLogInsert): Promise<void> {
  // INSERT INTO file_access_log (tenant_id, file_id, accessed_by_user_id, ...)
  // No update, no delete — append only
}
```

---

## Part C: Service Layer

### `service.ts`

```typescript
// Two-step upload: Step 1 — Get presigned URL
export async function getUploadUrl(tenantId: string, input: UploadUrlInput, userId: string) {
  // 1. Validate mime type is allowed
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowedMimes.includes(input.mime_type)) {
    throw new BadRequestError('File type not allowed');
  }

  // 2. Validate file size (50MB staff, 10MB client)
  const maxSize = input.uploaded_by_client ? 10_000_000 : 50_000_000;
  if (input.file_size_bytes > maxSize) {
    throw new BadRequestError(`File too large. Max ${maxSize / 1_000_000}MB`);
  }

  // 3. Generate R2 key
  const r2Key = `${tenantId}/clients/${input.customer_id}/${input.folder_type}/${Date.now()}_${input.file_name}`;

  // 4. Get presigned upload URL
  const uploadUrl = await r2Client.getPresignedUploadUrl(r2Key, input.mime_type);

  return { upload_url: uploadUrl, r2_key: r2Key };
}

// Two-step upload: Step 2 — Confirm upload
export async function confirmUpload(tenantId: string, input: ConfirmUploadInput, userId: string) {
  return await db.transaction(async (client) => {
    // 1. Insert file record
    const file = await FileRepository.insertFile(client, {
      tenant_id: tenantId,
      customer_id: input.customer_id,
      folder_id: input.folder_id,
      r2_key: input.r2_key,
      file_name: input.file_name,
      mime_type: input.mime_type,
      file_size_bytes: input.file_size_bytes,
      file_category: input.file_category,
      portal_visible: input.portal_visible ?? false,
      uploaded_by_user_id: userId,
      upload_source: input.upload_source ?? 'staff_web',
    });

    // 2. Log access
    await FileRepository.logAccess({
      tenant_id: tenantId,
      file_id: file.id,
      accessed_by_user_id: userId,
      access_type: 'upload',
    });

    return file;
  });
}

// Get signed download URL (logs access)
export async function getDownloadUrl(tenantId: string, fileId: string, userId: string, userRole: string, clientIp: string) {
  const file = await FileRepository.getFileById(tenantId, fileId);
  if (!file) throw new NotFoundError('File not found');

  // Portal access check
  if (userRole === 'client') {
    if (!file.portal_visible) throw new ForbiddenError('Not accessible in portal');
  }

  // Generate signed URL
  const signedUrl = await r2Client.getPresignedDownloadUrl(file.r2_key);
  const expiresAt = new Date(Date.now() + 3600_000); // 1 hour

  // Log access
  await FileRepository.logAccess({
    tenant_id: tenantId,
    file_id: fileId,
    accessed_by_user_id: userRole !== 'client' ? userId : null,
    accessed_by_client: userRole === 'client',
    client_ip_address: clientIp,
    access_type: 'download',
    signed_url_expiry: expiresAt,
  });

  return { download_url: signedUrl, expires_at: expiresAt };
}

// Delete file (blocks signed documents)
export async function deleteFile(tenantId: string, fileId: string, userId: string) {
  const file = await FileRepository.getFileById(tenantId, fileId);
  if (!file) throw new NotFoundError('File not found');
  if (file.is_signed_document) {
    throw new UnprocessableError('Signed documents cannot be deleted');
  }

  await FileRepository.softDeleteFile(db.pool, tenantId, fileId);

  await FileRepository.logAccess({
    tenant_id: tenantId,
    file_id: fileId,
    accessed_by_user_id: userId,
    access_type: 'delete',
  });
}
```

---

## Part D: Zod Schemas

### `schema.ts`

```typescript
export const uploadUrlSchema = z.object({
  customer_id: z.string().uuid(),
  folder_id: z.string().uuid(),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1),
  file_size_bytes: z.coerce.number().int().min(1),
});

export const confirmUploadSchema = z.object({
  r2_key: z.string().min(1),
  customer_id: z.string().uuid(),
  folder_id: z.string().uuid(),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1),
  file_size_bytes: z.coerce.number().int().min(1),
  file_category: z.enum([
    'quote_pdf', 'contract_pdf', 'signature', 'invoice_pdf',
    'property_photo', 'project_render', 'general', 'internal'
  ]).default('general'),
  portal_visible: z.boolean().default(false),
  upload_source: z.enum(['crew_app', 'staff_web', 'client_portal', 'system']).default('staff_web'),
});

export const updateFileSchema = z.object({
  portal_visible: z.boolean().optional(),
  file_category: z.enum([...]).optional(),
  caption: z.string().max(500).optional(),
});

export const fileQuerySchema = z.object({
  folder_id: z.string().uuid().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createFolderSchema = z.object({
  customer_id: z.string().uuid(),
  folder_name: z.string().min(1).max(100),
  folder_type: z.literal('custom'),
  internal_only: z.boolean().default(false),
  portal_visible: z.boolean().default(false),
});
```

---

## Part E: API Endpoints

### `routes.ts`

```typescript
// Folders
router.get('/v1/customers/:customerId/folders', authenticate, tenantScope, ctrl.listFolders);
router.post('/v1/customers/:customerId/folders', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(createFolderSchema), ctrl.createFolder);

// Files
router.get('/v1/customers/:customerId/files', authenticate, tenantScope, ctrl.listFiles);
router.post('/v1/files/upload-url', authenticate, tenantScope, validate(uploadUrlSchema), ctrl.getUploadUrl);
router.post('/v1/files/confirm', authenticate, tenantScope, validate(confirmUploadSchema), ctrl.confirmUpload);
router.get('/v1/files/:id', authenticate, tenantScope, ctrl.getFile);
router.get('/v1/files/:id/download', authenticate, tenantScope, ctrl.getDownloadUrl);
router.patch('/v1/files/:id', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(updateFileSchema), ctrl.updateFile);
router.delete('/v1/files/:id', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.deleteFile);
```

---

## Security Rules (Non-Negotiable)

| Rule | Where Enforced |
|------|---------------|
| Internal folders NEVER in portal responses | Repository layer — `WHERE internal_only = FALSE` |
| Signed documents cannot be deleted | Service layer — throws 422 if `is_signed_document=TRUE` |
| R2 files behind signed URLs only | R2 client — no public bucket access |
| All downloads logged | Service layer — `logAccess()` on every download |
| Tenant isolation | Repository — `WHERE tenant_id = $1` on every query |
| File size limits | Service layer — 50MB staff, 10MB client |
| MIME type validation | Service layer — allowlist check |
| gate_code never in portal | Not this module (enforced in properties module) |

---

## Testing

```bash
npm run test -w api
```

Write tests for:
1. Standard folder creation on customer setup
2. Upload URL generation with size/MIME validation
3. Upload confirmation creates file record + access log
4. Download URL generation + access logging
5. Portal access filtering (internal_only hidden)
6. Signed document delete blocked (422)
7. Soft delete works for non-signed files
8. Tenant isolation (cannot access other tenant's files)

## Done When
- [ ] R2 client wrapper created
- [ ] File CRUD endpoints working
- [ ] Two-step upload flow working
- [ ] Signed download URLs with 1-hour expiry
- [ ] Internal folder filtering for portal
- [ ] Signed document delete protection
- [ ] Access logging on all operations
- [ ] All tests pass
- [ ] Committed to branch
