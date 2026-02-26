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

// --- Mock invoicing repository ---
const mockFindAllInvoices = vi.fn();
const mockFindInvoiceById = vi.fn();
const mockCreateInvoice = vi.fn();
const mockUpdateInvoice = vi.fn();
const mockUpdateStatus = vi.fn();
const mockSoftDeleteInvoice = vi.fn();
const mockGenerateInvoiceNumber = vi.fn();
const mockGetLineItems = vi.fn();
const mockAddLineItem = vi.fn();
const mockUpdateLineItem = vi.fn();
const mockRemoveLineItem = vi.fn();
const mockGetLineItemById = vi.fn();
const mockRecalculateTotals = vi.fn();
const mockRecordPayment = vi.fn();
const mockGetPayments = vi.fn();
const mockUpdateAmountPaid = vi.fn();
const mockGetContractWithLineItems = vi.fn();
const mockGetJobsForInvoice = vi.fn();
const mockGetStats = vi.fn();
const mockGetAgingReport = vi.fn();
const mockCustomerExists = vi.fn();

vi.mock('../repository.js', () => ({
  findAllInvoices: (...args: unknown[]) => mockFindAllInvoices(...args),
  findInvoiceById: (...args: unknown[]) => mockFindInvoiceById(...args),
  createInvoice: (...args: unknown[]) => mockCreateInvoice(...args),
  updateInvoice: (...args: unknown[]) => mockUpdateInvoice(...args),
  updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  softDeleteInvoice: (...args: unknown[]) => mockSoftDeleteInvoice(...args),
  generateInvoiceNumber: (...args: unknown[]) => mockGenerateInvoiceNumber(...args),
  getLineItems: (...args: unknown[]) => mockGetLineItems(...args),
  addLineItem: (...args: unknown[]) => mockAddLineItem(...args),
  updateLineItem: (...args: unknown[]) => mockUpdateLineItem(...args),
  removeLineItem: (...args: unknown[]) => mockRemoveLineItem(...args),
  getLineItemById: (...args: unknown[]) => mockGetLineItemById(...args),
  recalculateTotals: (...args: unknown[]) => mockRecalculateTotals(...args),
  recordPayment: (...args: unknown[]) => mockRecordPayment(...args),
  getPayments: (...args: unknown[]) => mockGetPayments(...args),
  updateAmountPaid: (...args: unknown[]) => mockUpdateAmountPaid(...args),
  getContractWithLineItems: (...args: unknown[]) => mockGetContractWithLineItems(...args),
  getJobsForInvoice: (...args: unknown[]) => mockGetJobsForInvoice(...args),
  getStats: (...args: unknown[]) => mockGetStats(...args),
  getAgingReport: (...args: unknown[]) => mockGetAgingReport(...args),
  customerExists: (...args: unknown[]) => mockCustomerExists(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const CONTRACT_ID = 'ffffffff-0000-0000-0000-000000000001';
const INVOICE_ID = '11111111-0000-0000-0000-000000000001';
const LINE_ITEM_ID = '22222222-0000-0000-0000-000000000001';
const PAYMENT_ID = '33333333-0000-0000-0000-000000000001';
const JOB_ID_1 = '44444444-0000-0000-0000-000000000001';
const JOB_ID_2 = '44444444-0000-0000-0000-000000000002';

const SAMPLE_INVOICE = {
  id: INVOICE_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  property_id: PROPERTY_ID,
  contract_id: null,
  invoice_number: 'INV-2026-0001',
  status: 'draft',
  invoice_date: '2026-02-25',
  due_date: '2026-03-27',
  paid_date: null,
  subtotal: 500,
  tax_rate: 0.13,
  tax_amount: 65,
  discount_amount: 0,
  total: 565,
  amount_paid: 0,
  balance_due: 565,
  currency: 'USD',
  division: 'landscaping_maintenance',
  billing_period_start: null,
  billing_period_end: null,
  notes: null,
  internal_notes: null,
  xero_invoice_id: null,
  xero_sync_status: 'not_synced',
  xero_last_synced_at: null,
  pdf_url: null,
  sent_at: null,
  sent_to_email: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  customer_display_name: 'John Doe',
  property_name: 'Main Residence',
  line_items: [],
  payments: [],
};

const SAMPLE_LINE_ITEM = {
  id: LINE_ITEM_ID,
  tenant_id: TENANT_A,
  invoice_id: INVOICE_ID,
  job_id: null,
  description: 'Lawn Mowing - Weekly Service',
  quantity: 4,
  unit_price: 125,
  line_total: 500,
  tax_rate: 0,
  tax_amount: 0,
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_PAYMENT = {
  id: PAYMENT_ID,
  tenant_id: TENANT_A,
  invoice_id: INVOICE_ID,
  payment_date: '2026-03-01',
  amount: 565,
  payment_method: 'bank_transfer',
  reference_number: 'CHK-12345',
  notes: null,
  xero_payment_id: null,
  recorded_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
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
// GET /v1/invoices — List
// ============================================
describe('GET /v1/invoices', () => {
  it('should return paginated invoice list', async () => {
    const token = await loginAs('owner');
    mockFindAllInvoices.mockResolvedValue({ rows: [SAMPLE_INVOICE], total: 1 });

    const res = await request(app)
      .get('/v1/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass filters to repository', async () => {
    const token = await loginAs('coordinator');
    mockFindAllInvoices.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/invoices?status=draft&customer_id=${CUSTOMER_ID}&division=landscaping_maintenance&date_from=2026-01-01&date_to=2026-12-31`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllInvoices).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        status: 'draft',
        customer_id: CUSTOMER_ID,
        division: 'landscaping_maintenance',
        date_from: '2026-01-01',
        date_to: '2026-12-31',
      }),
    );
  });

  it('should deny crew_leader from listing invoices', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/invoices/:id — Detail
// ============================================
describe('GET /v1/invoices/:id', () => {
  it('should return invoice with line items and payments', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({
      ...SAMPLE_INVOICE,
      line_items: [SAMPLE_LINE_ITEM],
      payments: [SAMPLE_PAYMENT],
    });

    const res = await request(app)
      .get(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invoice_number).toBe('INV-2026-0001');
    expect(res.body.data.customer_display_name).toBe('John Doe');
    expect(res.body.data.line_items).toHaveLength(1);
    expect(res.body.data.payments).toHaveLength(1);
  });

  it('should return 404 for non-existent invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/invoices — Create
// ============================================
describe('POST /v1/invoices', () => {
  it('should create invoice with line items and auto-generated number', async () => {
    const token = await loginAs('owner');
    mockCustomerExists.mockResolvedValue(true);
    mockGenerateInvoiceNumber.mockResolvedValue('INV-2026-0001');
    mockCreateInvoice.mockResolvedValue(SAMPLE_INVOICE);

    const res = await request(app)
      .post('/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        tax_rate: 0.13,
        line_items: [
          { description: 'Lawn Mowing - Weekly Service', quantity: 4, unit_price: 125 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invoice_number).toBe('INV-2026-0001');
    // Verify auto-generated number was passed
    expect(mockGenerateInvoiceNumber).toHaveBeenCalledWith(TENANT_A);
  });

  it('should default due_date to invoice_date + 30 days', async () => {
    const token = await loginAs('coordinator');
    mockCustomerExists.mockResolvedValue(true);
    mockGenerateInvoiceNumber.mockResolvedValue('INV-2026-0002');
    mockCreateInvoice.mockResolvedValue(SAMPLE_INVOICE);

    await request(app)
      .post('/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        invoice_date: '2026-03-01',
        line_items: [],
      });

    expect(mockCreateInvoice).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ due_date: '2026-03-31' }),
      expect.anything(),
      USER_ID,
    );
  });

  it('should calculate totals from line items', async () => {
    const token = await loginAs('owner');
    mockCustomerExists.mockResolvedValue(true);
    mockGenerateInvoiceNumber.mockResolvedValue('INV-2026-0003');
    mockCreateInvoice.mockResolvedValue(SAMPLE_INVOICE);

    await request(app)
      .post('/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        tax_rate: 0.13,
        line_items: [
          { description: 'Service A', quantity: 2, unit_price: 100 },
          { description: 'Service B', quantity: 1, unit_price: 300 },
        ],
      });

    // subtotal = 200 + 300 = 500, invoiceTax = 500 * 0.13 = 65, total = 565
    expect(mockCreateInvoice).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        subtotal: 500,
        tax_amount: 65,
        total: 565,
      }),
      expect.anything(),
      USER_ID,
    );
  });

  it('should reject if customer not found', async () => {
    const token = await loginAs('owner');
    mockCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_id: CUSTOMER_ID, line_items: [] });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Customer not found');
  });

  it('should deny div_mgr from creating invoices', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post('/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_id: CUSTOMER_ID, line_items: [] });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/invoices/:id — Update
// ============================================
describe('PUT /v1/invoices/:id', () => {
  it('should update draft invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });
    mockUpdateInvoice.mockResolvedValue({ ...SAMPLE_INVOICE, notes: 'Updated' });

    const res = await request(app)
      .put(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('should block editing sent invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'sent', line_items: [], payments: [] });

    const res = await request(app)
      .put(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Changed' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Cannot edit invoice with status 'sent'");
  });

  it('should allow editing pending invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'pending', line_items: [], payments: [] });
    mockUpdateInvoice.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'pending' });

    const res = await request(app)
      .put(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'OK' });

    expect(res.status).toBe(200);
  });
});

// ============================================
// PATCH /v1/invoices/:id/status
// ============================================
describe('PATCH /v1/invoices/:id/status', () => {
  it('should transition draft -> pending', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });
    mockUpdateStatus.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'pending' });

    const res = await request(app)
      .patch(`/v1/invoices/${INVOICE_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pending' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
  });

  it('should transition sent -> paid (records paid_date)', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'sent', line_items: [], payments: [] });
    mockUpdateStatus.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'paid' });

    const res = await request(app)
      .patch(`/v1/invoices/${INVOICE_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paid' });

    expect(res.status).toBe(200);
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      TENANT_A, INVOICE_ID, 'paid', USER_ID,
      expect.objectContaining({ paid_date: expect.any(String) }),
    );
  });

  it('should reject invalid transition draft -> paid', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });

    const res = await request(app)
      .patch(`/v1/invoices/${INVOICE_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paid' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Cannot transition from 'draft' to 'paid'");
  });

  it('should reject invalid transition paid -> draft', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'paid', line_items: [], payments: [] });

    const res = await request(app)
      .patch(`/v1/invoices/${INVOICE_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'draft' });

    expect(res.status).toBe(400);
  });

  it('should return same invoice if already in target status', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });

    const res = await request(app)
      .patch(`/v1/invoices/${INVOICE_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'draft' });

    expect(res.status).toBe(200);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });
});

// ============================================
// DELETE /v1/invoices/:id
// ============================================
describe('DELETE /v1/invoices/:id', () => {
  it('should soft delete draft invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });
    mockSoftDeleteInvoice.mockResolvedValue(SAMPLE_INVOICE);

    const res = await request(app)
      .delete(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Invoice deleted');
  });

  it('should soft delete cancelled invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'cancelled', line_items: [], payments: [] });
    mockSoftDeleteInvoice.mockResolvedValue(SAMPLE_INVOICE);

    const res = await request(app)
      .delete(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should block deletion of sent invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'sent', line_items: [], payments: [] });

    const res = await request(app)
      .delete(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Cannot delete invoice with status 'sent'");
  });

  it('should block deletion of paid invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'paid', line_items: [], payments: [] });

    const res = await request(app)
      .delete(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('should deny coordinator from deleting invoices', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .delete(`/v1/invoices/${INVOICE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Line Items
// ============================================
describe('POST /v1/invoices/:id/line-items', () => {
  it('should add line item and recalculate totals', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });
    mockAddLineItem.mockResolvedValue(SAMPLE_LINE_ITEM);
    mockRecalculateTotals.mockResolvedValue(SAMPLE_INVOICE);

    const res = await request(app)
      .post(`/v1/invoices/${INVOICE_ID}/line-items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Lawn Mowing', quantity: 4, unit_price: 125 });

    expect(res.status).toBe(201);
    expect(res.body.data.line_total).toBe(500);
    expect(mockRecalculateTotals).toHaveBeenCalledWith(TENANT_A, INVOICE_ID);
  });

  it('should block adding line items to sent invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'sent', line_items: [], payments: [] });

    const res = await request(app)
      .post(`/v1/invoices/${INVOICE_ID}/line-items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Test', quantity: 1, unit_price: 100 });

    expect(res.status).toBe(409);
  });
});

describe('PUT /v1/invoices/line-items/:lineItemId', () => {
  it('should update line item and recalculate', async () => {
    const token = await loginAs('owner');
    mockGetLineItemById.mockResolvedValue(SAMPLE_LINE_ITEM);
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });
    mockUpdateLineItem.mockResolvedValue({ ...SAMPLE_LINE_ITEM, quantity: 8, line_total: 1000 });
    mockRecalculateTotals.mockResolvedValue(SAMPLE_INVOICE);

    const res = await request(app)
      .put(`/v1/invoices/line-items/${LINE_ITEM_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 8 });

    expect(res.status).toBe(200);
    expect(mockRecalculateTotals).toHaveBeenCalledWith(TENANT_A, INVOICE_ID);
  });

  it('should return 404 for non-existent line item', async () => {
    const token = await loginAs('owner');
    mockGetLineItemById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/invoices/line-items/${LINE_ITEM_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /v1/invoices/line-items/:lineItemId', () => {
  it('should remove line item and recalculate', async () => {
    const token = await loginAs('coordinator');
    mockGetLineItemById.mockResolvedValue(SAMPLE_LINE_ITEM);
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });
    mockRemoveLineItem.mockResolvedValue(SAMPLE_LINE_ITEM);
    mockRecalculateTotals.mockResolvedValue(SAMPLE_INVOICE);

    const res = await request(app)
      .delete(`/v1/invoices/line-items/${LINE_ITEM_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Line item removed');
  });
});

// ============================================
// Payments
// ============================================
describe('POST /v1/invoices/:id/payments', () => {
  it('should record full payment and auto-set status to paid', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'sent', line_items: [], payments: [] });
    mockRecordPayment.mockResolvedValue(SAMPLE_PAYMENT);
    mockUpdateAmountPaid.mockResolvedValue({ ...SAMPLE_INVOICE, amount_paid: 565, total: 565 });
    mockUpdateStatus.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'paid' });

    const res = await request(app)
      .post(`/v1/invoices/${INVOICE_ID}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        payment_date: '2026-03-01',
        amount: 565,
        payment_method: 'bank_transfer',
        reference_number: 'CHK-12345',
      });

    expect(res.status).toBe(201);
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      TENANT_A, INVOICE_ID, 'paid', USER_ID,
      expect.objectContaining({ paid_date: expect.any(String) }),
    );
  });

  it('should record partial payment and auto-set status to partially_paid', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'sent', line_items: [], payments: [] });
    mockRecordPayment.mockResolvedValue({ ...SAMPLE_PAYMENT, amount: 200 });
    mockUpdateAmountPaid.mockResolvedValue({ ...SAMPLE_INVOICE, amount_paid: 200, total: 565 });
    mockUpdateStatus.mockResolvedValue({ ...SAMPLE_INVOICE, status: 'partially_paid' });

    const res = await request(app)
      .post(`/v1/invoices/${INVOICE_ID}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        payment_date: '2026-03-01',
        amount: 200,
        payment_method: 'check',
      });

    expect(res.status).toBe(201);
    expect(mockUpdateStatus).toHaveBeenCalledWith(TENANT_A, INVOICE_ID, 'partially_paid', USER_ID);
  });

  it('should reject payment on draft invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });

    const res = await request(app)
      .post(`/v1/invoices/${INVOICE_ID}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        payment_date: '2026-03-01',
        amount: 100,
        payment_method: 'cash',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Cannot record payment on invoice with status 'draft'");
  });
});

describe('GET /v1/invoices/:id/payments', () => {
  it('should return payments for invoice', async () => {
    const token = await loginAs('owner');
    mockFindInvoiceById.mockResolvedValue({ ...SAMPLE_INVOICE, line_items: [], payments: [] });
    mockGetPayments.mockResolvedValue([SAMPLE_PAYMENT]);

    const res = await request(app)
      .get(`/v1/invoices/${INVOICE_ID}/payments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].amount).toBe(565);
  });
});

// ============================================
// Generate from Contract
// ============================================
describe('POST /v1/invoices/generate-from-contract', () => {
  it('should generate invoice from contract line items', async () => {
    const token = await loginAs('owner');
    mockGetContractWithLineItems.mockResolvedValue({
      contract: { customer_id: CUSTOMER_ID, property_id: PROPERTY_ID, division: 'landscaping_maintenance' },
      line_items: [
        { service_name: 'Weekly Mowing', quantity: 4, unit_price: 125 },
        { service_name: 'Edging', quantity: 4, unit_price: 50 },
      ],
    });
    mockGenerateInvoiceNumber.mockResolvedValue('INV-2026-0010');
    mockCreateInvoice.mockResolvedValue({ ...SAMPLE_INVOICE, invoice_number: 'INV-2026-0010', contract_id: CONTRACT_ID });

    const res = await request(app)
      .post('/v1/invoices/generate-from-contract')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contract_id: CONTRACT_ID,
        billing_period_start: '2026-03-01',
        billing_period_end: '2026-03-31',
        tax_rate: 0.13,
      });

    expect(res.status).toBe(201);
    expect(mockCreateInvoice).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        contract_id: CONTRACT_ID,
        subtotal: 700, // 4*125 + 4*50
      }),
      expect.arrayContaining([
        expect.objectContaining({ description: 'Weekly Mowing' }),
        expect.objectContaining({ description: 'Edging' }),
      ]),
      USER_ID,
    );
  });

  it('should return 404 for non-existent contract', async () => {
    const token = await loginAs('owner');
    mockGetContractWithLineItems.mockResolvedValue(null);

    const res = await request(app)
      .post('/v1/invoices/generate-from-contract')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contract_id: CONTRACT_ID,
        billing_period_start: '2026-03-01',
        billing_period_end: '2026-03-31',
      });

    expect(res.status).toBe(404);
  });
});

// ============================================
// Generate from Jobs
// ============================================
describe('POST /v1/invoices/generate-from-jobs', () => {
  it('should generate invoice from completed jobs', async () => {
    const token = await loginAs('owner');
    mockGetJobsForInvoice.mockResolvedValue([
      { id: JOB_ID_1, title: 'Lawn Mowing Mar 1', estimated_price: 125 },
      { id: JOB_ID_2, title: 'Lawn Mowing Mar 8', estimated_price: 125 },
    ]);
    mockCustomerExists.mockResolvedValue(true);
    mockGenerateInvoiceNumber.mockResolvedValue('INV-2026-0011');
    mockCreateInvoice.mockResolvedValue(SAMPLE_INVOICE);

    const res = await request(app)
      .post('/v1/invoices/generate-from-jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_ids: [JOB_ID_1, JOB_ID_2],
        customer_id: CUSTOMER_ID,
        tax_rate: 0.13,
      });

    expect(res.status).toBe(201);
    expect(mockCreateInvoice).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ subtotal: 250 }),
      expect.arrayContaining([
        expect.objectContaining({ job_id: JOB_ID_1 }),
        expect.objectContaining({ job_id: JOB_ID_2 }),
      ]),
      USER_ID,
    );
  });

  it('should return 404 if no valid jobs found', async () => {
    const token = await loginAs('owner');
    mockGetJobsForInvoice.mockResolvedValue([]);

    const res = await request(app)
      .post('/v1/invoices/generate-from-jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_ids: [JOB_ID_1],
        customer_id: CUSTOMER_ID,
      });

    expect(res.status).toBe(404);
  });
});

// ============================================
// Stats & Aging
// ============================================
describe('GET /v1/invoices/stats', () => {
  it('should return financial stats', async () => {
    const token = await loginAs('owner');
    mockGetStats.mockResolvedValue({
      total_count: 15,
      total_amount: '18150.00',
      paid_amount: '12500.00',
      outstanding_amount: '5650.00',
      overdue_count: 3,
      overdue_amount: '2100.00',
      revenueByMonth: [{ month: '2026-02', total: '12500.00' }],
      revenueByDivision: [{ division: 'landscaping_maintenance', total: '8000.00' }],
    });

    const res = await request(app)
      .get('/v1/invoices/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.outstanding_amount).toBe('5650.00');
    expect(res.body.data.overdue_count).toBe(3);
    expect(res.body.data.total_amount).toBe('18150.00');
    expect(res.body.data.paid_amount).toBe('12500.00');
  });

  it('should deny coordinator from viewing stats', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/invoices/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /v1/invoices/aging-report', () => {
  it('should return aging buckets', async () => {
    const token = await loginAs('owner');
    mockGetAgingReport.mockResolvedValue({
      current: '2000.00',
      days_30: '1500.00',
      days_60: '800.00',
      days_90_plus: '350.00',
    });

    const res = await request(app)
      .get('/v1/invoices/aging-report')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.current).toBe('2000.00');
    expect(res.body.data.days_30).toBe('1500.00');
    expect(res.body.data.days_60).toBe('800.00');
    expect(res.body.data.days_90_plus).toBe('350.00');
  });

  it('should allow div_mgr to view aging report', async () => {
    const token = await loginAs('div_mgr');
    mockGetAgingReport.mockResolvedValue({ current: '0', days_30: '0', days_60: '0', days_90_plus: '0' });

    const res = await request(app)
      .get('/v1/invoices/aging-report')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant isolation', () => {
  it('should scope invoice queries to tenant', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockFindAllInvoices.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/invoices')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mockFindAllInvoices).toHaveBeenCalledWith(TENANT_A, expect.anything());
  });

  it('should isolate between tenants', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockFindAllInvoices.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/invoices')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mockFindAllInvoices).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });
});

// ============================================
// Role-Based Access Control
// ============================================
describe('Role-based access', () => {
  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get('/v1/invoices');
    expect(res.status).toBe(401);
  });

  it('should deny crew_member from all invoice endpoints', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should allow coordinator to create invoices', async () => {
    const token = await loginAs('coordinator');
    mockCustomerExists.mockResolvedValue(true);
    mockGenerateInvoiceNumber.mockResolvedValue('INV-2026-0099');
    mockCreateInvoice.mockResolvedValue(SAMPLE_INVOICE);

    const res = await request(app)
      .post('/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_id: CUSTOMER_ID, line_items: [] });

    expect(res.status).toBe(201);
  });

  it('should allow div_mgr to view but not create invoices', async () => {
    const token = await loginAs('div_mgr');
    mockFindAllInvoices.mockResolvedValue({ rows: [], total: 0 });

    const listRes = await request(app)
      .get('/v1/invoices')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);

    const createRes = await request(app)
      .post('/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_id: CUSTOMER_ID, line_items: [] });
    expect(createRes.status).toBe(403);
  });
});
