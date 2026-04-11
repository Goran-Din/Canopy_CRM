import { AppError } from '../../middleware/errorHandler.js';
import * as repo from './repository.js';
import * as r2 from './r2.client.js';
import type {
  UploadUrlInput,
  ConfirmUploadInput,
  UpdateFileInput,
  FileQuery,
  CreateFolderInput,
} from './schema.js';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE_STAFF = 50_000_000;  // 50MB
const MAX_FILE_SIZE_CLIENT = 10_000_000; // 10MB

// === Folders ===

export async function listFolders(
  tenantId: string,
  customerId: string,
  includeInternal: boolean,
) {
  return repo.findFoldersByCustomerId(tenantId, customerId, includeInternal);
}

export async function createFolder(
  tenantId: string,
  input: CreateFolderInput,
  userId: string,
) {
  return repo.createFolder(tenantId, input, userId);
}

export async function createStandardFolders(
  tenantId: string,
  customerId: string,
  userId?: string,
) {
  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const folders = await repo.createStandardFolders(client, tenantId, customerId, userId);
    await client.query('COMMIT');
    return folders;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// === Upload Flow ===

/**
 * Step 1: Get presigned upload URL.
 * Validates MIME type and file size before generating URL.
 */
export async function getUploadUrl(
  tenantId: string,
  input: UploadUrlInput,
  userId: string,
  isClientUpload: boolean,
) {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(input.mime_type)) {
    throw new AppError(400, 'File type not allowed');
  }

  // Validate file size
  const maxSize = isClientUpload ? MAX_FILE_SIZE_CLIENT : MAX_FILE_SIZE_STAFF;
  if (input.file_size_bytes > maxSize) {
    throw new AppError(400, `File too large. Max ${maxSize / 1_000_000}MB`);
  }

  // Validate folder exists
  const folder = await repo.findFolderById(tenantId, input.folder_id);
  if (!folder) {
    throw new AppError(404, 'Folder not found');
  }

  // Generate R2 key
  const r2Key = `${tenantId}/clients/${input.customer_id}/${folder.folder_type}/${Date.now()}_${input.file_name}`;

  // Get presigned upload URL
  const uploadUrl = await r2.getPresignedUploadUrl(r2Key, input.mime_type);

  return { upload_url: uploadUrl, r2_key: r2Key };
}

/**
 * Step 2: Confirm upload completed — create file record + log access.
 */
export async function confirmUpload(
  tenantId: string,
  input: ConfirmUploadInput,
  userId: string,
) {
  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const file = await repo.insertFile(client, {
      tenant_id: tenantId,
      customer_id: input.customer_id,
      folder_id: input.folder_id,
      r2_key: input.r2_key,
      file_name: input.file_name,
      file_size_bytes: input.file_size_bytes,
      mime_type: input.mime_type,
      file_category: input.file_category,
      portal_visible: input.portal_visible,
      uploaded_by_user_id: userId,
      upload_source: input.upload_source,
    });

    await client.query('COMMIT');

    // Log access (outside transaction — non-critical)
    await repo.logAccess({
      tenant_id: tenantId,
      file_id: file.id,
      accessed_by_user_id: userId,
      access_type: 'upload',
    });

    return file;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// === File Operations ===

export async function getFile(tenantId: string, fileId: string) {
  const file = await repo.getFileById(tenantId, fileId);
  if (!file) {
    throw new AppError(404, 'File not found');
  }
  return file;
}

export async function listFiles(
  tenantId: string,
  customerId: string,
  query: FileQuery,
  portalOnly: boolean,
) {
  const { rows, total } = await repo.findFilesByCustomerId(
    tenantId,
    customerId,
    { ...query, portalOnly },
  );

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

/**
 * Get signed download URL (logs access).
 */
export async function getDownloadUrl(
  tenantId: string,
  fileId: string,
  userId: string,
  userRole: string,
  clientIp: string,
) {
  const file = await repo.getFileById(tenantId, fileId);
  if (!file) {
    throw new AppError(404, 'File not found');
  }

  // Portal access check
  if (userRole === 'client') {
    if (!file.portal_visible) {
      throw new AppError(403, 'File not accessible in portal');
    }
  }

  // Generate signed URL
  const signedUrl = await r2.getPresignedDownloadUrl(file.r2_key);
  const expiresAt = new Date(Date.now() + 3600_000);

  // Log access
  await repo.logAccess({
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

export async function updateFile(
  tenantId: string,
  fileId: string,
  input: UpdateFileInput,
) {
  const file = await repo.getFileById(tenantId, fileId);
  if (!file) {
    throw new AppError(404, 'File not found');
  }

  const updated = await repo.updateFile(tenantId, fileId, input);
  if (!updated) {
    throw new AppError(500, 'Failed to update file');
  }
  return updated;
}

/**
 * Delete file (blocks signed documents with 422).
 */
export async function deleteFile(
  tenantId: string,
  fileId: string,
  userId: string,
) {
  const file = await repo.getFileById(tenantId, fileId);
  if (!file) {
    throw new AppError(404, 'File not found');
  }

  if (file.is_signed_document) {
    throw new AppError(422, 'Signed documents cannot be deleted');
  }

  const deleted = await repo.softDeleteFile(tenantId, fileId);
  if (!deleted) {
    throw new AppError(500, 'Failed to delete file');
  }

  // Log access
  await repo.logAccess({
    tenant_id: tenantId,
    file_id: fileId,
    accessed_by_user_id: userId,
    access_type: 'delete',
  });

  return deleted;
}
