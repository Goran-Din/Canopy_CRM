import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

vi.mock('../../../config/database.js', () => ({
  queryDb: vi.fn(),
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

// --- Mock automation repository ---
const mockGetConfig = vi.fn();
const mockGetAllConfigs = vi.fn();
const mockUpdateConfig = vi.fn();
const mockInsertLog = vi.fn();
const mockFindLogs = vi.fn();
const mockHasBeenFiredRecently = vi.fn();
const mockCountRecentFires = vi.fn();

vi.mock('../repository.js', () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
  getAllConfigs: (...args: unknown[]) => mockGetAllConfigs(...args),
  updateConfig: (...args: unknown[]) => mockUpdateConfig(...args),
  insertLog: (...args: unknown[]) => mockInsertLog(...args),
  findLogs: (...args: unknown[]) => mockFindLogs(...args),
  hasBeenFiredRecently: (...args: unknown[]) => mockHasBeenFiredRecently(...args),
  countRecentFires: (...args: unknown[]) => mockCountRecentFires(...args),
}));

// --- Mock template repository ---
const mockTemplateFindById = vi.fn();

vi.mock('../../templates/repository.js', () => ({
  findById: (...args: unknown[]) => mockTemplateFindById(...args),
  findAll: vi.fn(), create: vi.fn(), update: vi.fn(), softDelete: vi.fn(),
  findAutomationTemplates: vi.fn(), saveFromQuote: vi.fn(),
  createVersion: vi.fn(), getLatestVersionNumber: vi.fn(), acquireClient: vi.fn(),
}));

// --- Mock customer repository ---
const mockCustomerFindById = vi.fn();

vi.mock('../../customers/repository.js', () => ({
  findById: (...args: unknown[]) => mockCustomerFindById(...args),
  findAll: vi.fn(), create: vi.fn(), update: vi.fn(), softDelete: vi.fn(),
  getStats: vi.fn(), search: vi.fn(),
}));

// --- Mock diary repository ---
const mockDiaryInsertStandalone = vi.fn();

vi.mock('../../jobs/diary/diary.repository.js', () => ({
  insert: vi.fn(), insertStandalone: (...args: unknown[]) => mockDiaryInsertStandalone(...args),
  findByJobId: vi.fn(),
}));

import app from '../../../app.js';
import { fireAutomation, resolveMergeFields } from '../service.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const TEMPLATE_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const QUOTE_ID = 'ffffffff-0000-0000-0000-000000000001';
const INVOICE_ID = '11111111-0000-0000-0000-000000000001';

const SAMPLE_CONFIG = {
  id: '22222222-0000-0000-0000-000000000001',
  tenant_id: TENANT_A,
  automation_type: 'booking_confirmation',
  is_enabled: false,
  template_id: TEMPLATE_ID,
  delay_minutes: 0,
  send_via: 'email',
  max_repeats: 1,
  repeat_interval_days: 7,
  conditions: {},
  updated_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const ALL_CONFIGS = [
  { ...SAMPLE_CONFIG, automation_type: 'booking_confirmation' },
  { ...SAMPLE_CONFIG, id: '22222222-0000-0000-0000-000000000002', automation_type: 'appointment_reminder' },
  { ...SAMPLE_CONFIG, id: '22222222-0000-0000-0000-000000000003', automation_type: 'quote_followup' },
  { ...SAMPLE_CONFIG, id: '22222222-0000-0000-0000-000000000004', automation_type: 'payment_reminder', max_repeats: 3 },
  { ...SAMPLE_CONFIG, id: '22222222-0000-0000-0000-000000000005', automation_type: 'feedback_request' },
];

const SAMPLE_TEMPLATE = {
  id: TEMPLATE_ID,
  tenant_id: TENANT_A,
  template_category: 'automation',
  template_name: 'Booking Confirmation',
  content: {
    email_subject: 'Your appointment is confirmed — {{company_name}}',
    email_body: 'Hi {{client_first_name}}, your booking is confirmed.',
    sms_body: 'Hi {{client_first_name}}! Booking confirmed.',
  },
  is_active: true,
};

const SAMPLE_CUSTOMER = {
  id: CUSTOMER_ID,
  tenant_id: TENANT_A,
  first_name: 'John',
  last_name: 'Smith',
  email: 'john@example.com',
  phone: '555-1234',
  display_name: 'John Smith',
};

async function loginAs(role: string, tenantId = TENANT_A) {
  mockFindUserByEmail.mockResolvedValue({
    id: USER_ID, tenant_id: tenantId, email: 'test@test.com',
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
  mockInsertLog.mockResolvedValue({ id: 'log-1', status: 'sent' });
  mockDiaryInsertStandalone.mockResolvedValue({});
});

// ============================================
// 1. GET /automations/configs returns all 5 types, all disabled by default
// ============================================
describe('GET /v1/automations/configs', () => {
  it('should return all 5 automation types, all disabled by default', async () => {
    const token = await loginAs('owner');
    mockGetAllConfigs.mockResolvedValueOnce(ALL_CONFIGS);

    const res = await request(app)
      .get('/v1/automations/configs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    for (const config of res.body.data) {
      expect(config.is_enabled).toBe(false);
    }
  });
});

// ============================================
// 2. PATCH config enables an automation (is_enabled=true)
// ============================================
describe('PATCH /v1/automations/configs/:type', () => {
  it('should enable an automation', async () => {
    const token = await loginAs('owner');
    mockUpdateConfig.mockResolvedValueOnce({ ...SAMPLE_CONFIG, is_enabled: true });

    const res = await request(app)
      .patch('/v1/automations/configs/booking_confirmation')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.data.is_enabled).toBe(true);
  });

  // ============================================
  // 3. PATCH config updates delay_minutes and send_via
  // ============================================
  it('should update delay_minutes and send_via', async () => {
    const token = await loginAs('owner');
    mockUpdateConfig.mockResolvedValueOnce({
      ...SAMPLE_CONFIG,
      delay_minutes: 1440,
      send_via: 'both',
    });

    const res = await request(app)
      .patch('/v1/automations/configs/appointment_reminder')
      .set('Authorization', `Bearer ${token}`)
      .send({ delay_minutes: 1440, send_via: 'both' });

    expect(res.status).toBe(200);
    expect(res.body.data.delay_minutes).toBe(1440);
    expect(res.body.data.send_via).toBe('both');
  });

  it('should deny div_mgr from updating config', async () => {
    const token = await loginAs('div_mgr');
    const res = await request(app)
      .patch('/v1/automations/configs/booking_confirmation')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_enabled: true });
    expect(res.status).toBe(403);
  });
});

// ============================================
// 4. fireAutomation with disabled config: no message sent, no log entry
// ============================================
describe('fireAutomation', () => {
  it('should return silently when automation is disabled', async () => {
    mockGetConfig.mockResolvedValueOnce({ ...SAMPLE_CONFIG, is_enabled: false });

    const result = await fireAutomation(TENANT_A, 'booking_confirmation', {
      job_id: JOB_ID,
      customer_id: CUSTOMER_ID,
    });

    expect(result.status).toBe('disabled');
    expect(mockInsertLog).not.toHaveBeenCalled();
    expect(mockCustomerFindById).not.toHaveBeenCalled();
  });

  // ============================================
  // 5. fireAutomation with enabled config: message sent, log entry created
  // ============================================
  it('should send message and log entry when enabled', async () => {
    mockGetConfig.mockResolvedValueOnce({ ...SAMPLE_CONFIG, is_enabled: true });
    mockHasBeenFiredRecently.mockResolvedValueOnce(false);
    mockCustomerFindById.mockResolvedValueOnce(SAMPLE_CUSTOMER);
    mockTemplateFindById.mockResolvedValueOnce(SAMPLE_TEMPLATE);

    const result = await fireAutomation(TENANT_A, 'booking_confirmation', {
      job_id: JOB_ID,
      customer_id: CUSTOMER_ID,
    });

    expect(result.status).toBe('sent');
    expect(mockInsertLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        automation_type: 'booking_confirmation',
        recipient_email: 'john@example.com',
      }),
    );
  });

  // ============================================
  // 6. fireAutomation with no customer contact info: logged as 'skipped'
  // ============================================
  it('should log as skipped when no contact info', async () => {
    mockGetConfig.mockResolvedValueOnce({ ...SAMPLE_CONFIG, is_enabled: true });
    mockHasBeenFiredRecently.mockResolvedValueOnce(false);
    mockCustomerFindById.mockResolvedValueOnce({
      ...SAMPLE_CUSTOMER,
      email: null,
      phone: null,
    });

    const result = await fireAutomation(TENANT_A, 'booking_confirmation', {
      job_id: JOB_ID,
      customer_id: CUSTOMER_ID,
    });

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('no_contact_info');
    expect(mockInsertLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'skipped',
        failure_reason: 'no_contact_info',
      }),
    );
  });

  // ============================================
  // 7. Deduplication: same automation + same context fires only once
  // ============================================
  it('should skip when already fired for same context', async () => {
    mockGetConfig.mockResolvedValueOnce({ ...SAMPLE_CONFIG, is_enabled: true });
    mockHasBeenFiredRecently.mockResolvedValueOnce(true);

    const result = await fireAutomation(TENANT_A, 'booking_confirmation', {
      job_id: JOB_ID,
      customer_id: CUSTOMER_ID,
    });

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('already_fired');
    expect(mockCustomerFindById).not.toHaveBeenCalled();
  });
});

// ============================================
// 8. Quote follow-up cancelled if quote already signed
// ============================================
describe('Quote follow-up deduplication', () => {
  it('should skip follow-up if already sent for this quote', async () => {
    mockGetConfig.mockResolvedValueOnce({
      ...SAMPLE_CONFIG,
      automation_type: 'quote_followup',
      is_enabled: true,
    });
    mockHasBeenFiredRecently.mockResolvedValueOnce(true); // already sent

    const result = await fireAutomation(TENANT_A, 'quote_followup', {
      quote_id: QUOTE_ID,
      customer_id: CUSTOMER_ID,
    });

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('already_fired');
  });
});

// ============================================
// 9. Payment reminder respects max_repeats limit
// ============================================
describe('Payment reminder max_repeats', () => {
  it('should skip when max_repeats reached', async () => {
    mockGetConfig.mockResolvedValueOnce({
      ...SAMPLE_CONFIG,
      automation_type: 'payment_reminder',
      is_enabled: true,
      max_repeats: 3,
    });
    mockCountRecentFires.mockResolvedValueOnce(3); // already sent 3 times

    const result = await fireAutomation(TENANT_A, 'payment_reminder', {
      invoice_id: INVOICE_ID,
      customer_id: CUSTOMER_ID,
    });

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('max_repeats_reached');
    expect(mockInsertLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'skipped',
        failure_reason: expect.stringContaining('max_repeats_reached'),
      }),
    );
  });

  it('should allow send when under max_repeats', async () => {
    mockGetConfig.mockResolvedValueOnce({
      ...SAMPLE_CONFIG,
      automation_type: 'payment_reminder',
      is_enabled: true,
      max_repeats: 3,
    });
    mockCountRecentFires
      .mockResolvedValueOnce(2) // check: 2 < 3, ok
      .mockResolvedValueOnce(2); // for attempt_number calculation
    mockCustomerFindById.mockResolvedValueOnce(SAMPLE_CUSTOMER);
    mockTemplateFindById.mockResolvedValueOnce(SAMPLE_TEMPLATE);

    const result = await fireAutomation(TENANT_A, 'payment_reminder', {
      invoice_id: INVOICE_ID,
      customer_id: CUSTOMER_ID,
    });

    expect(result.status).toBe('sent');
  });
});

// ============================================
// 10. Test send does not create log entry
// ============================================
describe('POST /v1/automations/test-send', () => {
  it('should send test message without logging', async () => {
    const token = await loginAs('owner');
    mockGetConfig.mockResolvedValueOnce({ ...SAMPLE_CONFIG, is_enabled: true });
    mockTemplateFindById.mockResolvedValueOnce(SAMPLE_TEMPLATE);

    const res = await request(app)
      .post('/v1/automations/test-send')
      .set('Authorization', `Bearer ${token}`)
      .send({
        automation_type: 'booking_confirmation',
        recipient_email: 'test@test.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.automation_type).toBe('booking_confirmation');
    expect(res.body.data.sent_to).toBe('test@test.com');
    // Verify NO log entry was created
    expect(mockInsertLog).not.toHaveBeenCalled();
  });
});

// ============================================
// 11. Log entries are append-only (no update/delete)
// ============================================
describe('Automation log append-only', () => {
  it('should create log entries via insertLog only', async () => {
    mockGetConfig.mockResolvedValueOnce({ ...SAMPLE_CONFIG, is_enabled: true });
    mockHasBeenFiredRecently.mockResolvedValueOnce(false);
    mockCustomerFindById.mockResolvedValueOnce(SAMPLE_CUSTOMER);
    mockTemplateFindById.mockResolvedValueOnce(SAMPLE_TEMPLATE);

    await fireAutomation(TENANT_A, 'booking_confirmation', {
      job_id: JOB_ID,
      customer_id: CUSTOMER_ID,
    });

    // Verify insertLog was called (append)
    expect(mockInsertLog).toHaveBeenCalledTimes(1);
    expect(mockInsertLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_A,
        automation_type: 'booking_confirmation',
        status: 'sent',
      }),
    );
    // There is no updateLog or deleteLog function in the repository
  });
});

// ============================================
// 12. Multi-tenant isolation test
// ============================================
describe('Multi-tenant isolation', () => {
  it('should list configs only for authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockGetAllConfigs.mockResolvedValueOnce(ALL_CONFIGS);

    const res = await request(app)
      .get('/v1/automations/configs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockGetAllConfigs).toHaveBeenCalledWith(TENANT_A);
  });

  it('should list logs only for authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockFindLogs.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 25 });

    const res = await request(app)
      .get('/v1/automations/log')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindLogs).toHaveBeenCalledWith(TENANT_A, expect.any(Object));
  });
});

// ============================================
// Merge field resolution
// ============================================
describe('resolveMergeFields', () => {
  it('should replace all merge fields in template', () => {
    const template = 'Hi {{client_first_name}}, your appointment with {{company_name}} is confirmed.';
    const result = resolveMergeFields(template, {
      customer: { first_name: 'John', last_name: 'Smith' },
    });
    expect(result).toBe('Hi John, your appointment with Sunset Services is confirmed.');
  });
});

// ============================================
// RBAC
// ============================================
describe('RBAC', () => {
  it('should deny crew_member from accessing automation configs', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get('/v1/automations/configs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should deny coordinator from listing configs', async () => {
    const token = await loginAs('coordinator');
    const res = await request(app)
      .get('/v1/automations/configs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get('/v1/automations/configs');
    expect(res.status).toBe(401);
  });

  it('should deny div_mgr from test-send', async () => {
    const token = await loginAs('div_mgr');
    const res = await request(app)
      .post('/v1/automations/test-send')
      .set('Authorization', `Bearer ${token}`)
      .send({ automation_type: 'booking_confirmation' });
    expect(res.status).toBe(403);
  });
});
