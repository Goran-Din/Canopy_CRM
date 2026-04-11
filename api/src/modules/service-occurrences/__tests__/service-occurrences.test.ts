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

vi.mock('../../../config/redis.js', () => ({
  redis: { isOpen: true, ping: vi.fn().mockResolvedValue('PONG'), connect: vi.fn(), on: vi.fn() },
  connectRedis: vi.fn(),
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
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
}));

// --- Mock occurrence repository ---
const mockBulkInsert = vi.fn();
const mockFindAll = vi.fn();
const mockGetById = vi.fn();
const mockOccUpdate = vi.fn();
const mockCountByContractService = vi.fn();
const mockGetServiceListSummary = vi.fn();
const mockGetServiceDetail = vi.fn();
const mockGetSeasonSummary = vi.fn();
const mockOccAcquireClient = vi.fn();

vi.mock('../repository.js', () => ({
  bulkInsert: (...args: unknown[]) => mockBulkInsert(...args),
  findAll: (...args: unknown[]) => mockFindAll(...args),
  getById: (...args: unknown[]) => mockGetById(...args),
  update: (...args: unknown[]) => mockOccUpdate(...args),
  countByContractService: (...args: unknown[]) => mockCountByContractService(...args),
  getServiceListSummary: (...args: unknown[]) => mockGetServiceListSummary(...args),
  getServiceDetail: (...args: unknown[]) => mockGetServiceDetail(...args),
  getSeasonSummary: (...args: unknown[]) => mockGetSeasonSummary(...args),
  findForBillingPeriod: vi.fn(),
  acquireClient: (...args: unknown[]) => mockOccAcquireClient(...args),
}));

// --- Mock contracts repository ---
const mockContractFindById = vi.fn();

vi.mock('../../contracts/repository.js', () => ({
  findById: (...args: unknown[]) => mockContractFindById(...args),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getLineItems: vi.fn(),
}));

// --- Mock jobs repository ---
const mockGetNextJobNumber = vi.fn();
const mockCreateWithClient = vi.fn();
const mockUpdateStatusWithClient = vi.fn();

vi.mock('../../jobs/repository.js', () => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  softDelete: vi.fn(),
  getByDateRange: vi.fn(),
  getByProperty: vi.fn(),
  addPhoto: vi.fn(),
  getPhotos: vi.fn(),
  addChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
  getChecklist: vi.fn(),
  getChecklistItemById: vi.fn(),
  getStats: vi.fn(),
  customerExists: vi.fn(),
  propertyBelongsToCustomer: vi.fn(),
  contractExists: vi.fn(),
  getNextJobNumber: (...args: unknown[]) => mockGetNextJobNumber(...args),
  createWithClient: (...args: unknown[]) => mockCreateWithClient(...args),
  updateStatusWithClient: (...args: unknown[]) => mockUpdateStatusWithClient(...args),
  acquireClient: vi.fn(),
}));

// --- Mock diary repository ---
const mockDiaryInsert = vi.fn();

vi.mock('../../jobs/diary/diary.repository.js', () => ({
  insert: (...args: unknown[]) => mockDiaryInsert(...args),
  insertStandalone: vi.fn(),
  findByJobId: vi.fn(),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CONTRACT_ID = '11111111-0000-0000-0000-000000000001';
const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const OCC_ID = '22222222-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';

const SAMPLE_CONTRACT = {
  id: CONTRACT_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  property_id: PROPERTY_ID,
  service_tier: 'gold',
  package_services: [
    { service_code: 'FERT', service_name: 'Fertilization', occurrence_type: 'seasonal', occurrence_count: 4, preferred_months: ['Apr', 'Jun', 'Aug', 'Oct'] },
    { service_code: 'AERATE', service_name: 'Aeration', occurrence_type: 'one_time', occurrence_count: 1 },
    { service_code: 'MOW', service_name: 'Weekly Mowing', occurrence_type: 'weekly', occurrence_count: 30 },
  ],
  line_items: [],
};

const SAMPLE_OCCURRENCE = {
  id: OCC_ID,
  tenant_id: TENANT_A,
  contract_id: CONTRACT_ID,
  property_id: PROPERTY_ID,
  customer_id: CUSTOMER_ID,
  service_code: 'FERT',
  service_name: 'Fertilization',
  occurrence_number: 1,
  season_year: 2026,
  status: 'pending',
  assigned_date: null,
  preferred_month: 'Apr',
  job_id: null,
  skipped_reason: null,
  skipped_date: null,
  recovery_date: null,
  is_included_in_invoice: false,
  notes: null,
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
  mockOccAcquireClient.mockResolvedValue(mockClient);
});

// ============================================
// Season Setup — Generate Occurrences
// ============================================
describe('POST /v1/contracts/:contractId/season-setup', () => {
  it('should generate occurrences from contract package_services', async () => {
    const token = await loginAs('coordinator');
    mockContractFindById.mockResolvedValue(SAMPLE_CONTRACT);
    mockBulkInsert.mockResolvedValue(5); // 4 FERT + 1 AERATE = 5

    const res = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    expect(res.status).toBe(201);
    expect(res.body.data.total_generated).toBe(5); // 4 FERT + 1 AERATE
    expect(res.body.data.inserted).toBe(5);
  });

  it('should skip weekly services (MOW)', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(SAMPLE_CONTRACT);
    mockBulkInsert.mockResolvedValue(5);

    await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    // bulkInsert should be called with 5 occurrences (not 35 including weekly)
    expect(mockBulkInsert).toHaveBeenCalledWith(
      mockClient,
      expect.arrayContaining([
        expect.objectContaining({ service_code: 'FERT', occurrence_number: 1 }),
        expect.objectContaining({ service_code: 'AERATE', occurrence_number: 1 }),
      ]),
    );
    // Should NOT contain MOW
    const insertedOccs = mockBulkInsert.mock.calls[0][1] as Array<{ service_code: string }>;
    expect(insertedOccs.every(o => o.service_code !== 'MOW')).toBe(true);
  });

  it('should be idempotent (ON CONFLICT DO NOTHING)', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue(SAMPLE_CONTRACT);
    mockBulkInsert.mockResolvedValue(0); // 0 inserted because all exist

    const res = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    expect(res.status).toBe(201);
    expect(res.body.data.total_generated).toBe(5);
    expect(res.body.data.inserted).toBe(0); // All already existed
  });

  it('should reject contract with no package_services', async () => {
    const token = await loginAs('owner');
    mockContractFindById.mockResolvedValue({ ...SAMPLE_CONTRACT, package_services: [] });

    const res = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    expect(res.status).toBe(400);
  });

  it('should deny crew_leader', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    expect(res.status).toBe(403);
  });
});

// ============================================
// Assign Occurrence
// ============================================
describe('PATCH /v1/service-occurrences/:id/assign', () => {
  it('should assign occurrence and create job', async () => {
    const token = await loginAs('coordinator');
    mockGetById.mockResolvedValue(SAMPLE_OCCURRENCE);
    mockCountByContractService.mockResolvedValue(4);
    mockGetNextJobNumber.mockResolvedValue('0001-26');
    mockCreateWithClient.mockResolvedValue({ id: JOB_ID, job_number: '0001-26' });
    mockDiaryInsert.mockResolvedValue({});
    mockOccUpdate.mockResolvedValue({ ...SAMPLE_OCCURRENCE, status: 'assigned', job_id: JOB_ID });

    const res = await request(app)
      .patch(`/v1/service-occurrences/${OCC_ID}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assigned_date: '2026-04-15' });

    expect(res.status).toBe(200);
    expect(mockCreateWithClient).toHaveBeenCalledWith(
      mockClient,
      TENANT_A,
      expect.objectContaining({
        title: 'Fertilization — 1/4',
        creation_path: 'instant_work_order',
        scheduled_date: '2026-04-15',
      }),
      USER_ID,
    );
  });

  it('should reject assigning non-pending occurrence', async () => {
    const token = await loginAs('owner');
    mockGetById.mockResolvedValue({ ...SAMPLE_OCCURRENCE, status: 'assigned' });

    const res = await request(app)
      .patch(`/v1/service-occurrences/${OCC_ID}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assigned_date: '2026-04-15' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Only pending');
  });
});

// ============================================
// Bulk Assign
// ============================================
describe('POST /v1/service-occurrences/bulk-assign', () => {
  it('should create multiple jobs', async () => {
    const token = await loginAs('coordinator');
    const OCC_ID2 = '22222222-0000-0000-0000-000000000002';
    mockGetById
      .mockResolvedValueOnce(SAMPLE_OCCURRENCE)
      .mockResolvedValueOnce({ ...SAMPLE_OCCURRENCE, id: OCC_ID2, occurrence_number: 2 });
    mockCountByContractService.mockResolvedValue(4);
    mockGetNextJobNumber.mockResolvedValue('0001-26');
    mockCreateWithClient.mockResolvedValue({ id: JOB_ID, job_number: '0001-26' });
    mockDiaryInsert.mockResolvedValue({});
    mockOccUpdate.mockResolvedValue(SAMPLE_OCCURRENCE);

    const res = await request(app)
      .post('/v1/service-occurrences/bulk-assign')
      .set('Authorization', `Bearer ${token}`)
      .send({ occurrence_ids: [OCC_ID, OCC_ID2], assigned_date: '2026-04-15' });

    expect(res.status).toBe(200);
    expect(res.body.data.jobs_created).toBe(2);
    expect(res.body.data.occurrences_assigned).toBe(2);
  });
});

// ============================================
// Skip Occurrence
// ============================================
describe('PATCH /v1/service-occurrences/:id/skip', () => {
  it('should skip occurrence and update job if linked', async () => {
    const token = await loginAs('coordinator');
    mockGetById.mockResolvedValue({ ...SAMPLE_OCCURRENCE, status: 'assigned', job_id: JOB_ID });
    mockOccUpdate.mockResolvedValue({ ...SAMPLE_OCCURRENCE, status: 'skipped' });
    mockUpdateStatusWithClient.mockResolvedValue({ id: JOB_ID, status: 'skipped' });
    mockDiaryInsert.mockResolvedValue({});

    const res = await request(app)
      .patch(`/v1/service-occurrences/${OCC_ID}/skip`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        skipped_reason: 'Customer requested delay',
        skipped_date: '2026-04-15',
        recovery_date: '2026-05-01',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('skipped');
    expect(mockUpdateStatusWithClient).toHaveBeenCalledWith(
      mockClient, TENANT_A, JOB_ID, 'skipped', null, USER_ID,
    );
    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ entry_type: 'status_change' }),
    );
  });
});

// ============================================
// Service List Summary
// ============================================
describe('GET /v1/service-lists', () => {
  it('should return aggregated summary', async () => {
    const token = await loginAs('coordinator');
    mockGetServiceListSummary.mockResolvedValue([
      { service_code: 'FERT', service_name: 'Fertilization', total_properties: '15', occurrence_number: 1, pending: '10', assigned: '3', completed: '2', skipped: '0' },
    ]);

    const res = await request(app)
      .get('/v1/service-lists?season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].service_code).toBe('FERT');
  });
});

// ============================================
// Season Summary
// ============================================
describe('GET /v1/service-occurrences/season-summary', () => {
  it('should return season stats', async () => {
    const token = await loginAs('owner');
    mockGetSeasonSummary.mockResolvedValue({
      total: 50, pending: 20, assigned: 15, completed: 10, skipped: 5,
    });

    const res = await request(app)
      .get('/v1/service-occurrences/season-summary?season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(50);
    expect(res.body.data.completed).toBe(10);
  });
});

// ============================================
// Mark Completed
// ============================================
describe('PATCH /v1/service-occurrences/:id/complete', () => {
  it('should mark occurrence as completed', async () => {
    const token = await loginAs('crew_leader');
    mockGetById.mockResolvedValue(SAMPLE_OCCURRENCE);
    mockOccUpdate.mockResolvedValue({ ...SAMPLE_OCCURRENCE, status: 'completed' });

    const res = await request(app)
      .patch(`/v1/service-occurrences/${OCC_ID}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });
});

// ============================================
// Auth
// ============================================
describe('Authentication', () => {
  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get('/v1/service-occurrences');
    expect(res.status).toBe(401);
  });
});
