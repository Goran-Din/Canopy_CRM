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

// --- Mock materials repository ---
const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();
const mockRecordTransaction = vi.fn();
const mockAdjustStock = vi.fn();
const mockFindTransactions = vi.fn();
const mockGetLowStockMaterials = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  create: (...args: unknown[]) => mockCreate(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  softDelete: (...args: unknown[]) => mockSoftDelete(...args),
  recordTransaction: (...args: unknown[]) => mockRecordTransaction(...args),
  adjustStock: (...args: unknown[]) => mockAdjustStock(...args),
  findTransactions: (...args: unknown[]) => mockFindTransactions(...args),
  getLowStockMaterials: (...args: unknown[]) => mockGetLowStockMaterials(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const MATERIAL_ID = '11111111-0000-0000-0000-000000000001';
const TRANSACTION_ID = '22222222-0000-0000-0000-000000000001';

const SAMPLE_MATERIAL = {
  id: MATERIAL_ID,
  tenant_id: TENANT_A,
  material_name: 'Road Salt (Bulk)',
  category: 'salt',
  unit_of_measure: 'ton',
  current_stock: 50,
  reorder_level: 20,
  cost_per_unit: 85.00,
  preferred_supplier: 'Salt Depot Inc',
  storage_location: 'Yard A - Bin 3',
  notes: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_TRANSACTION = {
  id: TRANSACTION_ID,
  tenant_id: TENANT_A,
  material_id: MATERIAL_ID,
  transaction_type: 'purchase',
  quantity: 25,
  unit_cost: 82.00,
  job_id: null,
  notes: 'Winter pre-buy',
  recorded_by: USER_ID,
  created_at: new Date().toISOString(),
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
// GET /v1/materials — List
// ============================================
describe('GET /v1/materials', () => {
  it('should return paginated material list', async () => {
    const token = await loginAs('owner');
    mockFindAll.mockResolvedValue({ rows: [SAMPLE_MATERIAL], total: 1 });

    const res = await request(app)
      .get('/v1/materials')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should filter by category', async () => {
    const token = await loginAs('div_mgr');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/materials?category=salt')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ category: 'salt' }));
  });

  it('should reject crew_member role', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get('/v1/materials')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/materials/:id — Get
// ============================================
describe('GET /v1/materials/:id', () => {
  it('should return material by id', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_MATERIAL);

    const res = await request(app)
      .get(`/v1/materials/${MATERIAL_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.material_name).toBe('Road Salt (Bulk)');
  });

  it('should return 404 for non-existent material', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/materials/${MATERIAL_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/materials — Create
// ============================================
describe('POST /v1/materials', () => {
  it('should create a new material', async () => {
    const token = await loginAs('owner');
    mockCreate.mockResolvedValue(SAMPLE_MATERIAL);

    const res = await request(app)
      .post('/v1/materials')
      .set('Authorization', `Bearer ${token}`)
      .send({
        material_name: 'Road Salt (Bulk)',
        category: 'salt',
        unit_of_measure: 'ton',
        current_stock: 50,
        reorder_level: 20,
        cost_per_unit: 85.00,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.material_name).toBe('Road Salt (Bulk)');
  });

  it('should require material_name', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/materials')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'salt' });

    expect(res.status).toBe(400);
  });
});

// ============================================
// PUT /v1/materials/:id — Update
// ============================================
describe('PUT /v1/materials/:id', () => {
  it('should update a material', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_MATERIAL);
    const updated = { ...SAMPLE_MATERIAL, cost_per_unit: 90.00 };
    mockUpdate.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/materials/${MATERIAL_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cost_per_unit: 90.00 });

    expect(res.status).toBe(200);
    expect(res.body.data.cost_per_unit).toBe(90.00);
  });

  it('should return 404 for non-existent material', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/materials/${MATERIAL_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cost_per_unit: 90 });

    expect(res.status).toBe(404);
  });
});

// ============================================
// DELETE /v1/materials/:id — Delete
// ============================================
describe('DELETE /v1/materials/:id', () => {
  it('should soft delete a material', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_MATERIAL);
    mockSoftDelete.mockResolvedValue({ ...SAMPLE_MATERIAL, deleted_at: new Date().toISOString() });

    const res = await request(app)
      .delete(`/v1/materials/${MATERIAL_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });

  it('should reject non-owner delete', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .delete(`/v1/materials/${MATERIAL_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /v1/materials/:id/transactions — Record Transaction
// ============================================
describe('POST /v1/materials/:id/transactions', () => {
  it('should record a purchase transaction and increase stock', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_MATERIAL);
    mockRecordTransaction.mockResolvedValue(SAMPLE_TRANSACTION);
    mockAdjustStock.mockResolvedValue(undefined);

    const res = await request(app)
      .post(`/v1/materials/${MATERIAL_ID}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        transaction_type: 'purchase',
        quantity: 25,
        unit_cost: 82.00,
        notes: 'Winter pre-buy',
      });

    expect(res.status).toBe(201);
    expect(mockAdjustStock).toHaveBeenCalledWith(TENANT_A, MATERIAL_ID, 25);
  });

  it('should record a usage transaction and decrease stock', async () => {
    const token = await loginAs('crew_leader');
    mockFindById.mockResolvedValue(SAMPLE_MATERIAL);
    mockRecordTransaction.mockResolvedValue({ ...SAMPLE_TRANSACTION, transaction_type: 'usage', quantity: 5 });
    mockAdjustStock.mockResolvedValue(undefined);

    const res = await request(app)
      .post(`/v1/materials/${MATERIAL_ID}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ transaction_type: 'usage', quantity: 5 });

    expect(res.status).toBe(201);
    expect(mockAdjustStock).toHaveBeenCalledWith(TENANT_A, MATERIAL_ID, -5);
  });

  it('should reject usage exceeding stock', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue({ ...SAMPLE_MATERIAL, current_stock: 3 });

    const res = await request(app)
      .post(`/v1/materials/${MATERIAL_ID}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ transaction_type: 'usage', quantity: 10 });

    expect(res.status).toBe(400);
  });

  it('should return 404 for non-existent material', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/v1/materials/${MATERIAL_ID}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ transaction_type: 'purchase', quantity: 10 });

    expect(res.status).toBe(404);
  });
});

// ============================================
// GET /v1/materials/:id/transactions — List Transactions
// ============================================
describe('GET /v1/materials/:id/transactions', () => {
  it('should return paginated transactions', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_MATERIAL);
    mockFindTransactions.mockResolvedValue({ rows: [SAMPLE_TRANSACTION], total: 1 });

    const res = await request(app)
      .get(`/v1/materials/${MATERIAL_ID}/transactions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });
});

// ============================================
// GET /v1/materials/low-stock — Low Stock
// ============================================
describe('GET /v1/materials/low-stock', () => {
  it('should return low stock materials', async () => {
    const token = await loginAs('owner');
    const lowStockItem = { ...SAMPLE_MATERIAL, current_stock: 15 };
    mockGetLowStockMaterials.mockResolvedValue([lowStockItem]);

    const res = await request(app)
      .get('/v1/materials/low-stock')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('should reject crew_leader from low-stock endpoint', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/materials/low-stock')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
