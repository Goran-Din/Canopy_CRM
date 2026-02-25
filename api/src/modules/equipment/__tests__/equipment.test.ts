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

// --- Mock equipment repository ---
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
const EQUIPMENT_ID = '11111111-0000-0000-0000-000000000001';
const CREW_ID = '22222222-0000-0000-0000-000000000001';

const SAMPLE_EQUIPMENT = {
  id: EQUIPMENT_ID,
  tenant_id: TENANT_A,
  equipment_name: 'Ford F-350 #1',
  equipment_type: 'truck',
  status: 'active',
  make: 'Ford',
  model: 'F-350',
  year: 2022,
  serial_number: null,
  license_plate: 'ABC-1234',
  vin: '1FTRF3B66CEA12345',
  purchase_date: '2022-01-15',
  purchase_price: 55000,
  current_value: 42000,
  assigned_crew_id: CREW_ID,
  assigned_division: 'landscaping_maintenance',
  last_maintenance_date: '2025-12-01',
  next_maintenance_date: '2026-03-01',
  mileage: 45000,
  hours_used: 1200,
  notes: null,
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
// GET /v1/equipment — List
// ============================================
describe('GET /v1/equipment', () => {
  it('should return paginated equipment list', async () => {
    const token = await loginAs('owner');
    mockFindAll.mockResolvedValue({ rows: [SAMPLE_EQUIPMENT], total: 1 });

    const res = await request(app)
      .get('/v1/equipment')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should filter by equipment_type', async () => {
    const token = await loginAs('div_mgr');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/equipment?equipment_type=truck')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ equipment_type: 'truck' }));
  });

  it('should allow crew_leader access', async () => {
    const token = await loginAs('crew_leader');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/equipment')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should reject crew_member role', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get('/v1/equipment')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/equipment/:id — Get
// ============================================
describe('GET /v1/equipment/:id', () => {
  it('should return equipment by id', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_EQUIPMENT);

    const res = await request(app)
      .get(`/v1/equipment/${EQUIPMENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.equipment_name).toBe('Ford F-350 #1');
  });

  it('should return 404 for non-existent equipment', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/equipment/${EQUIPMENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/equipment — Create
// ============================================
describe('POST /v1/equipment', () => {
  it('should create new equipment', async () => {
    const token = await loginAs('owner');
    mockCreate.mockResolvedValue(SAMPLE_EQUIPMENT);

    const res = await request(app)
      .post('/v1/equipment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        equipment_name: 'Ford F-350 #1',
        equipment_type: 'truck',
        make: 'Ford',
        model: 'F-350',
        year: 2022,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.equipment_name).toBe('Ford F-350 #1');
  });

  it('should require equipment_name', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/equipment')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipment_type: 'truck' });

    expect(res.status).toBe(400);
  });

  it('should reject coordinator from creating', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/equipment')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipment_name: 'Test' });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/equipment/:id — Update
// ============================================
describe('PUT /v1/equipment/:id', () => {
  it('should update equipment', async () => {
    const token = await loginAs('div_mgr');
    mockFindById.mockResolvedValue(SAMPLE_EQUIPMENT);
    const updated = { ...SAMPLE_EQUIPMENT, mileage: 50000 };
    mockUpdate.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/equipment/${EQUIPMENT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mileage: 50000 });

    expect(res.status).toBe(200);
    expect(res.body.data.mileage).toBe(50000);
  });

  it('should return 404 for non-existent equipment', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/equipment/${EQUIPMENT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mileage: 50000 });

    expect(res.status).toBe(404);
  });
});

// ============================================
// DELETE /v1/equipment/:id — Delete
// ============================================
describe('DELETE /v1/equipment/:id', () => {
  it('should soft delete equipment', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_EQUIPMENT);
    mockSoftDelete.mockResolvedValue({ ...SAMPLE_EQUIPMENT, deleted_at: new Date().toISOString() });

    const res = await request(app)
      .delete(`/v1/equipment/${EQUIPMENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });

  it('should reject non-owner delete', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .delete(`/v1/equipment/${EQUIPMENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
