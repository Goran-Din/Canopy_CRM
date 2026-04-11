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
const mockFindUserRoles = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockUpdateLastLogin = vi.fn();

vi.mock('../../auth/repository.js', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  findUserById: vi.fn(),
  findUserRoles: (...args: unknown[]) => mockFindUserRoles(...args),
  saveRefreshToken: (...args: unknown[]) => mockSaveRefreshToken(...args),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
}));

// --- Mock signature repository ---
const mockFindBySigningToken = vi.fn();
const mockLockQuoteByToken = vi.fn();
const mockInsertSignature = vi.fn();
const mockFindByQuoteId = vi.fn();
const mockSigAcquireClient = vi.fn();

vi.mock('../repository.js', () => ({
  findBySigningToken: (...args: unknown[]) => mockFindBySigningToken(...args),
  lockQuoteByToken: (...args: unknown[]) => mockLockQuoteByToken(...args),
  insertSignature: (...args: unknown[]) => mockInsertSignature(...args),
  findByQuoteId: (...args: unknown[]) => mockFindByQuoteId(...args),
  acquireClient: (...args: unknown[]) => mockSigAcquireClient(...args),
}));

// --- Mock file repository ---
const mockInsertFile = vi.fn();

vi.mock('../../files/repository.js', () => ({
  insertFile: (...args: unknown[]) => mockInsertFile(...args),
  insertFileStandalone: vi.fn(),
  getFileById: vi.fn(),
  findFilesByCustomerId: vi.fn(),
  updateFile: vi.fn(),
  softDeleteFile: vi.fn(),
  logAccess: vi.fn(),
  createStandardFolders: vi.fn(),
  createFolder: vi.fn(),
  findFoldersByCustomerId: vi.fn(),
  findFolderById: vi.fn(),
  acquireClient: vi.fn(),
}));

// --- Mock diary repository ---
const mockDiaryInsert = vi.fn();

vi.mock('../../jobs/diary/diary.repository.js', () => ({
  insert: (...args: unknown[]) => mockDiaryInsert(...args),
  insertStandalone: vi.fn(),
  findByJobId: vi.fn(),
}));

// --- Mock R2 client ---
vi.mock('../../files/r2.client.js', () => ({
  getPresignedUploadUrl: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
  uploadBuffer: vi.fn().mockResolvedValue(undefined),
  deleteObject: vi.fn(),
}));

import app from '../../../app.js';

// --- Fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const QUOTE_ID = 'aaaa1111-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const VALID_TOKEN = 'a'.repeat(64);
const FILE_ID = 'ffffffff-0000-0000-0000-000000000001';

const SAMPLE_QUOTE_FOR_SIGNING = {
  id: QUOTE_ID,
  tenant_id: TENANT_A,
  job_id: JOB_ID,
  customer_id: CUSTOMER_ID,
  property_id: 'eeeeeeee-0000-0000-0000-000000000001',
  quote_number: 'Q-0001-26',
  version: 1,
  status: 'sent',
  subtotal: '350.00',
  discount_amount: '0.00',
  tax_rate: '0.13',
  tax_amount: '45.50',
  total_amount: '395.50',
  client_notes: 'Thank you for choosing us',
  payment_terms: 'Net 30',
  valid_until: '2026-12-31',
  signing_token: VALID_TOKEN,
  pdf_file_id: 'some-pdf-id',
  created_at: new Date().toISOString(),
  customer_name: 'John Smith',
  customer_email: 'john@example.com',
  street_address: '123 Main St',
  city: 'Toronto',
  state: 'ON',
  zip_code: 'M5V 1A1',
  sections: [],
};

const SAMPLE_SIGNATURE = {
  id: '99999999-0000-0000-0000-000000000001',
  tenant_id: TENANT_A,
  quote_id: QUOTE_ID,
  signer_name: 'John Smith',
  signature_file_id: FILE_ID,
  signed_at: new Date().toISOString(),
  signer_ip_address: '127.0.0.1',
  user_agent: 'Mozilla/5.0',
  signing_token_used: VALID_TOKEN,
  agreement_checked: true,
  created_at: new Date().toISOString(),
};

// Base64 PNG stub (enough to pass min length)
const FAKE_SIGNATURE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
  'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='.padEnd(200, 'A');

function createMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
}

let mockClient: ReturnType<typeof createMockClient>;

async function loginAs(role: string) {
  mockFindUserByEmail.mockResolvedValue({
    id: USER_ID,
    tenant_id: TENANT_A,
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
  mockSigAcquireClient.mockResolvedValue(mockClient);
});

// ============================================
// GET /v1/quotes/sign/:token — Public Signing Page
// ============================================
describe('GET /v1/quotes/sign/:token', () => {
  it('should return quote data for valid sent token', async () => {
    mockFindBySigningToken.mockResolvedValue(SAMPLE_QUOTE_FOR_SIGNING);

    const res = await request(app)
      .get(`/v1/quotes/sign/${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.quote_number).toBe('Q-0001-26');
    expect(res.body.data.customer_name).toBe('John Smith');
    expect(res.body.data.total_amount).toBe('395.50');
    expect(res.body.data.already_signed).toBe(false);
  });

  it('should show already-signed message for signed quote', async () => {
    mockFindBySigningToken.mockResolvedValue({
      ...SAMPLE_QUOTE_FOR_SIGNING,
      status: 'signed',
    });

    const res = await request(app)
      .get(`/v1/quotes/sign/${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.already_signed).toBe(true);
  });

  it('should return 401 for expired token', async () => {
    mockFindBySigningToken.mockResolvedValue({
      ...SAMPLE_QUOTE_FOR_SIGNING,
      status: 'expired',
    });

    const res = await request(app)
      .get(`/v1/quotes/sign/${VALID_TOKEN}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('expired');
  });

  it('should return 401 for superseded token', async () => {
    mockFindBySigningToken.mockResolvedValue({
      ...SAMPLE_QUOTE_FOR_SIGNING,
      status: 'superseded',
    });

    const res = await request(app)
      .get(`/v1/quotes/sign/${VALID_TOKEN}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('newer version');
  });

  it('should return 401 for invalid (not found) token', async () => {
    mockFindBySigningToken.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/quotes/sign/${VALID_TOKEN}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid or expired link');
  });

  it('should auto-expire and return 401 if valid_until passed', async () => {
    mockFindBySigningToken.mockResolvedValue({
      ...SAMPLE_QUOTE_FOR_SIGNING,
      valid_until: '2020-01-01',
      status: 'sent',
    });

    const res = await request(app)
      .get(`/v1/quotes/sign/${VALID_TOKEN}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('expired');
  });

  it('should reject malformed token (wrong length)', async () => {
    const res = await request(app)
      .get('/v1/quotes/sign/tooshort');

    expect(res.status).toBe(400);
  });
});

// ============================================
// POST /v1/quotes/sign — Signature Submission
// ============================================
describe('POST /v1/quotes/sign', () => {
  it('should process signature and return confirmation', async () => {
    mockLockQuoteByToken.mockResolvedValue(SAMPLE_QUOTE_FOR_SIGNING);
    mockInsertFile.mockResolvedValue({
      id: FILE_ID,
      tenant_id: TENANT_A,
      r2_key: 'test/sig.png',
    });
    mockInsertSignature.mockResolvedValue(SAMPLE_SIGNATURE);
    mockDiaryInsert.mockResolvedValue({});

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: VALID_TOKEN,
        signer_name: 'John Smith',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(res.body.data.signer_name).toBe('John Smith');
    expect(res.body.data.quote_number).toBe('Q-0001-26');
  });

  it('should create diary entry for quote_signed', async () => {
    mockLockQuoteByToken.mockResolvedValue(SAMPLE_QUOTE_FOR_SIGNING);
    mockInsertFile.mockResolvedValue({ id: FILE_ID });
    mockInsertSignature.mockResolvedValue(SAMPLE_SIGNATURE);
    mockDiaryInsert.mockResolvedValue({});

    await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: VALID_TOKEN,
        signer_name: 'John Smith',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        entry_type: 'quote_signed',
        title: 'Quote signed by John Smith',
      }),
    );
  });

  it('should update job status to unscheduled after signing', async () => {
    mockLockQuoteByToken.mockResolvedValue(SAMPLE_QUOTE_FOR_SIGNING);
    mockInsertFile.mockResolvedValue({ id: FILE_ID });
    mockInsertSignature.mockResolvedValue(SAMPLE_SIGNATURE);
    mockDiaryInsert.mockResolvedValue({});

    await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: VALID_TOKEN,
        signer_name: 'John Smith',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    // Verify job status updated to unscheduled
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'unscheduled'"),
      [JOB_ID],
    );
    // Verify quote status updated to signed
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'signed'"),
      [QUOTE_ID],
    );
  });

  it('should return 409 for duplicate submission (already signed)', async () => {
    mockLockQuoteByToken.mockResolvedValue({
      ...SAMPLE_QUOTE_FOR_SIGNING,
      status: 'signed',
    });

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: VALID_TOKEN,
        signer_name: 'John Smith',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Already signed');
  });

  it('should return 401 for expired quote', async () => {
    mockLockQuoteByToken.mockResolvedValue({
      ...SAMPLE_QUOTE_FOR_SIGNING,
      status: 'expired',
    });

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: VALID_TOKEN,
        signer_name: 'John Smith',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    expect(res.status).toBe(401);
  });

  it('should return 401 for invalid token', async () => {
    mockLockQuoteByToken.mockResolvedValue(null);

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: VALID_TOKEN,
        signer_name: 'John Smith',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    expect(res.status).toBe(401);
  });

  it('should reject if agreement not checked', async () => {
    const res = await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: VALID_TOKEN,
        signer_name: 'John Smith',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: false,
      });

    expect(res.status).toBe(400);
  });

  it('should reject short signer name', async () => {
    const res = await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: VALID_TOKEN,
        signer_name: 'J',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    expect(res.status).toBe(400);
  });
});

// ============================================
// Staff Endpoint — GET /v1/quotes/:id/signature
// ============================================
describe('GET /v1/quotes/:id/signature', () => {
  it('should return signature details for staff', async () => {
    const token = await loginAs('owner');
    mockFindByQuoteId.mockResolvedValue(SAMPLE_SIGNATURE);

    const res = await request(app)
      .get(`/v1/quotes/${QUOTE_ID}/signature`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.signer_name).toBe('John Smith');
    expect(res.body.data.agreement_checked).toBe(true);
  });

  it('should return 404 if no signature exists', async () => {
    const token = await loginAs('owner');
    mockFindByQuoteId.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/quotes/${QUOTE_ID}/signature`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should require authentication', async () => {
    const res = await request(app)
      .get(`/v1/quotes/${QUOTE_ID}/signature`);

    expect(res.status).toBe(401);
  });
});
