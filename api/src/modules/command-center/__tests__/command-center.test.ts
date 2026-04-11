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

// --- Mock command-center repository ---
const mockGetCommandCenterSummary = vi.fn();

vi.mock('../repository.js', () => ({
  getCommandCenterSummary: (...args: unknown[]) => mockGetCommandCenterSummary(...args),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';

const SAMPLE_SUMMARY_ROW = {
  crews_active: '3',
  crews_not_in: '2',
  billing_drafts_amount: '1500.00',
  billing_drafts_count: '4',
  billing_overdue_amount: '750.50',
  billing_overdue_count: '2',
  season_completion_pct: '67.5',
  season_pending_count: '12',
  feedback_avg_rating: '4.3',
  feedback_response_count: '28',
  jobs_today_total: '15',
  jobs_today_completed: '8',
  jobs_today_active: '4',
  jobs_today_scheduled: '3',
  jobs_today_unassigned: '1',
};

const ZERO_SUMMARY_ROW = {
  crews_active: '0',
  crews_not_in: '0',
  billing_drafts_amount: '0',
  billing_drafts_count: '0',
  billing_overdue_amount: '0',
  billing_overdue_count: '0',
  season_completion_pct: '0',
  season_pending_count: '0',
  feedback_avg_rating: '0',
  feedback_response_count: '0',
  jobs_today_total: '0',
  jobs_today_completed: '0',
  jobs_today_active: '0',
  jobs_today_scheduled: '0',
  jobs_today_unassigned: '0',
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
  mockQueryDb.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ============================================
// GET /v1/command-center/summary
// ============================================
describe('GET /v1/command-center/summary', () => {
  it('should return all summary fields with correct numeric types', async () => {
    const token = await loginAs('owner');
    mockGetCommandCenterSummary.mockResolvedValueOnce(SAMPLE_SUMMARY_ROW);

    const res = await request(app)
      .get('/v1/command-center/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // All fields must be numbers (not strings)
    expect(typeof data.crews_active).toBe('number');
    expect(typeof data.crews_not_in).toBe('number');
    expect(typeof data.billing_drafts_amount).toBe('number');
    expect(typeof data.billing_drafts_count).toBe('number');
    expect(typeof data.billing_overdue_amount).toBe('number');
    expect(typeof data.billing_overdue_count).toBe('number');
    expect(typeof data.season_completion_pct).toBe('number');
    expect(typeof data.season_pending_count).toBe('number');
    expect(typeof data.feedback_avg_rating).toBe('number');
    expect(typeof data.feedback_response_count).toBe('number');
    expect(typeof data.jobs_today_total).toBe('number');
    expect(typeof data.jobs_today_completed).toBe('number');
    expect(typeof data.jobs_today_active).toBe('number');
    expect(typeof data.jobs_today_scheduled).toBe('number');
    expect(typeof data.jobs_today_unassigned).toBe('number');

    // Spot-check values
    expect(data.crews_active).toBe(3);
    expect(data.crews_not_in).toBe(2);
    expect(data.billing_drafts_amount).toBe(1500);
    expect(data.billing_drafts_count).toBe(4);
    expect(data.billing_overdue_amount).toBe(750.5);
    expect(data.billing_overdue_count).toBe(2);
    expect(data.season_completion_pct).toBe(67.5);
    expect(data.season_pending_count).toBe(12);
    expect(data.feedback_avg_rating).toBe(4.3);
    expect(data.feedback_response_count).toBe(28);
    expect(data.jobs_today_total).toBe(15);
    expect(data.jobs_today_completed).toBe(8);
    expect(data.jobs_today_active).toBe(4);
    expect(data.jobs_today_scheduled).toBe(3);
    expect(data.jobs_today_unassigned).toBe(1);
  });

  it('should return zeros when no data exists', async () => {
    const token = await loginAs('owner');
    mockGetCommandCenterSummary.mockResolvedValueOnce(ZERO_SUMMARY_ROW);

    const res = await request(app)
      .get('/v1/command-center/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.crews_active).toBe(0);
    expect(data.crews_not_in).toBe(0);
    expect(data.billing_drafts_amount).toBe(0);
    expect(data.billing_drafts_count).toBe(0);
    expect(data.billing_overdue_amount).toBe(0);
    expect(data.billing_overdue_count).toBe(0);
    expect(data.season_completion_pct).toBe(0);
    expect(data.season_pending_count).toBe(0);
    expect(data.feedback_avg_rating).toBe(0);
    expect(data.feedback_response_count).toBe(0);
    expect(data.jobs_today_total).toBe(0);
    expect(data.jobs_today_completed).toBe(0);
    expect(data.jobs_today_active).toBe(0);
    expect(data.jobs_today_scheduled).toBe(0);
    expect(data.jobs_today_unassigned).toBe(0);
  });

  it('should require authentication (401 without token)', async () => {
    const res = await request(app)
      .get('/v1/command-center/summary');

    expect(res.status).toBe(401);
  });

  it('should deny coordinator role (403 — owner only)', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/command-center/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny div_mgr role (403 — owner only)', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .get('/v1/command-center/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny crew_member role (403 — owner only)', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/command-center/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny crew_leader role (403 — owner only)', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/command-center/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should allow owner role', async () => {
    const token = await loginAs('owner');
    mockGetCommandCenterSummary.mockResolvedValueOnce(SAMPLE_SUMMARY_ROW);

    const res = await request(app)
      .get('/v1/command-center/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should scope query to authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockGetCommandCenterSummary.mockResolvedValueOnce(SAMPLE_SUMMARY_ROW);

    await request(app)
      .get('/v1/command-center/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(mockGetCommandCenterSummary).toHaveBeenCalledWith(TENANT_A);
  });
});
