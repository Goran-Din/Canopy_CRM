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

// --- Mock prospects repository ---
const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateStatus = vi.fn();
const mockSoftDelete = vi.fn();
const mockCreateCustomerFromProspect = vi.fn();
const mockGetPipelineStats = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  create: (...args: unknown[]) => mockCreate(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  softDelete: (...args: unknown[]) => mockSoftDelete(...args),
  createCustomerFromProspect: (...args: unknown[]) => mockCreateCustomerFromProspect(...args),
  getPipelineStats: (...args: unknown[]) => mockGetPipelineStats(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const PROSPECT_ID = '11111111-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';

const SAMPLE_PROSPECT = {
  id: PROSPECT_ID,
  tenant_id: TENANT_A,
  company_name: 'Acme Corp',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@acme.com',
  phone: '555-0100',
  mobile: null,
  source: 'referral',
  status: 'new',
  assigned_to: USER_ID,
  estimated_value: 5000,
  interest_services: ['landscaping', 'snow_removal'],
  address_line1: '123 Main St',
  city: 'Toronto',
  state: 'ON',
  zip: 'M5V 2T6',
  notes: 'Interested in spring cleanup',
  next_follow_up_date: '2026-04-01',
  last_contacted_at: null,
  lost_reason: null,
  converted_customer_id: null,
  mautic_contact_id: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

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
});

// ============================================
// GET /v1/prospects — List
// ============================================
describe('GET /v1/prospects', () => {
  it('should return paginated prospect list', async () => {
    const token = await loginAs('owner');
    mockFindAll.mockResolvedValue({ rows: [SAMPLE_PROSPECT], total: 1 });

    const res = await request(app)
      .get('/v1/prospects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should filter by status', async () => {
    const token = await loginAs('div_mgr');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/prospects?status=qualified')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ status: 'qualified' }));
  });

  it('should reject crew_member role', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get('/v1/prospects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/prospects/:id — Get
// ============================================
describe('GET /v1/prospects/:id', () => {
  it('should return a prospect by id', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_PROSPECT);

    const res = await request(app)
      .get(`/v1/prospects/${PROSPECT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('John');
  });

  it('should return 404 for non-existent prospect', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/prospects/${PROSPECT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/prospects — Create
// ============================================
describe('POST /v1/prospects', () => {
  it('should create a new prospect', async () => {
    const token = await loginAs('coordinator');
    mockCreate.mockResolvedValue(SAMPLE_PROSPECT);

    const res = await request(app)
      .post('/v1/prospects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        first_name: 'John',
        last_name: 'Doe',
        company_name: 'Acme Corp',
        email: 'john@acme.com',
        source: 'referral',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.company_name).toBe('Acme Corp');
  });

  it('should reject invalid email', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/prospects')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });
});

// ============================================
// PUT /v1/prospects/:id — Update
// ============================================
describe('PUT /v1/prospects/:id', () => {
  it('should update a prospect', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_PROSPECT);
    const updated = { ...SAMPLE_PROSPECT, company_name: 'Acme Inc' };
    mockUpdate.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/prospects/${PROSPECT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: 'Acme Inc' });

    expect(res.status).toBe(200);
    expect(res.body.data.company_name).toBe('Acme Inc');
  });

  it('should return 404 for non-existent prospect', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/prospects/${PROSPECT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: 'X' });

    expect(res.status).toBe(404);
  });
});

// ============================================
// PATCH /v1/prospects/:id/status — Change Status
// ============================================
describe('PATCH /v1/prospects/:id/status', () => {
  it('should update status', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_PROSPECT);
    const updated = { ...SAMPLE_PROSPECT, status: 'contacted' };
    mockUpdateStatus.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`/v1/prospects/${PROSPECT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'contacted' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('contacted');
  });

  it('should require lost_reason when setting to lost', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_PROSPECT);

    const res = await request(app)
      .patch(`/v1/prospects/${PROSPECT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'lost' });

    expect(res.status).toBe(400);
  });

  it('should accept lost with lost_reason', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_PROSPECT);
    const updated = { ...SAMPLE_PROSPECT, status: 'lost', lost_reason: 'Chose competitor' };
    mockUpdateStatus.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`/v1/prospects/${PROSPECT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'lost', lost_reason: 'Chose competitor' });

    expect(res.status).toBe(200);
    expect(res.body.data.lost_reason).toBe('Chose competitor');
  });

  it('should convert to customer when won', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_PROSPECT);
    mockCreateCustomerFromProspect.mockResolvedValue(CUSTOMER_ID);
    const updated = { ...SAMPLE_PROSPECT, status: 'won', converted_customer_id: CUSTOMER_ID };
    mockUpdateStatus.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`/v1/prospects/${PROSPECT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'won' });

    expect(res.status).toBe(200);
    expect(mockCreateCustomerFromProspect).toHaveBeenCalled();
    expect(res.body.data.converted_customer_id).toBe(CUSTOMER_ID);
  });

  it('should not re-convert if already converted', async () => {
    const token = await loginAs('owner');
    const alreadyConverted = { ...SAMPLE_PROSPECT, converted_customer_id: CUSTOMER_ID };
    mockFindById.mockResolvedValue(alreadyConverted);
    mockUpdateStatus.mockResolvedValue({ ...alreadyConverted, status: 'won' });

    const res = await request(app)
      .patch(`/v1/prospects/${PROSPECT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'won' });

    expect(res.status).toBe(200);
    expect(mockCreateCustomerFromProspect).not.toHaveBeenCalled();
  });
});

// ============================================
// DELETE /v1/prospects/:id — Delete
// ============================================
describe('DELETE /v1/prospects/:id', () => {
  it('should soft delete a prospect', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_PROSPECT);
    mockSoftDelete.mockResolvedValue({ ...SAMPLE_PROSPECT, deleted_at: new Date().toISOString() });

    const res = await request(app)
      .delete(`/v1/prospects/${PROSPECT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });

  it('should reject non-owner delete', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .delete(`/v1/prospects/${PROSPECT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/prospects/pipeline — Pipeline Stats
// ============================================
describe('GET /v1/prospects/pipeline', () => {
  it('should return pipeline stats', async () => {
    const token = await loginAs('owner');
    const stats = [
      { status: 'new', count: '5', total_value: '25000' },
      { status: 'qualified', count: '3', total_value: '45000' },
    ];
    mockGetPipelineStats.mockResolvedValue(stats);

    const res = await request(app)
      .get('/v1/prospects/pipeline')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should reject coordinator from pipeline stats', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/prospects/pipeline')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
