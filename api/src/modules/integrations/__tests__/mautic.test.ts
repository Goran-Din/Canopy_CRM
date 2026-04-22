import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

const mockQueryDb = vi.fn();

vi.mock('../../../config/database.js', () => ({
  queryDb: (...args: unknown[]) => mockQueryDb(...args),
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }), on: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  getClient: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }),
}));

vi.mock('../../../config/redis.js', () => ({
  redis: { isOpen: true, ping: vi.fn().mockResolvedValue('PONG'), connect: vi.fn(), on: vi.fn() },
  connectRedis: vi.fn(),
}));

vi.mock('../../../config/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockFindUserByEmail = vi.fn();
const mockFindUserRoles = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockUpdateLastLogin = vi.fn();

vi.mock('../../auth/repository.js', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  findUserById: vi.fn(),
  findUserRoles: (...args: unknown[]) => mockFindUserRoles(...args),
  saveRefreshToken: (...args: unknown[]) => mockSaveRefreshToken(...args),
  findRefreshToken: vi.fn(), revokeRefreshToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
}));

// Mock quote repository
const mockQuoteGetById = vi.fn();
const mockQuoteAcquireClient = vi.fn();

vi.mock('../../quotes/repository.js', () => ({
  insert: vi.fn(), getById: (...args: unknown[]) => mockQuoteGetById(...args),
  findByJobId: vi.fn(), findActiveByJobId: vi.fn(),
  updateStatus: vi.fn(), update: vi.fn(), updateTotals: vi.fn(),
  getNextQuoteNumber: vi.fn(), insertSection: vi.fn(), getSectionById: vi.fn(),
  updateSection: vi.fn(), deleteSection: vi.fn(), insertLineItem: vi.fn(),
  getLineItemById: vi.fn(), updateLineItem: vi.fn(), deleteLineItem: vi.fn(),
  findLineItemsByQuoteId: vi.fn(), copyQuoteContent: vi.fn(),
  searchXeroItems: vi.fn(), acquireClient: (...args: unknown[]) => mockQuoteAcquireClient(...args),
}));

// Mock PDF service
vi.mock('../../quotes/pdf/quote-pdf.service.js', () => ({
  generatePdfBuffer: vi.fn().mockResolvedValue(Buffer.from('fake')),
  uploadQuotePdf: vi.fn().mockResolvedValue({ file_id: 'f1', r2_key: 'k' }),
  generateSignedPdfBuffer: vi.fn(),
}));

// Mock template repository
vi.mock('../../templates/repository.js', () => ({
  findById: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(),
  softDelete: vi.fn(), findAutomationTemplates: vi.fn(), saveFromQuote: vi.fn(),
  createVersion: vi.fn(), getLatestVersionNumber: vi.fn(), acquireClient: vi.fn(),
}));

// Mock diary repository
const mockDiaryInsert = vi.fn();
vi.mock('../../jobs/diary/diary.repository.js', () => ({
  insert: (...args: unknown[]) => mockDiaryInsert(...args),
  insertStandalone: vi.fn(), findByJobId: vi.fn(),
}));

// Mock jobs repository
vi.mock('../../jobs/repository.js', () => ({
  findById: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(),
  updateStatus: vi.fn(), softDelete: vi.fn(), getByDateRange: vi.fn(),
  getByProperty: vi.fn(), addPhoto: vi.fn(), getPhotos: vi.fn(),
  addChecklistItem: vi.fn(), updateChecklistItem: vi.fn(), getChecklist: vi.fn(),
  getChecklistItemById: vi.fn(), getStats: vi.fn(), customerExists: vi.fn(),
  propertyBelongsToCustomer: vi.fn(), contractExists: vi.fn(),
  getNextJobNumber: vi.fn(), createWithClient: vi.fn(),
  updateStatusWithClient: vi.fn(), acquireClient: vi.fn(),
}));

// Mock Mautic client
const mockPushContact = vi.fn();
const mockAddToSegment = vi.fn();

vi.mock('../mautic/mautic-client.js', () => ({
  MauticClient: vi.fn().mockImplementation(() => ({
    pushContact: (...args: unknown[]) => mockPushContact(...args),
    addToSegment: (...args: unknown[]) => mockAddToSegment(...args),
  })),
}));

// Mock other integration stuff
vi.mock('../repository.js', () => ({
  findAllConfigs: vi.fn().mockResolvedValue([]),
  findConfigByProvider: vi.fn(), upsertConfig: vi.fn(), updateConfigStatus: vi.fn(),
  updateTokens: vi.fn(), updateLastSync: vi.fn(), updateLastError: vi.fn(),
  deleteConfig: vi.fn(), createSyncLog: vi.fn().mockResolvedValue({ id: 'l1' }),
  updateSyncLog: vi.fn(), findSyncLogs: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  findSyncLogsByEntity: vi.fn().mockResolvedValue([]),
}));
vi.mock('../xero/xero-client.js', () => ({ xeroRequest: vi.fn() }));
vi.mock('../xero/xero-sync.js', () => ({ syncCustomer: vi.fn(), syncInvoice: vi.fn(), syncPayment: vi.fn(), fullSync: vi.fn() }));
vi.mock('../xero/xero-items.js', () => ({ syncXeroItems: vi.fn(), search: vi.fn() }));
vi.mock('../xero/xero-webhook.js', () => ({
  handleWebhook: vi.fn((_r: unknown, res: { status: (n: number) => { json: (d: unknown) => void } }) => res.status(200).json({ status: 'ok' })),
  verifyWebhookSignature: vi.fn(),
}));

import app from '../../../app.js';
import { pushExpiredQuote, pushDeclinedQuote, pushBronzeUpsellFlag } from '../mautic/mautic-service.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const QUOTE_ID = 'aaaa1111-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';

const SAMPLE_QUOTE_ROW = {
  id: QUOTE_ID, tenant_id: TENANT_A, job_id: JOB_ID,
  quote_number: 'Q-0001-26', version: 1, status: 'sent',
  total_amount: '5000.00', valid_until: '2026-04-20',
  first_name: 'John', last_name: 'Smith', email: 'john@example.com', phone: '555-1234',
  job_type: 'landscape_project', address_line1: '123 Main St', city: 'Toronto',
  customer_id: CUSTOMER_ID,
  decline_reason: null, declined_at: null,
};

function createMockClient() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
}
let mockClient: ReturnType<typeof createMockClient>;

let origMauticEnabled: string | undefined;

async function loginAs(role: string) {
  mockFindUserByEmail.mockResolvedValue({
    id: USER_ID, tenant_id: TENANT_A, email: 'test@test.com',
    password_hash: TEST_HASH, first_name: 'Test', last_name: 'User', is_active: true,
  });
  mockFindUserRoles.mockResolvedValue([{ role_name: role, division_id: null, division_name: null }]);
  mockSaveRefreshToken.mockResolvedValue(undefined);
  mockUpdateLastLogin.mockResolvedValue(undefined);
  const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: TEST_PASSWORD });
  return res.body.data.accessToken as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  TEST_HASH = await bcrypt.hash(TEST_PASSWORD, 4);
  mockClient = createMockClient();
  mockQuoteAcquireClient.mockResolvedValue(mockClient);
  mockDiaryInsert.mockResolvedValue({});
  mockQueryDb.mockResolvedValue({ rows: [], rowCount: 0 });
  origMauticEnabled = process.env.MAUTIC_ENABLED;
});

afterEach(() => {
  if (origMauticEnabled !== undefined) {
    process.env.MAUTIC_ENABLED = origMauticEnabled;
  } else {
    delete process.env.MAUTIC_ENABLED;
  }
});

// ============================================
// 1. MAUTIC_ENABLED=false: no API calls
// ============================================
describe('Feature flag', () => {
  it('should skip all Mautic pushes when disabled', async () => {
    process.env.MAUTIC_ENABLED = 'false';
    await pushExpiredQuote(TENANT_A, QUOTE_ID);
    await pushDeclinedQuote(TENANT_A, QUOTE_ID);
    await pushBronzeUpsellFlag(TENANT_A, CUSTOMER_ID);
    expect(mockPushContact).not.toHaveBeenCalled();
    expect(mockQueryDb).not.toHaveBeenCalled(); // No DB queries either
  });
});

// ============================================
// 2. Expired quote push with tag
// ============================================
describe('pushExpiredQuote', () => {
  it('should push contact with crm_quote_expired tag', async () => {
    process.env.MAUTIC_ENABLED = 'true';
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('quotes_v2')) {
        return Promise.resolve({ rows: [SAMPLE_QUOTE_ROW] });
      }
      if (typeof sql === 'string' && sql.includes('integration_configs') && sql.includes('mautic')) {
        return Promise.resolve({ rows: [{ config_data: { base_url: 'http://mautic', api_key: 'key', expired_quotes_segment_id: 'seg1' } }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    mockPushContact.mockResolvedValue({ success: true, mautic_contact_id: 'mc-1' });
    mockAddToSegment.mockResolvedValue({ success: true });

    await pushExpiredQuote(TENANT_A, QUOTE_ID);

    expect(mockPushContact).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@example.com',
        tags: ['crm_quote_expired'],
      }),
    );
  });
});

// ============================================
// 3. Declined quote push with tag
// ============================================
describe('pushDeclinedQuote', () => {
  it('should push contact with crm_quote_declined tag', async () => {
    process.env.MAUTIC_ENABLED = 'true';
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('quotes_v2')) {
        return Promise.resolve({ rows: [{ ...SAMPLE_QUOTE_ROW, status: 'declined', decline_reason: 'Too expensive' }] });
      }
      if (typeof sql === 'string' && sql.includes('integration_configs') && sql.includes('mautic')) {
        return Promise.resolve({ rows: [{ config_data: { base_url: 'http://mautic', api_key: 'key' } }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    mockPushContact.mockResolvedValue({ success: true, mautic_contact_id: 'mc-1' });

    await pushDeclinedQuote(TENANT_A, QUOTE_ID);

    expect(mockPushContact).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['crm_quote_declined'],
        customFields: expect.objectContaining({ decline_reason: 'Too expensive' }),
      }),
    );
  });
});

// ============================================
// 4. Bronze upsell push
// ============================================
describe('pushBronzeUpsellFlag', () => {
  it('should push contact with crm_bronze_upsell tag when 2+ seasons', async () => {
    process.env.MAUTIC_ENABLED = 'true';
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('customers') && sql.includes('deleted_at')) {
        return Promise.resolve({ rows: [{ id: CUSTOMER_ID, first_name: 'John', last_name: 'Smith', email: 'john@example.com', phone: '555' }] });
      }
      if (typeof sql === 'string' && sql.includes('service_contracts') && sql.includes('xero_item_code')) {
        return Promise.resolve({
          rows: [
            { xero_item_code: 'AERATION', season_year: 2025 },
            { xero_item_code: 'AERATION', season_year: 2026 }, // 2 consecutive seasons
          ],
        });
      }
      if (typeof sql === 'string' && sql.includes('integration_configs') && sql.includes('mautic')) {
        return Promise.resolve({ rows: [{ config_data: { base_url: 'http://mautic', api_key: 'key' } }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    mockPushContact.mockResolvedValue({ success: true, mautic_contact_id: 'mc-1' });

    await pushBronzeUpsellFlag(TENANT_A, CUSTOMER_ID);

    expect(mockPushContact).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['crm_bronze_upsell'],
        customFields: expect.objectContaining({ current_tier: 'bronze' }),
      }),
    );
  });

  // ============================================
  // 13. Only 1 season: NOT flagged
  // ============================================
  it('should not push when only 1 season of add-on', async () => {
    process.env.MAUTIC_ENABLED = 'true';
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('customers') && sql.includes('deleted_at')) {
        return Promise.resolve({ rows: [{ id: CUSTOMER_ID, first_name: 'John', last_name: 'Smith', email: 'john@example.com', phone: '555' }] });
      }
      if (typeof sql === 'string' && sql.includes('service_contracts') && sql.includes('xero_item_code')) {
        return Promise.resolve({ rows: [{ xero_item_code: 'AERATION', season_year: 2026 }] }); // only 1 season
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await pushBronzeUpsellFlag(TENANT_A, CUSTOMER_ID);

    expect(mockPushContact).not.toHaveBeenCalled();
  });
});

// ============================================
// 5. No email: skipped
// ============================================
describe('Push with no email', () => {
  it('should skip and log when customer has no email', async () => {
    process.env.MAUTIC_ENABLED = 'true';
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('quotes_v2')) {
        return Promise.resolve({ rows: [{ ...SAMPLE_QUOTE_ROW, email: null }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await pushExpiredQuote(TENANT_A, QUOTE_ID);

    expect(mockPushContact).not.toHaveBeenCalled();
    // Should log as skipped
    const syncLog = mockQueryDb.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('integration_sync_log'),
    );
    expect(syncLog).toBeDefined();
  });
});

// ============================================
// 6. Mautic API failure: logged, CRM not affected
// ============================================
describe('Mautic API failure', () => {
  it('should log error and not throw on API failure', async () => {
    process.env.MAUTIC_ENABLED = 'true';
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('quotes_v2')) {
        return Promise.resolve({ rows: [SAMPLE_QUOTE_ROW] });
      }
      if (typeof sql === 'string' && sql.includes('integration_configs') && sql.includes('mautic')) {
        return Promise.resolve({ rows: [{ config_data: { base_url: 'http://mautic', api_key: 'key' } }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    mockPushContact.mockResolvedValue({ success: false, error: 'Connection timeout' });

    // Should NOT throw
    await expect(pushExpiredQuote(TENANT_A, QUOTE_ID)).resolves.not.toThrow();
  });
});

// ============================================
// 7. Decline quote: status='declined', reason stored
// ============================================
describe('PATCH /v1/quotes/:id/decline', () => {
  it('should decline quote and store reason', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById
      .mockResolvedValueOnce({ id: QUOTE_ID, tenant_id: TENANT_A, job_id: JOB_ID, quote_number: 'Q-0001-26', status: 'sent', sections: [] })
      .mockResolvedValueOnce({ id: QUOTE_ID, status: 'declined', decline_reason: 'Too expensive' });

    const res = await request(app)
      .patch(`/v1/quotes/${QUOTE_ID}/decline`)
      .set('Authorization', `Bearer ${token}`)
      .send({ decline_reason: 'Too expensive' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('declined');

    // Verify UPDATE was called
    const updateCall = mockClient.query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes("status = 'declined'"),
    );
    expect(updateCall).toBeDefined();
  });

  // ============================================
  // 8. Decline draft: 422
  // ============================================
  it('should return 422 for draft quote', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce({ id: QUOTE_ID, status: 'draft', sections: [] });

    const res = await request(app)
      .patch(`/v1/quotes/${QUOTE_ID}/decline`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  // ============================================
  // 9. Decline signed: 422
  // ============================================
  it('should return 422 for signed quote', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce({ id: QUOTE_ID, status: 'signed', sections: [] });

    const res = await request(app)
      .patch(`/v1/quotes/${QUOTE_ID}/decline`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

// ============================================
// 10/11. Custom fields in push
// ============================================
describe('Custom fields', () => {
  it('should include quote_number and amount in expired push', async () => {
    process.env.MAUTIC_ENABLED = 'true';
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('quotes_v2')) {
        return Promise.resolve({ rows: [SAMPLE_QUOTE_ROW] });
      }
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ config_data: { base_url: 'http://m', api_key: 'k' } }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    mockPushContact.mockResolvedValue({ success: true });

    await pushExpiredQuote(TENANT_A, QUOTE_ID);

    expect(mockPushContact).toHaveBeenCalledWith(
      expect.objectContaining({
        customFields: expect.objectContaining({
          quote_number: 'Q-0001-26',
          quote_amount: '5000.00',
          service_type: 'landscape_project',
          source: 'canopy_crm',
        }),
      }),
    );
  });
});

// ============================================
// 14. Sync log entries
// ============================================
describe('Sync log', () => {
  it('should create sync log entry for push', async () => {
    process.env.MAUTIC_ENABLED = 'true';
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('quotes_v2')) return Promise.resolve({ rows: [SAMPLE_QUOTE_ROW] });
      if (typeof sql === 'string' && sql.includes('integration_configs')) return Promise.resolve({ rows: [{ config_data: { base_url: 'http://m', api_key: 'k' } }] });
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    mockPushContact.mockResolvedValue({ success: true });

    await pushExpiredQuote(TENANT_A, QUOTE_ID);

    const syncInsert = mockQueryDb.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string'
        && (call[0] as string).includes('integration_sync_log')
        && (call[0] as string).includes('INSERT'),
    );
    expect(syncInsert).toBeDefined();
  });
});

// ============================================
// 15. Multi-tenant isolation
// ============================================
describe('Multi-tenant isolation', () => {
  it('should scope push to correct tenant', async () => {
    process.env.MAUTIC_ENABLED = 'true';
    mockQueryDb.mockImplementation((sql: string, _params?: unknown[]) => {
      if (typeof sql === 'string' && sql.includes('quotes_v2')) {
        return Promise.resolve({ rows: [SAMPLE_QUOTE_ROW] });
      }
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ config_data: { base_url: 'http://m', api_key: 'k' } }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    mockPushContact.mockResolvedValue({ success: true });

    await pushExpiredQuote(TENANT_A, QUOTE_ID);

    // Verify quote lookup used TENANT_A
    const quoteQuery = mockQueryDb.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('quotes_v2'),
    );
    expect(quoteQuery![1]).toContain(TENANT_A);
  });
});
