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

// --- Mock template repository ---
const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();
const mockFindAutomationTemplates = vi.fn();
const mockSaveFromQuote = vi.fn();
const mockCreateVersion = vi.fn();
const mockGetLatestVersionNumber = vi.fn();
const mockAcquireClient = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  create: (...args: unknown[]) => mockCreate(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  softDelete: (...args: unknown[]) => mockSoftDelete(...args),
  findAutomationTemplates: (...args: unknown[]) => mockFindAutomationTemplates(...args),
  saveFromQuote: (...args: unknown[]) => mockSaveFromQuote(...args),
  createVersion: (...args: unknown[]) => mockCreateVersion(...args),
  getLatestVersionNumber: (...args: unknown[]) => mockGetLatestVersionNumber(...args),
  acquireClient: (...args: unknown[]) => mockAcquireClient(...args),
}));

// --- Mock quotes repository (for load-template and save-from-quote) ---
const mockQuoteGetById = vi.fn();
const mockInsertSection = vi.fn();
const mockInsertLineItem = vi.fn();
const mockQuoteAcquireClient = vi.fn();

vi.mock('../../quotes/repository.js', () => ({
  getById: (...args: unknown[]) => mockQuoteGetById(...args),
  insert: vi.fn(),
  findByJobId: vi.fn(),
  findActiveByJobId: vi.fn(),
  updateStatus: vi.fn(),
  update: vi.fn(),
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
  findLineItemsByQuoteId: vi.fn(),
  copyQuoteContent: vi.fn(),
  searchXeroItems: vi.fn(),
  acquireClient: (...args: unknown[]) => mockQuoteAcquireClient(...args),
}));

import app from '../../../app.js';

// --- Fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'aaaaaaaa-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const USER_B_ID = 'cccccccc-0000-0000-0000-000000000002';
const TEMPLATE_ID = 'dddddddd-0000-0000-0000-000000000001';
const QUOTE_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const SECTION_ID = 'ffffffff-0000-0000-0000-000000000001';

const SAMPLE_QUOTE_TEMPLATE = {
  id: TEMPLATE_ID,
  tenant_id: TENANT_A,
  template_category: 'quote',
  template_name: 'Spring Cleanup Package',
  description: 'Standard spring cleanup scope',
  is_active: true,
  is_system: false,
  content: {
    sections: [{
      section_title: 'Scope of Work',
      section_body: 'Spring cleanup services',
      sort_order: 0,
      line_items: [{
        item_name: 'Spring Cleanup',
        description: 'Full spring cleanup',
        xero_item_code: '4220-SEASON-001',
        quantity: null,
        unit_price: null,
        unit: 'each',
        sort_order: 0,
      }],
    }],
    default_client_notes: '',
    default_payment_terms: 'Payment due within 30 days',
    default_valid_days: 30,
  },
  channel: null,
  automation_type: null,
  tags: ['spring', 'cleanup'],
  created_by: USER_ID,
  updated_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_SYSTEM_TEMPLATE = {
  ...SAMPLE_QUOTE_TEMPLATE,
  id: 'dddddddd-0000-0000-0000-000000000099',
  template_name: 'System Default',
  is_system: true,
};

const SAMPLE_EMAIL_TEMPLATE = {
  ...SAMPLE_QUOTE_TEMPLATE,
  id: 'dddddddd-0000-0000-0000-000000000002',
  template_category: 'email',
  template_name: 'Quote Sent Email',
  content: {
    subject: 'Your Quote from Sunset Services — Job #{{job_number}}',
    email_body: 'Hi {{client_first_name}}, please review your quote.',
    sms_body: 'Hi {{client_first_name}}, your quote is ready.',
    merge_fields: ['client_first_name', 'job_number', 'signing_link', 'valid_until', 'coordinator_name'],
  },
  channel: 'email',
};

const SAMPLE_AUTOMATION_TEMPLATE = {
  ...SAMPLE_QUOTE_TEMPLATE,
  id: 'dddddddd-0000-0000-0000-000000000003',
  template_category: 'automation',
  template_name: 'Booking Confirmation',
  automation_type: 'booking_confirmation',
  is_active: false,
  content: {
    email_subject: 'Your appointment is confirmed — {{company_name}}',
    email_body: 'Hi {{client_first_name}}, your booking is confirmed.',
    sms_body: 'Hi {{client_first_name}}! Booking confirmed.',
    send_via: 'both',
    delay_minutes: 0,
  },
  channel: 'both',
};

const SAMPLE_QUOTE = {
  id: QUOTE_ID,
  tenant_id: TENANT_A,
  job_id: '33333333-0000-0000-0000-000000000001',
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
  created_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sections: [{
    id: SECTION_ID,
    tenant_id: TENANT_A,
    quote_id: QUOTE_ID,
    section_title: 'Existing Section',
    section_body: null,
    sort_order: 0,
    line_items: [{
      id: 'aaaaaaaa-1111-0000-0000-000000000001',
      item_name: 'Existing Item',
      description: 'Already in quote',
      quantity: '5',
      unit_price: '100.00',
      line_total: '500.00',
      xero_item_code: null,
      unit: 'each',
      sort_order: 0,
      is_taxable: true,
      is_locked: false,
    }],
  }],
};

function createMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
}

let mockClient: ReturnType<typeof createMockClient>;

async function loginAs(role: string, tenantId = TENANT_A, userId = USER_ID) {
  mockFindUserByEmail.mockResolvedValue({
    id: userId,
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
  mockClient = createMockClient();
  mockQuoteAcquireClient.mockResolvedValue(mockClient);
  mockAcquireClient.mockResolvedValue(mockClient);
});

// ============================================
// 1. POST /templates creates template with correct category and content
// ============================================
describe('POST /v1/templates', () => {
  it('should create template with correct category and content', async () => {
    const token = await loginAs('owner');
    mockCreate.mockResolvedValue(SAMPLE_QUOTE_TEMPLATE);

    const res = await request(app)
      .post('/v1/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        template_category: 'quote',
        template_name: 'Spring Cleanup Package',
        content: SAMPLE_QUOTE_TEMPLATE.content,
        tags: ['spring', 'cleanup'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.template_category).toBe('quote');
    expect(res.body.data.template_name).toBe('Spring Cleanup Package');
    expect(res.body.data.content.sections).toBeDefined();
  });

  it('should deny crew_leader from creating templates', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post('/v1/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        template_category: 'quote',
        template_name: 'Test',
        content: {},
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// 2. Quote template content has null prices and quantities
// ============================================
describe('Quote template content validation', () => {
  it('should have null prices and quantities in quote template line items', async () => {
    const token = await loginAs('owner');
    mockCreate.mockResolvedValue(SAMPLE_QUOTE_TEMPLATE);

    const res = await request(app)
      .post('/v1/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        template_category: 'quote',
        template_name: 'Spring Cleanup Package',
        content: SAMPLE_QUOTE_TEMPLATE.content,
      });

    expect(res.status).toBe(201);
    const lineItem = res.body.data.content.sections[0].line_items[0];
    expect(lineItem.quantity).toBeNull();
    expect(lineItem.unit_price).toBeNull();
  });
});

// ============================================
// 3. POST load-template appends sections to quote, does not replace existing
// ============================================
describe('POST /v1/quotes/:id/load-template', () => {
  it('should append template sections to existing quote content', async () => {
    const token = await loginAs('coordinator');
    mockFindById.mockResolvedValue(SAMPLE_QUOTE_TEMPLATE);
    mockQuoteGetById
      .mockResolvedValueOnce(SAMPLE_QUOTE) // first call: get quote to check exists
      .mockResolvedValueOnce({ // second call: return updated quote
        ...SAMPLE_QUOTE,
        sections: [
          ...SAMPLE_QUOTE.sections,
          {
            id: 'new-section-id',
            section_title: 'Scope of Work',
            sort_order: 1,
            line_items: [{
              item_name: 'Spring Cleanup',
              quantity: null,
              unit_price: null,
            }],
          },
        ],
      });
    mockInsertSection.mockResolvedValue({
      id: 'new-section-id',
      section_title: 'Scope of Work',
      sort_order: 1,
    });
    mockInsertLineItem.mockResolvedValue({});

    const res = await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/load-template`)
      .set('Authorization', `Bearer ${token}`)
      .send({ template_id: TEMPLATE_ID });

    expect(res.status).toBe(200);
    // Original section + appended template section
    expect(res.body.data.sections).toHaveLength(2);
    expect(res.body.data.sections[0].section_title).toBe('Existing Section');
    expect(res.body.data.sections[1].section_title).toBe('Scope of Work');
  });

  // ============================================
  // 4. Loaded template items have null unit_price in quote
  // ============================================
  it('should insert line items with null unit_price', async () => {
    const token = await loginAs('coordinator');
    mockFindById.mockResolvedValue(SAMPLE_QUOTE_TEMPLATE);
    mockQuoteGetById
      .mockResolvedValueOnce(SAMPLE_QUOTE)
      .mockResolvedValueOnce(SAMPLE_QUOTE);
    mockInsertSection.mockResolvedValue({
      id: 'new-section-id',
      section_title: 'Scope of Work',
    });
    mockInsertLineItem.mockResolvedValue({});

    await request(app)
      .post(`/v1/quotes/${QUOTE_ID}/load-template`)
      .set('Authorization', `Bearer ${token}`)
      .send({ template_id: TEMPLATE_ID });

    expect(mockInsertLineItem).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        unit_price: null,
        quantity: null,
        line_total: 0,
      }),
    );
  });
});

// ============================================
// 5. POST save-from-quote captures structure but no prices
// ============================================
describe('POST /v1/templates/save-from-quote', () => {
  it('should save quote structure without prices or quantities', async () => {
    const token = await loginAs('coordinator');
    mockQuoteGetById.mockResolvedValue(SAMPLE_QUOTE);
    mockSaveFromQuote.mockImplementation((_tenantId: string, data: Record<string, unknown>) => {
      return Promise.resolve({
        ...SAMPLE_QUOTE_TEMPLATE,
        content: data.content,
        template_name: data.template_name,
      });
    });

    const res = await request(app)
      .post('/v1/templates/save-from-quote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        quote_id: QUOTE_ID,
        template_name: 'Saved from quote',
        tags: ['saved'],
      });

    expect(res.status).toBe(201);
    // Verify prices and quantities are stripped
    const savedContent = res.body.data.content as { sections: Array<{ line_items: Array<{ quantity: unknown; unit_price: unknown }> }> };
    const lineItem = savedContent.sections[0].line_items[0];
    expect(lineItem.quantity).toBeNull();
    expect(lineItem.unit_price).toBeNull();
  });
});

// ============================================
// 6. Only one active template per automation_type — unique index enforced
// ============================================
describe('Automation template uniqueness', () => {
  it('should update existing automation template instead of creating duplicate', async () => {
    const token = await loginAs('owner');
    mockFindAutomationTemplates.mockResolvedValue([SAMPLE_AUTOMATION_TEMPLATE]);
    mockUpdate.mockResolvedValue({
      ...SAMPLE_AUTOMATION_TEMPLATE,
      is_active: true,
      content: { email_subject: 'Updated' },
    });

    const res = await request(app)
      .patch('/v1/templates/automations/booking_confirmation/config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: { email_subject: 'Updated' },
        is_active: true,
      });

    expect(res.status).toBe(200);
    // Should call update, not create
    expect(mockUpdate).toHaveBeenCalledWith(
      SAMPLE_AUTOMATION_TEMPLATE.id,
      TENANT_A,
      expect.objectContaining({ is_active: true }),
    );
  });

  it('should create automation template when none exists for type', async () => {
    const token = await loginAs('owner');
    mockFindAutomationTemplates.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      ...SAMPLE_AUTOMATION_TEMPLATE,
      automation_type: 'payment_reminder',
    });

    const res = await request(app)
      .patch('/v1/templates/automations/payment_reminder/config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: { email_subject: 'Payment reminder' },
        channel: 'email',
      });

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        automation_type: 'payment_reminder',
        template_category: 'automation',
        is_active: false, // automations OFF by default
      }),
    );
  });
});

// ============================================
// 7. DELETE on is_system=TRUE template returns 422
// ============================================
describe('DELETE /v1/templates/:id', () => {
  it('should return 422 when deleting a system template', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_SYSTEM_TEMPLATE);

    const res = await request(app)
      .delete(`/v1/templates/${SAMPLE_SYSTEM_TEMPLATE.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('System templates cannot be deleted');
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it('should soft-delete a non-system template', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_QUOTE_TEMPLATE);
    mockSoftDelete.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/v1/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Template deleted');
    expect(mockSoftDelete).toHaveBeenCalledWith(TEMPLATE_ID, TENANT_A);
  });

  it('should deny div_mgr from deleting templates', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .delete(`/v1/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// 8. GET /templates?template_category=quote returns only quote templates
// ============================================
describe('GET /v1/templates', () => {
  it('should filter by template_category=quote', async () => {
    const token = await loginAs('coordinator');
    mockFindAll.mockResolvedValue({
      data: [SAMPLE_QUOTE_TEMPLATE],
      total: 1,
      page: 1,
      limit: 25,
    });

    const res = await request(app)
      .get('/v1/templates?template_category=quote')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0].template_category).toBe('quote');
    expect(mockFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ template_category: 'quote' }),
    );
  });

  it('should return 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/v1/templates');
    expect(res.status).toBe(401);
  });
});

// ============================================
// 9. Merge fields in email templates are documented and validated
// ============================================
describe('Email template merge fields', () => {
  it('should store merge fields in email template content', async () => {
    const token = await loginAs('owner');
    mockCreate.mockResolvedValue(SAMPLE_EMAIL_TEMPLATE);

    const res = await request(app)
      .post('/v1/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        template_category: 'email',
        template_name: 'Quote Sent Email',
        content: SAMPLE_EMAIL_TEMPLATE.content,
        channel: 'email',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.content.merge_fields).toEqual(
      expect.arrayContaining(['client_first_name', 'job_number', 'signing_link']),
    );
    expect(res.body.data.content.subject).toContain('{{job_number}}');
    expect(res.body.data.content.email_body).toContain('{{client_first_name}}');
  });
});

// ============================================
// 10. Multi-tenant isolation test
// ============================================
describe('Multi-tenant isolation', () => {
  it('should not return templates from another tenant', async () => {
    const token = await loginAs('owner', TENANT_A, USER_ID);
    mockFindAll.mockResolvedValue({
      data: [SAMPLE_QUOTE_TEMPLATE], // only TENANT_A templates
      total: 1,
      page: 1,
      limit: 25,
    });

    const res = await request(app)
      .get('/v1/templates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Verify findAll was called with TENANT_A
    expect(mockFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.any(Object),
    );
    // All returned templates should belong to TENANT_A
    for (const tpl of res.body.data.data) {
      expect(tpl.tenant_id).toBe(TENANT_A);
    }
  });

  it('should return 404 when accessing another tenant template by ID', async () => {
    const token = await loginAs('owner', TENANT_A, USER_ID);
    mockFindById.mockResolvedValue(null); // not found in TENANT_A

    const res = await request(app)
      .get(`/v1/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// Automation templates listing
// ============================================
describe('GET /v1/templates/automations', () => {
  it('should list automation templates for owner', async () => {
    const token = await loginAs('owner');
    mockFindAutomationTemplates.mockResolvedValue([SAMPLE_AUTOMATION_TEMPLATE]);

    const res = await request(app)
      .get('/v1/templates/automations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].automation_type).toBe('booking_confirmation');
  });

  it('should deny coordinator from listing automation templates', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/templates/automations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// RBAC
// ============================================
describe('Role-based access', () => {
  it('should deny crew_member from all template operations', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .post('/v1/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        template_category: 'quote',
        template_name: 'Test',
        content: {},
      });

    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get(`/v1/templates/${TEMPLATE_ID}`);
    expect(res.status).toBe(401);
  });

  it('should allow coordinator to read templates', async () => {
    const token = await loginAs('coordinator');
    mockFindById.mockResolvedValue(SAMPLE_QUOTE_TEMPLATE);

    const res = await request(app)
      .get(`/v1/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny div_mgr from updating automation config', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .patch('/v1/templates/automations/booking_confirmation/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: { email_subject: 'Test' } });

    expect(res.status).toBe(403);
  });
});
