// ============================================
// Google Drive Integration Client — STUB
// ============================================

export async function uploadFile(_tenantId: string, _fileData: unknown): Promise<{ message: string }> {
  return { message: 'Google Drive upload stub — not yet implemented' };
}

export async function listFiles(_tenantId: string): Promise<{ message: string; data: unknown[] }> {
  return { message: 'Google Drive list-files stub — not yet implemented', data: [] };
}

export async function getFileUrl(_tenantId: string, _fileId: string): Promise<{ message: string }> {
  return { message: 'Google Drive get-file-url stub — not yet implemented' };
}
