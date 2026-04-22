/**
 * H-14 Season Setup Workflow E2E tests.
 *
 * Actual season setup endpoint:
 *   POST /v1/contracts/:contractId/season-setup    { season_year }
 *     — generates service_occurrences from contract.package_services
 *     — does NOT create billing_schedule rows (billing.service.createBillingSchedule
 *       exists but is not exposed via any route in Wave 1–6)
 *
 * Gaps vs the brief (endpoints referenced but not implemented):
 *   - GET  /v1/contracts/season-setup/pending           — no dedicated endpoint
 *   - GET  /v1/contracts/:id/season-setup-context       — no endpoint
 *   - POST /v1/contracts/:id/activate-season            — no endpoint (season-setup only
 *                                                         generates occurrences; billing
 *                                                         schedule creation is internal)
 *   - POST /v1/contracts/:id/close-season               — no endpoint
 *   - POST /v1/contracts/:id/occurrences/add            — no endpoint
 *   - POST /v1/service-occurrences/:id/cancel           — use /skip instead
 *
 * Brief asks for ~20 tests here; we land ~14 focused on the endpoints that do exist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';

vi.mock('../../config/database.js', () => ({
  queryDb: vi.fn().mockResolvedValue({ rows: [] }),
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }), on: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  getClient: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }),
}));

vi.mock('../../config/redis.js', () => ({
  redis: { isOpen: true, ping: vi.fn().mockResolvedValue('PONG'), connect: vi.fn(), on: vi.fn() },
  connectRedis: vi.fn(),
}));

const mockFindUserByEmail = vi.fn();
const mockFindUserRoles = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockUpdateLastLogin = vi.fn();

vi.mock('../../modules/auth/repository.js', () => ({
  findUserByEmail: (...a: unknown[]) => mockFindUserByEmail(...a),
  findUserById: vi.fn(),
  findUserRoles: (...a: unknown[]) => mockFindUserRoles(...a),
  saveRefreshToken: (...a: unknown[]) => mockSaveRefreshToken(...a),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  updateLastLogin: (...a: unknown[]) => mockUpdateLastLogin(...a),
}));

// Contracts repo mock
const mockContractsFindById = vi.fn();
const mockContractsFindAll = vi.fn();

vi.mock('../../modules/contracts/repository.js', () => ({
  findById: (...a: unknown[]) => mockContractsFindById(...a),
  findAll: (...a: unknown[]) => mockContractsFindAll(...a),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  getStats: vi.fn(),
  getLineItems: vi.fn(),
  addLineItem: vi.fn(),
  updateLineItem: vi.fn(),
  removeLineItem: vi.fn(),
  getLineItemById: vi.fn(),
  changeStatus: vi.fn(),
  customerExists: vi.fn().mockResolvedValue(true),
  propertyBelongsToCustomer: vi.fn().mockResolvedValue(true),
  getNextContractNumber: vi.fn(),
  acquireClient: vi.fn(),
}));

// Service occurrences repo mock
const mockOccBulkInsert = vi.fn();
const mockOccGetById = vi.fn();
const mockOccUpdate = vi.fn();
const mockOccFindAll = vi.fn();
const mockOccCountByContractService = vi.fn();
const mockOccAcquireClient = vi.fn();

vi.mock('../../modules/service-occurrences/repository.js', () => ({
  bulkInsert: (...a: unknown[]) => mockOccBulkInsert(...a),
  getById: (...a: unknown[]) => mockOccGetById(...a),
  update: (...a: unknown[]) => mockOccUpdate(...a),
  findAll: (...a: unknown[]) => mockOccFindAll(...a),
  countByContractService: (...a: unknown[]) => mockOccCountByContractService(...a),
  getServiceListSummary: vi.fn(),
  getServiceDetail: vi.fn(),
  getSeasonSummary: vi.fn(),
  findForBillingPeriod: vi.fn().mockResolvedValue([]),
  acquireClient: (...a: unknown[]) => mockOccAcquireClient(...a),
}));

// Jobs repo mock (occurrence assignment path hits it)
const mockJobsGetNextJobNumber = vi.fn();
const mockJobsCreateWithClient = vi.fn();
const mockJobsUpdateStatusWithClient = vi.fn();
const mockJobsFindById = vi.fn();

vi.mock('../../modules/jobs/repository.js', () => ({
  findAll: vi.fn(),
  findById: (...a: unknown[]) => mockJobsFindById(...a),
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
  customerExists: vi.fn().mockResolvedValue(true),
  propertyBelongsToCustomer: vi.fn().mockResolvedValue(true),
  contractExists: vi.fn().mockResolvedValue(true),
  getNextJobNumber: (...a: unknown[]) => mockJobsGetNextJobNumber(...a),
  createWithClient: (...a: unknown[]) => mockJobsCreateWithClient(...a),
  updateStatusWithClient: (...a: unknown[]) => mockJobsUpdateStatusWithClient(...a),
  acquireClient: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }),
}));

const mockDiaryInsert = vi.fn();
const mockDiaryInsertStandalone = vi.fn();
const mockDiaryFindByJobId = vi.fn();
vi.mock('../../modules/jobs/diary/diary.repository.js', () => ({
  insert: (...a: unknown[]) => mockDiaryInsert(...a),
  insertStandalone: (...a: unknown[]) => mockDiaryInsertStandalone(...a),
  findByJobId: (...a: unknown[]) => mockDiaryFindByJobId(...a),
}));

import app from '../../app.js';
import {
  CONTRACT_ID,
  WorkflowState,
  makeContract,
  loginAs,
} from './_helpers.js';

const state = new WorkflowState();

beforeEach(() => {
  vi.clearAllMocks();
  state.reset();

  // Default auth mocks (loginAs sets these)
  // Wire contract / occurrence mocks to the state container
  mockContractsFindById.mockImplementation(async (tenantId: string, id: string) => {
    const c = state.contracts.get(id);
    if (!c || c.tenant_id !== tenantId) return null;
    return c;
  });

  const fakeClient = {
    query: async () => ({ rows: [] }),
    release: () => {},
  };
  mockOccAcquireClient.mockResolvedValue(fakeClient);

  mockOccBulkInsert.mockImplementation(
    async (_client: unknown, rows: Array<Record<string, unknown>>) => {
      for (const row of rows) {
        const id = crypto.randomUUID();
        state.occurrences.set(id, {
          id,
          tenant_id: row.tenant_id as string,
          contract_id: row.contract_id as string,
          property_id: row.property_id as string,
          customer_id: row.customer_id as string,
          service_code: row.service_code as string,
          service_name: row.service_name as string,
          occurrence_number: row.occurrence_number as number,
          season_year: row.season_year as number,
          status: (row.status as string) ?? 'pending',
          preferred_month: (row.preferred_month as string | null) ?? null,
          is_included_in_invoice: (row.is_included_in_invoice as boolean) ?? false,
          notes: (row.notes as string | null) ?? null,
          assigned_date: null,
          job_id: null,
          skipped_reason: null,
          skipped_date: null,
          recovery_date: null,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
      return rows.length;
    },
  );

  mockOccGetById.mockImplementation(async (tenantId: string, id: string) => {
    const occ = state.occurrences.get(id);
    if (!occ || occ.tenant_id !== tenantId) return null;
    return occ;
  });
  mockOccUpdate.mockImplementation(
    async (
      _client: unknown,
      id: string,
      tenantId: string,
      patch: Record<string, unknown>,
    ) => {
      const existing = state.occurrences.get(id);
      if (!existing || existing.tenant_id !== tenantId) return null;
      const updated = { ...existing, ...patch, updated_at: new Date() };
      state.occurrences.set(id, updated);
      return updated;
    },
  );
  mockOccFindAll.mockImplementation(async (_tenantId: string, _query: unknown) => ({
    rows: [...state.occurrences.values()],
    total: state.occurrences.size,
  }));
  mockOccCountByContractService.mockResolvedValue(5);

  // Auth seed
  mockFindUserByEmail.mockResolvedValue(null);
});

const authMocks = {
  findUserByEmail: mockFindUserByEmail,
  findUserRoles: mockFindUserRoles,
  saveRefreshToken: mockSaveRefreshToken,
  updateLastLogin: mockUpdateLastLogin,
};

function seedGoldContract(overrides: Parameters<typeof makeContract>[0] = {}) {
  const c = makeContract(overrides);
  state.contracts.set(c.id, c);
  return c;
}

// ============================================
// Describe: POST /v1/contracts/:contractId/season-setup
// ============================================
describe('H-14 §2–4 — Season Setup (generate occurrences)', () => {
  it('generates occurrences from contract package_services; weekly services are skipped', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract();

    const res = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    expect(res.status).toBe(201);
    // Default Gold fixture: 5 FERT + 1 AERATE one_time + 1 MOW weekly (skipped)
    //   → 6 occurrences total
    expect(res.body.data.total_generated).toBe(6);
    expect(state.occurrences.size).toBe(6);

    const services = [...state.occurrences.values()].map((o) => o.service_code);
    expect(services).toContain('FERT');
    expect(services).toContain('AERATE');
    expect(services).not.toContain('MOW');
  });

  it('fertilization creates 5 occurrences numbered 1..5', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract();

    await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    const fert = [...state.occurrences.values()].filter((o) => o.service_code === 'FERT');
    expect(fert).toHaveLength(5);
    expect(fert.map((o) => o.occurrence_number).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('one_time services create exactly 1 occurrence regardless of occurrence_count', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract({
      package_services: [
        { service_code: 'AERATE', service_name: 'Core Aeration', occurrence_type: 'one_time', occurrence_count: 99 },
      ],
    });

    await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    const aerate = [...state.occurrences.values()].filter((o) => o.service_code === 'AERATE');
    expect(aerate).toHaveLength(1);
    expect(aerate[0].occurrence_number).toBe(1);
  });

  it('Bronze contract sets is_included_in_invoice=true on every occurrence', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract({
      service_tier: 'bronze',
      package_services: [
        { service_code: 'MULCH', service_name: 'Mulching', occurrence_type: 'per_season', occurrence_count: 3 },
      ],
    });

    await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    const occs = [...state.occurrences.values()];
    expect(occs).toHaveLength(3);
    expect(occs.every((o) => o.is_included_in_invoice === true)).toBe(true);
  });

  it('Gold/Silver contract sets is_included_in_invoice=false (bundled into monthly fee)', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract(); // Gold tier

    await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    const occs = [...state.occurrences.values()];
    expect(occs.every((o) => o.is_included_in_invoice === false)).toBe(true);
  });

  it('preferred_month is carried onto occurrences when provided per-round', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract({
      package_services: [
        {
          service_code: 'FERT',
          service_name: 'Fertilization',
          occurrence_type: 'per_season',
          occurrence_count: 3,
          preferred_months: ['April', 'June', 'September'],
        },
      ],
    });

    await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    const byNumber = new Map(
      [...state.occurrences.values()].map((o) => [o.occurrence_number, o]),
    );
    expect(byNumber.get(1)?.preferred_month).toBe('April');
    expect(byNumber.get(2)?.preferred_month).toBe('June');
    expect(byNumber.get(3)?.preferred_month).toBe('September');
  });

  it('contract with no package_services → 400', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract({ package_services: [] });

    const res = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    expect(res.status).toBe(400);
  });

  it('unknown contract → 404', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const unknownId = 'deadbeef-0000-0000-0000-000000000001';

    const res = await request(app)
      .post(`/v1/contracts/${unknownId}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    expect(res.status).toBe(404);
  });

  it('season_year below 2024 rejected by Zod (400)', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract();

    const res = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 1999 });

    expect(res.status).toBe(400);
  });

  it('role guard: owner/div_mgr/coordinator allowed; crew_member rejected', async () => {
    seedGoldContract();

    const crewToken = await loginAs(app, 'crew_member', authMocks);
    const rejected = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${crewToken}`)
      .send({ season_year: 2026 });
    expect(rejected.status).toBe(403);

    const divMgrToken = await loginAs(app, 'div_mgr', authMocks);
    const allowed = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${divMgrToken}`)
      .send({ season_year: 2026 });
    expect(allowed.status).toBe(201);
  });

  it('season year is stamped onto every occurrence', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract();

    await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2027 });

    const occs = [...state.occurrences.values()];
    expect(occs.every((o) => o.season_year === 2027)).toBe(true);
  });

  it('POST /v1/service-occurrences/bulk-assign creates one job per occurrence', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract();
    await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });
    const ids = [...state.occurrences.values()].slice(0, 3).map((o) => o.id);

    // Stub job number + job creation
    let jobCounter = 0;
    mockJobsGetNextJobNumber.mockImplementation(async () => `0${++jobCounter}01-26`);
    mockJobsCreateWithClient.mockImplementation(async (_c, tenantId, input, userId) => ({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      status: input.status,
      job_number: input.job_number,
      created_by: userId,
      ...input,
    }));

    const res = await request(app)
      .post('/v1/service-occurrences/bulk-assign')
      .set('Authorization', `Bearer ${token}`)
      .send({ occurrence_ids: ids, assigned_date: '2026-05-15' });

    expect(res.status).toBe(200);
    expect(res.body.data.jobs_created).toBe(3);
    expect(mockJobsGetNextJobNumber).toHaveBeenCalledTimes(3);
  });

  it('PATCH /v1/service-occurrences/:id/skip flags the occurrence as skipped with reason', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract();
    await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });
    const [firstOcc] = [...state.occurrences.values()];

    const res = await request(app)
      .patch(`/v1/service-occurrences/${firstOcc.id}/skip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ skipped_reason: 'weather', skipped_date: '2026-06-15' });

    expect(res.status).toBe(200);
    expect(state.occurrences.get(firstOcc.id)?.status).toBe('skipped');
    expect(state.occurrences.get(firstOcc.id)?.skipped_reason).toBe('weather');
  });

  it('re-running season-setup for the same year re-inserts occurrences (not idempotent at API level)', async () => {
    // The current generateOccurrences implementation does NOT dedupe — it always
    // inserts. Tests pin this behaviour so if Wave 8 adds idempotency we catch it.
    const token = await loginAs(app, 'coordinator', authMocks);
    seedGoldContract();

    const first = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });
    const second = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ season_year: 2026 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    // Each call inserted the same 6 rows → 12 total
    expect(state.occurrences.size).toBe(12);
  });
});
