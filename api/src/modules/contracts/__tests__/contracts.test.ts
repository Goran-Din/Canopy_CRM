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

// --- Mock contract repository ---
const mockContractFindAll = vi.fn();
const mockContractFindById = vi.fn();
const mockContractCreate = vi.fn();
const mockContractUpdate = vi.fn();
const mockContractUpdateStatus = vi.fn();
const mockContractSoftDelete = vi.fn();
const mockContractGetLineItems = vi.fn();
const mockContractAddLineItem = vi.fn();
const mockContractUpdateLineItem = vi.fn();
const mockContractRemoveLineItem = vi.fn();
const mockContractGetLineItemById = vi.fn();
const mockContractGenerateNumber = vi.fn();
const mockContractGetStats = vi.fn();
const mockContractCustomerExists = vi.fn();
const mockContractPropertyBelongsToCustomer = vi.fn();
const mockContractLogPriceChange = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockContractFindAll(...args),
  findById: (...args: unknown[]) => mockContractFindById(...args),
  create: (...args: unknown[]) => mockContractCreate(...args),
  update: (...args: unknown[]) => mockContractUpdate(...args),
  updateStatus: (...args: unknown[]) => mockContractUpdateStatus(...args),
  softDelete: (...args: unknown[]) => mockContractSoftDelete(...args),
  getLineItems: (...args: unknown[]) => mockContractGetLineItems(...args),
  addLineItem: (...args: unknown[]) => mockContractAddLineItem(...args),
  updateLineItem: (...args: unknown[]) => mockContractUpdateLineItem(...args),
  removeLineItem: (...args: unknown[]) => mockContractRemoveLineItem(...args),
  getLineItemById: (...args: unknown[]) => mockContractGetLineItemById(...args),
  generateContractNumber: (...args: unknown[]) => mockContractGenerateNumber(...args),
  getStats: (...args: unknown[]) => mockContractGetStats(...args),
  customerExists: (...args: unknown[]) => mockContractCustomerExists(...args),
  propertyBelongsToCustomer: (...args: unknown[]) => mockContractPropertyBelongsToCustomer(...args),
  logPriceChange: (...args: unknown[]) => mockContractLogPriceChange(...args),
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
const CONTRACT_ID = '11111111-0000-0000-0000-000000000001';
const LINE_ITEM_ID = '22222222-0000-0000-0000-000000000001';

const SAMPLE_LINE_ITEM = {
  id: LINE_ITEM_ID,
  tenant_id: TENANT_A,
  contract_id: CONTRACT_ID,
  service_name: 'Weekly Lawn Mowing',
  description: null,
  quantity: 1,
  unit_price: 150.00,
  frequency: 'weekly',
  division: 'landscaping_maintenance',
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_CONTRACT = {
  id: CONTRACT_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  property_id: PROPERTY_ID,
  contract_type: 'maintenance',
  status: 'draft',
  division: 'landscaping_maintenance',
  contract_number: 'SC-2026-0001',
  title: 'Annual Lawn Maintenance',
  description: 'Full-season lawn care',
  start_date: '2026-04-01',
  end_date: '2026-10-31',
  signed_date: null,
  signed_by: null,
  billing_frequency: 'monthly',
  contract_value: 4500.00,
  recurring_amount: 750.00,
  auto_renew: false,
  renewal_increase_percent: 0,
  notes: null,
  tags: ['lawn'],
  xero_repeating_invoice_id: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  customer_display_name: 'John Doe',
  property_name: 'Main Residence',
  line_items: [SAMPLE_LINE_ITEM],
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
// GET /v1/contracts — List
// ============================================
describe('GET /v1/contracts', () => {
  it('should return paginated contract list', async () => {
    const token = await loginAs('owner');
    mockContractFindAll.mockResolvedValue({ rows: [SAMPLE_CONTRACT], total: 1 });

    const res = await request(app)
      .get('/v1/contracts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass filters to repository', async () => {
    const token = await loginAs('coordinator');
    mockContractFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/contracts?status=active&type=maintenance&division=landscaping_maintenance&customer_id=${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockContractFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        status: 'active',
        type: 'maintenance',
        division: 'landscaping_maintenance',
        customer_id: CUSTOMER_ID,
      }),
    );
  });

  it('should deny crew_member access', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app).get('/v1/contracts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/contracts/:id — Detail
// ============================================
describe('GET /v1/contracts/:id', () => {
  it('should return contract with line items and relations', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(SAMPLE_CONTRACT);

    const res = await request(app)
      .get(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.contract_number).toBe('SC-2026-0001');
    expect(res.body.data.customer_display_name).toBe('John Doe');
    expect(res.body.data.property_name).toBe('Main Residence');
    expect(res.body.data.line_items).toHaveLength(1);
  });

  it('should return 404 for non-existent contract', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/contracts — Create
// ============================================
describe('POST /v1/contracts', () => {
  it('should create contract with auto-generated number', async () => {
    const token = await loginAs('owner');
    mockContractCustomerExists.mockResolvedValue(true);
    mockContractPropertyBelongsToCustomer.mockResolvedValue(true);
    mockContractGenerateNumber.mockResolvedValue('SC-2026-0001');
    mockContractCreate.mockResolvedValue(SAMPLE_CONTRACT);

    const res = await request(app)
      .post('/v1/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        contract_type: 'maintenance',
        division: 'landscaping_maintenance',
        title: 'Annual Lawn Maintenance',
        start_date: '2026-04-01',
        end_date: '2026-10-31',
        billing_frequency: 'monthly',
        contract_value: 4500,
        recurring_amount: 750,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.contract_number).toBe('SC-2026-0001');
    expect(mockContractGenerateNumber).toHaveBeenCalledWith(TENANT_A);
  });

  it('should create contract with line items and calculate value', async () => {
    const token = await loginAs('owner');
    mockContractCustomerExists.mockResolvedValue(true);
    mockContractPropertyBelongsToCustomer.mockResolvedValue(true);
    mockContractGenerateNumber.mockResolvedValue('SC-2026-0002');
    mockContractCreate.mockResolvedValue({
      ...SAMPLE_CONTRACT,
      contract_number: 'SC-2026-0002',
      contract_value: 300,
    });

    const res = await request(app)
      .post('/v1/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        contract_type: 'maintenance',
        division: 'landscaping_maintenance',
        title: 'Mowing Contract',
        start_date: '2026-04-01',
        line_items: [
          { service_name: 'Mowing', quantity: 2, unit_price: 100 },
          { service_name: 'Edging', quantity: 1, unit_price: 100 },
        ],
      });

    expect(res.status).toBe(201);
    // Verify contract_value was calculated from line items (2*100 + 1*100 = 300)
    expect(mockContractCreate).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ contract_value: 300 }),
      expect.arrayContaining([
        expect.objectContaining({ service_name: 'Mowing' }),
        expect.objectContaining({ service_name: 'Edging' }),
      ]),
      USER_ID,
    );
  });

  it('should reject if customer does not exist in tenant', async () => {
    const token = await loginAs('owner');
    mockContractCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        contract_type: 'maintenance',
        division: 'landscaping_maintenance',
        title: 'Test',
        start_date: '2026-04-01',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer not found in this tenant');
  });

  it('should reject if property does not belong to customer', async () => {
    const token = await loginAs('owner');
    mockContractCustomerExists.mockResolvedValue(true);
    mockContractPropertyBelongsToCustomer.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        contract_type: 'maintenance',
        division: 'landscaping_maintenance',
        title: 'Test',
        start_date: '2026-04-01',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Property does not belong to this customer');
  });

  it('should reject without required fields', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Missing fields' });

    expect(res.status).toBe(400);
  });

  it('should deny div_mgr from creating', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post('/v1/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        contract_type: 'maintenance',
        division: 'landscaping_maintenance',
        title: 'Test',
        start_date: '2026-04-01',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/contracts/:id — Update
// ============================================
describe('PUT /v1/contracts/:id', () => {
  it('should update contract fields', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(SAMPLE_CONTRACT);
    mockContractUpdate.mockResolvedValue({
      ...SAMPLE_CONTRACT,
      title: 'Updated Title',
    });

    const res = await request(app)
      .put(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('should log price change when contract_value changes', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(SAMPLE_CONTRACT);
    mockContractLogPriceChange.mockResolvedValue(undefined);
    mockContractUpdate.mockResolvedValue({
      ...SAMPLE_CONTRACT,
      contract_value: 5000,
    });

    await request(app)
      .put(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contract_value: 5000 });

    expect(mockContractLogPriceChange).toHaveBeenCalledWith(
      TENANT_A,
      CONTRACT_ID,
      4500,    // old value
      5000,    // new value
      null,
      USER_ID,
    );
  });

  it('should return 409 on concurrency conflict', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(SAMPLE_CONTRACT);
    mockContractUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated', updated_at: '2020-01-01T00:00:00.000Z' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('modified by another user');
  });
});

// ============================================
// PATCH /v1/contracts/:id/status — Status Change
// ============================================
describe('PATCH /v1/contracts/:id/status', () => {
  it('should allow valid transition: draft -> pending_approval', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'draft' });
    mockContractUpdateStatus.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'pending_approval' });

    const res = await request(app)
      .patch(`/v1/contracts/${CONTRACT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pending_approval' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending_approval');
  });

  it('should allow valid transition: pending_approval -> active', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'pending_approval' });
    mockContractUpdateStatus.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'active' });

    const res = await request(app)
      .patch(`/v1/contracts/${CONTRACT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
  });

  it('should allow valid transition: active -> on_hold', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'active' });
    mockContractUpdateStatus.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'on_hold' });

    const res = await request(app)
      .patch(`/v1/contracts/${CONTRACT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'on_hold' });

    expect(res.status).toBe(200);
  });

  it('should allow valid transition: active -> completed', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'active' });
    mockContractUpdateStatus.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'completed' });

    const res = await request(app)
      .patch(`/v1/contracts/${CONTRACT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
  });

  it('should reject invalid transition: draft -> active', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'draft' });

    const res = await request(app)
      .patch(`/v1/contracts/${CONTRACT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Cannot transition from 'draft' to 'active'");
  });

  it('should reject invalid transition: draft -> completed', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'draft' });

    const res = await request(app)
      .patch(`/v1/contracts/${CONTRACT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
  });

  it('should reject invalid transition: completed -> on_hold', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'completed' });

    const res = await request(app)
      .patch(`/v1/contracts/${CONTRACT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'on_hold' });

    expect(res.status).toBe(400);
  });

  it('should return same contract if already in target status', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'active' });

    const res = await request(app)
      .patch(`/v1/contracts/${CONTRACT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(mockContractUpdateStatus).not.toHaveBeenCalled();
  });
});

// ============================================
// DELETE /v1/contracts/:id — Soft Delete
// ============================================
describe('DELETE /v1/contracts/:id', () => {
  it('should soft delete draft contract', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'draft' });
    mockContractSoftDelete.mockResolvedValue(SAMPLE_CONTRACT);

    const res = await request(app)
      .delete(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Contract deleted');
  });

  it('should soft delete cancelled contract', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'cancelled' });
    mockContractSoftDelete.mockResolvedValue(SAMPLE_CONTRACT);

    const res = await request(app)
      .delete(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should block deletion of active contract', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'active' });

    const res = await request(app)
      .delete(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Cannot delete contract with status 'active'");
  });

  it('should block deletion of completed contract', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, status: 'completed' });

    const res = await request(app)
      .delete(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('should deny coordinator from deleting', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .delete(`/v1/contracts/${CONTRACT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Line Items CRUD
// ============================================
describe('GET /v1/contracts/:id/line-items', () => {
  it('should return line items for contract', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(SAMPLE_CONTRACT);
    mockContractGetLineItems.mockResolvedValue([SAMPLE_LINE_ITEM]);

    const res = await request(app)
      .get(`/v1/contracts/${CONTRACT_ID}/line-items`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].service_name).toBe('Weekly Lawn Mowing');
  });

  it('should return 404 for non-existent contract', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/contracts/${CONTRACT_ID}/line-items`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /v1/contracts/:id/line-items', () => {
  it('should add line item and recalculate value', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(SAMPLE_CONTRACT);
    mockContractAddLineItem.mockResolvedValue(SAMPLE_LINE_ITEM);
    mockContractGetLineItems.mockResolvedValue([SAMPLE_LINE_ITEM]);
    mockContractUpdate.mockResolvedValue(SAMPLE_CONTRACT);

    const res = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/line-items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        service_name: 'Weekly Lawn Mowing',
        unit_price: 150,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.service_name).toBe('Weekly Lawn Mowing');
    // Verify recalculation was triggered
    expect(mockContractUpdate).toHaveBeenCalled();
  });

  it('should reject without required fields', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/line-items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Missing service_name and unit_price' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /v1/contracts/line-items/:lineItemId', () => {
  it('should update line item', async () => {
    const token = await loginAs('owner');
    mockContractGetLineItemById.mockResolvedValue(SAMPLE_LINE_ITEM);
    mockContractUpdateLineItem.mockResolvedValue({
      ...SAMPLE_LINE_ITEM,
      unit_price: 200,
    });
    mockContractGetLineItems.mockResolvedValue([{ ...SAMPLE_LINE_ITEM, unit_price: 200 }]);
    mockContractUpdate.mockResolvedValue(SAMPLE_CONTRACT);

    const res = await request(app)
      .put(`/v1/contracts/line-items/${LINE_ITEM_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unit_price: 200 });

    expect(res.status).toBe(200);
    expect(res.body.data.unit_price).toBe(200);
  });

  it('should return 404 for non-existent line item', async () => {
    const token = await loginAs('owner');
    mockContractGetLineItemById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/contracts/line-items/${LINE_ITEM_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unit_price: 200 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /v1/contracts/line-items/:lineItemId', () => {
  it('should remove line item', async () => {
    const token = await loginAs('owner');
    mockContractGetLineItemById.mockResolvedValue(SAMPLE_LINE_ITEM);
    mockContractRemoveLineItem.mockResolvedValue(SAMPLE_LINE_ITEM);
    mockContractGetLineItems.mockResolvedValue([]);
    mockContractUpdate.mockResolvedValue(SAMPLE_CONTRACT);

    const res = await request(app)
      .delete(`/v1/contracts/line-items/${LINE_ITEM_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Line item removed');
  });
});

// ============================================
// GET /v1/contracts/stats — Stats
// ============================================
describe('GET /v1/contracts/stats', () => {
  it('should return stats for owner', async () => {
    const token = await loginAs('owner');
    mockContractGetStats.mockResolvedValue({
      byStatus: [
        { label: 'active', count: '8' },
        { label: 'draft', count: '3' },
      ],
      totalValueByType: [
        { label: 'maintenance', total_value: '45000' },
        { label: 'snow_removal', total_value: '12000' },
      ],
    });

    const res = await request(app)
      .get('/v1/contracts/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.byStatus).toHaveLength(2);
    expect(res.body.data.totalValueByType).toHaveLength(2);
  });

  it('should deny coordinator from viewing stats', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/contracts/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant isolation', () => {
  it('should scope queries to authenticated tenant', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockContractFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/contracts')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mockContractFindAll).toHaveBeenCalledWith(TENANT_A, expect.anything());
  });

  it('should not return contracts from another tenant', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockContractFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/contracts')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mockContractFindAll).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });

  it('should validate customer and property belong to tenant on create', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockContractCustomerExists.mockResolvedValue(true);
    mockContractPropertyBelongsToCustomer.mockResolvedValue(true);
    mockContractGenerateNumber.mockResolvedValue('SC-2026-0001');
    mockContractCreate.mockResolvedValue(SAMPLE_CONTRACT);

    await request(app)
      .post('/v1/contracts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        contract_type: 'maintenance',
        division: 'landscaping_maintenance',
        title: 'Test',
        start_date: '2026-04-01',
      });

    expect(mockContractCustomerExists).toHaveBeenCalledWith(TENANT_A, CUSTOMER_ID);
    expect(mockContractPropertyBelongsToCustomer).toHaveBeenCalledWith(TENANT_A, PROPERTY_ID, CUSTOMER_ID);
  });
});

// ============================================
// Role-Based Access Control
// ============================================
describe('Role-based access', () => {
  it('should allow div_mgr to list and view contracts', async () => {
    const token = await loginAs('div_mgr');
    mockContractFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/contracts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_leader from contract endpoints', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/contracts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny div_mgr from creating contracts', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post('/v1/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        contract_type: 'maintenance',
        division: 'landscaping_maintenance',
        title: 'Test',
        start_date: '2026-04-01',
      });

    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get('/v1/contracts');
    expect(res.status).toBe(401);
  });
});
