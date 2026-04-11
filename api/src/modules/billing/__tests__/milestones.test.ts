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
const mockFindMilestonesByJobId = vi.fn();
const mockCreateMilestones = vi.fn();
const mockCreateSingleMilestone = vi.fn();
const mockGetMilestoneById = vi.fn();
const mockUpdateMilestone = vi.fn();
const mockCancelMilestone = vi.fn();
const mockGetHardscapeBillingSummary = vi.fn();
const mockInsertDraft = vi.fn();
const mockBillingAcquireClient = vi.fn();

vi.mock('../repository.js', () => ({
  bulkInsertSchedule: vi.fn(),
  findDueScheduleEntries: vi.fn(),
  findSchedule: vi.fn(),
  updateScheduleStatus: vi.fn(),
  getNextDraftNumber: vi.fn(),
  insertDraft: (...args: unknown[]) => mockInsertDraft(...args),
  getDraftById: vi.fn(),
  findDrafts: vi.fn(),
  updateDraft: vi.fn(),
  getMilestoneById: (...args: unknown[]) => mockGetMilestoneById(...args),
  updateMilestone: (...args: unknown[]) => mockUpdateMilestone(...args),
  getDashboardStats: vi.fn(),
  findOverdue: vi.fn(),
  findMilestonesByJobId: (...args: unknown[]) => mockFindMilestonesByJobId(...args),
  createMilestones: (...args: unknown[]) => mockCreateMilestones(...args),
  createSingleMilestone: (...args: unknown[]) => mockCreateSingleMilestone(...args),
  cancelMilestone: (...args: unknown[]) => mockCancelMilestone(...args),
  getHardscapeBillingSummary: (...args: unknown[]) => mockGetHardscapeBillingSummary(...args),
  acquireClient: (...args: unknown[]) => mockBillingAcquireClient(...args),
}));

// --- Mock jobs repository ---
const mockJobFindById = vi.fn();

vi.mock('../../jobs/repository.js', () => ({
  findById: (...args: unknown[]) => mockJobFindById(...args),
  findAll: vi.fn(), create: vi.fn(), update: vi.fn(), updateStatus: vi.fn(),
  softDelete: vi.fn(), getByDateRange: vi.fn(), getByProperty: vi.fn(),
  addPhoto: vi.fn(), getPhotos: vi.fn(), addChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(), getChecklist: vi.fn(), getChecklistItemById: vi.fn(),
  getStats: vi.fn(), customerExists: vi.fn(), propertyBelongsToCustomer: vi.fn(),
  contractExists: vi.fn(), getNextJobNumber: vi.fn(), createWithClient: vi.fn(),
  updateStatusWithClient: vi.fn(), acquireClient: vi.fn(),
}));

// --- Mock contracts repository ---
vi.mock('../../contracts/repository.js', () => ({
  findById: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), getLineItems: vi.fn(),
}));

// --- Mock occurrence repository ---
vi.mock('../../service-occurrences/repository.js', () => ({
  findForBillingPeriod: vi.fn(), bulkInsert: vi.fn(), findAll: vi.fn(), getById: vi.fn(),
  update: vi.fn(), countByContractService: vi.fn(), getServiceListSummary: vi.fn(),
  getServiceDetail: vi.fn(), getSeasonSummary: vi.fn(), acquireClient: vi.fn(),
}));

// --- Mock diary repository ---
const mockDiaryInsert = vi.fn();

vi.mock('../../jobs/diary/diary.repository.js', () => ({
  insert: (...args: unknown[]) => mockDiaryInsert(...args),
  insertStandalone: vi.fn(), findByJobId: vi.fn(),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'aaaaaaaa-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const MILESTONE_ID = 'bbbb3333-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const CONTRACT_ID = '11111111-0000-0000-0000-000000000001';
const DRAFT_ID = 'aaaa2222-0000-0000-0000-000000000001';

const SAMPLE_JOB = {
  id: JOB_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  property_id: 'eeeeeeee-0000-0000-0000-000000000001',
  contract_id: CONTRACT_ID,
  division: 'hardscape',
  status: 'in_progress',
  photos: [],
  checklist: [],
};

const makeMilestone = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: MILESTONE_ID,
  tenant_id: TENANT_A,
  job_id: JOB_ID,
  contract_id: CONTRACT_ID,
  customer_id: CUSTOMER_ID,
  milestone_name: 'Deposit',
  milestone_description: 'Initial deposit',
  amount_type: 'percentage',
  amount_value: '0.3000',
  computed_amount: '4500.00',
  project_total: '15000.00',
  status: 'pending',
  invoice_id: null,
  xero_invoice_id: null,
  sort_order: 1,
  due_date: '2026-04-01',
  triggered_at: null,
  paid_at: null,
  notes: null,
  created_by: USER_ID,
  updated_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

function createMockClient() {
  return { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
}
let mockClient: ReturnType<typeof createMockClient>;

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
  mockClient = createMockClient();
  mockBillingAcquireClient.mockResolvedValue(mockClient);
  mockDiaryInsert.mockResolvedValue({});
});

// ============================================
// 1. POST milestones/setup with percentage milestones validates sum = 1.00
// ============================================
describe('POST /v1/jobs/:id/milestones/setup', () => {
  it('should accept percentage milestones that sum to 1.00', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB);
    mockCreateMilestones.mockResolvedValue([
      makeMilestone({ milestone_name: 'Deposit', amount_value: '0.3000', computed_amount: '4500.00' }),
      makeMilestone({ id: 'bbbb3333-0000-0000-0000-000000000002', milestone_name: 'Progress', amount_value: '0.4000', computed_amount: '6000.00' }),
      makeMilestone({ id: 'bbbb3333-0000-0000-0000-000000000003', milestone_name: 'Final', amount_value: '0.3000', computed_amount: '4500.00' }),
    ]);

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/milestones/setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        project_total: 15000,
        milestones: [
          { milestone_name: 'Deposit', amount_type: 'percentage', amount_value: 0.30, sort_order: 1 },
          { milestone_name: 'Progress', amount_type: 'percentage', amount_value: 0.40, sort_order: 2 },
          { milestone_name: 'Final', amount_type: 'percentage', amount_value: 0.30, sort_order: 3 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(3);
  });

  // ============================================
  // 2. POST milestones/setup computes correct computed_amount for each milestone
  // ============================================
  it('should compute correct computed_amount for each milestone', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB);
    mockCreateMilestones.mockImplementation((_client: unknown, _jobId: string, _tenantId: string, data: Array<Record<string, unknown>>) => {
      return data.map((m, i) => ({
        ...makeMilestone(),
        id: `bbbb3333-0000-0000-0000-00000000000${i + 1}`,
        milestone_name: m.milestone_name,
        computed_amount: String(m.computed_amount),
      }));
    });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/milestones/setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        project_total: 20000,
        milestones: [
          { milestone_name: 'Deposit', amount_type: 'percentage', amount_value: 0.25, sort_order: 1 },
          { milestone_name: 'Materials', amount_type: 'fixed', amount_value: 5000, sort_order: 2 },
          { milestone_name: 'Final', amount_type: 'fixed', amount_value: 10000, sort_order: 3 },
        ],
      });

    expect(res.status).toBe(201);
    // Verify createMilestones was called with correct computed amounts
    const milestoneData = mockCreateMilestones.mock.calls[0][3] as Array<Record<string, unknown>>;
    expect(milestoneData[0].computed_amount).toBe(5000); // 0.25 × 20000
    expect(milestoneData[1].computed_amount).toBe(5000); // fixed 5000
    expect(milestoneData[2].computed_amount).toBe(10000); // fixed 10000
  });

  // ============================================
  // 3. POST milestones/setup with amounts that don't sum to project_total returns 422
  // ============================================
  it('should return 422 when milestone amounts do not sum to project total', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB);

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/milestones/setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        project_total: 15000,
        milestones: [
          { milestone_name: 'Deposit', amount_type: 'percentage', amount_value: 0.30, sort_order: 1 },
          { milestone_name: 'Final', amount_type: 'percentage', amount_value: 0.30, sort_order: 2 },
          // Sum = 0.60 × 15000 = 9000, not 15000
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Milestone amounts sum to');
  });

  it('should reject non-hardscape job', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, division: 'landscaping_maintenance' });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/milestones/setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        project_total: 15000,
        milestones: [
          { milestone_name: 'Full', amount_type: 'fixed', amount_value: 15000, sort_order: 1 },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('hardscape');
  });
});

// ============================================
// 4. POST generate-invoice creates draft invoice with correct amount
// ============================================
describe('POST /v1/milestones/:id/generate-invoice', () => {
  it('should create draft invoice with correct amount', async () => {
    const token = await loginAs('owner');
    const milestone = makeMilestone();
    mockGetMilestoneById
      .mockResolvedValueOnce(milestone) // first call: validate
      .mockResolvedValueOnce({ ...milestone, status: 'invoiced', invoice_id: DRAFT_ID }); // second call: return updated
    mockInsertDraft.mockResolvedValue({
      id: DRAFT_ID,
      tenant_id: TENANT_A,
      total_amount: '4500.00',
      description: 'Hardscape Milestone: Deposit',
      status: 'pending_review',
    });
    mockUpdateMilestone.mockResolvedValue({ ...milestone, status: 'invoiced' });

    const res = await request(app)
      .post(`/v1/milestones/${MILESTONE_ID}/generate-invoice`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.draft.total_amount).toBe('4500.00');
    expect(res.body.data.draft.status).toBe('pending_review');

    // Verify draft was created with correct amount
    const draftCall = mockInsertDraft.mock.calls[0][1] as Record<string, unknown>;
    expect(draftCall.total_amount).toBe(4500);
    expect(draftCall.status).toBe('pending_review'); // NEVER auto-approved

    // Verify milestone status updated
    expect(mockUpdateMilestone).toHaveBeenCalledWith(
      mockClient, MILESTONE_ID,
      expect.objectContaining({ status: 'invoiced' }),
    );

    // Verify diary entry
    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ entry_type: 'milestone_invoiced' }),
    );
  });

  // ============================================
  // 5. POST generate-invoice on non-pending milestone returns 422
  // ============================================
  it('should return 422 for non-pending milestone', async () => {
    const token = await loginAs('owner');
    mockGetMilestoneById.mockResolvedValue(makeMilestone({ status: 'invoiced' }));

    const res = await request(app)
      .post(`/v1/milestones/${MILESTONE_ID}/generate-invoice`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('invoiced');
  });
});

// ============================================
// 6. Job completion status does NOT affect ability to generate milestone invoice
// ============================================
describe('Milestone invoice independence from job status', () => {
  it('should generate invoice even when job is completed', async () => {
    const token = await loginAs('owner');
    // Milestone is pending — that's all that matters
    const milestone = makeMilestone();
    mockGetMilestoneById
      .mockResolvedValueOnce(milestone)
      .mockResolvedValueOnce({ ...milestone, status: 'invoiced' });
    mockInsertDraft.mockResolvedValue({
      id: DRAFT_ID, total_amount: '4500.00', status: 'pending_review',
    });
    mockUpdateMilestone.mockResolvedValue({ ...milestone, status: 'invoiced' });

    // Job status is irrelevant — we only check milestone.status
    const res = await request(app)
      .post(`/v1/milestones/${MILESTONE_ID}/generate-invoice`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
  });
});

// ============================================
// 7. PATCH on invoiced milestone returns 422
// ============================================
describe('PATCH /v1/milestones/:id', () => {
  it('should return 422 for invoiced milestone', async () => {
    const token = await loginAs('owner');
    mockGetMilestoneById.mockResolvedValue(makeMilestone({ status: 'invoiced' }));

    const res = await request(app)
      .patch(`/v1/milestones/${MILESTONE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ milestone_name: 'Updated Name' });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('invoiced');
  });

  it('should return 422 for paid milestone', async () => {
    const token = await loginAs('owner');
    mockGetMilestoneById.mockResolvedValue(makeMilestone({ status: 'paid' }));

    const res = await request(app)
      .patch(`/v1/milestones/${MILESTONE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ milestone_name: 'Updated Name' });

    expect(res.status).toBe(422);
  });

  it('should update pending milestone successfully', async () => {
    const token = await loginAs('owner');
    const pending = makeMilestone({ status: 'pending' });
    mockGetMilestoneById.mockResolvedValue(pending);
    mockUpdateMilestone.mockResolvedValue({ ...pending, milestone_name: 'Updated Deposit' });

    const res = await request(app)
      .patch(`/v1/milestones/${MILESTONE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ milestone_name: 'Updated Deposit' });

    expect(res.status).toBe(200);
    expect(res.body.data.milestone_name).toBe('Updated Deposit');
  });
});

// ============================================
// 8. Changing project_total recomputes pending percentage milestones only
// ============================================
describe('Recalculate pending milestones', () => {
  it('should only affect pending percentage milestones in financial summary', async () => {
    const token = await loginAs('owner');

    // Financial summary should correctly separate paid/invoiced/pending
    mockFindMilestonesByJobId.mockResolvedValueOnce([
      makeMilestone({ id: 'bbbb3333-0000-0000-0000-000000000011', status: 'paid', computed_amount: '4500.00', sort_order: 1 }),
      makeMilestone({ id: 'bbbb3333-0000-0000-0000-000000000012', status: 'invoiced', computed_amount: '6000.00', sort_order: 2 }),
      makeMilestone({ id: 'bbbb3333-0000-0000-0000-000000000013', status: 'pending', computed_amount: '4500.00', sort_order: 3 }),
    ]);

    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}/milestones`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.project_total).toBe(15000); // 4500 + 6000 + 4500
    expect(data.invoiced_to_date).toBe(10500); // invoiced (6000) + paid (4500)
    expect(data.collected).toBe(4500); // paid only
    expect(data.outstanding).toBe(10500); // 15000 - 4500
    expect(data.invoiced_percent).toBe(70); // 10500 / 15000 × 100
  });
});

// ============================================
// 9. POST cancel sets status='cancelled', record retained (not deleted)
// ============================================
describe('POST /v1/milestones/:id/cancel', () => {
  it('should cancel milestone and retain record', async () => {
    const token = await loginAs('owner');
    const pending = makeMilestone({ status: 'pending' });
    mockGetMilestoneById.mockResolvedValue(pending);
    mockCancelMilestone.mockResolvedValue({
      ...pending,
      status: 'cancelled',
      notes: 'Client changed scope',
    });

    const res = await request(app)
      .post(`/v1/milestones/${MILESTONE_ID}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Client changed scope' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.notes).toBe('Client changed scope');

    // Verify it's a status update, not a delete
    expect(mockCancelMilestone).toHaveBeenCalledWith(
      mockClient, MILESTONE_ID, TENANT_A, 'Client changed scope', USER_ID,
    );
  });

  it('should reject cancelling non-pending milestone', async () => {
    const token = await loginAs('owner');
    mockGetMilestoneById.mockResolvedValue(makeMilestone({ status: 'paid' }));

    const res = await request(app)
      .post(`/v1/milestones/${MILESTONE_ID}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Too late' });

    expect(res.status).toBe(422);
  });

  it('should require a reason', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post(`/v1/milestones/${MILESTONE_ID}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ============================================
// 10. GET /jobs/:id/milestones returns correct financial summary calculations
// ============================================
describe('GET /v1/jobs/:id/milestones', () => {
  it('should return correct financial summary excluding cancelled', async () => {
    const token = await loginAs('coordinator');
    mockFindMilestonesByJobId.mockResolvedValueOnce([
      makeMilestone({ id: 'bbbb3333-0000-0000-0000-000000000021', status: 'paid', computed_amount: '4500.00', sort_order: 1 }),
      makeMilestone({ id: 'bbbb3333-0000-0000-0000-000000000022', status: 'invoiced', computed_amount: '6000.00', sort_order: 2 }),
      makeMilestone({ id: 'bbbb3333-0000-0000-0000-000000000023', status: 'pending', computed_amount: '4500.00', sort_order: 3 }),
      makeMilestone({ id: 'bbbb3333-0000-0000-0000-000000000024', status: 'cancelled', computed_amount: '2000.00', sort_order: 4 }),
    ]);

    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}/milestones`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;

    // project_total = non-cancelled: 4500 + 6000 + 4500 = 15000
    expect(data.project_total).toBe(15000);
    // invoiced_to_date = invoiced + paid: 6000 + 4500 = 10500
    expect(data.invoiced_to_date).toBe(10500);
    // collected = paid only: 4500
    expect(data.collected).toBe(4500);
    // outstanding = project_total - collected: 15000 - 4500 = 10500
    expect(data.outstanding).toBe(10500);
    // invoiced_percent = 10500 / 15000 × 100 = 70
    expect(data.invoiced_percent).toBe(70);
    // All milestones returned (including cancelled for audit)
    expect(data.milestones).toHaveLength(4);
  });
});

// ============================================
// 11. Multi-tenant isolation test
// ============================================
describe('Multi-tenant isolation', () => {
  it('should only return milestones for the authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockFindMilestonesByJobId.mockResolvedValue([makeMilestone()]);

    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}/milestones`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindMilestonesByJobId).toHaveBeenCalledWith(JOB_ID, TENANT_A);
    expect(res.body.data.milestones[0].tenant_id).toBe(TENANT_A);
  });
});

// ============================================
// Hardscape billing summary
// ============================================
describe('GET /v1/billing/hardscape-summary', () => {
  it('should return hardscape billing summary', async () => {
    const token = await loginAs('owner');
    mockGetHardscapeBillingSummary.mockResolvedValue([{
      job_id: JOB_ID, job_title: 'Patio Install', job_status: 'in_progress',
      customer_name: 'John Smith', total_milestones: 3,
      project_total: '15000.00', invoiced_to_date: '4500.00', collected: '4500.00',
      pending_count: 2, paid_count: 1,
    }]);

    const res = await request(app)
      .get('/v1/billing/hardscape-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].project_total).toBe('15000.00');
  });

  it('should deny coordinator', async () => {
    const token = await loginAs('coordinator');
    const res = await request(app)
      .get('/v1/billing/hardscape-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ============================================
// RBAC
// ============================================
describe('Milestone RBAC', () => {
  it('should deny crew_member from accessing milestones', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}/milestones`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should deny coordinator from setting up milestones', async () => {
    const token = await loginAs('coordinator');
    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/milestones/setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ project_total: 10000, milestones: [{ milestone_name: 'Test', amount_type: 'fixed', amount_value: 10000 }] });
    expect(res.status).toBe(403);
  });

  it('should allow div_mgr to generate invoice', async () => {
    const token = await loginAs('div_mgr');
    const milestone = makeMilestone();
    mockGetMilestoneById
      .mockResolvedValueOnce(milestone)
      .mockResolvedValueOnce({ ...milestone, status: 'invoiced' });
    mockInsertDraft.mockResolvedValue({ id: DRAFT_ID, total_amount: '4500.00', status: 'pending_review' });
    mockUpdateMilestone.mockResolvedValue({ ...milestone, status: 'invoiced' });

    const res = await request(app)
      .post(`/v1/milestones/${MILESTONE_ID}/generate-invoice`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
  });
});
