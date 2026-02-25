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

// --- Mock property repository ---
const mockPropertyFindAll = vi.fn();
const mockPropertyFindById = vi.fn();
const mockPropertyFindByCustomerId = vi.fn();
const mockPropertyCreate = vi.fn();
const mockPropertyUpdate = vi.fn();
const mockPropertySoftDelete = vi.fn();
const mockPropertyGetStats = vi.fn();
const mockPropertyHasActiveContracts = vi.fn();
const mockPropertyCustomerExists = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockPropertyFindAll(...args),
  findById: (...args: unknown[]) => mockPropertyFindById(...args),
  findByCustomerId: (...args: unknown[]) => mockPropertyFindByCustomerId(...args),
  create: (...args: unknown[]) => mockPropertyCreate(...args),
  update: (...args: unknown[]) => mockPropertyUpdate(...args),
  softDelete: (...args: unknown[]) => mockPropertySoftDelete(...args),
  getStats: (...args: unknown[]) => mockPropertyGetStats(...args),
  hasActiveContracts: (...args: unknown[]) => mockPropertyHasActiveContracts(...args),
  customerExists: (...args: unknown[]) => mockPropertyCustomerExists(...args),
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

const SAMPLE_PROPERTY = {
  id: PROPERTY_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  property_name: 'Main Residence',
  property_type: 'residential',
  status: 'active',
  address_line1: '456 Oak Ave',
  address_line2: null,
  city: 'Miami',
  state: 'FL',
  zip: '33101',
  country: 'US',
  latitude: 25.7617,
  longitude: -80.1918,
  google_maps_url: 'https://www.google.com/maps?q=25.7617,-80.1918',
  lot_size_sqft: 8500,
  lawn_area_sqft: 5000,
  zone: 'Zone A',
  service_frequency: 'weekly',
  property_photos_url: null,
  notes: null,
  tags: ['vip'],
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  customer_display_name: 'John Doe',
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
// GET /v1/properties — List
// ============================================
describe('GET /v1/properties', () => {
  it('should return paginated property list', async () => {
    const token = await loginAs('owner');
    mockPropertyFindAll.mockResolvedValue({
      rows: [SAMPLE_PROPERTY],
      total: 1,
    });

    const res = await request(app)
      .get('/v1/properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(25);
  });

  it('should pass search, filter, and zone params to repository', async () => {
    const token = await loginAs('coordinator');
    mockPropertyFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/properties?search=oak&status=active&type=residential&zone=Zone+A&page=2&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(mockPropertyFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        search: 'oak',
        status: 'active',
        type: 'residential',
        zone: 'Zone A',
        page: 2,
        limit: 10,
      }),
    );
  });

  it('should filter by customer_id', async () => {
    const token = await loginAs('owner');
    mockPropertyFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/properties?customer_id=${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockPropertyFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ customer_id: CUSTOMER_ID }),
    );
  });

  it('should deny crew_member access', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/properties/:id — Detail
// ============================================
describe('GET /v1/properties/:id', () => {
  it('should return single property with customer name', async () => {
    const token = await loginAs('owner');
    mockPropertyFindById.mockResolvedValue(SAMPLE_PROPERTY);

    const res = await request(app)
      .get(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(PROPERTY_ID);
    expect(res.body.data.customer_display_name).toBe('John Doe');
  });

  it('should return 404 for non-existent property', async () => {
    const token = await loginAs('owner');
    mockPropertyFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid UUID', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/properties/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// GET /v1/properties/by-customer/:customerId
// ============================================
describe('GET /v1/properties/by-customer/:customerId', () => {
  it('should return all properties for a customer', async () => {
    const token = await loginAs('owner');
    mockPropertyCustomerExists.mockResolvedValue(true);
    mockPropertyFindByCustomerId.mockResolvedValue([SAMPLE_PROPERTY]);

    const res = await request(app)
      .get(`/v1/properties/by-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].customer_id).toBe(CUSTOMER_ID);
  });

  it('should return 404 if customer does not exist', async () => {
    const token = await loginAs('owner');
    mockPropertyCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .get(`/v1/properties/by-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer not found');
  });

  it('should return 400 for invalid customer UUID', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/properties/by-customer/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// POST /v1/properties — Create
// ============================================
describe('POST /v1/properties', () => {
  it('should create a property with auto-generated Google Maps URL', async () => {
    const token = await loginAs('owner');
    mockPropertyCustomerExists.mockResolvedValue(true);
    mockPropertyCreate.mockResolvedValue(SAMPLE_PROPERTY);

    const res = await request(app)
      .post('/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_name: 'Main Residence',
        property_type: 'residential',
        address_line1: '456 Oak Ave',
        city: 'Miami',
        state: 'FL',
        zip: '33101',
        latitude: 25.7617,
        longitude: -80.1918,
        lot_size_sqft: 8500,
        lawn_area_sqft: 5000,
        zone: 'Zone A',
        tags: ['vip'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.property_name).toBe('Main Residence');
    expect(mockPropertyCreate).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        google_maps_url: 'https://www.google.com/maps?q=25.7617,-80.1918',
      }),
      USER_ID,
    );
  });

  it('should create a property without lat/lng (no Google Maps URL)', async () => {
    const token = await loginAs('coordinator');
    mockPropertyCustomerExists.mockResolvedValue(true);
    const propertyNoGeo = { ...SAMPLE_PROPERTY, latitude: null, longitude: null, google_maps_url: null };
    mockPropertyCreate.mockResolvedValue(propertyNoGeo);

    const res = await request(app)
      .post('/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_name: 'Back Lot',
        address_line1: '789 Pine St',
        city: 'Miami',
        state: 'FL',
        zip: '33101',
      });

    expect(res.status).toBe(201);
    expect(mockPropertyCreate).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        google_maps_url: null,
      }),
      USER_ID,
    );
  });

  it('should reject create if customer does not exist in tenant', async () => {
    const token = await loginAs('owner');
    mockPropertyCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_name: 'Invalid',
        address_line1: '123 Fake St',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer not found in this tenant');
  });

  it('should reject create without customer_id', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        property_name: 'No Customer',
        address_line1: '123 Fake St',
      });

    expect(res.status).toBe(400);
  });

  it('should deny crew_member from creating', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .post('/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_id: CUSTOMER_ID, property_name: 'Test' });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/properties/:id — Update
// ============================================
describe('PUT /v1/properties/:id', () => {
  it('should update property fields', async () => {
    const token = await loginAs('owner');
    mockPropertyFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockPropertyUpdate.mockResolvedValue({
      ...SAMPLE_PROPERTY,
      property_name: 'Updated Residence',
    });

    const res = await request(app)
      .put(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ property_name: 'Updated Residence' });

    expect(res.status).toBe(200);
    expect(res.body.data.property_name).toBe('Updated Residence');
  });

  it('should recompute Google Maps URL when lat/lng changes', async () => {
    const token = await loginAs('owner');
    mockPropertyFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockPropertyUpdate.mockResolvedValue({
      ...SAMPLE_PROPERTY,
      latitude: 26.0,
      longitude: -80.0,
      google_maps_url: 'https://www.google.com/maps?q=26,-80',
    });

    await request(app)
      .put(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 26.0, longitude: -80.0 });

    expect(mockPropertyUpdate).toHaveBeenCalledWith(
      TENANT_A,
      PROPERTY_ID,
      expect.objectContaining({
        google_maps_url: 'https://www.google.com/maps?q=26,-80',
      }),
      USER_ID,
    );
  });

  it('should validate new customer_id on reassignment', async () => {
    const token = await loginAs('owner');
    const newCustomerId = 'ffffffff-0000-0000-0000-000000000099';
    mockPropertyFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockPropertyCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .put(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_id: newCustomerId });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer not found in this tenant');
  });

  it('should return 404 for non-existent property', async () => {
    const token = await loginAs('owner');
    mockPropertyFindById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ property_name: 'Test' });

    expect(res.status).toBe(404);
  });

  it('should return 409 on optimistic concurrency conflict', async () => {
    const token = await loginAs('owner');
    mockPropertyFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockPropertyUpdate.mockResolvedValue(null); // no rows updated = conflict

    const res = await request(app)
      .put(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        property_name: 'Updated',
        updated_at: '2020-01-01T00:00:00.000Z', // stale timestamp
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('modified by another user');
  });
});

// ============================================
// DELETE /v1/properties/:id — Soft Delete
// ============================================
describe('DELETE /v1/properties/:id', () => {
  it('should soft delete property (owner only)', async () => {
    const token = await loginAs('owner');
    mockPropertyFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockPropertyHasActiveContracts.mockResolvedValue(false);
    mockPropertySoftDelete.mockResolvedValue(SAMPLE_PROPERTY);

    const res = await request(app)
      .delete(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Property deleted');
  });

  it('should block deletion when active contracts exist', async () => {
    const token = await loginAs('owner');
    mockPropertyFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockPropertyHasActiveContracts.mockResolvedValue(true);

    const res = await request(app)
      .delete(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Cannot delete property with active contracts');
  });

  it('should return 404 for non-existent property', async () => {
    const token = await loginAs('owner');
    mockPropertyFindById.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should deny coordinator from deleting', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .delete(`/v1/properties/${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/properties/stats — Stats
// ============================================
describe('GET /v1/properties/stats', () => {
  it('should return stats for owner', async () => {
    const token = await loginAs('owner');
    mockPropertyGetStats.mockResolvedValue({
      byStatus: [
        { label: 'active', count: '15' },
        { label: 'pending', count: '3' },
      ],
      byType: [
        { label: 'residential', count: '12' },
        { label: 'commercial', count: '6' },
      ],
      byZone: [
        { label: 'Zone A', count: '8' },
        { label: 'Zone B', count: '10' },
      ],
    });

    const res = await request(app)
      .get('/v1/properties/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.byStatus).toHaveLength(2);
    expect(res.body.data.byType).toHaveLength(2);
    expect(res.body.data.byZone).toHaveLength(2);
  });

  it('should deny coordinator from viewing stats', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/properties/stats')
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
    mockPropertyFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/properties')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mockPropertyFindAll).toHaveBeenCalledWith(TENANT_A, expect.anything());
  });

  it('should not return properties from another tenant', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockPropertyFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/properties')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mockPropertyFindAll).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });

  it('should use tenant from JWT for create operations', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockPropertyCustomerExists.mockResolvedValue(true);
    mockPropertyCreate.mockResolvedValue(SAMPLE_PROPERTY);

    await request(app)
      .post('/v1/properties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ customer_id: CUSTOMER_ID, property_name: 'Test' });

    expect(mockPropertyCreate).toHaveBeenCalledWith(TENANT_A, expect.anything(), expect.anything());
  });

  it('should validate customer belongs to same tenant on create', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockPropertyCustomerExists.mockResolvedValue(false); // customer not in tenant A

    const res = await request(app)
      .post('/v1/properties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ customer_id: 'ffffffff-0000-0000-0000-000000000099', property_name: 'Cross-tenant' });

    expect(res.status).toBe(404);
    // customerExists was called with tenant A
    expect(mockPropertyCustomerExists).toHaveBeenCalledWith(TENANT_A, 'ffffffff-0000-0000-0000-000000000099');
  });
});

// ============================================
// Role-Based Access Control
// ============================================
describe('Role-based access', () => {
  it('should allow div_mgr to list and view properties', async () => {
    const token = await loginAs('div_mgr');
    mockPropertyFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_leader from property endpoints', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny div_mgr from creating properties', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post('/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_id: CUSTOMER_ID, property_name: 'Test' });

    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get('/v1/properties');
    expect(res.status).toBe(401);
  });
});
