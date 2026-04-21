/**
 * H-15 Recurring Billing Workflow E2E tests.
 *
 * Actual endpoints used:
 *   POST /v1/billing/generate-drafts            — manual draft generation trigger
 *   GET  /v1/billing/drafts?status=...          — list drafts
 *   PATCH /v1/billing/drafts/:id                — edit a pending draft
 *   POST /v1/billing/drafts/:id/approve         — approve (flips schedule → approved)
 *   POST /v1/billing/drafts/:id/reject          — reject with reason
 *   POST /v1/milestones/:id/generate-invoice    — V2 hardscape milestone invoice
 *   POST /v1/webhooks/xero                      — Xero PAID webhook (HMAC validated)
 *
 * Gaps vs the brief (noted inline where tested):
 *   - No Xero push on approve — current code only flips status to 'approved'. The brief's
 *     "Xero push failure / retry-push" sequence is documented as a TODO in the service
 *     (billing/service.ts:358 — "In production: push to Xero here").
 *   - No POST /v1/invoices/:id/escalate endpoint.
 *   - Draft model has its own state machine (pending_review → approved/rejected);
 *     billing_schedule has (scheduled → draft → approved → skipped).
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

// Contracts repo
const mockContractsFindById = vi.fn();
vi.mock('../../modules/contracts/repository.js', () => ({
  findById: (...a: unknown[]) => mockContractsFindById(...a),
  findAll: vi.fn(),
  create: vi.fn(), update: vi.fn(), softDelete: vi.fn(),
  getStats: vi.fn(), getLineItems: vi.fn(), addLineItem: vi.fn(),
  updateLineItem: vi.fn(), removeLineItem: vi.fn(), getLineItemById: vi.fn(),
  changeStatus: vi.fn(),
  customerExists: vi.fn().mockResolvedValue(true),
  propertyBelongsToCustomer: vi.fn().mockResolvedValue(true),
  getNextContractNumber: vi.fn(),
  acquireClient: vi.fn(),
}));

// Service occurrences repo (used by Bronze per-cut invoice builder)
vi.mock('../../modules/service-occurrences/repository.js', () => ({
  bulkInsert: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  findAll: vi.fn(),
  countByContractService: vi.fn(),
  getServiceListSummary: vi.fn(),
  getServiceDetail: vi.fn(),
  getSeasonSummary: vi.fn(),
  findForBillingPeriod: vi.fn().mockResolvedValue([]),
  acquireClient: vi.fn(),
}));

// Billing repo
const mockBillingAcquireClient = vi.fn();
const mockFindDueScheduleEntries = vi.fn();
const mockInsertDraft = vi.fn();
const mockUpdateScheduleStatus = vi.fn();
const mockGetDraftById = vi.fn();
const mockFindDrafts = vi.fn();
const mockUpdateDraft = vi.fn();
const mockGetMilestoneById = vi.fn();
const mockUpdateMilestone = vi.fn();
const mockFindMilestonesByJobId = vi.fn();
const mockCreateMilestones = vi.fn();

vi.mock('../../modules/billing/repository.js', () => ({
  bulkInsertSchedule: vi.fn(),
  findDueScheduleEntries: (...a: unknown[]) => mockFindDueScheduleEntries(...a),
  findSchedule: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  updateScheduleStatus: (...a: unknown[]) => mockUpdateScheduleStatus(...a),
  insertDraft: (...a: unknown[]) => mockInsertDraft(...a),
  getDraftById: (...a: unknown[]) => mockGetDraftById(...a),
  findDrafts: (...a: unknown[]) => mockFindDrafts(...a),
  updateDraft: (...a: unknown[]) => mockUpdateDraft(...a),
  getMilestoneById: (...a: unknown[]) => mockGetMilestoneById(...a),
  updateMilestone: (...a: unknown[]) => mockUpdateMilestone(...a),
  findMilestonesByJobId: (...a: unknown[]) => mockFindMilestonesByJobId(...a),
  createMilestones: (...a: unknown[]) => mockCreateMilestones(...a),
  cancelMilestone: vi.fn(),
  getDashboardStats: vi.fn().mockResolvedValue({}),
  findOverdue: vi.fn().mockResolvedValue([]),
  acquireClient: (...a: unknown[]) => mockBillingAcquireClient(...a),
}));

// Jobs repo (milestones service needs this)
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
  getNextJobNumber: vi.fn(),
  createWithClient: vi.fn(),
  updateStatusWithClient: vi.fn(),
  acquireClient: vi.fn(),
}));

const mockDiaryInsert = vi.fn();
const mockDiaryInsertStandalone = vi.fn();
vi.mock('../../modules/jobs/diary/diary.repository.js', () => ({
  insert: (...a: unknown[]) => mockDiaryInsert(...a),
  insertStandalone: (...a: unknown[]) => mockDiaryInsertStandalone(...a),
  findByJobId: vi.fn(),
}));

import app from '../../app.js';
import {
  TENANT_A,
  CONTRACT_ID,
  CUSTOMER_ID,
  JOB_ID,
  WorkflowState,
  makeContract,
  loginAs,
  type InvoiceDraftRow,
  type BillingScheduleRow,
} from './_helpers.js';

const state = new WorkflowState();

beforeEach(() => {
  vi.clearAllMocks();
  state.reset();
  process.env.XERO_WEBHOOK_KEY = 'test-xero-webhook-secret';

  // Contract lookup served from state
  mockContractsFindById.mockImplementation(async (tenantId: string, id: string) => {
    const c = state.contracts.get(id);
    if (!c || c.tenant_id !== tenantId) return null;
    return c;
  });

  const fakeClient = {
    query: async () => ({ rows: [] }),
    release: () => {},
  };
  mockBillingAcquireClient.mockResolvedValue(fakeClient);

  mockFindDueScheduleEntries.mockImplementation(
    async (tenantId: string, billingDate: string) => {
      const iso = billingDate;
      return [...state.billingSchedule.values()].filter(
        (s) =>
          s.tenant_id === tenantId &&
          s.status === 'scheduled' &&
          new Date(s.billing_date).toISOString().slice(0, 10) === iso,
      );
    },
  );

  mockInsertDraft.mockImplementation(
    async (_client: unknown, row: Record<string, unknown>): Promise<InvoiceDraftRow> => {
      const id = crypto.randomUUID();
      const draft: InvoiceDraftRow = {
        id,
        tenant_id: row.tenant_id as string,
        customer_id: row.customer_id as string,
        contract_id: (row.contract_id as string | null) ?? null,
        billing_schedule_id: (row.billing_schedule_id as string | null) ?? null,
        line_items: row.line_items as Array<Record<string, unknown>>,
        subtotal: row.subtotal as number,
        total_amount: row.total_amount as number,
        description: (row.description as string | null) ?? null,
        status: (row.status as string) ?? 'pending_review',
        created_at: new Date(),
      };
      state.invoiceDrafts.set(id, draft);
      return draft;
    },
  );

  mockUpdateScheduleStatus.mockImplementation(
    async (_client: unknown, id: string, status: string, invoiceDraftId?: string | null) => {
      const existing = state.billingSchedule.get(id);
      if (!existing) return;
      state.billingSchedule.set(id, {
        ...existing,
        status,
        invoice_draft_id: invoiceDraftId ?? existing.invoice_draft_id ?? null,
      });
    },
  );

  mockGetDraftById.mockImplementation(async (tenantId: string, id: string) => {
    const d = state.invoiceDrafts.get(id);
    if (!d || d.tenant_id !== tenantId) return null;
    return d;
  });

  mockFindDrafts.mockImplementation(async (tenantId: string, query: { status?: string }) => {
    const rows = [...state.invoiceDrafts.values()].filter(
      (d) => d.tenant_id === tenantId && (!query.status || d.status === query.status),
    );
    return { rows, total: rows.length };
  });

  mockUpdateDraft.mockImplementation(
    async (_client: unknown, id: string, patch: Record<string, unknown>) => {
      const existing = state.invoiceDrafts.get(id);
      if (!existing) return null;
      const updated: InvoiceDraftRow = { ...existing };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (updated as Record<string, unknown>)[k] = v;
      }
      state.invoiceDrafts.set(id, updated);
      return updated;
    },
  );

  // Milestones
  mockGetMilestoneById.mockImplementation(async (_tenantId: string, id: string) => {
    return state.milestones.get(id) ?? null;
  });
  mockUpdateMilestone.mockImplementation(
    async (_client: unknown, id: string, patch: Record<string, unknown>) => {
      const existing = state.milestones.get(id);
      if (!existing) return null;
      state.milestones.set(id, { ...existing, ...patch });
      return state.milestones.get(id);
    },
  );
});

const authMocks = {
  findUserByEmail: mockFindUserByEmail,
  findUserRoles: mockFindUserRoles,
  saveRefreshToken: mockSaveRefreshToken,
  updateLastLogin: mockUpdateLastLogin,
};

function seedSchedule(
  overrides: Partial<BillingScheduleRow> = {},
): BillingScheduleRow {
  const id = overrides.id ?? crypto.randomUUID();
  const row: BillingScheduleRow = {
    id,
    tenant_id: TENANT_A,
    contract_id: CONTRACT_ID,
    billing_period_start: new Date('2026-05-01'),
    billing_period_end: new Date('2026-05-31'),
    billing_date: new Date('2026-05-01'),
    invoice_number_in_season: 2,
    total_invoices_in_season: 8,
    planned_amount: 1000,
    status: 'scheduled',
    invoice_draft_id: null,
    ...overrides,
  };
  state.billingSchedule.set(id, row);
  return row;
}

// ============================================
// Describe: Draft Generation (H-15 §2)
// ============================================
describe('H-15 §2 — Monthly Draft Generation', () => {
  it('Gold contract: generate-drafts produces a single-line "Monthly Landscape Maintenance" draft', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    state.contracts.set(CONTRACT_ID, makeContract({ service_tier: 'gold', season_monthly_price: 1000 }));
    seedSchedule();

    const res = await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-05-01' });

    expect(res.status).toBe(200);
    expect(res.body.data.generated).toBe(1);
    expect(state.invoiceDrafts.size).toBe(1);

    const draft = [...state.invoiceDrafts.values()][0];
    expect(draft.line_items).toHaveLength(1);
    const line = draft.line_items[0];
    expect(line.description).toContain('Monthly Landscape Maintenance');
    expect(line.unit_price).toBe(1000);
  });

  it('Silver contract: draft description labels the tier as "Silver Package"', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    state.contracts.set(CONTRACT_ID, makeContract({ service_tier: 'silver', season_monthly_price: 750 }));
    seedSchedule({ planned_amount: 750 });

    await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-05-01' });

    const draft = [...state.invoiceDrafts.values()][0];
    expect(draft.description).toContain('Silver Package');
    expect(draft.description).not.toContain('Gold');
  });

  it('Gold/Silver drafts have ONE line item (package_services NOT exposed individually) — non-negotiable rule', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    state.contracts.set(CONTRACT_ID, makeContract({
      service_tier: 'gold',
      season_monthly_price: 1000,
      package_services: [
        { service_code: 'FERT', service_name: 'Fertilization', occurrence_type: 'per_season', occurrence_count: 5 },
        { service_code: 'AERATE', service_name: 'Aeration', occurrence_type: 'one_time' },
        { service_code: 'MOW', service_name: 'Mowing', occurrence_type: 'weekly' },
      ],
    }));
    seedSchedule();

    await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-05-01' });

    const draft = [...state.invoiceDrafts.values()][0];
    expect(draft.line_items).toHaveLength(1);
  });

  it('Bronze flat-monthly draft: single line labeled "Monthly Lawn Maintenance"', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    state.contracts.set(CONTRACT_ID, makeContract({
      service_tier: 'bronze',
      bronze_billing_type: 'flat_monthly',
      season_monthly_price: 400,
    }));
    seedSchedule({ planned_amount: 400 });

    await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-05-01' });

    const draft = [...state.invoiceDrafts.values()][0];
    expect(draft.line_items[0].description).toContain('Monthly Lawn Maintenance');
    expect(draft.description).toContain('Bronze Flat Monthly');
  });

  it('Bronze per-cut with zero occurrences for the period still produces a draft (0 cuts, $0 total)', async () => {
    // findForBillingPeriod mock returns [] by default. Per-cut builder uses cutCount=0.
    const token = await loginAs(app, 'owner', authMocks);
    state.contracts.set(CONTRACT_ID, makeContract({
      service_tier: 'bronze',
      bronze_billing_type: 'per_cut',
      per_cut_price: 50,
    }));
    seedSchedule({ planned_amount: null });

    await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-05-01' });

    const draft = [...state.invoiceDrafts.values()][0];
    expect(draft.total_amount).toBe(0);
    expect(draft.line_items[0].description).toContain('Weekly Lawn Mowing');
  });

  it('Snow seasonal draft: single line labeled "Snow Removal Service"', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    state.contracts.set(CONTRACT_ID, makeContract({
      service_tier: 'snow_seasonal',
      season_monthly_price: 300,
    }));
    seedSchedule({ planned_amount: 300 });

    await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-05-01' });

    const draft = [...state.invoiceDrafts.values()][0];
    expect(draft.line_items[0].description).toContain('Snow Removal Service');
    expect(draft.description).toContain('Snow Seasonal');
  });

  it('on successful draft creation: billing_schedule row flips scheduled → draft + invoice_draft_id set', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    state.contracts.set(CONTRACT_ID, makeContract({ service_tier: 'gold', season_monthly_price: 1000 }));
    const schedule = seedSchedule();

    await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-05-01' });

    const updated = state.billingSchedule.get(schedule.id)!;
    expect(updated.status).toBe('draft');
    expect(updated.invoice_draft_id).toBeTruthy();
  });

  it('generate-drafts for a date with no due schedule entries → no drafts', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    state.contracts.set(CONTRACT_ID, makeContract({ service_tier: 'gold' }));
    seedSchedule({ billing_date: new Date('2026-06-01') }); // different day

    const res = await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_date: '2026-05-01' });

    expect(res.status).toBe(200);
    expect(res.body.data.generated).toBe(0);
    expect(state.invoiceDrafts.size).toBe(0);
  });

  it('role guard: only owner can trigger generate-drafts', async () => {
    state.contracts.set(CONTRACT_ID, makeContract({ service_tier: 'gold' }));
    seedSchedule();

    const divMgrToken = await loginAs(app, 'div_mgr', authMocks);
    const res = await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${divMgrToken}`)
      .send({ billing_date: '2026-05-01' });

    expect(res.status).toBe(403);
  });
});

// ============================================
// Describe: Draft Review & Approval (H-15 §3)
// ============================================
describe('H-15 §3 — Draft Review & Approval', () => {
  it('GET /v1/billing/drafts?status=pending_review returns open drafts', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    // Seed two drafts, one pending, one approved
    const d1Id = crypto.randomUUID();
    state.invoiceDrafts.set(d1Id, {
      id: d1Id, tenant_id: TENANT_A, customer_id: CUSTOMER_ID, contract_id: CONTRACT_ID,
      billing_schedule_id: null, line_items: [], subtotal: 100, total_amount: 100,
      description: null, status: 'pending_review', created_at: new Date(),
    });
    state.invoiceDrafts.set('d2', {
      id: 'd2', tenant_id: TENANT_A, customer_id: CUSTOMER_ID, contract_id: CONTRACT_ID,
      billing_schedule_id: null, line_items: [], subtotal: 100, total_amount: 100,
      description: null, status: 'approved', created_at: new Date(),
    });

    const res = await request(app)
      .get('/v1/billing/drafts?status=pending_review')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(d1Id);
  });

  it('approve: flips draft → approved and linked schedule → approved', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    const schedule = seedSchedule({ status: 'draft' });
    const d1Id = crypto.randomUUID();
    state.invoiceDrafts.set(d1Id, {
      id: d1Id, tenant_id: TENANT_A, customer_id: CUSTOMER_ID, contract_id: CONTRACT_ID,
      billing_schedule_id: schedule.id, line_items: [], subtotal: 1000, total_amount: 1000,
      description: null, status: 'pending_review', created_at: new Date(),
    });

    const res = await request(app)
      .post(`/v1/billing/drafts/${d1Id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(state.invoiceDrafts.get(d1Id)?.status).toBe('approved');
    expect(state.billingSchedule.get(schedule.id)?.status).toBe('approved');

    // Current implementation does NOT push to Xero (billing/service.ts:358 — TODO).
    // Flagged so Wave 8 can swap this assertion for a real Xero mock invocation.
  });

  it('cannot approve an already-approved draft (state machine rejects: 400)', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    const d1Id = crypto.randomUUID();
    state.invoiceDrafts.set(d1Id, {
      id: d1Id, tenant_id: TENANT_A, customer_id: CUSTOMER_ID, contract_id: CONTRACT_ID,
      billing_schedule_id: null, line_items: [], subtotal: 100, total_amount: 100,
      description: null, status: 'approved', created_at: new Date(),
    });

    const res = await request(app)
      .post(`/v1/billing/drafts/${d1Id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('edit: PATCH a pending_review draft updates line_items and total_amount', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    const d1Id = crypto.randomUUID();
    state.invoiceDrafts.set(d1Id, {
      id: d1Id, tenant_id: TENANT_A, customer_id: CUSTOMER_ID, contract_id: CONTRACT_ID,
      billing_schedule_id: null,
      line_items: [{ description: 'orig', quantity: 1, unit_price: 100, line_total: 100 }],
      subtotal: 100, total_amount: 100,
      description: null, status: 'pending_review', created_at: new Date(),
    });

    const res = await request(app)
      .patch(`/v1/billing/drafts/${d1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        line_items: [{ description: 'new line', quantity: 2, unit_price: 75, line_total: 150 }],
        subtotal: 150,
        total_amount: 150,
      });

    expect(res.status).toBe(200);
    expect(state.invoiceDrafts.get(d1Id)?.total_amount).toBe(150);
  });

  it('cannot PATCH an approved draft (400)', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    const d1Id = crypto.randomUUID();
    state.invoiceDrafts.set(d1Id, {
      id: d1Id, tenant_id: TENANT_A, customer_id: CUSTOMER_ID, contract_id: CONTRACT_ID,
      billing_schedule_id: null, line_items: [], subtotal: 100, total_amount: 100,
      description: null, status: 'approved', created_at: new Date(),
    });

    const res = await request(app)
      .patch(`/v1/billing/drafts/${d1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ total_amount: 999 });

    expect(res.status).toBe(400);
  });

  it('reject: POST /reject flips status to rejected and records the reason', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    const d1Id = crypto.randomUUID();
    state.invoiceDrafts.set(d1Id, {
      id: d1Id, tenant_id: TENANT_A, customer_id: CUSTOMER_ID, contract_id: CONTRACT_ID,
      billing_schedule_id: null, line_items: [], subtotal: 100, total_amount: 100,
      description: null, status: 'pending_review', created_at: new Date(),
    });

    const res = await request(app)
      .post(`/v1/billing/drafts/${d1Id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'duplicate invoice' });

    expect(res.status).toBe(200);
    const updated = state.invoiceDrafts.get(d1Id)!;
    expect(updated.status).toBe('rejected');
    expect(updated.rejection_reason).toBe('duplicate invoice');
  });

  it('role guard: div_mgr cannot approve (owner-only)', async () => {
    const token = await loginAs(app, 'div_mgr', authMocks);
    const d1Id = crypto.randomUUID();
    state.invoiceDrafts.set(d1Id, {
      id: d1Id, tenant_id: TENANT_A, customer_id: CUSTOMER_ID, contract_id: CONTRACT_ID,
      billing_schedule_id: null, line_items: [], subtotal: 100, total_amount: 100,
      description: null, status: 'pending_review', created_at: new Date(),
    });

    const res = await request(app)
      .post(`/v1/billing/drafts/${d1Id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Describe: Payment Receipt (H-15 §4)
// ============================================
describe('H-15 §4 — Payment Receipt (Xero PAID Webhook)', () => {
  it('invalid HMAC → 401', async () => {
    const res = await request(app)
      .post('/v1/webhooks/xero')
      .set('x-xero-signature', 'totally-wrong')
      .send({ events: [{ eventType: 'PAID', resourceId: 'xero-inv-99' }] });

    expect(res.status).toBe(401);
  });

  it('valid HMAC → 200 and event accepted for async processing', async () => {
    const payload = {
      events: [{ eventType: 'PAID', resourceId: 'xero-inv-99', amountPaid: 1000, fullyPaidDate: '2026-05-15' }],
    };
    const body = JSON.stringify(payload);
    const sig = crypto
      .createHmac('sha256', 'test-xero-webhook-secret')
      .update(body)
      .digest('base64');

    const res = await request(app)
      .post('/v1/webhooks/xero')
      .set('Content-Type', 'application/json')
      .set('x-xero-signature', sig)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('received');
  });

  it('missing signature header → 401', async () => {
    const res = await request(app)
      .post('/v1/webhooks/xero')
      .send({ events: [{ eventType: 'PAID', resourceId: 'xero-inv-1' }] });

    expect(res.status).toBe(401);
  });

  it('AUTHORISED event type returns 200 without action (logged only)', async () => {
    const payload = { events: [{ eventType: 'AUTHORISED', resourceId: 'xero-inv-1' }] };
    const body = JSON.stringify(payload);
    const sig = crypto
      .createHmac('sha256', 'test-xero-webhook-secret')
      .update(body)
      .digest('base64');

    const res = await request(app)
      .post('/v1/webhooks/xero')
      .set('Content-Type', 'application/json')
      .set('x-xero-signature', sig)
      .send(body);

    expect(res.status).toBe(200);
  });
});

// ============================================
// Describe: Hardscape Milestone Billing (H-15 §5)
// ============================================
describe('H-15 §5 — Hardscape Milestone Billing', () => {
  it('generate-invoice on a pending milestone creates a draft and flips milestone to invoiced', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    const milestoneId = crypto.randomUUID();
    state.milestones.set(milestoneId, {
      id: milestoneId,
      tenant_id: TENANT_A,
      job_id: JOB_ID,
      contract_id: CONTRACT_ID,
      customer_id: CUSTOMER_ID,
      milestone_name: 'Deposit',
      milestone_description: '30% down',
      amount_type: 'fixed',
      amount_value: 5000,
      computed_amount: 5000,
      project_total: 20000,
      sort_order: 0,
      due_date: null,
      status: 'pending',
      created_at: new Date(),
    });

    const res = await request(app)
      .post(`/v1/billing/milestones/${milestoneId}/trigger`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(state.invoiceDrafts.size).toBe(1);
    expect(state.milestones.get(milestoneId)?.status).toBe('invoiced');
  });

  it('milestone invoice appears in the drafts-to-review list (pending_review status)', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    const milestoneId = crypto.randomUUID();
    state.milestones.set(milestoneId, {
      id: milestoneId, tenant_id: TENANT_A, job_id: JOB_ID,
      contract_id: CONTRACT_ID, customer_id: CUSTOMER_ID,
      milestone_name: 'Final', milestone_description: null,
      amount_type: 'fixed', amount_value: 3000, computed_amount: 3000, project_total: null,
      sort_order: 0, due_date: null, status: 'pending', created_at: new Date(),
    });

    await request(app)
      .post(`/v1/billing/milestones/${milestoneId}/trigger`)
      .set('Authorization', `Bearer ${token}`);

    const listRes = await request(app)
      .get('/v1/billing/drafts?status=pending_review')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].description).toContain('Final');
  });

  it('cannot trigger an already-invoiced milestone (400)', async () => {
    const token = await loginAs(app, 'owner', authMocks);
    const milestoneId = crypto.randomUUID();
    state.milestones.set(milestoneId, {
      id: milestoneId, tenant_id: TENANT_A, job_id: JOB_ID,
      contract_id: CONTRACT_ID, customer_id: CUSTOMER_ID,
      milestone_name: 'Dep', milestone_description: null,
      amount_type: 'fixed', amount_value: 1000, computed_amount: 1000, project_total: null,
      sort_order: 0, due_date: null, status: 'invoiced', created_at: new Date(),
    });

    const res = await request(app)
      .post(`/v1/billing/milestones/${milestoneId}/trigger`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
