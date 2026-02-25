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

// --- Mock redis ---
vi.mock('../../../config/redis.js', () => ({
  redis: {
    isOpen: true,
    ping: vi.fn().mockResolvedValue('PONG'),
    connect: vi.fn(),
    on: vi.fn(),
  },
  connectRedis: vi.fn(),
}));

// --- Mock auth repository ---
const mockFindUserByEmail = vi.fn();
const mockFindUserById = vi.fn();
const mockFindUserRoles = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockFindRefreshToken = vi.fn();
const mockRevokeRefreshToken = vi.fn();
const mockRevokeAllUserRefreshTokens = vi.fn();
const mockUpdateLastLogin = vi.fn();

vi.mock('../../auth/repository.js', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  findUserRoles: (...args: unknown[]) => mockFindUserRoles(...args),
  saveRefreshToken: (...args: unknown[]) => mockSaveRefreshToken(...args),
  findRefreshToken: (...args: unknown[]) => mockFindRefreshToken(...args),
  revokeRefreshToken: (...args: unknown[]) => mockRevokeRefreshToken(...args),
  revokeAllUserRefreshTokens: (...args: unknown[]) => mockRevokeAllUserRefreshTokens(...args),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
}));

// --- Mock disputes repository ---
const mockFindAllDisputes = vi.fn();
const mockFindDisputeById = vi.fn();
const mockCreateDispute = vi.fn();
const mockUpdateDispute = vi.fn();
const mockResolveDispute = vi.fn();
const mockGenerateDisputeNumber = vi.fn();
const mockGetInvoiceTotal = vi.fn();
const mockInvoiceExists = vi.fn();
const mockCustomerExists = vi.fn();
const mockUpdateInvoiceStatus = vi.fn();
const mockFindAllCreditNotes = vi.fn();
const mockFindCreditNoteById = vi.fn();
const mockCreateCreditNote = vi.fn();
const mockApproveCreditNote = vi.fn();
const mockApplyCreditNote = vi.fn();
const mockVoidCreditNote = vi.fn();
const mockGenerateCreditNoteNumber = vi.fn();
const mockAdjustInvoiceAmountPaid = vi.fn();
const mockGetStats = vi.fn();

vi.mock('../repository.js', () => ({
  findAllDisputes: (...args: unknown[]) => mockFindAllDisputes(...args),
  findDisputeById: (...args: unknown[]) => mockFindDisputeById(...args),
  createDispute: (...args: unknown[]) => mockCreateDispute(...args),
  updateDispute: (...args: unknown[]) => mockUpdateDispute(...args),
  resolveDispute: (...args: unknown[]) => mockResolveDispute(...args),
  generateDisputeNumber: (...args: unknown[]) => mockGenerateDisputeNumber(...args),
  getInvoiceTotal: (...args: unknown[]) => mockGetInvoiceTotal(...args),
  invoiceExists: (...args: unknown[]) => mockInvoiceExists(...args),
  customerExists: (...args: unknown[]) => mockCustomerExists(...args),
  updateInvoiceStatus: (...args: unknown[]) => mockUpdateInvoiceStatus(...args),
  findAllCreditNotes: (...args: unknown[]) => mockFindAllCreditNotes(...args),
  findCreditNoteById: (...args: unknown[]) => mockFindCreditNoteById(...args),
  createCreditNote: (...args: unknown[]) => mockCreateCreditNote(...args),
  approveCreditNote: (...args: unknown[]) => mockApproveCreditNote(...args),
  applyCreditNote: (...args: unknown[]) => mockApplyCreditNote(...args),
  voidCreditNote: (...args: unknown[]) => mockVoidCreditNote(...args),
  generateCreditNoteNumber: (...args: unknown[]) => mockGenerateCreditNoteNumber(...args),
  adjustInvoiceAmountPaid: (...args: unknown[]) => mockAdjustInvoiceAmountPaid(...args),
  getStats: (...args: unknown[]) => mockGetStats(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const INVOICE_ID = '11111111-0000-0000-0000-000000000001';
const DISPUTE_ID = '22222222-0000-0000-0000-000000000001';
const CREDIT_NOTE_ID = '33333333-0000-0000-0000-000000000001';

const SAMPLE_DISPUTE = {
  id: DISPUTE_ID,
  tenant_id: TENANT_A,
  invoice_id: INVOICE_ID,
  customer_id: CUSTOMER_ID,
  dispute_number: 'DSP-2026-0001',
  status: 'open',
  reason: 'billing_error',
  description: 'Incorrect amount charged for lawn maintenance',
  disputed_amount: 150,
  resolution_notes: null,
  resolved_by: null,
  resolved_at: null,
  assigned_to: null,
  priority: 'normal',
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  customer_display_name: 'John Doe',
  invoice_number: 'INV-2026-0001',
  credit_notes: [],
};

const SAMPLE_CREDIT_NOTE = {
  id: CREDIT_NOTE_ID,
  tenant_id: TENANT_A,
  invoice_id: INVOICE_ID,
  dispute_id: DISPUTE_ID,
  customer_id: CUSTOMER_ID,
  credit_note_number: 'CN-2026-0001',
  status: 'draft',
  amount: 150,
  reason: 'Billing error correction',
  applied_at: null,
  applied_by: null,
  xero_credit_note_id: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  customer_display_name: 'John Doe',
  invoice_number: 'INV-2026-0001',
};

async function loginAs(role: string, tenantId: string = TENANT_A) {
  mockFindUserByEmail.mockResolvedValue({
    id: USER_ID,
    tenant_id: tenantId,
    email: 'test@test.com',
    password_hash: TEST_HASH,
    first_name: 'Test',
    last_name: 'User',
    is_active: true,
  });
  mockFindUserRoles.mockResolvedValue([
    { role_name: role, division_id: null, division_name: null },
  ]);
  mockSaveRefreshToken.mockResolvedValue(undefined);
  mockUpdateLastLogin.mockResolvedValue(undefined);

  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'test@test.com', password: TEST_PASSWORD });

  return res.body.data.accessToken as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  TEST_HASH = await bcrypt.hash(TEST_PASSWORD, 4);
});

// ============================================
// GET /v1/disputes — List
// ============================================
describe('GET /v1/disputes', () => {
  it('should return paginated dispute list', async () => {
    const token = await loginAs('owner');
    mockFindAllDisputes.mockResolvedValue({ rows: [SAMPLE_DISPUTE], total: 1 });

    const res = await request(app)
      .get('/v1/disputes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass filters to repository', async () => {
    const token = await loginAs('coordinator');
    mockFindAllDisputes.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/disputes?status=open&customer_id=${CUSTOMER_ID}&priority=high&invoice_id=${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllDisputes).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        status: 'open',
        customer_id: CUSTOMER_ID,
        priority: 'high',
        invoice_id: INVOICE_ID,
      }),
    );
  });

  it('should deny crew_leader from listing disputes', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/disputes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/disputes/:id — Detail
// ============================================
describe('GET /v1/disputes/:id', () => {
  it('should return dispute with credit notes', async () => {
    const token = await loginAs('owner');
    mockFindDisputeById.mockResolvedValue({
      ...SAMPLE_DISPUTE,
      credit_notes: [SAMPLE_CREDIT_NOTE],
    });

    const res = await request(app)
      .get(`/v1/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.dispute_number).toBe('DSP-2026-0001');
    expect(res.body.data.credit_notes).toHaveLength(1);
  });

  it('should return 404 for non-existent dispute', async () => {
    const token = await loginAs('owner');
    mockFindDisputeById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/disputes — Create
// ============================================
describe('POST /v1/disputes', () => {
  it('should create dispute and set invoice to disputed', async () => {
    const token = await loginAs('coordinator');
    mockGetInvoiceTotal.mockResolvedValue(500);
    mockCustomerExists.mockResolvedValue(true);
    mockGenerateDisputeNumber.mockResolvedValue('DSP-2026-0001');
    mockCreateDispute.mockResolvedValue(SAMPLE_DISPUTE);
    mockUpdateInvoiceStatus.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/v1/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        reason: 'billing_error',
        description: 'Incorrect amount charged',
        disputed_amount: 150,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.dispute_number).toBe('DSP-2026-0001');
    // Verify invoice status was set to disputed
    expect(mockUpdateInvoiceStatus).toHaveBeenCalledWith(
      TENANT_A, INVOICE_ID, 'disputed', USER_ID,
    );
  });

  it('should auto-generate dispute number', async () => {
    const token = await loginAs('owner');
    mockGetInvoiceTotal.mockResolvedValue(1000);
    mockCustomerExists.mockResolvedValue(true);
    mockGenerateDisputeNumber.mockResolvedValue('DSP-2026-0002');
    mockCreateDispute.mockResolvedValue({ ...SAMPLE_DISPUTE, dispute_number: 'DSP-2026-0002' });
    mockUpdateInvoiceStatus.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/v1/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        reason: 'poor_quality',
        description: 'Service not up to standard',
        disputed_amount: 200,
      });

    expect(res.status).toBe(201);
    expect(mockGenerateDisputeNumber).toHaveBeenCalledWith(TENANT_A);
  });

  it('should reject disputed amount exceeding invoice total', async () => {
    const token = await loginAs('coordinator');
    mockGetInvoiceTotal.mockResolvedValue(500);
    mockCustomerExists.mockResolvedValue(true);

    const res = await request(app)
      .post('/v1/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        reason: 'billing_error',
        description: 'Overcharge',
        disputed_amount: 600,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('cannot exceed invoice total');
  });

  it('should return 404 for non-existent invoice', async () => {
    const token = await loginAs('coordinator');
    mockGetInvoiceTotal.mockResolvedValue(null);

    const res = await request(app)
      .post('/v1/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        reason: 'billing_error',
        description: 'Test',
        disputed_amount: 100,
      });

    expect(res.status).toBe(404);
  });

  it('should return 404 for non-existent customer', async () => {
    const token = await loginAs('coordinator');
    mockGetInvoiceTotal.mockResolvedValue(500);
    mockCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        reason: 'billing_error',
        description: 'Test',
        disputed_amount: 100,
      });

    expect(res.status).toBe(404);
  });

  it('should deny crew_leader from creating disputes', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post('/v1/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        reason: 'billing_error',
        description: 'Test',
        disputed_amount: 100,
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/disputes/:id — Update
// ============================================
describe('PUT /v1/disputes/:id', () => {
  it('should update an open dispute', async () => {
    const token = await loginAs('coordinator');
    const updated = { ...SAMPLE_DISPUTE, priority: 'high' };
    mockFindDisputeById.mockResolvedValue(SAMPLE_DISPUTE);
    mockUpdateDispute.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(200);
  });

  it('should allow editing under_review disputes', async () => {
    const token = await loginAs('owner');
    const underReview = { ...SAMPLE_DISPUTE, status: 'under_review' };
    mockFindDisputeById.mockResolvedValue(underReview);
    mockUpdateDispute.mockResolvedValue(underReview);

    const res = await request(app)
      .put(`/v1/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(200);
  });

  it('should reject editing resolved disputes', async () => {
    const token = await loginAs('coordinator');
    const resolved = { ...SAMPLE_DISPUTE, status: 'resolved_credit' };
    mockFindDisputeById.mockResolvedValue(resolved);

    const res = await request(app)
      .put(`/v1/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(409);
  });

  it('should reject disputed_amount exceeding invoice total on update', async () => {
    const token = await loginAs('coordinator');
    mockFindDisputeById.mockResolvedValue(SAMPLE_DISPUTE);
    mockGetInvoiceTotal.mockResolvedValue(200);

    const res = await request(app)
      .put(`/v1/disputes/${DISPUTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ disputed_amount: 300 });

    expect(res.status).toBe(400);
  });
});

// ============================================
// POST /v1/disputes/:id/resolve — Resolve
// ============================================
describe('POST /v1/disputes/:id/resolve', () => {
  it('should resolve with no_action', async () => {
    const token = await loginAs('owner');
    const resolved = { ...SAMPLE_DISPUTE, status: 'resolved_no_action', resolution_notes: 'No action needed' };
    mockFindDisputeById.mockResolvedValue(SAMPLE_DISPUTE);
    mockResolveDispute.mockResolvedValue(resolved);

    const res = await request(app)
      .post(`/v1/disputes/${DISPUTE_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'resolved_no_action',
        resolution_notes: 'No action needed',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.dispute.status).toBe('resolved_no_action');
    expect(res.body.data.credit_note).toBeNull();
  });

  it('should resolve with credit and auto-create credit note', async () => {
    const token = await loginAs('div_mgr');
    const resolved = { ...SAMPLE_DISPUTE, status: 'resolved_credit', resolution_notes: 'Credit issued' };
    mockFindDisputeById.mockResolvedValue(SAMPLE_DISPUTE);
    mockResolveDispute.mockResolvedValue(resolved);
    mockGenerateCreditNoteNumber.mockResolvedValue('CN-2026-0001');
    mockCreateCreditNote.mockResolvedValue(SAMPLE_CREDIT_NOTE);

    const res = await request(app)
      .post(`/v1/disputes/${DISPUTE_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'resolved_credit',
        resolution_notes: 'Credit issued',
        credit_amount: 150,
        credit_reason: 'Billing error correction',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.dispute.status).toBe('resolved_credit');
    expect(res.body.data.credit_note).not.toBeNull();
    expect(mockCreateCreditNote).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        invoice_id: INVOICE_ID,
        dispute_id: DISPUTE_ID,
        amount: 150,
      }),
      USER_ID,
    );
  });

  it('should require credit_amount when resolving with credit', async () => {
    const token = await loginAs('owner');
    mockFindDisputeById.mockResolvedValue(SAMPLE_DISPUTE);

    const res = await request(app)
      .post(`/v1/disputes/${DISPUTE_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'resolved_credit',
        resolution_notes: 'Credit issued',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Credit amount is required');
  });

  it('should require credit_reason when resolving with credit', async () => {
    const token = await loginAs('owner');
    mockFindDisputeById.mockResolvedValue(SAMPLE_DISPUTE);

    const res = await request(app)
      .post(`/v1/disputes/${DISPUTE_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'resolved_credit',
        resolution_notes: 'Credit issued',
        credit_amount: 150,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Credit reason is required');
  });

  it('should reject resolving already-resolved disputes', async () => {
    const token = await loginAs('owner');
    const resolved = { ...SAMPLE_DISPUTE, status: 'resolved_no_action' };
    mockFindDisputeById.mockResolvedValue(resolved);

    const res = await request(app)
      .post(`/v1/disputes/${DISPUTE_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'resolved_adjusted',
        resolution_notes: 'Adjusted',
      });

    expect(res.status).toBe(409);
  });

  it('should deny coordinator from resolving disputes', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post(`/v1/disputes/${DISPUTE_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'resolved_no_action',
        resolution_notes: 'No action needed',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/disputes/stats — Stats
// ============================================
describe('GET /v1/disputes/stats', () => {
  it('should return dispute statistics', async () => {
    const token = await loginAs('owner');
    mockGetStats.mockResolvedValue({
      openCount: '5',
      underReviewCount: '3',
      totalDisputedAmount: '2500.00',
      avgResolutionDays: '4.5',
    });

    const res = await request(app)
      .get('/v1/disputes/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.openCount).toBe('5');
    expect(res.body.data.totalDisputedAmount).toBe('2500.00');
  });

  it('should deny coordinator from viewing stats', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/disputes/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/credit-notes — List
// ============================================
describe('GET /v1/credit-notes', () => {
  it('should return paginated credit note list', async () => {
    const token = await loginAs('owner');
    mockFindAllCreditNotes.mockResolvedValue({ rows: [SAMPLE_CREDIT_NOTE], total: 1 });

    const res = await request(app)
      .get('/v1/credit-notes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass filters to repository', async () => {
    const token = await loginAs('div_mgr');
    mockFindAllCreditNotes.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/credit-notes?status=draft&customer_id=${CUSTOMER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllCreditNotes).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        status: 'draft',
        customer_id: CUSTOMER_ID,
      }),
    );
  });

  it('should deny crew_leader from listing credit notes', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/credit-notes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/credit-notes/:id — Detail
// ============================================
describe('GET /v1/credit-notes/:id', () => {
  it('should return credit note detail', async () => {
    const token = await loginAs('owner');
    mockFindCreditNoteById.mockResolvedValue(SAMPLE_CREDIT_NOTE);

    const res = await request(app)
      .get(`/v1/credit-notes/${CREDIT_NOTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.credit_note_number).toBe('CN-2026-0001');
    expect(res.body.data.amount).toBe(150);
  });

  it('should return 404 for non-existent credit note', async () => {
    const token = await loginAs('owner');
    mockFindCreditNoteById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/credit-notes/${CREDIT_NOTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/credit-notes — Create
// ============================================
describe('POST /v1/credit-notes', () => {
  it('should create a credit note manually', async () => {
    const token = await loginAs('owner');
    mockInvoiceExists.mockResolvedValue(true);
    mockCustomerExists.mockResolvedValue(true);
    mockGenerateCreditNoteNumber.mockResolvedValue('CN-2026-0001');
    mockCreateCreditNote.mockResolvedValue(SAMPLE_CREDIT_NOTE);

    const res = await request(app)
      .post('/v1/credit-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        amount: 150,
        reason: 'Billing error correction',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.credit_note_number).toBe('CN-2026-0001');
    expect(mockGenerateCreditNoteNumber).toHaveBeenCalledWith(TENANT_A);
  });

  it('should return 404 for non-existent invoice', async () => {
    const token = await loginAs('owner');
    mockInvoiceExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/credit-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        amount: 100,
        reason: 'Test',
      });

    expect(res.status).toBe(404);
  });

  it('should return 404 for non-existent customer', async () => {
    const token = await loginAs('owner');
    mockInvoiceExists.mockResolvedValue(true);
    mockCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/credit-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        amount: 100,
        reason: 'Test',
      });

    expect(res.status).toBe(404);
  });

  it('should deny coordinator from creating credit notes', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/credit-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: INVOICE_ID,
        customer_id: CUSTOMER_ID,
        amount: 100,
        reason: 'Test',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /v1/credit-notes/:id/approve — Approve
// ============================================
describe('POST /v1/credit-notes/:id/approve', () => {
  it('should approve a draft credit note', async () => {
    const token = await loginAs('owner');
    const approved = { ...SAMPLE_CREDIT_NOTE, status: 'approved' };
    mockFindCreditNoteById.mockResolvedValue(SAMPLE_CREDIT_NOTE);
    mockApproveCreditNote.mockResolvedValue(approved);

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });

  it('should reject approving non-draft credit note', async () => {
    const token = await loginAs('owner');
    const approved = { ...SAMPLE_CREDIT_NOTE, status: 'approved' };
    mockFindCreditNoteById.mockResolvedValue(approved);

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Only draft credit notes');
  });

  it('should deny coordinator from approving', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /v1/credit-notes/:id/apply — Apply
// ============================================
describe('POST /v1/credit-notes/:id/apply', () => {
  it('should apply approved credit note and adjust invoice balance', async () => {
    const token = await loginAs('owner');
    const approved = { ...SAMPLE_CREDIT_NOTE, status: 'approved' };
    const applied = { ...SAMPLE_CREDIT_NOTE, status: 'applied', applied_at: new Date().toISOString() };
    mockFindCreditNoteById.mockResolvedValue(approved);
    mockApplyCreditNote.mockResolvedValue(applied);
    mockAdjustInvoiceAmountPaid.mockResolvedValue(undefined);

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/apply`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('applied');
    // Verify invoice amount_paid was increased
    expect(mockAdjustInvoiceAmountPaid).toHaveBeenCalledWith(
      TENANT_A, INVOICE_ID, 150,
    );
  });

  it('should reject applying non-approved credit note', async () => {
    const token = await loginAs('owner');
    mockFindCreditNoteById.mockResolvedValue(SAMPLE_CREDIT_NOTE); // status: draft

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/apply`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Only approved credit notes');
  });

  it('should deny div_mgr from applying credit notes', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/apply`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /v1/credit-notes/:id/void — Void
// ============================================
describe('POST /v1/credit-notes/:id/void', () => {
  it('should void approved credit note without reversing balance', async () => {
    const token = await loginAs('owner');
    const approved = { ...SAMPLE_CREDIT_NOTE, status: 'approved' };
    const voided = { ...SAMPLE_CREDIT_NOTE, status: 'voided' };
    mockFindCreditNoteById.mockResolvedValue(approved);
    mockVoidCreditNote.mockResolvedValue(voided);

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/void`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('voided');
    // Approved (not applied) credit note — no balance reversal
    expect(mockAdjustInvoiceAmountPaid).not.toHaveBeenCalled();
  });

  it('should void applied credit note and reverse balance adjustment', async () => {
    const token = await loginAs('owner');
    const applied = { ...SAMPLE_CREDIT_NOTE, status: 'applied', applied_at: new Date().toISOString() };
    const voided = { ...SAMPLE_CREDIT_NOTE, status: 'voided' };
    mockFindCreditNoteById.mockResolvedValue(applied);
    mockVoidCreditNote.mockResolvedValue(voided);
    mockAdjustInvoiceAmountPaid.mockResolvedValue(undefined);

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/void`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Verify balance was reversed (negative adjustment)
    expect(mockAdjustInvoiceAmountPaid).toHaveBeenCalledWith(
      TENANT_A, INVOICE_ID, -150,
    );
  });

  it('should reject voiding draft credit note', async () => {
    const token = await loginAs('owner');
    mockFindCreditNoteById.mockResolvedValue(SAMPLE_CREDIT_NOTE); // status: draft

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/void`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Only approved or applied');
  });

  it('should deny div_mgr from voiding credit notes', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post(`/v1/credit-notes/${CREDIT_NOTE_ID}/void`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Tenant isolation
// ============================================
describe('Tenant isolation', () => {
  it('should scope disputes to authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_B);
    mockFindAllDisputes.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/disputes')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllDisputes).toHaveBeenCalledWith(
      TENANT_B,
      expect.anything(),
    );
  });

  it('should scope credit notes to authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_B);
    mockFindAllCreditNotes.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/credit-notes')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllCreditNotes).toHaveBeenCalledWith(
      TENANT_B,
      expect.anything(),
    );
  });
});
