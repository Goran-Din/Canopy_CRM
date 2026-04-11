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

// --- Mock billing repository ---
const mockBulkInsertSchedule = vi.fn();
const mockFindDueScheduleEntries = vi.fn();
const mockFindSchedule = vi.fn();
const mockUpdateScheduleStatus = vi.fn();
const mockGetNextDraftNumber = vi.fn();
const mockInsertDraft = vi.fn();
const mockGetDraftById = vi.fn();
const mockFindDrafts = vi.fn();
const mockUpdateDraft = vi.fn();
const mockGetMilestoneById = vi.fn();
const mockUpdateMilestone = vi.fn();
const mockGetDashboardStats = vi.fn();
const mockFindOverdue = vi.fn();
const mockBillingAcquireClient = vi.fn();

vi.mock('../repository.js', () => ({
  bulkInsertSchedule: (...args: unknown[]) => mockBulkInsertSchedule(...args),
  findDueScheduleEntries: (...args: unknown[]) => mockFindDueScheduleEntries(...args),
  findSchedule: (...args: unknown[]) => mockFindSchedule(...args),
  updateScheduleStatus: (...args: unknown[]) => mockUpdateScheduleStatus(...args),
  getNextDraftNumber: (...args: unknown[]) => mockGetNextDraftNumber(...args),
  insertDraft: (...args: unknown[]) => mockInsertDraft(...args),
  getDraftById: (...args: unknown[]) => mockGetDraftById(...args),
  findDrafts: (...args: unknown[]) => mockFindDrafts(...args),
  updateDraft: (...args: unknown[]) => mockUpdateDraft(...args),
  getMilestoneById: (...args: unknown[]) => mockGetMilestoneById(...args),
  updateMilestone: (...args: unknown[]) => mockUpdateMilestone(...args),
  getDashboardStats: (...args: unknown[]) => mockGetDashboardStats(...args),
  findOverdue: (...args: unknown[]) => mockFindOverdue(...args),
  acquireClient: (...args: unknown[]) => mockBillingAcquireClient(...args),
}));

// --- Mock contracts repository ---
const mockContractFindById = vi.fn();

vi.mock('../../contracts/repository.js', () => ({
  findById: (...args: unknown[]) => mockContractFindById(...args),
  findAll: vi.fn(), create: vi.fn(), update: vi.fn(), getLineItems: vi.fn(),
}));

// --- Mock occurrence repository ---
const mockFindForBillingPeriod = vi.fn();

vi.mock('../../service-occurrences/repository.js', () => ({
  findForBillingPeriod: (...args: unknown[]) => mockFindForBillingPeriod(...args),
  bulkInsert: vi.fn(), findAll: vi.fn(), getById: vi.fn(), update: vi.fn(),
  countByContractService: vi.fn(), getServiceListSummary: vi.fn(),
  getServiceDetail: vi.fn(), getSeasonSummary: vi.fn(), acquireClient: vi.fn(),
}));

// --- Mock diary repository ---
vi.mock('../../jobs/diary/diary.repository.js', () => ({
  insert: vi.fn(), insertStandalone: vi.fn(), findByJobId: vi.fn(),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CONTRACT_ID = '11111111-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const DRAFT_ID = 'aaaa2222-0000-0000-0000-000000000001';
const MILESTONE_ID = 'bbbb3333-0000-0000-0000-000000000001';
const SCHEDULE_ID = 'cccc4444-0000-0000-0000-000000000001';

const SAMPLE_DRAFT = {
  id: DRAFT_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  contract_id: CONTRACT_ID,
  billing_schedule_id: SCHEDULE_ID,
  draft_number: 'DRF-0001-26',
  line_items: [{ description: 'Monthly Landscape Maintenance — April 2026', quantity: 1, unit_price: 850, line_total: 850 }],
  subtotal: '850.00',
  tax_rate: '0',
  tax_amount: '0',
  total_amount: '850.00',
  description: 'Gold Package — April 2026 (1/8)',
  status: 'pending_review',
  reviewed_by: null, reviewed_at: null,
  approved_by: null, approved_at: null,
  pushed_to_xero: false, xero_invoice_id: null,
  invoice_id: null, rejection_reason: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SAMPLE_MILESTONE = {
  id: MILESTONE_ID,
  tenant_id: TENANT_A,
  job_id: '33333333-0000-0000-0000-000000000001',
  contract_id: CONTRACT_ID,
  customer_id: CUSTOMER_ID,
  milestone_name: 'Foundation Complete',
  milestone_description: 'Patio foundation poured',
  amount_type: 'percentage',
  amount_value: '30.0000',
  computed_amount: null,
  project_total: '15000.00',
  status: 'pending',
  invoice_id: null, xero_invoice_id: null,
  sort_order: 1, due_date: null,
  triggered_at: null, paid_at: null,
  notes: null, created_by: USER_ID, updated_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function createMockClient() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
}
let mockClient: ReturnType<typeof createMockClient>;

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
  mockBillingAcquireClient.mockResolvedValue(mockClient);
});

// ============================================
// Draft Generation
// ============================================
describe('POST /v1/billing/generate-drafts', () => {
  it('should generate Gold/Silver drafts with exactly ONE line item', async () => {
    const token = await loginAs('owner');

    const scheduleEntry = {
      id: SCHEDULE_ID, tenant_id: TENANT_A, contract_id: CONTRACT_ID,
      billing_period_start: '2026-04-01', billing_period_end: '2026-04-30',
      billing_date: '2026-04-01', invoice_number_in_season: 1,
      total_invoices_in_season: 8, planned_amount: '850.00', status: 'scheduled',
    };

    mockFindDueScheduleEntries.mockResolvedValue([scheduleEntry]);
    mockContractFindById.mockResolvedValue({
      id: CONTRACT_ID, tenant_id: TENANT_A, customer_id: CUSTOMER_ID,
      property_id: 'eeeeeeee-0000-0000-0000-000000000001',
      service_tier: 'gold', season_monthly_price: '850.00',
      season_start_date: '2026-04-01', line_items: [],
    });
    mockInsertDraft.mockResolvedValue(SAMPLE_DRAFT);

    const res = await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-04-01' });

    expect(res.status).toBe(200);
    expect(res.body.data.generated).toBe(1);

    // Verify EXACTLY ONE line item (non-negotiable rule)
    const draftCall = mockInsertDraft.mock.calls[0][1] as Record<string, unknown>;
    const lineItems = draftCall.line_items as Array<Record<string, unknown>>;
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].description).toContain('Monthly Landscape Maintenance');
  });

  it('should generate Bronze per-cut draft with occurrence count', async () => {
    const token = await loginAs('owner');

    const scheduleEntry = {
      id: SCHEDULE_ID, tenant_id: TENANT_A, contract_id: CONTRACT_ID,
      billing_period_start: '2026-04-01', billing_period_end: '2026-04-30',
      billing_date: '2026-04-01', invoice_number_in_season: 1,
      total_invoices_in_season: 8, planned_amount: null, status: 'scheduled',
    };

    mockFindDueScheduleEntries.mockResolvedValue([scheduleEntry]);
    mockContractFindById.mockResolvedValue({
      id: CONTRACT_ID, tenant_id: TENANT_A, customer_id: CUSTOMER_ID,
      service_tier: 'bronze', bronze_billing_type: 'per_cut',
      per_cut_price: '45.00', season_start_date: '2026-04-01', line_items: [],
    });
    mockFindForBillingPeriod.mockResolvedValue([
      { assigned_date: '2026-04-05', status: 'completed' },
      { assigned_date: '2026-04-12', status: 'completed' },
      { assigned_date: '2026-04-19', status: 'assigned' },
    ]);
    mockInsertDraft.mockResolvedValue({ ...SAMPLE_DRAFT, total_amount: '135.00' });

    const res = await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-04-01' });

    expect(res.status).toBe(200);
    expect(res.body.data.generated).toBe(1);

    const draftCall = mockInsertDraft.mock.calls[0][1] as Record<string, unknown>;
    const lineItems = draftCall.line_items as Array<Record<string, unknown>>;
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].quantity).toBe(3); // 3 cuts
    expect(draftCall.total_amount).toBe(135); // 3 × $45
  });

  it('should deny non-owner from generating drafts', async () => {
    const token = await loginAs('div_mgr');
    const res = await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

// ============================================
// Draft Approval
// ============================================
describe('POST /v1/billing/drafts/:id/approve', () => {
  it('should approve pending draft', async () => {
    const token = await loginAs('owner');
    mockGetDraftById.mockResolvedValue(SAMPLE_DRAFT);
    mockUpdateDraft.mockResolvedValue({ ...SAMPLE_DRAFT, status: 'approved' });

    const res = await request(app)
      .post(`/v1/billing/drafts/${DRAFT_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockUpdateDraft).toHaveBeenCalledWith(
      mockClient, DRAFT_ID,
      expect.objectContaining({ status: 'approved', approved_by: USER_ID }),
    );
  });

  it('should reject approving already-approved draft', async () => {
    const token = await loginAs('owner');
    mockGetDraftById.mockResolvedValue({ ...SAMPLE_DRAFT, status: 'approved' });

    const res = await request(app)
      .post(`/v1/billing/drafts/${DRAFT_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// Draft Rejection
// ============================================
describe('POST /v1/billing/drafts/:id/reject', () => {
  it('should reject draft with reason', async () => {
    const token = await loginAs('owner');
    mockGetDraftById.mockResolvedValue(SAMPLE_DRAFT);
    mockUpdateDraft.mockResolvedValue({ ...SAMPLE_DRAFT, status: 'rejected', rejection_reason: 'Amount incorrect' });

    const res = await request(app)
      .post(`/v1/billing/drafts/${DRAFT_ID}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Amount incorrect' });

    expect(res.status).toBe(200);
    expect(mockUpdateDraft).toHaveBeenCalledWith(
      mockClient, DRAFT_ID,
      expect.objectContaining({ status: 'rejected', rejection_reason: 'Amount incorrect' }),
    );
  });

  it('should require rejection reason', async () => {
    const token = await loginAs('owner');
    const res = await request(app)
      .post(`/v1/billing/drafts/${DRAFT_ID}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ============================================
// Milestone Billing
// ============================================
describe('POST /v1/billing/milestones/:id/trigger', () => {
  it('should trigger milestone with percentage-based amount', async () => {
    const token = await loginAs('owner');
    mockGetMilestoneById.mockResolvedValue(SAMPLE_MILESTONE);
    mockInsertDraft.mockResolvedValue({
      ...SAMPLE_DRAFT, total_amount: '4500.00',
      description: 'Hardscape Milestone: Foundation Complete',
    });
    mockUpdateMilestone.mockResolvedValue({ ...SAMPLE_MILESTONE, status: 'invoiced' });

    const res = await request(app)
      .post(`/v1/billing/milestones/${MILESTONE_ID}/trigger`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    // 30% of $15,000 = $4,500
    const draftCall = mockInsertDraft.mock.calls[0][1] as Record<string, unknown>;
    expect(draftCall.total_amount).toBe(4500);
    expect(mockUpdateMilestone).toHaveBeenCalledWith(
      mockClient, MILESTONE_ID,
      expect.objectContaining({ status: 'invoiced', computed_amount: 4500 }),
    );
  });

  it('should reject non-pending milestone', async () => {
    const token = await loginAs('owner');
    mockGetMilestoneById.mockResolvedValue({ ...SAMPLE_MILESTONE, status: 'invoiced' });

    const res = await request(app)
      .post(`/v1/billing/milestones/${MILESTONE_ID}/trigger`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// Dashboard & Schedule
// ============================================
describe('GET /v1/billing/dashboard', () => {
  it('should return billing stats', async () => {
    const token = await loginAs('owner');
    mockGetDashboardStats.mockResolvedValue({
      pending_review: '5', total_scheduled: '20', total_approved: '10', overdue_count: '2',
    });

    const res = await request(app)
      .get('/v1/billing/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pending_review).toBe('5');
  });

  it('should deny coordinator from dashboard', async () => {
    const token = await loginAs('coordinator');
    const res = await request(app)
      .get('/v1/billing/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /v1/billing/drafts', () => {
  it('should list drafts with pagination', async () => {
    const token = await loginAs('owner');
    mockFindDrafts.mockResolvedValue({ rows: [SAMPLE_DRAFT], total: 1 });

    const res = await request(app)
      .get('/v1/billing/drafts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ============================================
// Auth
// ============================================
describe('Authentication', () => {
  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get('/v1/billing/dashboard');
    expect(res.status).toBe(401);
  });
});
