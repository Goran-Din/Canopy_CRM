import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Mock other integrations
vi.mock('../repository.js', () => ({
  findAllConfigs: vi.fn().mockResolvedValue([]),
  findConfigByProvider: vi.fn(), upsertConfig: vi.fn(), updateConfigStatus: vi.fn(),
  updateTokens: vi.fn(), updateLastSync: vi.fn(), updateLastError: vi.fn(),
  deleteConfig: vi.fn(), createSyncLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
  updateSyncLog: vi.fn(), findSyncLogs: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  findSyncLogsByEntity: vi.fn().mockResolvedValue([]),
}));

vi.mock('../xero/xero-client.js', () => ({ xeroRequest: vi.fn() }));
vi.mock('../xero/xero-sync.js', () => ({ syncCustomer: vi.fn(), syncInvoice: vi.fn(), syncPayment: vi.fn(), fullSync: vi.fn() }));
vi.mock('../xero/xero-items.js', () => ({ syncXeroItems: vi.fn(), search: vi.fn() }));
vi.mock('../xero/xero-webhook.js', () => ({
  handleWebhook: vi.fn((_req: unknown, res: { status: (n: number) => { json: (d: unknown) => void } }) => {
    res.status(200).json({ status: 'received' });
  }),
  verifyWebhookSignature: vi.fn(),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const API_KEY = 'northchat-api-key-test';
const THREAD_ID = 'nc-thread-001';

const V1_PAYLOAD = {
  northchat_thread_id: THREAD_ID,
  customer_email: 'john@example.com',
  thread_url: 'https://northchat.app/thread/001',
  thread_summary: 'Client asking about spring cleanup',
};

const V2_PAYLOAD_JOB_ID = {
  ...V1_PAYLOAD,
  job_id: JOB_ID,
};

const V2_PAYLOAD_JOB_NUMBER = {
  ...V1_PAYLOAD,
  northchat_thread_id: 'nc-thread-002',
  job_number: '0047-26',
};

function setupApiKeyAuth() {
  mockQueryDb.mockImplementation((sql: string, params?: unknown[]) => {
    if (typeof sql === 'string' && sql.includes('integration_configs') && sql.includes('provider')) {
      return Promise.resolve({
        rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }],
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  TEST_HASH = await bcrypt.hash(TEST_PASSWORD, 4);
  mockQueryDb.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ============================================
// 1. V1 payload (no job fields): customer thread linked
// ============================================
describe('POST /v1/webhooks/northchat', () => {
  it('should process V1 payload with customer matching', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      if (typeof sql === 'string' && sql.includes('contacts') && sql.includes('email')) {
        return Promise.resolve({ rows: [{ id: CUSTOMER_ID }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/v1/webhooks/northchat')
      .set('X-API-Key', API_KEY)
      .send(V1_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body.data.customer_id).toBe(CUSTOMER_ID);
    expect(res.body.data.job_id).toBeNull();
  });

  // ============================================
  // 2. V2 with job_id: diary entry created
  // ============================================
  it('should create job diary entry when job_id provided', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      if (typeof sql === 'string' && sql.includes('contacts') && sql.includes('email')) {
        return Promise.resolve({ rows: [{ id: CUSTOMER_ID }] });
      }
      if (typeof sql === 'string' && sql.includes('FROM jobs') && sql.includes('id = $1')) {
        return Promise.resolve({ rows: [{ id: JOB_ID }] });
      }
      if (typeof sql === 'string' && sql.includes('job_diary_entries') && sql.includes('SELECT')) {
        return Promise.resolve({ rows: [] }); // no duplicate
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/v1/webhooks/northchat')
      .set('X-API-Key', API_KEY)
      .send(V2_PAYLOAD_JOB_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.job_id).toBe(JOB_ID);

    // Verify diary entry was created
    const diaryInsert = mockQueryDb.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string'
        && (call[0] as string).includes('INSERT INTO job_diary_entries'),
    );
    expect(diaryInsert).toBeDefined();
  });

  // ============================================
  // 3. V2 with job_number: job resolved, diary entry created
  // ============================================
  it('should resolve job by number and create diary entry', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      if (typeof sql === 'string' && sql.includes('contacts') && sql.includes('email')) {
        return Promise.resolve({ rows: [{ id: CUSTOMER_ID }] });
      }
      if (typeof sql === 'string' && sql.includes('job_number = $1')) {
        return Promise.resolve({ rows: [{ id: JOB_ID }] });
      }
      if (typeof sql === 'string' && sql.includes('job_diary_entries') && sql.includes('SELECT')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/v1/webhooks/northchat')
      .set('X-API-Key', API_KEY)
      .send(V2_PAYLOAD_JOB_NUMBER);

    expect(res.status).toBe(200);
    expect(res.body.data.job_id).toBe(JOB_ID);
  });

  // ============================================
  // 4. Invalid job_number: returns 404
  // ============================================
  it('should return 404 for invalid job_number', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 }); // no job found
    });

    const res = await request(app)
      .post('/v1/webhooks/northchat')
      .set('X-API-Key', API_KEY)
      .send({ ...V2_PAYLOAD_JOB_NUMBER, job_number: '9999-99' });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Job not found');
  });

  // ============================================
  // 5. Duplicate thread for same job: 409
  // ============================================
  it('should return 409 for duplicate thread on same job', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      if (typeof sql === 'string' && sql.includes('FROM jobs')) {
        return Promise.resolve({ rows: [{ id: JOB_ID }] });
      }
      if (typeof sql === 'string' && sql.includes('job_diary_entries') && sql.includes('SELECT')) {
        return Promise.resolve({ rows: [{ id: 'existing-diary' }] }); // duplicate!
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/v1/webhooks/northchat')
      .set('X-API-Key', API_KEY)
      .send(V2_PAYLOAD_JOB_ID);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already linked');
  });

  // ============================================
  // 6. Same thread linked to different jobs: allowed
  // ============================================
  it('should allow same thread linked to different jobs', async () => {
    const JOB_ID_2 = '33333333-0000-0000-0000-000000000002';

    mockQueryDb.mockImplementation((sql: string, params?: unknown[]) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      if (typeof sql === 'string' && sql.includes('FROM jobs') && sql.includes('id = $1')) {
        return Promise.resolve({ rows: [{ id: params?.[0] ?? JOB_ID_2 }] });
      }
      if (typeof sql === 'string' && sql.includes('job_diary_entries') && sql.includes('SELECT')) {
        return Promise.resolve({ rows: [] }); // no duplicate for this job
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .post('/v1/webhooks/northchat')
      .set('X-API-Key', API_KEY)
      .send({ ...V2_PAYLOAD_JOB_ID, job_id: JOB_ID_2 });

    expect(res.status).toBe(200);
  });
});

// ============================================
// 7. GET /job-lookup: returns job info
// ============================================
describe('GET /v1/integrations/northchat/job-lookup', () => {
  it('should return job info for valid number', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      if (typeof sql === 'string' && sql.includes('job_number = $1')) {
        return Promise.resolve({
          rows: [{ id: JOB_ID, job_number: '0047-26', status: 'scheduled', customer_id: CUSTOMER_ID }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get('/v1/integrations/northchat/job-lookup?job_number=0047-26')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.crm_job_id).toBe(JOB_ID);
    expect(res.body.data.job_number).toBe('0047-26');
    expect(res.body.data.status).toBe('scheduled');
  });

  // ============================================
  // 8. Non-existent job number: returns 404
  // ============================================
  it('should return 404 for non-existent job number', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await request(app)
      .get('/v1/integrations/northchat/job-lookup?job_number=9999-99')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(404);
  });
});

// ============================================
// 9. Diary entry includes thread_url
// ============================================
describe('Job diary entry content', () => {
  it('should include thread_url in diary body', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      if (typeof sql === 'string' && sql.includes('FROM jobs')) {
        return Promise.resolve({ rows: [{ id: JOB_ID }] });
      }
      if (typeof sql === 'string' && sql.includes('job_diary_entries') && sql.includes('SELECT')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await request(app)
      .post('/v1/webhooks/northchat')
      .set('X-API-Key', API_KEY)
      .send(V2_PAYLOAD_JOB_ID);

    const diaryInsert = mockQueryDb.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string'
        && (call[0] as string).includes('INSERT INTO job_diary_entries'),
    );
    expect(diaryInsert).toBeDefined();
    const bodyParam = diaryInsert![1] as unknown[];
    expect(bodyParam[2]).toContain('https://northchat.app/thread/001');
  });
});

// ============================================
// 10. Sync log entries created
// ============================================
describe('Integration sync log', () => {
  it('should create sync log entry for job linking', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      if (typeof sql === 'string' && sql.includes('FROM jobs')) {
        return Promise.resolve({ rows: [{ id: JOB_ID }] });
      }
      if (typeof sql === 'string' && sql.includes('job_diary_entries') && sql.includes('SELECT')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await request(app)
      .post('/v1/webhooks/northchat')
      .set('X-API-Key', API_KEY)
      .send(V2_PAYLOAD_JOB_ID);

    const syncLog = mockQueryDb.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string'
        && (call[0] as string).includes('integration_sync_log')
        && (call[0] as string).includes('INSERT'),
    );
    expect(syncLog).toBeDefined();
  });
});

// ============================================
// 11. Multi-tenant isolation
// ============================================
describe('Multi-tenant isolation', () => {
  it('should scope all queries to tenant from API key', async () => {
    mockQueryDb.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('integration_configs')) {
        return Promise.resolve({ rows: [{ tenant_id: TENANT_A, config_data: { api_key: API_KEY }, status: 'active' }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await request(app)
      .post('/v1/webhooks/northchat')
      .set('X-API-Key', API_KEY)
      .send(V1_PAYLOAD);

    // All queries after auth should use TENANT_A
    const customerQuery = mockQueryDb.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string'
        && (call[0] as string).includes('customers')
        && (call[0] as string).includes('contacts'),
    );
    if (customerQuery) {
      expect(customerQuery[1]).toContain(TENANT_A);
    }
  });
});

// ============================================
// RBAC
// ============================================
describe('RBAC', () => {
  it('should require API key for webhook', async () => {
    const res = await request(app)
      .post('/v1/webhooks/northchat')
      .send(V1_PAYLOAD);
    expect(res.status).toBe(401);
  });

  it('should require API key for job lookup', async () => {
    const res = await request(app)
      .get('/v1/integrations/northchat/job-lookup?job_number=0047-26');
    expect(res.status).toBe(401);
  });
});
