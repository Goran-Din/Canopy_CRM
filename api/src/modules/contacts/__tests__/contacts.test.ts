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

// --- Mock contact repository ---
const mockContactFindAll = vi.fn();
const mockContactFindById = vi.fn();
const mockContactFindByCustomerId = vi.fn();
const mockContactFindByPropertyId = vi.fn();
const mockContactCountByCustomerId = vi.fn();
const mockContactCreate = vi.fn();
const mockContactUpdate = vi.fn();
const mockContactSoftDelete = vi.fn();
const mockContactSetPrimary = vi.fn();
const mockContactCustomerExists = vi.fn();
const mockContactPropertyBelongsToCustomer = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockContactFindAll(...args),
  findById: (...args: unknown[]) => mockContactFindById(...args),
  findByCustomerId: (...args: unknown[]) => mockContactFindByCustomerId(...args),
  findByPropertyId: (...args: unknown[]) => mockContactFindByPropertyId(...args),
  countByCustomerId: (...args: unknown[]) => mockContactCountByCustomerId(...args),
  create: (...args: unknown[]) => mockContactCreate(...args),
  update: (...args: unknown[]) => mockContactUpdate(...args),
  softDelete: (...args: unknown[]) => mockContactSoftDelete(...args),
  setPrimary: (...args: unknown[]) => mockContactSetPrimary(...args),
  customerExists: (...args: unknown[]) => mockContactCustomerExists(...args),
  propertyBelongsToCustomer: (...args: unknown[]) => mockContactPropertyBelongsToCustomer(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const CONTACT_ID = 'ffffffff-0000-0000-0000-000000000001';
const CONTACT_ID_2 = 'ffffffff-0000-0000-0000-000000000002';

const SAMPLE_CONTACT = {
  id: CONTACT_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  property_id: null,
  contact_type: 'primary',
  is_primary: true,
  preferred_contact_method: 'email',
  first_name: 'Jane',
  last_name: 'Doe',
  display_name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-9876',
  mobile: null,
  job_title: null,
  notes: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  customer_display_name: 'John Doe',
  property_name: null,
};

const SAMPLE_CONTACT_2 = {
  ...SAMPLE_CONTACT,
  id: CONTACT_ID_2,
  is_primary: false,
  contact_type: 'billing',
  first_name: 'Bob',
  last_name: 'Smith',
  display_name: 'Bob Smith',
  email: 'bob@example.com',
};

// Helper to login and get access token for a specific role and tenant
async function loginAs(
  role: string,
  tenantId: string = TENANT_A,
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
// GET /v1/contacts — List
// ============================================
describe('GET /v1/contacts', () => {
  it('should return paginated contact list', async () => {
    const token = await loginAs('owner');
    mockContactFindAll.mockResolvedValue({
      rows: [SAMPLE_CONTACT],
      total: 1,
    });

    const res = await request(app)
      .get('/v1/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass search and filter params to repository', async () => {
    const token = await loginAs('coordinator');
    mockContactFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/contacts?search=jane&customer_id=${CUSTOMER_ID}&type=primary&page=2&limit=10`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockContactFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        search: 'jane',
        customer_id: CUSTOMER_ID,
        type: 'primary',
        page: 2,
        limit: 10,
      }),
    );
  });

  it('should deny crew_member access', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/contacts/:id — Detail
// ============================================
describe('GET /v1/contacts/:id', () => {
  it('should return single contact with customer and property names', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue({
      ...SAMPLE_CONTACT,
      property_id: PROPERTY_ID,
      property_name: 'Main Residence',
    });

    const res = await request(app)
      .get(`/v1/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.customer_display_name).toBe('John Doe');
    expect(res.body.data.property_name).toBe('Main Residence');
  });

  it('should return 404 for non-existent contact', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid UUID', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/contacts/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// GET /v1/contacts/by-customer/:customerId
// ============================================
describe('GET /v1/contacts/by-customer/:customerId', () => {
  it('should return all contacts for a customer', async () => {
    const token = await loginAs('owner');
    mockContactCustomerExists.mockResolvedValue(true);
    mockContactFindByCustomerId.mockResolvedValue([SAMPLE_CONTACT, SAMPLE_CONTACT_2]);

    const res = await request(app)
      .get(`/v1/contacts/by-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should return 404 if customer does not exist', async () => {
    const token = await loginAs('owner');
    mockContactCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .get(`/v1/contacts/by-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer not found');
  });
});

// ============================================
// GET /v1/contacts/by-property/:propertyId
// ============================================
describe('GET /v1/contacts/by-property/:propertyId', () => {
  it('should return all contacts for a property', async () => {
    const token = await loginAs('owner');
    mockContactFindByPropertyId.mockResolvedValue([
      { ...SAMPLE_CONTACT, property_id: PROPERTY_ID },
    ]);

    const res = await request(app)
      .get(`/v1/contacts/by-property/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ============================================
// POST /v1/contacts — Create
// ============================================
describe('POST /v1/contacts', () => {
  it('should create a contact', async () => {
    const token = await loginAs('owner');
    mockContactCustomerExists.mockResolvedValue(true);
    mockContactCountByCustomerId.mockResolvedValue(1); // not first
    mockContactCreate.mockResolvedValue(SAMPLE_CONTACT_2);

    const res = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        contact_type: 'billing',
        first_name: 'Bob',
        last_name: 'Smith',
        email: 'bob@example.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.first_name).toBe('Bob');
  });

  it('should auto-set first contact as primary', async () => {
    const token = await loginAs('owner');
    mockContactCustomerExists.mockResolvedValue(true);
    mockContactCountByCustomerId.mockResolvedValue(0); // first contact
    mockContactCreate.mockResolvedValue({ ...SAMPLE_CONTACT, is_primary: true });

    const res = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        contact_type: 'primary',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      });

    expect(res.status).toBe(201);
    // Verify create was called with is_primary=true
    expect(mockContactCreate).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ is_primary: true }),
      USER_ID,
    );
  });

  it('should reassign primary when creating with is_primary=true and contacts exist', async () => {
    const token = await loginAs('owner');
    mockContactCustomerExists.mockResolvedValue(true);
    mockContactCountByCustomerId.mockResolvedValue(1); // existing contacts
    // Create with is_primary=false first, then setPrimary
    mockContactCreate.mockResolvedValue({ ...SAMPLE_CONTACT_2, is_primary: false });
    mockContactSetPrimary.mockResolvedValue({ ...SAMPLE_CONTACT_2, is_primary: true });
    mockContactFindById.mockResolvedValue({ ...SAMPLE_CONTACT_2, is_primary: true });

    const res = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        contact_type: 'billing',
        first_name: 'Bob',
        last_name: 'Smith',
        is_primary: true,
      });

    expect(res.status).toBe(201);
    expect(mockContactSetPrimary).toHaveBeenCalled();
  });

  it('should reject create if customer does not exist in tenant', async () => {
    const token = await loginAs('owner');
    mockContactCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        first_name: 'Bad',
        last_name: 'Contact',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer not found in this tenant');
  });

  it('should reject create if property does not belong to customer', async () => {
    const token = await loginAs('owner');
    mockContactCustomerExists.mockResolvedValue(true);
    mockContactPropertyBelongsToCustomer.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        first_name: 'Bad',
        last_name: 'Link',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Property does not belong to this customer');
  });

  it('should accept create when property belongs to customer', async () => {
    const token = await loginAs('coordinator');
    mockContactCustomerExists.mockResolvedValue(true);
    mockContactPropertyBelongsToCustomer.mockResolvedValue(true);
    mockContactCountByCustomerId.mockResolvedValue(1);
    mockContactCreate.mockResolvedValue({
      ...SAMPLE_CONTACT,
      property_id: PROPERTY_ID,
    });

    const res = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        first_name: 'Site',
        last_name: 'Contact',
        contact_type: 'site',
      });

    expect(res.status).toBe(201);
  });

  it('should reject without required fields', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_id: CUSTOMER_ID });

    expect(res.status).toBe(400);
  });

  it('should deny crew_member from creating', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        first_name: 'Test',
        last_name: 'User',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/contacts/:id — Update
// ============================================
describe('PUT /v1/contacts/:id', () => {
  it('should update contact fields', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(SAMPLE_CONTACT);
    mockContactUpdate.mockResolvedValue({
      ...SAMPLE_CONTACT,
      first_name: 'Janet',
      display_name: 'Janet Doe',
    });

    const res = await request(app)
      .put(`/v1/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Janet' });

    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('Janet');
  });

  it('should return 404 for non-existent contact', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Test' });

    expect(res.status).toBe(404);
  });

  it('should return 409 on optimistic concurrency conflict', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(SAMPLE_CONTACT);
    mockContactUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        first_name: 'Updated',
        updated_at: '2020-01-01T00:00:00.000Z',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('modified by another user');
  });

  it('should validate property belongs to customer on update', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(SAMPLE_CONTACT);
    mockContactPropertyBelongsToCustomer.mockResolvedValue(false);

    const res = await request(app)
      .put(`/v1/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ property_id: PROPERTY_ID });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Property does not belong to this customer');
  });
});

// ============================================
// PUT /v1/contacts/:id/set-primary
// ============================================
describe('PUT /v1/contacts/:id/set-primary', () => {
  it('should set contact as primary', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(SAMPLE_CONTACT_2); // not primary
    mockContactSetPrimary.mockResolvedValue({ ...SAMPLE_CONTACT_2, is_primary: true });

    const res = await request(app)
      .put(`/v1/contacts/${CONTACT_ID_2}/set-primary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_primary).toBe(true);
  });

  it('should return already-primary contact as-is', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(SAMPLE_CONTACT); // already primary

    const res = await request(app)
      .put(`/v1/contacts/${CONTACT_ID}/set-primary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_primary).toBe(true);
    // setPrimary should NOT have been called since already primary
    expect(mockContactSetPrimary).not.toHaveBeenCalled();
  });

  it('should return 404 for non-existent contact', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/contacts/${CONTACT_ID}/set-primary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should deny div_mgr from setting primary', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .put(`/v1/contacts/${CONTACT_ID}/set-primary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// DELETE /v1/contacts/:id — Soft Delete
// ============================================
describe('DELETE /v1/contacts/:id', () => {
  it('should soft delete non-primary contact', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(SAMPLE_CONTACT_2); // not primary
    mockContactSoftDelete.mockResolvedValue(SAMPLE_CONTACT_2);

    const res = await request(app)
      .delete(`/v1/contacts/${CONTACT_ID_2}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Contact deleted');
  });

  it('should soft delete primary contact when it is the only contact', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(SAMPLE_CONTACT); // primary
    mockContactCountByCustomerId.mockResolvedValue(1); // only one
    mockContactSoftDelete.mockResolvedValue(SAMPLE_CONTACT);

    const res = await request(app)
      .delete(`/v1/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Contact deleted');
  });

  it('should block deletion of primary contact when other contacts exist', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(SAMPLE_CONTACT); // primary
    mockContactCountByCustomerId.mockResolvedValue(3); // others exist

    const res = await request(app)
      .delete(`/v1/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Reassign primary first');
  });

  it('should return 404 for non-existent contact', async () => {
    const token = await loginAs('owner');
    mockContactFindById.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/v1/contacts/${CONTACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should deny coordinator from deleting', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .delete(`/v1/contacts/${CONTACT_ID}`)
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
    mockContactFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/contacts')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mockContactFindAll).toHaveBeenCalledWith(TENANT_A, expect.anything());
  });

  it('should not return contacts from another tenant', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockContactFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/contacts')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mockContactFindAll).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });

  it('should use tenant from JWT for create operations', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockContactCustomerExists.mockResolvedValue(true);
    mockContactCountByCustomerId.mockResolvedValue(0);
    mockContactCreate.mockResolvedValue(SAMPLE_CONTACT);

    await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customer_id: CUSTOMER_ID,
        first_name: 'Test',
        last_name: 'User',
      });

    expect(mockContactCreate).toHaveBeenCalledWith(TENANT_A, expect.anything(), expect.anything());
  });
});

// ============================================
// Role-Based Access Control
// ============================================
describe('Role-based access', () => {
  it('should allow div_mgr to list and view contacts', async () => {
    const token = await loginAs('div_mgr');
    mockContactFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_leader from contact endpoints', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny div_mgr from creating contacts', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post('/v1/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        first_name: 'Test',
        last_name: 'User',
      });

    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get('/v1/contacts');
    expect(res.status).toBe(401);
  });
});
