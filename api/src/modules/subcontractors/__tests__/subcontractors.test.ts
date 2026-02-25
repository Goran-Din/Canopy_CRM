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

// --- Mock subcontractors repository ---
const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  create: (...args: unknown[]) => mockCreate(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  softDelete: (...args: unknown[]) => mockSoftDelete(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const SUB_ID = '11111111-0000-0000-0000-000000000001';

const SAMPLE_SUBCONTRACTOR = {
  id: SUB_ID,
  tenant_id: TENANT_A,
  company_name: 'Pro Excavation Ltd',
  contact_name: 'Mike Johnson',
  email: 'mike@proexcavation.com',
  phone: '555-0200',
  mobile: '555-0201',
  specialty: ['excavation', 'grading'],
  status: 'active',
  insurance_expiry: '2027-01-15',
  license_number: 'EXC-2024-001',
  rate_type: 'hourly',
  default_rate: 150.00,
  rating: 4,
  notes: 'Reliable, always on time',
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
// GET /v1/subcontractors — List
// ============================================
describe('GET /v1/subcontractors', () => {
  it('should return paginated subcontractor list', async () => {
    const token = await loginAs('owner');
    mockFindAll.mockResolvedValue({ rows: [SAMPLE_SUBCONTRACTOR], total: 1 });

    const res = await request(app)
      .get('/v1/subcontractors')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should filter by status', async () => {
    const token = await loginAs('div_mgr');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/subcontractors?status=active')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ status: 'active' }));
  });

  it('should filter by specialty', async () => {
    const token = await loginAs('coordinator');
    mockFindAll.mockResolvedValue({ rows: [SAMPLE_SUBCONTRACTOR], total: 1 });

    const res = await request(app)
      .get('/v1/subcontractors?specialty=excavation')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ specialty: 'excavation' }));
  });

  it('should reject crew_leader role', async () => {
    const token = await loginAs('crew_leader');
    const res = await request(app)
      .get('/v1/subcontractors')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/subcontractors/:id — Get
// ============================================
describe('GET /v1/subcontractors/:id', () => {
  it('should return subcontractor by id', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_SUBCONTRACTOR);

    const res = await request(app)
      .get(`/v1/subcontractors/${SUB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.company_name).toBe('Pro Excavation Ltd');
  });

  it('should return 404 for non-existent subcontractor', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/subcontractors/${SUB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/subcontractors — Create
// ============================================
describe('POST /v1/subcontractors', () => {
  it('should create a new subcontractor', async () => {
    const token = await loginAs('owner');
    mockCreate.mockResolvedValue(SAMPLE_SUBCONTRACTOR);

    const res = await request(app)
      .post('/v1/subcontractors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company_name: 'Pro Excavation Ltd',
        contact_name: 'Mike Johnson',
        email: 'mike@proexcavation.com',
        specialty: ['excavation', 'grading'],
        rate_type: 'hourly',
        default_rate: 150.00,
        rating: 4,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.company_name).toBe('Pro Excavation Ltd');
  });

  it('should require company_name', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/subcontractors')
      .set('Authorization', `Bearer ${token}`)
      .send({ contact_name: 'Mike' });

    expect(res.status).toBe(400);
  });

  it('should reject coordinator from creating', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/subcontractors')
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: 'Test Sub' });

    expect(res.status).toBe(403);
  });

  it('should validate rating range (1-5)', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/subcontractors')
      .set('Authorization', `Bearer ${token}`)
      .send({ company_name: 'Test', rating: 6 });

    expect(res.status).toBe(400);
  });
});

// ============================================
// PUT /v1/subcontractors/:id — Update
// ============================================
describe('PUT /v1/subcontractors/:id', () => {
  it('should update a subcontractor', async () => {
    const token = await loginAs('div_mgr');
    mockFindById.mockResolvedValue(SAMPLE_SUBCONTRACTOR);
    const updated = { ...SAMPLE_SUBCONTRACTOR, rating: 5 };
    mockUpdate.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/subcontractors/${SUB_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(5);
  });

  it('should update status to inactive', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_SUBCONTRACTOR);
    const updated = { ...SAMPLE_SUBCONTRACTOR, status: 'inactive' };
    mockUpdate.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/subcontractors/${SUB_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
  });

  it('should return 404 for non-existent subcontractor', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/subcontractors/${SUB_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5 });

    expect(res.status).toBe(404);
  });
});

// ============================================
// DELETE /v1/subcontractors/:id — Delete
// ============================================
describe('DELETE /v1/subcontractors/:id', () => {
  it('should soft delete a subcontractor', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_SUBCONTRACTOR);
    mockSoftDelete.mockResolvedValue({ ...SAMPLE_SUBCONTRACTOR, deleted_at: new Date().toISOString() });

    const res = await request(app)
      .delete(`/v1/subcontractors/${SUB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });

  it('should reject non-owner delete', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .delete(`/v1/subcontractors/${SUB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
