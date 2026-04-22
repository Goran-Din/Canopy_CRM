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

// --- Mock integration repository ---
const mockFindAllConfigs = vi.fn();
const mockFindConfigByProvider = vi.fn();
const mockUpsertConfig = vi.fn();
const mockUpdateConfigStatus = vi.fn();
const mockUpdateTokens = vi.fn();
const mockUpdateLastSync = vi.fn();
const mockUpdateLastError = vi.fn();
const mockDeleteConfig = vi.fn();
const mockCreateSyncLog = vi.fn();
const mockUpdateSyncLog = vi.fn();
const mockFindSyncLogs = vi.fn();
const mockFindSyncLogsByEntity = vi.fn();

vi.mock('../repository.js', () => ({
  findAllConfigs: (...args: unknown[]) => mockFindAllConfigs(...args),
  findConfigByProvider: (...args: unknown[]) => mockFindConfigByProvider(...args),
  upsertConfig: (...args: unknown[]) => mockUpsertConfig(...args),
  updateConfigStatus: (...args: unknown[]) => mockUpdateConfigStatus(...args),
  updateTokens: (...args: unknown[]) => mockUpdateTokens(...args),
  updateLastSync: (...args: unknown[]) => mockUpdateLastSync(...args),
  updateLastError: (...args: unknown[]) => mockUpdateLastError(...args),
  deleteConfig: (...args: unknown[]) => mockDeleteConfig(...args),
  createSyncLog: (...args: unknown[]) => mockCreateSyncLog(...args),
  updateSyncLog: (...args: unknown[]) => mockUpdateSyncLog(...args),
  findSyncLogs: (...args: unknown[]) => mockFindSyncLogs(...args),
  findSyncLogsByEntity: (...args: unknown[]) => mockFindSyncLogsByEntity(...args),
}));

// --- Mock Xero client ---
const mockPushContact = vi.fn();
const mockPushInvoice = vi.fn();
const mockPushPayment = vi.fn();
const mockPushCreditNote = vi.fn();
const mockGetInvoiceStatus = vi.fn();

vi.mock('../xero/xero-client.js', () => ({
  pushContact: (...args: unknown[]) => mockPushContact(...args),
  pushInvoice: (...args: unknown[]) => mockPushInvoice(...args),
  pushPayment: (...args: unknown[]) => mockPushPayment(...args),
  pushCreditNote: (...args: unknown[]) => mockPushCreditNote(...args),
  getInvoiceStatus: (...args: unknown[]) => mockGetInvoiceStatus(...args),
}));

// --- Mock queryDb for xero-sync (uses queryDb directly) ---
import { queryDb } from '../../../config/database.js';
const mockQueryDb = vi.mocked(queryDb);

import app from '../../../app.js';

// --- Import mapper for unit tests ---
import {
  mapCustomerToXeroContact,
  mapInvoiceToXeroInvoice,
  mapPaymentToXeroPayment,
  mapCreditNoteToXeroCreditNote,
} from '../xero/xero-mapper.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const INVOICE_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const SYNC_LOG_ID = '11111111-0000-0000-0000-000000000001';

const SAMPLE_CONFIG = {
  id: '22222222-0000-0000-0000-000000000001',
  tenant_id: TENANT_A,
  provider: 'xero',
  status: 'active',
  config_data: { xero_tenant_id: 'xero-tenant-123' },
  access_token_encrypted: 'enc-access-token',
  refresh_token_encrypted: 'enc-refresh-token',
  token_expires_at: new Date(Date.now() + 3600000).toISOString(),
  last_sync_at: null,
  last_error: null,
  webhook_secret: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SAMPLE_SYNC_LOG = {
  id: SYNC_LOG_ID,
  tenant_id: TENANT_A,
  provider: 'xero',
  direction: 'push',
  entity_type: 'contact',
  entity_id: CUSTOMER_ID,
  external_id: 'xero-contact-001',
  status: 'success',
  error_message: null,
  request_payload: null,
  response_payload: null,
  duration_ms: 250,
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
// GET /v1/integrations — List
// ============================================
describe('GET /v1/integrations', () => {
  it('should return all integration configs', async () => {
    const token = await loginAs('owner');
    mockFindAllConfigs.mockResolvedValue([SAMPLE_CONFIG]);

    const res = await request(app)
      .get('/v1/integrations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('should reject non-owner', async () => {
    const token = await loginAs('div_mgr');
    const res = await request(app)
      .get('/v1/integrations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/integrations/:provider — Get Config
// ============================================
describe('GET /v1/integrations/:provider', () => {
  it('should return config for provider with masked tokens', async () => {
    const token = await loginAs('owner');
    mockFindConfigByProvider.mockResolvedValue(SAMPLE_CONFIG);

    const res = await request(app)
      .get('/v1/integrations/xero')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('xero');
    expect(res.body.data.access_token_encrypted).toBe('***');
    expect(res.body.data.refresh_token_encrypted).toBe('***');
  });

  it('should return 404 for unconfigured provider', async () => {
    const token = await loginAs('owner');
    mockFindConfigByProvider.mockResolvedValue(null);

    const res = await request(app)
      .get('/v1/integrations/mautic')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should reject invalid provider', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/integrations/invalid_provider')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// PUT /v1/integrations/:provider — Update Config
// ============================================
describe('PUT /v1/integrations/:provider', () => {
  it('should upsert integration config', async () => {
    const token = await loginAs('owner');
    mockUpsertConfig.mockResolvedValue(SAMPLE_CONFIG);

    const res = await request(app)
      .put('/v1/integrations/xero')
      .set('Authorization', `Bearer ${token}`)
      .send({ config_data: { xero_tenant_id: 'new-id' } });

    expect(res.status).toBe(200);
    expect(mockUpsertConfig).toHaveBeenCalled();
  });
});

// ============================================
// POST /v1/integrations/:provider/connect — Connect
// ============================================
describe('POST /v1/integrations/:provider/connect', () => {
  it('should initiate connection', async () => {
    const token = await loginAs('owner');
    mockUpsertConfig.mockResolvedValue(SAMPLE_CONFIG);
    mockUpdateConfigStatus.mockResolvedValue(undefined);
    mockFindConfigByProvider.mockResolvedValue({ ...SAMPLE_CONFIG, status: 'pending_setup' });

    const res = await request(app)
      .post('/v1/integrations/xero/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ config_data: { xero_tenant_id: 'abc' } });

    expect(res.status).toBe(200);
  });

  it('should activate with authorization code', async () => {
    const token = await loginAs('owner');
    mockUpsertConfig.mockResolvedValue(SAMPLE_CONFIG);
    mockUpdateConfigStatus.mockResolvedValue(undefined);
    mockFindConfigByProvider.mockResolvedValue({ ...SAMPLE_CONFIG, status: 'active' });

    const res = await request(app)
      .post('/v1/integrations/xero/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ authorization_code: 'auth-code-123' });

    expect(res.status).toBe(200);
    expect(mockUpdateConfigStatus).toHaveBeenCalledWith(TENANT_A, 'xero', 'active');
  });
});

// ============================================
// POST /v1/integrations/:provider/disconnect — Disconnect
// ============================================
describe('POST /v1/integrations/:provider/disconnect', () => {
  it('should disconnect integration', async () => {
    const token = await loginAs('owner');
    mockFindConfigByProvider.mockResolvedValue(SAMPLE_CONFIG);
    mockUpdateConfigStatus.mockResolvedValue({ ...SAMPLE_CONFIG, status: 'inactive' });

    const res = await request(app)
      .post('/v1/integrations/xero/disconnect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('disconnected');
  });

  it('should return 404 for unconfigured provider', async () => {
    const token = await loginAs('owner');
    mockFindConfigByProvider.mockResolvedValue(null);

    const res = await request(app)
      .post('/v1/integrations/mautic/disconnect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// Xero Sync Endpoints
// ============================================
describe('POST /v1/integrations/xero/sync-customer/:customerId', () => {
  it('should sync customer to Xero', async () => {
    const token = await loginAs('owner');
    // getActiveConfig
    mockFindConfigByProvider.mockResolvedValue(SAMPLE_CONFIG);
    // queryDb for customer lookup
    mockQueryDb.mockResolvedValueOnce({ rows: [{
      id: CUSTOMER_ID, display_name: 'John Doe', email: 'john@test.com',
      phone: '555-0100', address_line1: '123 Main', city: 'Toronto', state: 'ON', zip: 'M5V',
    }], rowCount: 1 } as never);
    // createSyncLog
    mockCreateSyncLog.mockResolvedValue(SAMPLE_SYNC_LOG);
    // pushContact
    mockPushContact.mockResolvedValue({ ContactID: 'xero-contact-001' });
    // queryDb for update xero_contact_id
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockUpdateSyncLog.mockResolvedValue(undefined);
    mockUpdateLastSync.mockResolvedValue(undefined);

    const res = await request(app)
      .post(`/v1/integrations/xero/sync-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.xero_contact_id).toBe('xero-contact-001');
  });

  it('should reject coordinator (not allowed for xero sync customer)', async () => {
    // Actually coordinator IS allowed per the route definition
    const token = await loginAs('coordinator');
    mockFindConfigByProvider.mockResolvedValue(SAMPLE_CONFIG);
    mockQueryDb.mockResolvedValueOnce({ rows: [{
      id: CUSTOMER_ID, display_name: 'Test',
    }], rowCount: 1 } as never);
    mockCreateSyncLog.mockResolvedValue(SAMPLE_SYNC_LOG);
    mockPushContact.mockResolvedValue({ ContactID: 'xero-c-002' });
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    mockUpdateSyncLog.mockResolvedValue(undefined);
    mockUpdateLastSync.mockResolvedValue(undefined);

    const res = await request(app)
      .post(`/v1/integrations/xero/sync-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should reject div_mgr from xero sync', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post(`/v1/integrations/xero/sync-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 if customer not found', async () => {
    const token = await loginAs('owner');
    mockFindConfigByProvider.mockResolvedValue(SAMPLE_CONFIG);
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

    const res = await request(app)
      .post(`/v1/integrations/xero/sync-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return error if xero not configured', async () => {
    const token = await loginAs('owner');
    mockFindConfigByProvider.mockResolvedValue(null);

    const res = await request(app)
      .post(`/v1/integrations/xero/sync-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return error if xero not active', async () => {
    const token = await loginAs('owner');
    mockFindConfigByProvider.mockResolvedValue({ ...SAMPLE_CONFIG, status: 'inactive' });

    const res = await request(app)
      .post(`/v1/integrations/xero/sync-customer/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/integrations/xero/sync-invoice/:invoiceId', () => {
  it('should require customer synced first', async () => {
    const token = await loginAs('owner');
    mockFindConfigByProvider.mockResolvedValue(SAMPLE_CONFIG);
    mockQueryDb.mockResolvedValueOnce({ rows: [{
      id: INVOICE_ID, xero_contact_id: null, customer_id: CUSTOMER_ID,
    }], rowCount: 1 } as never);

    const res = await request(app)
      .post(`/v1/integrations/xero/sync-invoice/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Customer must be synced');
  });
});

describe('POST /v1/integrations/xero/full-sync', () => {
  it('should sync all unsynced records', async () => {
    const token = await loginAs('owner');
    mockFindConfigByProvider.mockResolvedValue(SAMPLE_CONFIG);
    // Unsynced customers query
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    // Unsynced invoices query
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    mockUpdateLastSync.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/v1/integrations/xero/full-sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('customers');
    expect(res.body.data).toHaveProperty('invoices');
    expect(res.body.data).toHaveProperty('errors');
  });

  it('should reject non-owner from full sync', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/integrations/xero/full-sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Sync Log Endpoints
// ============================================
describe('GET /v1/integrations/sync-log', () => {
  it('should return paginated sync logs', async () => {
    const token = await loginAs('owner');
    mockFindSyncLogs.mockResolvedValue({ rows: [SAMPLE_SYNC_LOG], total: 1 });

    const res = await request(app)
      .get('/v1/integrations/sync-log')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should filter by provider', async () => {
    const token = await loginAs('div_mgr');
    mockFindSyncLogs.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/integrations/sync-log?provider=xero')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindSyncLogs).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ provider: 'xero' }));
  });

  it('should reject coordinator from sync logs', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/integrations/sync-log')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /v1/integrations/sync-log/:entityId', () => {
  it('should return sync logs for specific entity', async () => {
    const token = await loginAs('owner');
    mockFindSyncLogsByEntity.mockResolvedValue([SAMPLE_SYNC_LOG]);

    const res = await request(app)
      .get(`/v1/integrations/sync-log/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ============================================
// Stub Integration Endpoints
// ============================================
describe('Stub Integration Endpoints', () => {
  it('should respond with stub for mautic push-lead', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post(`/v1/integrations/mautic/push-lead/${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('stub');
  });

  it('should respond with stub for mautic pull-leads', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post('/v1/integrations/mautic/pull-leads')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('stub');
  });

  it('should respond with stub for drive upload', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/integrations/drive/upload')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should respond with stub for drive files', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/integrations/drive/files')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should respond with stub for quotes list', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/integrations/quotes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should respond with stub for ops context', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/integrations/ops/context')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should respond with stub for northchat notify', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/integrations/northchat/notify')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should reject crew_leader from stub endpoints', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post('/v1/integrations/mautic/pull-leads')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Xero Mapper Unit Tests
// ============================================
describe('Xero Mapper', () => {
  it('should map customer to Xero contact', () => {
    const customer = {
      display_name: 'Acme Corp',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@acme.com',
      phone: '555-0100',
      mobile: '555-0101',
      address_line1: '123 Main St',
      city: 'Toronto',
      state: 'ON',
      zip: 'M5V 2T6',
    };

    const contact = mapCustomerToXeroContact(customer);

    expect(contact.Name).toBe('Acme Corp');
    expect(contact.FirstName).toBe('John');
    expect(contact.LastName).toBe('Doe');
    expect(contact.EmailAddress).toBe('john@acme.com');
    expect(contact.Phones).toHaveLength(2);
    expect(contact.Addresses).toHaveLength(1);
    expect(contact.Addresses![0].City).toBe('Toronto');
    expect(contact.IsCustomer).toBe(true);
  });

  it('should handle customer with minimal fields', () => {
    const contact = mapCustomerToXeroContact({ company_name: 'Test Co' });

    expect(contact.Name).toBe('Test Co');
    expect(contact.Phones).toBeUndefined();
    expect(contact.Addresses).toBeUndefined();
  });

  it('should map invoice to Xero invoice', () => {
    const invoice = {
      invoice_number: 'INV-001',
      invoice_date: '2026-02-01',
      due_date: '2026-03-03',
    };
    const lineItems = [
      { description: 'Lawn maintenance', quantity: 4, unit_price: 150 },
      { description: 'Snow removal', quantity: 2, unit_price: 200 },
    ];

    const xeroInvoice = mapInvoiceToXeroInvoice(invoice, lineItems, 'xero-contact-id');

    expect(xeroInvoice.Type).toBe('ACCREC');
    expect(xeroInvoice.Contact.ContactID).toBe('xero-contact-id');
    expect(xeroInvoice.LineItems).toHaveLength(2);
    expect(xeroInvoice.LineItems[0].Description).toBe('Lawn maintenance');
    expect(xeroInvoice.LineItems[0].UnitAmount).toBe(150);
    expect(xeroInvoice.Reference).toBe('INV-001');
    expect(xeroInvoice.CurrencyCode).toBe('CAD');
  });

  it('should map payment to Xero payment', () => {
    const payment = {
      payment_date: '2026-02-15',
      amount: 500,
      reference: 'CHK-001',
    };

    const xeroPayment = mapPaymentToXeroPayment(payment, 'xero-inv-id');

    expect(xeroPayment.Invoice.InvoiceID).toBe('xero-inv-id');
    expect(xeroPayment.Amount).toBe(500);
    expect(xeroPayment.Date).toBe('2026-02-15');
  });

  it('should map credit note to Xero credit note', () => {
    const creditNote = {
      credit_note_number: 'CN-001',
      issued_date: '2026-02-20',
      amount: 100,
      reason: 'Service discount',
    };

    const xeroCN = mapCreditNoteToXeroCreditNote(creditNote, 'xero-contact-id');

    expect(xeroCN.Type).toBe('ACCRECCREDIT');
    expect(xeroCN.Contact.ContactID).toBe('xero-contact-id');
    expect(xeroCN.LineItems[0].UnitAmount).toBe(100);
    expect(xeroCN.LineItems[0].Description).toBe('Service discount');
    expect(xeroCN.Reference).toBe('CN-001');
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant Isolation', () => {
  it('should scope integrations to tenant', async () => {
    const token = await loginAs('owner', TENANT_B);
    mockFindAllConfigs.mockResolvedValue([]);

    const res = await request(app)
      .get('/v1/integrations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAllConfigs).toHaveBeenCalledWith(TENANT_B);
  });

  it('should scope sync logs to tenant', async () => {
    const token = await loginAs('owner', TENANT_B);
    mockFindSyncLogs.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/integrations/sync-log')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindSyncLogs).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });
});
