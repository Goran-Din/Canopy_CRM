/**
 * H-14 + H-15 End-to-End narrative.
 *
 * Walks a Gold contract from season setup through Month-1 draft generation, approval,
 * and Xero PAID webhook. The billing_schedule row is seeded directly (no wired API in
 * Wave 1–6 exposes createBillingSchedule), but every other step hits a real HTTP route.
 *
 * Steps (commented in the test body):
 *   1. Seed: Gold contract, one property, April-Nov season
 *   2. POST /v1/contracts/:contractId/season-setup → occurrences generated
 *   3. Seed billing_schedule row (no exposed endpoint)
 *   4. Advance clock; POST /v1/billing/generate-drafts → draft created
 *   5. POST /v1/billing/drafts/:id/approve → status approved, schedule approved
 *   6. POST /v1/webhooks/xero (valid HMAC) → 200 received
 *   7. Final assertion: state contains occurrences, draft, schedule=approved, diary
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

const mockContractsFindById = vi.fn();
vi.mock('../../modules/contracts/repository.js', () => ({
  findById: (...a: unknown[]) => mockContractsFindById(...a),
  findAll: vi.fn(), create: vi.fn(), update: vi.fn(), softDelete: vi.fn(),
  getStats: vi.fn(), getLineItems: vi.fn(), addLineItem: vi.fn(),
  updateLineItem: vi.fn(), removeLineItem: vi.fn(), getLineItemById: vi.fn(),
  changeStatus: vi.fn(),
  customerExists: vi.fn().mockResolvedValue(true),
  propertyBelongsToCustomer: vi.fn().mockResolvedValue(true),
  getNextContractNumber: vi.fn(),
  acquireClient: vi.fn(),
}));

const mockOccBulkInsert = vi.fn();
const mockOccAcquireClient = vi.fn();
vi.mock('../../modules/service-occurrences/repository.js', () => ({
  bulkInsert: (...a: unknown[]) => mockOccBulkInsert(...a),
  getById: vi.fn(),
  update: vi.fn(),
  findAll: vi.fn(),
  countByContractService: vi.fn(),
  getServiceListSummary: vi.fn(),
  getServiceDetail: vi.fn(),
  getSeasonSummary: vi.fn(),
  findForBillingPeriod: vi.fn().mockResolvedValue([]),
  acquireClient: (...a: unknown[]) => mockOccAcquireClient(...a),
}));

const mockBillingAcquireClient = vi.fn();
const mockFindDueScheduleEntries = vi.fn();
const mockInsertDraft = vi.fn();
const mockUpdateScheduleStatus = vi.fn();
const mockGetDraftById = vi.fn();
const mockUpdateDraft = vi.fn();

vi.mock('../../modules/billing/repository.js', () => ({
  bulkInsertSchedule: vi.fn(),
  findDueScheduleEntries: (...a: unknown[]) => mockFindDueScheduleEntries(...a),
  findSchedule: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  updateScheduleStatus: (...a: unknown[]) => mockUpdateScheduleStatus(...a),
  insertDraft: (...a: unknown[]) => mockInsertDraft(...a),
  getDraftById: (...a: unknown[]) => mockGetDraftById(...a),
  findDrafts: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  updateDraft: (...a: unknown[]) => mockUpdateDraft(...a),
  getMilestoneById: vi.fn(),
  updateMilestone: vi.fn(),
  findMilestonesByJobId: vi.fn(),
  createMilestones: vi.fn(),
  cancelMilestone: vi.fn(),
  getDashboardStats: vi.fn().mockResolvedValue({}),
  findOverdue: vi.fn().mockResolvedValue([]),
  acquireClient: (...a: unknown[]) => mockBillingAcquireClient(...a),
}));

vi.mock('../../modules/jobs/repository.js', () => ({
  findAll: vi.fn(), findById: vi.fn(), create: vi.fn(), update: vi.fn(),
  updateStatus: vi.fn(), softDelete: vi.fn(), getByDateRange: vi.fn(),
  getByProperty: vi.fn(), addPhoto: vi.fn(), getPhotos: vi.fn(),
  addChecklistItem: vi.fn(), updateChecklistItem: vi.fn(), getChecklist: vi.fn(),
  getChecklistItemById: vi.fn(), getStats: vi.fn(),
  customerExists: vi.fn().mockResolvedValue(true),
  propertyBelongsToCustomer: vi.fn().mockResolvedValue(true),
  contractExists: vi.fn().mockResolvedValue(true),
  getNextJobNumber: vi.fn(),
  createWithClient: vi.fn(),
  updateStatusWithClient: vi.fn(),
  acquireClient: vi.fn(),
}));

vi.mock('../../modules/jobs/diary/diary.repository.js', () => ({
  insert: vi.fn(),
  insertStandalone: vi.fn(),
  findByJobId: vi.fn(),
}));

import app from '../../app.js';
import {
  TENANT_A,
  CONTRACT_ID,
  CUSTOMER_ID,
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
  mockBillingAcquireClient.mockResolvedValue(fakeClient);

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

  mockFindDueScheduleEntries.mockImplementation(
    async (tenantId: string, billingDate: string) => {
      return [...state.billingSchedule.values()].filter(
        (s) =>
          s.tenant_id === tenantId &&
          s.status === 'scheduled' &&
          new Date(s.billing_date).toISOString().slice(0, 10) === billingDate,
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

  mockUpdateDraft.mockImplementation(
    async (_client: unknown, id: string, patch: Record<string, unknown>) => {
      const existing = state.invoiceDrafts.get(id);
      if (!existing) return null;
      const updated: InvoiceDraftRow = { ...existing };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (updated as unknown as Record<string, unknown>)[k] = v;
      }
      state.invoiceDrafts.set(id, updated);
      return updated;
    },
  );
});

const authMocks = {
  findUserByEmail: mockFindUserByEmail,
  findUserRoles: mockFindUserRoles,
  saveRefreshToken: mockSaveRefreshToken,
  updateLastLogin: mockUpdateLastLogin,
};

describe('H-14 + H-15 — Season to Paid Cycle (narrative)', () => {
  it('walks a Gold contract from season setup through Month-1 draft approval and Xero PAID', async () => {
    // ────────────────────────────────────────────────────────────────
    // 1. Seed: Gold contract, 2026 season
    // ────────────────────────────────────────────────────────────────
    const contract = makeContract({
      service_tier: 'gold',
      season_monthly_price: 1000,
      package_services: [
        { service_code: 'FERT', service_name: 'Fertilization', occurrence_type: 'per_season', occurrence_count: 5 },
        { service_code: 'AERATE', service_name: 'Core Aeration', occurrence_type: 'one_time' },
      ],
    });
    state.contracts.set(contract.id, contract);

    const ownerToken = await loginAs(app, 'owner', authMocks);

    // ────────────────────────────────────────────────────────────────
    // 2. Season setup → 6 occurrences generated
    // ────────────────────────────────────────────────────────────────
    const setupRes = await request(app)
      .post(`/v1/contracts/${CONTRACT_ID}/season-setup`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ season_year: 2026 });

    expect(setupRes.status).toBe(201);
    expect(setupRes.body.data.total_generated).toBe(6);
    expect(state.occurrences.size).toBe(6);

    // ────────────────────────────────────────────────────────────────
    // 3. Seed billing_schedule row for May 2026 (no API to do this in Wave 1–6)
    // ────────────────────────────────────────────────────────────────
    const scheduleId = crypto.randomUUID();
    const schedule: BillingScheduleRow = {
      id: scheduleId,
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
    };
    state.billingSchedule.set(scheduleId, schedule);

    // ────────────────────────────────────────────────────────────────
    // 4. Run draft generation for 2026-05-01
    // ────────────────────────────────────────────────────────────────
    const genRes = await request(app)
      .post('/v1/billing/generate-drafts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ billing_date: '2026-05-01' });

    expect(genRes.status).toBe(200);
    expect(genRes.body.data.generated).toBe(1);
    expect(state.invoiceDrafts.size).toBe(1);
    const [draft] = [...state.invoiceDrafts.values()];
    expect(draft.status).toBe('pending_review');
    expect(draft.total_amount).toBe(1000);

    // billing_schedule flipped to 'draft' with invoice_draft_id set
    const updatedSchedule = state.billingSchedule.get(scheduleId)!;
    expect(updatedSchedule.status).toBe('draft');
    expect(updatedSchedule.invoice_draft_id).toBe(draft.id);

    // ────────────────────────────────────────────────────────────────
    // 5. Approve the draft → draft.approved + billing_schedule.approved
    // ────────────────────────────────────────────────────────────────
    const approveRes = await request(app)
      .post(`/v1/billing/drafts/${draft.id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(approveRes.status).toBe(200);
    expect(state.invoiceDrafts.get(draft.id)?.status).toBe('approved');
    expect(state.billingSchedule.get(scheduleId)?.status).toBe('approved');

    // ────────────────────────────────────────────────────────────────
    // 6. Xero PAID webhook arrives (valid HMAC) → 200 received
    // ────────────────────────────────────────────────────────────────
    const webhookBody = JSON.stringify({
      events: [
        {
          eventType: 'PAID',
          resourceId: 'xero-inv-for-may',
          amountPaid: 1000,
          fullyPaidDate: '2026-05-15',
        },
      ],
    });
    const sig = crypto
      .createHmac('sha256', 'test-xero-webhook-secret')
      .update(webhookBody)
      .digest('base64');

    const webhookRes = await request(app)
      .post('/v1/webhooks/xero')
      .set('Content-Type', 'application/json')
      .set('x-xero-signature', sig)
      .send(webhookBody);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.status).toBe('received');

    // ────────────────────────────────────────────────────────────────
    // 7. Final summary: full state coherent
    // ────────────────────────────────────────────────────────────────
    expect(state.occurrences.size).toBe(6);
    expect(state.invoiceDrafts.size).toBe(1);
    expect([...state.invoiceDrafts.values()][0].status).toBe('approved');
    expect(state.billingSchedule.get(scheduleId)?.status).toBe('approved');
    expect(state.contracts.get(CONTRACT_ID)).toBeDefined();
    expect(state.contracts.get(CONTRACT_ID)?.customer_id).toBe(CUSTOMER_ID);
  });
});
