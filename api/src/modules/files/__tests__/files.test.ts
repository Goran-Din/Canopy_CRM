import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// --- Mock database ---
vi.mock('../../../config/database.js', () => ({
  queryDb: vi.fn(),
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }), on: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  getClient: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }),
}));

// --- Mock redis ---
vi.mock('../../../config/redis.js', () => ({
  redis: {
    isOpen: true,
    ping: vi.fn().mockResolvedValue('PONG'),
    connect: vi.fn(),
    on: vi.fn(),
  },
  connectRedis: vi.fn(),
}));

// --- Mock auth repository ---
const mockFindUserByEmail = vi.fn();
const mockFindUserById = vi.fn();
const mockFindUserRoles = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockFindRefreshToken = vi.fn();
const mockRevokeRefreshToken = vi.fn();
const mockRevokeAllUserRefreshTokens = vi.fn();
const mockUpdateLastLogin = vi.fn();

vi.mock('../../auth/repository.js', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  findUserRoles: (...args: unknown[]) => mockFindUserRoles(...args),
  saveRefreshToken: (...args: unknown[]) => mockSaveRefreshToken(...args),
  findRefreshToken: (...args: unknown[]) => mockFindRefreshToken(...args),
  revokeRefreshToken: (...args: unknown[]) => mockRevokeRefreshToken(...args),
  revokeAllUserRefreshTokens: (...args: unknown[]) => mockRevokeAllUserRefreshTokens(...args),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
}));

// --- Mock file repository ---
const mockCreateStandardFolders = vi.fn();
const mockCreateFolder = vi.fn();
const mockFindFoldersByCustomerId = vi.fn();
const mockFindFolderById = vi.fn();
const mockInsertFile = vi.fn();
const mockInsertFileStandalone = vi.fn();
const mockGetFileById = vi.fn();
const mockFindFilesByCustomerId = vi.fn();
const mockUpdateFile = vi.fn();
const mockSoftDeleteFile = vi.fn();
const mockLogAccess = vi.fn();
const mockAcquireClient = vi.fn();

vi.mock('../repository.js', () => ({
  createStandardFolders: (...args: unknown[]) => mockCreateStandardFolders(...args),
  createFolder: (...args: unknown[]) => mockCreateFolder(...args),
  findFoldersByCustomerId: (...args: unknown[]) => mockFindFoldersByCustomerId(...args),
  findFolderById: (...args: unknown[]) => mockFindFolderById(...args),
  insertFile: (...args: unknown[]) => mockInsertFile(...args),
  insertFileStandalone: (...args: unknown[]) => mockInsertFileStandalone(...args),
  getFileById: (...args: unknown[]) => mockGetFileById(...args),
  findFilesByCustomerId: (...args: unknown[]) => mockFindFilesByCustomerId(...args),
  updateFile: (...args: unknown[]) => mockUpdateFile(...args),
  softDeleteFile: (...args: unknown[]) => mockSoftDeleteFile(...args),
  logAccess: (...args: unknown[]) => mockLogAccess(...args),
  acquireClient: (...args: unknown[]) => mockAcquireClient(...args),
}));

// --- Mock R2 client ---
const mockGetPresignedUploadUrl = vi.fn();
const mockGetPresignedDownloadUrl = vi.fn();

vi.mock('../r2.client.js', () => ({
  getPresignedUploadUrl: (...args: unknown[]) => mockGetPresignedUploadUrl(...args),
  getPresignedDownloadUrl: (...args: unknown[]) => mockGetPresignedDownloadUrl(...args),
  uploadBuffer: vi.fn(),
  deleteObject: vi.fn(),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const FOLDER_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const FILE_ID = 'ffffffff-0000-0000-0000-000000000001';

const SAMPLE_FOLDER = {
  id: FOLDER_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  folder_name: 'Quotes & Proposals',
  folder_type: 'quotes',
  description: null,
  sort_order: 1,
  portal_visible: true,
  internal_only: false,
  created_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const INTERNAL_FOLDER = {
  ...SAMPLE_FOLDER,
  id: '11111111-0000-0000-0000-000000000001',
  folder_name: 'Internal',
  folder_type: 'internal',
  internal_only: true,
  portal_visible: false,
};

const SAMPLE_FILE = {
  id: FILE_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  folder_id: FOLDER_ID,
  job_id: null,
  property_id: null,
  r2_key: `${TENANT_A}/clients/${CUSTOMER_ID}/quotes/1712345678_proposal.pdf`,
  r2_bucket: 'canopy-crm',
  file_name: 'proposal.pdf',
  file_size_bytes: 1024000,
  mime_type: 'application/pdf',
  file_category: 'quote_pdf',
  photo_tag: null,
  portal_visible: true,
  is_signed_document: false,
  related_quote_id: null,
  version: 1,
  superseded_by: null,
  uploaded_by: USER_ID,
  uploaded_by_client: false,
  upload_source: 'staff_web',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SIGNED_FILE = {
  ...SAMPLE_FILE,
  id: '22222222-0000-0000-0000-000000000001',
  is_signed_document: true,
  file_name: 'signed_contract.pdf',
  file_category: 'contract_pdf',
};

function createMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
}

let mockClient: ReturnType<typeof createMockClient>;

async function loginAs(role: string, tenantId: string = TENANT_A) {
  mockFindUserByEmail.mockResolvedValue({
    id: USER_ID,
    tenant_id: tenantId,
    email: 'test@test.com',
    password_hash: TEST_HASH,
    first_name: 'Test',
    last_name: 'User',
    is_active: true,
  });
  mockFindUserRoles.mockResolvedValue([
    { role_name: role, division_id: null, division_name: null },
  ]);
  mockSaveRefreshToken.mockResolvedValue(undefined);
  mockUpdateLastLogin.mockResolvedValue(undefined);

  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'test@test.com', password: TEST_PASSWORD });

  return res.body.data.accessToken as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  TEST_HASH = await bcrypt.hash(TEST_PASSWORD, 4);
  mockClient = createMockClient();
  mockAcquireClient.mockResolvedValue(mockClient);
  mockLogAccess.mockResolvedValue(undefined);
});

// ============================================
// Folders
// ============================================
describe('GET /v1/customers/:customerId/folders', () => {
  it('should list folders for staff (includes internal)', async () => {
    const token = await loginAs('owner');
    mockFindFoldersByCustomerId.mockResolvedValue([SAMPLE_FOLDER, INTERNAL_FOLDER]);

    const res = await request(app)
      .get(`/v1/customers/${CUSTOMER_ID}/folders`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(mockFindFoldersByCustomerId).toHaveBeenCalledWith(TENANT_A, CUSTOMER_ID, true);
  });

  it('should hide internal folders for client role', async () => {
    const token = await loginAs('client');
    mockFindFoldersByCustomerId.mockResolvedValue([SAMPLE_FOLDER]);

    const res = await request(app)
      .get(`/v1/customers/${CUSTOMER_ID}/folders`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindFoldersByCustomerId).toHaveBeenCalledWith(TENANT_A, CUSTOMER_ID, false);
  });
});

describe('POST /v1/customers/:customerId/folders', () => {
  it('should create custom folder', async () => {
    const token = await loginAs('coordinator');
    mockCreateFolder.mockResolvedValue({
      ...SAMPLE_FOLDER,
      folder_name: 'My Custom Folder',
      folder_type: 'custom',
    });

    const res = await request(app)
      .post(`/v1/customers/${CUSTOMER_ID}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        folder_name: 'My Custom Folder',
        folder_type: 'custom',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.folder_name).toBe('My Custom Folder');
  });

  it('should deny crew_member from creating folders', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .post(`/v1/customers/${CUSTOMER_ID}/folders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        folder_name: 'Test',
        folder_type: 'custom',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// Upload Flow
// ============================================
describe('POST /v1/files/upload-url', () => {
  it('should return presigned upload URL', async () => {
    const token = await loginAs('coordinator');
    mockFindFolderById.mockResolvedValue(SAMPLE_FOLDER);
    mockGetPresignedUploadUrl.mockResolvedValue('https://r2.example.com/upload?signed=1');

    const res = await request(app)
      .post('/v1/files/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        folder_id: FOLDER_ID,
        file_name: 'proposal.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 1024000,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.upload_url).toContain('https://r2.example.com');
    expect(res.body.data.r2_key).toContain(TENANT_A);
    expect(res.body.data.r2_key).toContain('proposal.pdf');
  });

  it('should reject disallowed MIME type', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/files/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        folder_id: FOLDER_ID,
        file_name: 'malware.exe',
        mime_type: 'application/x-msdownload',
        file_size_bytes: 1000,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('File type not allowed');
  });

  it('should reject oversized file for staff (50MB limit)', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/files/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        folder_id: FOLDER_ID,
        file_name: 'huge.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 60_000_000,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('File too large');
  });

  it('should enforce 10MB limit for client uploads', async () => {
    const token = await loginAs('client');

    const res = await request(app)
      .post('/v1/files/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        folder_id: FOLDER_ID,
        file_name: 'large_photo.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 15_000_000,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('File too large. Max 10MB');
  });
});

describe('POST /v1/files/confirm', () => {
  it('should create file record and log access', async () => {
    const token = await loginAs('owner');
    mockInsertFile.mockResolvedValue(SAMPLE_FILE);

    const res = await request(app)
      .post('/v1/files/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        r2_key: SAMPLE_FILE.r2_key,
        customer_id: CUSTOMER_ID,
        folder_id: FOLDER_ID,
        file_name: 'proposal.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 1024000,
        file_category: 'quote_pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.file_name).toBe('proposal.pdf');
    expect(mockInsertFile).toHaveBeenCalled();
    expect(mockLogAccess).toHaveBeenCalledWith(
      expect.objectContaining({ access_type: 'upload' }),
    );
  });
});

// ============================================
// File Operations
// ============================================
describe('GET /v1/files/:id', () => {
  it('should return file metadata', async () => {
    const token = await loginAs('owner');
    mockGetFileById.mockResolvedValue(SAMPLE_FILE);

    const res = await request(app)
      .get(`/v1/files/${FILE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.file_name).toBe('proposal.pdf');
  });

  it('should return 404 for missing file', async () => {
    const token = await loginAs('owner');
    mockGetFileById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/files/${FILE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /v1/files/:id/download', () => {
  it('should return signed download URL and log access', async () => {
    const token = await loginAs('coordinator');
    mockGetFileById.mockResolvedValue(SAMPLE_FILE);
    mockGetPresignedDownloadUrl.mockResolvedValue('https://r2.example.com/download?signed=1');

    const res = await request(app)
      .get(`/v1/files/${FILE_ID}/download`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.download_url).toContain('https://r2.example.com');
    expect(res.body.data.expires_at).toBeDefined();
    expect(mockLogAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: 'download',
        accessed_by_user_id: USER_ID,
      }),
    );
  });

  it('should block client from downloading non-portal file', async () => {
    const token = await loginAs('client');
    mockGetFileById.mockResolvedValue({ ...SAMPLE_FILE, portal_visible: false });

    const res = await request(app)
      .get(`/v1/files/${FILE_ID}/download`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('not accessible in portal');
  });
});

describe('GET /v1/customers/:customerId/files', () => {
  it('should list files with pagination', async () => {
    const token = await loginAs('owner');
    mockFindFilesByCustomerId.mockResolvedValue({ rows: [SAMPLE_FILE], total: 1 });

    const res = await request(app)
      .get(`/v1/customers/${CUSTOMER_ID}/files`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should filter portal-only for client role', async () => {
    const token = await loginAs('client');
    mockFindFilesByCustomerId.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/customers/${CUSTOMER_ID}/files`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindFilesByCustomerId).toHaveBeenCalledWith(
      TENANT_A,
      CUSTOMER_ID,
      expect.objectContaining({ portalOnly: true }),
    );
  });

  it('should not filter portal for staff', async () => {
    const token = await loginAs('coordinator');
    mockFindFilesByCustomerId.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/customers/${CUSTOMER_ID}/files`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindFilesByCustomerId).toHaveBeenCalledWith(
      TENANT_A,
      CUSTOMER_ID,
      expect.objectContaining({ portalOnly: false }),
    );
  });
});

// ============================================
// Delete Protection
// ============================================
describe('DELETE /v1/files/:id', () => {
  it('should soft-delete non-signed file', async () => {
    const token = await loginAs('owner');
    mockGetFileById.mockResolvedValue(SAMPLE_FILE);
    mockSoftDeleteFile.mockResolvedValue(SAMPLE_FILE);

    const res = await request(app)
      .delete(`/v1/files/${FILE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('File deleted');
    expect(mockLogAccess).toHaveBeenCalledWith(
      expect.objectContaining({ access_type: 'delete' }),
    );
  });

  it('should block deletion of signed document (422)', async () => {
    const token = await loginAs('owner');
    mockGetFileById.mockResolvedValue(SIGNED_FILE);

    const res = await request(app)
      .delete(`/v1/files/${SIGNED_FILE.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Signed documents cannot be deleted');
  });

  it('should deny crew_member from deleting files', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .delete(`/v1/files/${FILE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Update File
// ============================================
describe('PATCH /v1/files/:id', () => {
  it('should update portal_visible', async () => {
    const token = await loginAs('coordinator');
    mockGetFileById.mockResolvedValue(SAMPLE_FILE);
    mockUpdateFile.mockResolvedValue({ ...SAMPLE_FILE, portal_visible: false });

    const res = await request(app)
      .patch(`/v1/files/${FILE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ portal_visible: false });

    expect(res.status).toBe(200);
    expect(res.body.data.portal_visible).toBe(false);
  });

  it('should deny crew_leader from updating files', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .patch(`/v1/files/${FILE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ portal_visible: true });

    expect(res.status).toBe(403);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant isolation', () => {
  it('should scope file queries to authenticated tenant', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockGetFileById.mockResolvedValue(SAMPLE_FILE);

    await request(app)
      .get(`/v1/files/${FILE_ID}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mockGetFileById).toHaveBeenCalledWith(TENANT_A, FILE_ID);
  });

  it('should scope folder queries to authenticated tenant', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockFindFoldersByCustomerId.mockResolvedValue([]);

    await request(app)
      .get(`/v1/customers/${CUSTOMER_ID}/folders`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mockFindFoldersByCustomerId).toHaveBeenCalledWith(TENANT_B, CUSTOMER_ID, true);
  });
});

// ============================================
// Auth
// ============================================
describe('Authentication', () => {
  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get(`/v1/files/${FILE_ID}`);
    expect(res.status).toBe(401);
  });
});
