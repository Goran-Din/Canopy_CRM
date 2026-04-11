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

// --- Mock quote repository ---
const mockQuoteInsert = vi.fn();
const mockQuoteGetById = vi.fn();
const mockQuoteFindByJobId = vi.fn();
const mockQuoteFindActiveByJobId = vi.fn();
const mockQuoteUpdateStatus = vi.fn();
const mockQuoteUpdate = vi.fn();
const mockQuoteUpdateTotals = vi.fn();
const mockGetNextQuoteNumber = vi.fn();
const mockInsertSection = vi.fn();
const mockGetSectionById = vi.fn();
const mockRepoUpdateSection = vi.fn();
const mockDeleteSection = vi.fn();
const mockInsertLineItem = vi.fn();
const mockGetLineItemById = vi.fn();
const mockRepoUpdateLineItem = vi.fn();
const mockDeleteLineItem = vi.fn();
const mockFindLineItemsByQuoteId = vi.fn();
const mockCopyQuoteContent = vi.fn();
const mockSearchXeroItems = vi.fn();
const mockQuoteAcquireClient = vi.fn();

// --- Mock PDF service ---
vi.mock('../pdf/quote-pdf.service.js', () => ({
  generatePdfBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  uploadQuotePdf: vi.fn().mockResolvedValue({ file_id: 'pdf-file-1', r2_key: 'test/key.pdf' }),
  generateSignedPdfBuffer: vi.fn(),
}));

// --- Mock template repository ---
vi.mock('../../templates/repository.js', () => ({
  findById: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(),
  softDelete: vi.fn(), findAutomationTemplates: vi.fn(), saveFromQuote: vi.fn(),
  createVersion: vi.fn(), getLatestVersionNumber: vi.fn(), acquireClient: vi.fn(),
}));

vi.mock('../repository.js', () => ({
  insert: (...args: unknown[]) => mockQuoteInsert(...args),
  getById: (...args: unknown[]) => mockQuoteGetById(...args),
  findByJobId: (...args: unknown[]) => mockQuoteFindByJobId(...args),
  findActiveByJobId: (...args: unknown[]) => mockQuoteFindActiveByJobId(...args),
  updateStatus: (...args: unknown[]) => mockQuoteUpdateStatus(...args),
  update: (...args: unknown[]) => mockQuoteUpdate(...args),
  updateTotals: (...args: unknown[]) => mockQuoteUpdateTotals(...args),
  getNextQuoteNumber: (...args: unknown[]) => mockGetNextQuoteNumber(...args),
  insertSection: (...args: unknown[]) => mockInsertSection(...args),
  getSectionById: (...args: unknown[]) => mockGetSectionById(...args),
  updateSection: (...args: unknown[]) => mockRepoUpdateSection(...args),
  deleteSection: (...args: unknown[]) => mockDeleteSection(...args),
  insertLineItem: (...args: unknown[]) => mockInsertLineItem(...args),
  getLineItemById: (...args: unknown[]) => mockGetLineItemById(...args),
  updateLineItem: (...args: unknown[]) => mockRepoUpdateLineItem(...args),
  deleteLineItem: (...args: unknown[]) => mockDeleteLineItem(...args),
  findLineItemsByQuoteId: (...args: unknown[]) => mockFindLineItemsByQuoteId(...args),
  copyQuoteContent: (...args: unknown[]) => mockCopyQuoteContent(...args),
  searchXeroItems: (...args: unknown[]) => mockSearchXeroItems(...args),
  acquireClient: (...args: unknown[]) => mockQuoteAcquireClient(...args),
}));

// --- Mock jobs repository (for createQuote validation) ---
const mockJobFindById = vi.fn();

vi.mock('../../jobs/repository.js', () => ({
  findById: (...args: unknown[]) => mockJobFindById(...args),
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
  getNextJobNumber: vi.fn(),
  createWithClient: vi.fn(),
  updateStatusWithClient: vi.fn(),
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

// --- Fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const QUOTE_ID = 'aaaa1111-0000-0000-0000-000000000001';
const SECTION_ID = 'bbbb1111-0000-0000-0000-000000000001';
const ITEM_ID = 'cccc1111-0000-0000-0000-000000000001';

const SAMPLE_JOB = {
  id: JOB_ID,
  tenant_id: TENANT_A,
  customer_id: 'dddddddd-0000-0000-0000-000000000001',
  property_id: 'eeeeeeee-0000-0000-0000-000000000001',
  status: 'quote',
  photos: [],
  checklist: [],
};

const SAMPLE_QUOTE = {
  id: QUOTE_ID,
  tenant_id: TENANT_A,
  job_id: JOB_ID,
  quote_number: 'Q-0001-26',
  version: 1,
  status: 'draft',
  subtotal: '0.00',
  discount_amount: '0.00',
  tax_rate: '0.13',
  tax_amount: '0.00',
  total_amount: '0.00',
  client_notes: null,
  payment_terms: null,
  internal_notes: null,
  template_id: null,
  sent_via: null,
  sent_to_email: null,
  sent_to_phone: null,
  sent_at: null,
  signing_token: 'abc123',
  valid_until: '2026-05-06',
  pdf_file_id: null,
  signed_pdf_file_id: null,
  created_by: USER_ID,
  updated_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sections: [],
};

const SAMPLE_SECTION = {
  id: SECTION_ID,
  tenant_id: TENANT_A,
  quote_id: QUOTE_ID,
  section_title: 'Landscaping Work',
  section_body: null,
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  line_items: [],
};

const SAMPLE_LINE_ITEM = {
  id: ITEM_ID,
  tenant_id: TENANT_A,
  quote_id: QUOTE_ID,
  section_id: SECTION_ID,
  xero_item_id: null,
  xero_item_code: null,
  item_name: 'Lawn Mowing',
  description: 'Weekly mowing service',
  quantity: '10',
  unit: 'each',
  unit_price: '35.00',
  line_total: '350.00',
  is_taxable: true,
  sort_order: 0,
  is_locked: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function createMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
}

let mockClient: ReturnType<typeof createMockClient>;

async function loginAs(role: string) {
  mockFindUserByEmail.mockResolvedValue({
    id: USER_ID,
    tenant_id: TENANT_A,
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
  mockClient = createMockClient();
  mockQuoteAcquireClient.mockResolvedValue(mockClient);
});

// ============================================
// Quote Creation
// ============================================
describe('POST /v1/jobs/:jobId/quotes', () => {
  it('should create quote with diary entry', async () => {
    const token = await loginAs('coordinator');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB);
    mockQuoteFindActiveByJobId.mockResolvedValue(null);
    mockGetNextQuoteNumber.mockResolvedValue('Q-0001-26');
    mockQuoteInsert.mockResolvedValue(SAMPLE_QUOTE);
    mockDiaryInsert.mockResolvedValue({});

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tax_enabled: true, tax_rate: 0.13 });

    expect(res.status).toBe(201);
    expect(res.body.data.quote_number).toBe('Q-0001-26');
    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ entry_type: 'quote_created' }),
    );
  });

  it('should reject if active draft exists', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB);
    mockQuoteFindActiveByJobId.mockResolvedValue(SAMPLE_QUOTE);

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Active draft already exists');
  });

  it('should deny crew_leader from creating quotes', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(403);
  });
});

// ============================================
// Quote Retrieval
// ============================================
describe('GET /v1/quotes/:id', () => {
  it('should return quote with sections and items', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValue({
      ...SAMPLE_QUOTE,
      sections: [{ ...SAMPLE_SECTION, line_items: [SAMPLE_LINE_ITEM] }],
    });

    const res = await request(app)
      .get(`/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sections).toHaveLength(1);
    expect(res.body.data.sections[0].line_items).toHaveLength(1);
  });

  it('should return 404 for missing quote', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// Section CRUD
// ============================================
describe('POST /v1/quotes/:id/sections', () => {
  it('should add section to draft quote', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValue(SAMPLE_QUOTE);
    mockInsertSection.mockResolvedValue(SAMPLE_SECTION);

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/sections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Landscaping Work' });

    expect(res.status).toBe(201);
    expect(res.body.data.section_title).toBe('Landscaping Work');
  });

  it('should reject adding section to signed quote (422)', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValue({ ...SAMPLE_QUOTE, status: 'signed' });

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/sections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Section' });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Cannot edit a signed quote');
  });
});

// ============================================
// Line Item CRUD
// ============================================
describe('POST /v1/quotes/:quoteId/sections/:sectionId/items', () => {
  it('should add line item with computed line_total', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValue({ ...SAMPLE_QUOTE, sections: [SAMPLE_SECTION] });
    mockGetSectionById.mockResolvedValue(SAMPLE_SECTION);
    mockInsertLineItem.mockResolvedValue(SAMPLE_LINE_ITEM);
    mockFindLineItemsByQuoteId.mockResolvedValue([SAMPLE_LINE_ITEM]);
    mockClient.query.mockResolvedValue({ rows: [SAMPLE_QUOTE] });

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/sections/${SECTION_ID}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        item_name: 'Lawn Mowing',
        description: 'Weekly mowing service',
        quantity: 10,
        unit_price: 35.00,
        is_taxable: true,
      });

    expect(res.status).toBe(201);
    // Verify line_total = quantity * unit_price = 350.00
    expect(mockInsertLineItem).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        line_total: 350,
        item_name: 'Lawn Mowing',
      }),
    );
  });

  it('should reject adding items to expired quote', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValue({ ...SAMPLE_QUOTE, status: 'expired' });

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/sections/${SECTION_ID}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        item_name: 'Test',
        quantity: 1,
        unit_price: 10,
      });

    expect(res.status).toBe(422);
  });
});

// ============================================
// Versioning
// ============================================
describe('PATCH /v1/quotes/:id (versioning)', () => {
  it('should edit draft in-place', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValue({ ...SAMPLE_QUOTE, status: 'draft' });
    mockQuoteUpdate.mockResolvedValue({
      ...SAMPLE_QUOTE,
      client_notes: 'Updated notes',
    });

    const res = await request(app)
      .patch(`/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Updated notes' });

    expect(res.status).toBe(200);
    // Should NOT create new version for drafts
    expect(mockQuoteUpdateStatus).not.toHaveBeenCalled();
  });

  it('should create new version when editing sent quote', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById
      .mockResolvedValueOnce({ ...SAMPLE_QUOTE, status: 'sent', sections: [] })
      .mockResolvedValueOnce({ ...SAMPLE_QUOTE, id: 'new-quote-id', version: 2, status: 'draft' });
    mockQuoteUpdateStatus.mockResolvedValue(undefined);
    mockQuoteInsert.mockResolvedValue({ ...SAMPLE_QUOTE, id: 'new-quote-id', version: 2, status: 'draft' });
    mockCopyQuoteContent.mockResolvedValue(undefined);
    mockDiaryInsert.mockResolvedValue({});

    const res = await request(app)
      .patch(`/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Revised notes' });

    expect(res.status).toBe(200);
    // Old quote → superseded
    expect(mockQuoteUpdateStatus).toHaveBeenCalledWith(
      mockClient,
      QUOTE_ID,
      'superseded',
    );
    // New version created
    expect(mockQuoteInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ version: 2, status: 'draft' }),
    );
    // Content copied
    expect(mockCopyQuoteContent).toHaveBeenCalled();
    // Diary entry
    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ entry_type: 'quote_version_created' }),
    );
  });

  it('should reject editing signed quote (immutable)', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValue({ ...SAMPLE_QUOTE, status: 'signed' });

    const res = await request(app)
      .patch(`/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Nope' });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Cannot edit a signed quote');
  });

  it('should reject editing converted quote', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValue({ ...SAMPLE_QUOTE, status: 'converted' });

    const res = await request(app)
      .patch(`/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Nope' });

    expect(res.status).toBe(422);
  });
});

// ============================================
// PDF Generation
// ============================================
describe('POST /v1/quotes/:id/generate-pdf', () => {
  it('should return 200 with pdf_file_id when PDF is generated', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValue({
      ...SAMPLE_QUOTE,
      sections: [{ ...SAMPLE_SECTION, line_items: [SAMPLE_LINE_ITEM] }],
    });
    mockQuoteUpdate.mockResolvedValue(SAMPLE_QUOTE);

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/generate-pdf`)
      .set('Authorization', `Bearer ${token}`)
      .send({ auto_send: false });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('complete');
    expect(res.body.data.pdf_file_id).toBeDefined();
  });

  it('should reject if quote has no line items', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValue({
      ...SAMPLE_QUOTE,
      sections: [{ ...SAMPLE_SECTION, line_items: [] }],
    });

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/generate-pdf`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('at least one section with one line item');
  });
});

// ============================================
// Send Quote
// ============================================
describe('POST /v1/quotes/:id/send', () => {
  it('should send quote with diary entry', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValue({
      ...SAMPLE_QUOTE,
      pdf_file_id: 'pdf-file-id',
      sections: [{ ...SAMPLE_SECTION, line_items: [SAMPLE_LINE_ITEM] }],
    });
    mockQuoteUpdateStatus.mockResolvedValue(undefined);
    mockQuoteUpdate.mockResolvedValue({
      ...SAMPLE_QUOTE,
      status: 'sent',
    });
    mockDiaryInsert.mockResolvedValue({});

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'email',
        email: 'client@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('sent');
    expect(res.body.data.signing_token).toBeDefined();
    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ entry_type: 'quote_sent' }),
    );
  });

  it('should auto-generate PDF when sending without one', async () => {
    const token = await loginAs('owner');
    mockQuoteGetById.mockResolvedValue({
      ...SAMPLE_QUOTE,
      pdf_file_id: null,
      sections: [{ ...SAMPLE_SECTION, line_items: [SAMPLE_LINE_ITEM] }],
    });
    mockQuoteUpdateStatus.mockResolvedValue(undefined);
    mockQuoteUpdate.mockResolvedValue(SAMPLE_QUOTE);
    mockDiaryInsert.mockResolvedValue({});

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'email' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('sent');
  });
});

// ============================================
// Xero Item Search
// ============================================
describe('GET /v1/xero-items', () => {
  it('should return search results (reference only, no auto-fill)', async () => {
    const token = await loginAs('coordinator');
    mockSearchXeroItems.mockResolvedValue([
      {
        id: 'xero-1',
        item_code: 'MOWING-001',
        item_name: 'Lawn Mowing Service',
        sales_description: 'Standard mowing',
        sales_account_code: '200',
        unit_price: '35.00',
      },
    ]);

    const res = await request(app)
      .get('/v1/xero-items?search=mowing')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].unit_price).toBe('35.00');
    // unit_price is returned for DISPLAY as hint only — never auto-filled into quote line items
  });

  it('should reject empty search', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/xero-items?search=')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// RBAC
// ============================================
describe('Role-based access', () => {
  it('should deny crew_member from all quote operations', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get(`/v1/quotes/${QUOTE_ID}`);
    expect(res.status).toBe(401);
  });
});
