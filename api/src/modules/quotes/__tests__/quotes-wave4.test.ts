import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// --- Mock database ---
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

// --- Mock quote repository ---
const mockQuoteGetById = vi.fn();
const mockQuoteInsert = vi.fn();
const mockQuoteUpdateStatus = vi.fn();
const mockQuoteUpdate = vi.fn();
const mockInsertSection = vi.fn();
const mockInsertLineItem = vi.fn();
const mockFindLineItemsByQuoteId = vi.fn();
const mockQuoteAcquireClient = vi.fn();
const mockSearchXeroItems = vi.fn();

vi.mock('../repository.js', () => ({
  insert: (...args: unknown[]) => mockQuoteInsert(...args),
  getById: (...args: unknown[]) => mockQuoteGetById(...args),
  findByJobId: vi.fn(),
  findActiveByJobId: vi.fn(),
  updateStatus: (...args: unknown[]) => mockQuoteUpdateStatus(...args),
  update: (...args: unknown[]) => mockQuoteUpdate(...args),
  updateTotals: vi.fn(),
  getNextQuoteNumber: vi.fn(),
  insertSection: (...args: unknown[]) => mockInsertSection(...args),
  getSectionById: vi.fn(),
  updateSection: vi.fn(),
  deleteSection: vi.fn(),
  insertLineItem: (...args: unknown[]) => mockInsertLineItem(...args),
  getLineItemById: vi.fn(),
  updateLineItem: vi.fn(),
  deleteLineItem: vi.fn(),
  findLineItemsByQuoteId: (...args: unknown[]) => mockFindLineItemsByQuoteId(...args),
  copyQuoteContent: vi.fn(),
  searchXeroItems: (...args: unknown[]) => mockSearchXeroItems(...args),
  acquireClient: (...args: unknown[]) => mockQuoteAcquireClient(...args),
}));

// --- Mock PDF service ---
const mockGeneratePdfBuffer = vi.fn();
const mockUploadQuotePdf = vi.fn();

vi.mock('../pdf/quote-pdf.service.js', () => ({
  generatePdfBuffer: (...args: unknown[]) => mockGeneratePdfBuffer(...args),
  uploadQuotePdf: (...args: unknown[]) => mockUploadQuotePdf(...args),
  generateSignedPdfBuffer: vi.fn(),
}));

// --- Mock template repository ---
const mockTemplateFindById = vi.fn();
const mockTemplateCreate = vi.fn();

vi.mock('../../templates/repository.js', () => ({
  findById: (...args: unknown[]) => mockTemplateFindById(...args),
  create: (...args: unknown[]) => mockTemplateCreate(...args),
  findAll: vi.fn(), update: vi.fn(), softDelete: vi.fn(),
  findAutomationTemplates: vi.fn(), saveFromQuote: vi.fn(),
  createVersion: vi.fn(), getLatestVersionNumber: vi.fn(), acquireClient: vi.fn(),
}));

// --- Mock diary repository ---
const mockDiaryInsert = vi.fn();

vi.mock('../../jobs/diary/diary.repository.js', () => ({
  insert: (...args: unknown[]) => mockDiaryInsert(...args),
  insertStandalone: vi.fn(), findByJobId: vi.fn(),
}));

// --- Mock jobs repository ---
vi.mock('../../jobs/repository.js', () => ({
  findById: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(),
  updateStatus: vi.fn(), softDelete: vi.fn(), getByDateRange: vi.fn(),
  getByProperty: vi.fn(), addPhoto: vi.fn(), getPhotos: vi.fn(),
  addChecklistItem: vi.fn(), updateChecklistItem: vi.fn(), getChecklist: vi.fn(),
  getChecklistItemById: vi.fn(), getStats: vi.fn(), customerExists: vi.fn(),
  propertyBelongsToCustomer: vi.fn(), contractExists: vi.fn(),
  getNextJobNumber: vi.fn(), createWithClient: vi.fn(),
  updateStatusWithClient: vi.fn(), acquireClient: vi.fn(),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const QUOTE_ID = 'aaaa1111-0000-0000-0000-000000000001';
const SECTION_ID = 'bbbb1111-0000-0000-0000-000000000001';
const ITEM_ID = 'cccc1111-0000-0000-0000-000000000001';
const TEMPLATE_ID = 'dddd1111-0000-0000-0000-000000000001';
const PDF_FILE_ID = 'ffff1111-0000-0000-0000-000000000001';
const SIGNED_PDF_FILE_ID = 'ffff2222-0000-0000-0000-000000000001';

const SAMPLE_LINE_ITEM = {
  id: ITEM_ID,
  tenant_id: TENANT_A,
  quote_id: QUOTE_ID,
  section_id: SECTION_ID,
  xero_item_id: null,
  xero_item_code: '4210-MAINT-001',
  item_name: 'Lawn Mowing',
  description: 'Weekly mowing service',
  quantity: '10',
  unit: 'each',
  unit_price: '35.00',
  line_total: '350.00',
  is_taxable: true,
  sort_order: 0,
  is_locked: false,
};

const SAMPLE_SECTION = {
  id: SECTION_ID,
  tenant_id: TENANT_A,
  quote_id: QUOTE_ID,
  section_title: 'Landscaping Work',
  section_body: null,
  sort_order: 0,
  line_items: [SAMPLE_LINE_ITEM],
};

const makeQuote = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: QUOTE_ID,
  tenant_id: TENANT_A,
  job_id: JOB_ID,
  quote_number: 'Q-0001-26',
  version: 1,
  status: 'draft',
  subtotal: '350.00',
  discount_amount: '0.00',
  tax_rate: '0.13',
  tax_amount: '45.50',
  total_amount: '395.50',
  client_notes: 'Please water plants',
  payment_terms: 'Net 30',
  internal_notes: 'SECRET INTERNAL NOTE',
  template_id: null,
  sent_via: null,
  sent_to_email: null,
  sent_to_phone: null,
  sent_at: null,
  signing_token: 'abc123def456',
  valid_until: '2026-05-06',
  pdf_file_id: PDF_FILE_ID,
  signed_pdf_file_id: null,
  created_by: USER_ID,
  updated_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sections: [SAMPLE_SECTION],
  customer_id: 'dddddddd-0000-0000-0000-000000000001',
  customer_display_name: 'John Smith',
  property_name: '123 Main St',
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
  mockQuoteAcquireClient.mockResolvedValue(mockClient);
  mockDiaryInsert.mockResolvedValue({});
  mockGeneratePdfBuffer.mockResolvedValue(Buffer.from('fake-pdf'));
  mockUploadQuotePdf.mockResolvedValue({ file_id: PDF_FILE_ID, r2_key: 'test/key.pdf' });
  mockQuoteUpdate.mockResolvedValue(makeQuote());
});

// ============================================
// 1. POST /generate-pdf: returns 200 with pdf_file_id (not 202 stub)
// ============================================
describe('POST /v1/quotes/:id/generate-pdf', () => {
  it('should return 200 with pdf_file_id', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote());

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/generate-pdf`)
      .set('Authorization', `Bearer ${token}`)
      .send({ auto_send: false });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('complete');
    expect(res.body.data.pdf_file_id).toBe(PDF_FILE_ID);
  });

  // ============================================
  // 2. POST /generate-pdf on empty quote: returns 422
  // ============================================
  it('should return 422 for quote with no line items', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({
      sections: [{ ...SAMPLE_SECTION, line_items: [] }],
    }));

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/generate-pdf`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

// ============================================
// 3. POST /send: sets status='sent', generates signing_token, diary entry
// ============================================
describe('POST /v1/quotes/:id/send', () => {
  it('should send quote with signing token and diary entry', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValue(makeQuote({ pdf_file_id: PDF_FILE_ID }));
    mockQuoteUpdateStatus.mockResolvedValue(undefined);

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'email', email: 'client@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('sent');
    expect(res.body.data.signing_token).toBeDefined();
    expect(res.body.data.signing_token.length).toBe(64);
    expect(res.body.data.signing_url).toContain('/sign/');
    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ entry_type: 'quote_sent' }),
    );
  });

  // ============================================
  // 5. POST /send on empty quote: returns 422
  // ============================================
  it('should return 422 for empty quote', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({
      sections: [{ ...SAMPLE_SECTION, line_items: [] }],
    }));

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'email' });

    expect(res.status).toBe(422);
  });
});

// ============================================
// 6. POST /resend: resends without regenerating PDF or new token
// ============================================
describe('POST /v1/quotes/:id/resend', () => {
  it('should resend without new PDF or token', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({ status: 'sent', signing_token: 'existing-token' }));

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/resend`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'client@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.resent_at).toBeDefined();
    // Should NOT generate new PDF
    expect(mockGeneratePdfBuffer).not.toHaveBeenCalled();
    // Should NOT create new signing token
    expect(mockQuoteUpdate).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ signing_token: expect.any(String) }),
    );
  });

  // ============================================
  // 7. POST /resend on draft quote: returns 422
  // ============================================
  it('should return 422 for draft quote', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({ status: 'draft' }));

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/resend`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});

// ============================================
// 18. GET /signed-pdf on signed quote: returns download URL
// ============================================
describe('GET /v1/quotes/:id/signed-pdf', () => {
  it('should return download URL for signed quote', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({
      status: 'signed',
      signed_pdf_file_id: SIGNED_PDF_FILE_ID,
    }));

    const res = await request(app)
      .get(`/v1/quotes/${QUOTE_ID}/signed-pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.download_url).toContain(SIGNED_PDF_FILE_ID);
  });

  // ============================================
  // 19. GET /signed-pdf on unsigned quote: returns 422
  // ============================================
  it('should return 422 for unsigned quote', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({ status: 'draft' }));

    const res = await request(app)
      .get(`/v1/quotes/${QUOTE_ID}/signed-pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });
});

// ============================================
// 20. POST /convert-to-invoice on signed quote: creates invoice, status='converted'
// ============================================
describe('POST /v1/quotes/:id/convert-to-invoice', () => {
  it('should create invoice draft from signed quote', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({ status: 'signed' }));
    mockQuoteUpdateStatus.mockResolvedValue(undefined);
    // Mock client.query for: BEGIN, INSERT invoice, customer_id lookup fallback, updateStatus, diary, COMMIT
    mockClient.query.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO invoices')) {
        return Promise.resolve({ rows: [{ id: 'inv-1', invoice_number: 'INV-0001-26' }] });
      }
      if (typeof sql === 'string' && sql.includes('SELECT customer_id')) {
        return Promise.resolve({ rows: [{ customer_id: 'cust-1', property_id: 'prop-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/convert-to-invoice`)
      .set('Authorization', `Bearer ${token}`)
      .send({ due_days: 30 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.invoice_id).toBe('inv-1');
  });

  // ============================================
  // 21. POST /convert-to-invoice on unsigned: returns 422
  // ============================================
  it('should return 422 for unsigned quote', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({ status: 'sent' }));

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/convert-to-invoice`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  // ============================================
  // 22. POST /convert-to-invoice twice: second returns 409
  // ============================================
  it('should return 409 if already converted', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({
      status: 'signed',
      converted_invoice_id: 'inv-1',
    }));

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/convert-to-invoice`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
  });
});

// ============================================
// 23. POST /load-template appends sections to draft
// ============================================
describe('POST /v1/quotes/:id/load-template', () => {
  it('should append template sections to draft quote', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById
      .mockResolvedValueOnce(makeQuote({ status: 'draft' }))
      .mockResolvedValueOnce(makeQuote({
        sections: [
          SAMPLE_SECTION,
          { ...SAMPLE_SECTION, id: 'new-section', section_title: 'Template Section' },
        ],
      }));
    mockTemplateFindById.mockResolvedValueOnce({
      id: TEMPLATE_ID,
      tenant_id: TENANT_A,
      template_category: 'quote',
      content: {
        sections: [{
          section_title: 'Template Section',
          line_items: [{ item_name: 'Template Item', description: 'From template' }],
        }],
      },
    });
    mockInsertSection.mockResolvedValue({ id: 'new-section', section_title: 'Template Section' });
    mockInsertLineItem.mockResolvedValue({});

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/load-template`)
      .set('Authorization', `Bearer ${token}`)
      .send({ template_id: TEMPLATE_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.sections).toHaveLength(2);
  });

  // ============================================
  // 24. POST /load-template on sent quote: returns 422
  // ============================================
  it('should return 422 for sent quote', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote({ status: 'signed' }));

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/load-template`)
      .set('Authorization', `Bearer ${token}`)
      .send({ template_id: TEMPLATE_ID });

    expect(res.status).toBe(422);
  });
});

// ============================================
// 25. POST /save-as-template captures sections without prices
// ============================================
describe('POST /v1/quotes/:id/save-as-template', () => {
  it('should save template without prices or quantities', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValueOnce(makeQuote());
    mockTemplateCreate.mockImplementation((data: Record<string, unknown>) => {
      return Promise.resolve({
        id: TEMPLATE_ID,
        template_name: data.template_name,
        content: data.content,
      });
    });

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/save-as-template`)
      .set('Authorization', `Bearer ${token}`)
      .send({ template_name: 'My Template' });

    expect(res.status).toBe(201);
    expect(res.body.data.template_id).toBe(TEMPLATE_ID);

    // Verify content has null prices
    const createCall = mockTemplateCreate.mock.calls[0][0] as Record<string, unknown>;
    const content = createCall.content as { sections: Array<{ line_items: Array<{ quantity: unknown; unit_price: unknown }> }> };
    expect(content.sections[0].line_items[0].quantity).toBeNull();
    expect(content.sections[0].line_items[0].unit_price).toBeNull();
  });
});

// ============================================
// 26. GET /xero-items?search=mow returns matching items
// ============================================
describe('GET /v1/xero-items', () => {
  it('should return matching Xero items', async () => {
    const token = await loginAs('coordinator');
    mockSearchXeroItems.mockResolvedValueOnce([{
      id: 'xero-1',
      item_code: 'MOWING-001',
      item_name: 'Lawn Mowing Service',
      sales_description: 'Standard mowing',
      sales_account_code: '200',
      unit_price: '35.00',
    }]);

    const res = await request(app)
      .get('/v1/xero-items?search=mow')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].item_code).toBe('MOWING-001');
  });
});

// ============================================
// 27. Multi-tenant isolation test
// ============================================
describe('Multi-tenant isolation', () => {
  it('should scope all queries to authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockQuoteGetById.mockResolvedValueOnce(makeQuote());

    await request(app)
      .get(`/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockQuoteGetById).toHaveBeenCalledWith(TENANT_A, QUOTE_ID);
  });
});

// ============================================
// RBAC
// ============================================
describe('RBAC', () => {
  it('should deny crew_member from converting to invoice', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/convert-to-invoice`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('should deny coordinator from converting to invoice', async () => {
    const token = await loginAs('coordinator');
    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/convert-to-invoice`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated access to signed PDF', async () => {
    const res = await request(app).get(`/v1/quotes/${QUOTE_ID}/signed-pdf`);
    expect(res.status).toBe(401);
  });
});
