import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// --- Mock database ---
vi.mock('../../../config/database.js', () => ({
  queryDb: vi.fn(),
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }), on: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  getClient: vi.fn(),
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

// --- Mock customer repository ---
const mockCustomerFindAll = vi.fn();
const mockCustomerFindById = vi.fn();
const mockCustomerCreate = vi.fn();
const mockCustomerUpdate = vi.fn();
const mockCustomerSoftDelete = vi.fn();
const mockCustomerFindByEmail = vi.fn();
const mockCustomerGetStats = vi.fn();
const mockCustomerHasActiveContracts = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockCustomerFindAll(...args),
  findById: (...args: unknown[]) => mockCustomerFindById(...args),
  create: (...args: unknown[]) => mockCustomerCreate(...args),
  update: (...args: unknown[]) => mockCustomerUpdate(...args),
  softDelete: (...args: unknown[]) => mockCustomerSoftDelete(...args),
  findByEmail: (...args: unknown[]) => mockCustomerFindByEmail(...args),
  getStats: (...args: unknown[]) => mockCustomerGetStats(...args),
  hasActiveContracts: (...args: unknown[]) => mockCustomerHasActiveContracts(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';

const SAMPLE_CUSTOMER = {
  id: CUSTOMER_ID,
  tenant_id: TENANT_A,
  customer_type: 'residential',
  status: 'active',
  source: 'manual',
  company_name: null,
  first_name: 'John',
  last_name: 'Doe',
  display_name: 'John Doe',
  email: 'john@example.com',
  phone: '555-1234',
  mobile: null,
  billing_address_line1: '123 Main St',
  billing_address_line2: null,
  billing_city: 'Toronto',
  billing_state: 'ON',
  billing_zip: 'M5V 1A1',
  billing_country: 'US',
  notes: null,
  tags: [],
  referred_by_customer_id: null,
  xero_contact_id: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  property_count: 0,
};

// Helper to login and get access token for a specific role and tenant
async function loginAs(
  role: string,
  tenantId: string = TENANT_A,
  divisionName: string | null = null,
) {
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
    {
      role_name: role,
      division_id: divisionName ? 'div-id' : null,
      division_name: divisionName,
    },
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
// GET /v1/customers — List
// ============================================
describe('GET /v1/customers', () => {
  it('should return paginated customer list', async () => {
    const token = await loginAs('owner');
    mockCustomerFindAll.mockResolvedValue({
      rows: [SAMPLE_CUSTOMER],
      total: 1,
    });

    const res = await request(app)
      .get('/v1/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(25);
  });

  it('should pass search and filter params to repository', async () => {
    const token = await loginAs('coordinator');
    mockCustomerFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/customers?search=john&status=active&type=residential&page=2&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(mockCustomerFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        search: 'john',
        status: 'active',
        type: 'residential',
        page: 2,
        limit: 10,
      }),
    );
  });

  it('should deny crew_member access', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/customers/:id — Detail
// ============================================
describe('GET /v1/customers/:id', () => {
  it('should return single customer with property count', async () => {
    const token = await loginAs('owner');
    mockCustomerFindById.mockResolvedValue(SAMPLE_CUSTOMER);

    const res = await request(app)
      .get(`/v1/customers/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(CUSTOMER_ID);
    expect(res.body.data.property_count).toBe(0);
  });

  it('should return 404 for non-existent customer', async () => {
    const token = await loginAs('owner');
    mockCustomerFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/customers/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid UUID', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/customers/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// POST /v1/customers — Create
// ============================================
describe('POST /v1/customers', () => {
  it('should create a residential customer', async () => {
    const token = await loginAs('owner');
    mockCustomerFindByEmail.mockResolvedValue(null);
    mockCustomerCreate.mockResolvedValue(SAMPLE_CUSTOMER);

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        billing_address_line1: '123 Main St',
        billing_city: 'Toronto',
        billing_state: 'ON',
        billing_zip: 'M5V 1A1',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.first_name).toBe('John');
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        first_name: 'John',
        display_name: 'John Doe',
      }),
      USER_ID,
    );
  });

  it('should create a commercial customer with company name', async () => {
    const token = await loginAs('coordinator');
    mockCustomerFindByEmail.mockResolvedValue(null);
    mockCustomerCreate.mockResolvedValue({
      ...SAMPLE_CUSTOMER,
      customer_type: 'commercial',
      company_name: 'Acme Corp',
      display_name: 'Acme Corp',
    });

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_type: 'commercial',
        company_name: 'Acme Corp',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@acme.com',
      });

    expect(res.status).toBe(201);
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ display_name: 'Acme Corp' }),
      USER_ID,
    );
  });

  it('should reject commercial customer without company name', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_type: 'commercial',
        first_name: 'Jane',
        last_name: 'Smith',
      });

    expect(res.status).toBe(400);
  });

  it('should block duplicate email within same tenant', async () => {
    const token = await loginAs('owner');
    mockCustomerFindByEmail.mockResolvedValue(SAMPLE_CUSTOMER);

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        first_name: 'Another',
        last_name: 'Person',
        email: 'john@example.com',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('A customer with this email already exists');
  });

  it('should deny crew_member from creating', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Test', last_name: 'User' });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/customers/:id — Update
// ============================================
describe('PUT /v1/customers/:id', () => {
  it('should update customer fields', async () => {
    const token = await loginAs('owner');
    mockCustomerFindById.mockResolvedValue(SAMPLE_CUSTOMER);
    mockCustomerFindByEmail.mockResolvedValue(null);
    mockCustomerUpdate.mockResolvedValue({
      ...SAMPLE_CUSTOMER,
      first_name: 'Johnny',
      display_name: 'Johnny Doe',
    });

    const res = await request(app)
      .put(`/v1/customers/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Johnny' });

    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('Johnny');
  });

  it('should return 404 for non-existent customer', async () => {
    const token = await loginAs('owner');
    mockCustomerFindById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/customers/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Test' });

    expect(res.status).toBe(404);
  });

  it('should block duplicate email on update', async () => {
    const token = await loginAs('owner');
    mockCustomerFindById.mockResolvedValue(SAMPLE_CUSTOMER);
    mockCustomerFindByEmail.mockResolvedValue({
      ...SAMPLE_CUSTOMER,
      id: 'eeeeeeee-0000-0000-0000-000000000099',
    });

    const res = await request(app)
      .put(`/v1/customers/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
  });

  it('should return 409 on optimistic concurrency conflict', async () => {
    const token = await loginAs('owner');
    mockCustomerFindById.mockResolvedValue(SAMPLE_CUSTOMER);
    mockCustomerFindByEmail.mockResolvedValue(null);
    mockCustomerUpdate.mockResolvedValue(null); // no rows updated = conflict

    const res = await request(app)
      .put(`/v1/customers/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        first_name: 'Updated',
        updated_at: '2020-01-01T00:00:00.000Z', // stale timestamp
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('modified by another user');
  });
});

// ============================================
// DELETE /v1/customers/:id — Soft Delete
// ============================================
describe('DELETE /v1/customers/:id', () => {
  it('should soft delete customer (owner only)', async () => {
    const token = await loginAs('owner');
    mockCustomerFindById.mockResolvedValue(SAMPLE_CUSTOMER);
    mockCustomerHasActiveContracts.mockResolvedValue(false);
    mockCustomerSoftDelete.mockResolvedValue(SAMPLE_CUSTOMER);

    const res = await request(app)
      .delete(`/v1/customers/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Customer deleted');
  });

  it('should block deletion when active contracts exist', async () => {
    const token = await loginAs('owner');
    mockCustomerFindById.mockResolvedValue(SAMPLE_CUSTOMER);
    mockCustomerHasActiveContracts.mockResolvedValue(true);

    const res = await request(app)
      .delete(`/v1/customers/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Cannot delete customer with active contracts');
  });

  it('should deny coordinator from deleting', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .delete(`/v1/customers/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/customers/stats — Stats
// ============================================
describe('GET /v1/customers/stats', () => {
  it('should return stats for owner', async () => {
    const token = await loginAs('owner');
    mockCustomerGetStats.mockResolvedValue({
      byStatus: [
        { label: 'active', count: '10' },
        { label: 'prospect', count: '5' },
      ],
      byType: [
        { label: 'residential', count: '12' },
        { label: 'commercial', count: '3' },
      ],
    });

    const res = await request(app)
      .get('/v1/customers/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.byStatus).toHaveLength(2);
    expect(res.body.data.byType).toHaveLength(2);
  });

  it('should deny coordinator from viewing stats', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/customers/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant isolation', () => {
  it('should scope all queries to the authenticated tenant', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockCustomerFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/customers')
      .set('Authorization', `Bearer ${tokenA}`);

    // Verify repository was called with tenant A
    expect(mockCustomerFindAll).toHaveBeenCalledWith(TENANT_A, expect.anything());
  });

  it('should not return customers from another tenant', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockCustomerFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/customers')
      .set('Authorization', `Bearer ${tokenB}`);

    // Verify repository was called with tenant B, not A
    expect(mockCustomerFindAll).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });

  it('should use tenant from JWT for create operations', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockCustomerFindByEmail.mockResolvedValue(null);
    mockCustomerCreate.mockResolvedValue(SAMPLE_CUSTOMER);

    await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ first_name: 'Test', last_name: 'User' });

    expect(mockCustomerCreate).toHaveBeenCalledWith(TENANT_A, expect.anything(), expect.anything());
  });
});

// ============================================
// Role-Based Access Control
// ============================================
describe('Role-based access', () => {
  it('should allow div_mgr to list and view customers', async () => {
    const token = await loginAs('div_mgr');
    mockCustomerFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_leader from customer endpoints', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny div_mgr from creating customers', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Test', last_name: 'User' });

    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get('/v1/customers');
    expect(res.status).toBe(401);
  });
});
