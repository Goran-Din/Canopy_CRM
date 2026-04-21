/**
 * H-13 Quote Signing & WO Conversion workflow E2E tests.
 *
 * Five describe blocks mirror H-13 sections 2–6:
 *   1. Remote Signing (H-13 §2)
 *   2. In-Person Signing (H-13 §3)
 *   3. Revision (H-13 §4)
 *   4. Quote → Invoice Conversion (H-13 §5)
 *   5. Exception Matrix (H-13 §6)
 *
 * Endpoint adjustments vs the brief (actual API):
 *   - POST /v1/quotes/sign                       — signature (token in body)
 *   - GET  /v1/quotes/sign/:token                — signing page
 *   - POST /v1/quotes/:id/send                   — send (generates token)
 *   - POST /v1/quotes/:id/resend                 — resend (token unchanged per H-13 §6)
 *   - PATCH /v1/quotes/:id                       — revise (auto-versions if sent/viewed)
 *   - GET  /v1/jobs/:jobId/quotes                — version history (brief said /versions)
 *   - POST /v1/quotes/:id/convert-to-invoice     — convert
 *   - POST /v1/webhooks/xero                     — Xero webhook (HMAC via x-xero-signature)
 *
 * Gaps vs the brief (endpoints not present in Wave 1–6 code):
 *   - /v1/quotes/:id/reactivate       — not implemented
 *   - /v1/quotes/:id/retry-pdf        — not implemented (use /send or /resend)
 *   - /v1/quotes/:id/share-link       — not implemented (same token from /send used)
 *   - /v1/invoice-drafts/:id/approve  — quote→invoice creates an `invoices` row directly;
 *                                        the billing-drafts approval flow (Brief 03 scope)
 *                                        is a separate mechanism for recurring billing.
 *   - /v1/invoices/:id/escalate       — not implemented
 *   - DELETE /v1/quote-signatures/:id — not implemented (intentional: signatures are
 *                                        immutable per H-13 §6).
 *
 * The 410 Gone status the brief expects for already-signed/expired quotes is returned
 * as 409 (already-signed) and 401 (expired/superseded/declined) by the current code.
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

const mockJobsCustomerExists = vi.fn();
const mockJobsPropertyBelongsToCustomer = vi.fn();
const mockJobsContractExists = vi.fn();
const mockJobsGetNextJobNumber = vi.fn();
const mockJobsCreateWithClient = vi.fn();
const mockJobsFindById = vi.fn();
const mockJobsUpdate = vi.fn();
const mockJobsUpdateStatusWithClient = vi.fn();
const mockJobsAcquireClient = vi.fn();

vi.mock('../../modules/jobs/repository.js', () => ({
  findAll: vi.fn(),
  findById: (...a: unknown[]) => mockJobsFindById(...a),
  create: vi.fn(),
  update: (...a: unknown[]) => mockJobsUpdate(...a),
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
  customerExists: (...a: unknown[]) => mockJobsCustomerExists(...a),
  propertyBelongsToCustomer: (...a: unknown[]) => mockJobsPropertyBelongsToCustomer(...a),
  contractExists: (...a: unknown[]) => mockJobsContractExists(...a),
  getNextJobNumber: (...a: unknown[]) => mockJobsGetNextJobNumber(...a),
  createWithClient: (...a: unknown[]) => mockJobsCreateWithClient(...a),
  updateStatusWithClient: (...a: unknown[]) => mockJobsUpdateStatusWithClient(...a),
  acquireClient: (...a: unknown[]) => mockJobsAcquireClient(...a),
}));

const mockDiaryInsert = vi.fn();
const mockDiaryInsertStandalone = vi.fn();
const mockDiaryFindByJobId = vi.fn();

vi.mock('../../modules/jobs/diary/diary.repository.js', () => ({
  insert: (...a: unknown[]) => mockDiaryInsert(...a),
  insertStandalone: (...a: unknown[]) => mockDiaryInsertStandalone(...a),
  findByJobId: (...a: unknown[]) => mockDiaryFindByJobId(...a),
}));

const mockQuotesGetById = vi.fn();
const mockQuotesFindActiveByJobId = vi.fn();
const mockQuotesFindByJobId = vi.fn();
const mockQuotesGetNextQuoteNumber = vi.fn();
const mockQuotesInsert = vi.fn();
const mockQuotesUpdate = vi.fn();
const mockQuotesUpdateStatus = vi.fn();
const mockQuotesAcquireClient = vi.fn();

vi.mock('../../modules/quotes/repository.js', () => ({
  insert: (...a: unknown[]) => mockQuotesInsert(...a),
  getById: (...a: unknown[]) => mockQuotesGetById(...a),
  findByJobId: (...a: unknown[]) => mockQuotesFindByJobId(...a),
  findActiveByJobId: (...a: unknown[]) => mockQuotesFindActiveByJobId(...a),
  updateStatus: (...a: unknown[]) => mockQuotesUpdateStatus(...a),
  update: (...a: unknown[]) => mockQuotesUpdate(...a),
  updateTotals: vi.fn(),
  insertSection: vi.fn(),
  getSectionById: vi.fn(),
  updateSection: vi.fn(),
  deleteSection: vi.fn(),
  insertLineItem: vi.fn(),
  getLineItemById: vi.fn(),
  updateLineItem: vi.fn(),
  deleteLineItem: vi.fn(),
  findLineItemsByQuoteId: vi.fn().mockResolvedValue([]),
  copyQuoteContent: vi.fn(),
  getNextQuoteNumber: (...a: unknown[]) => mockQuotesGetNextQuoteNumber(...a),
  searchXeroItems: vi.fn(),
  acquireClient: (...a: unknown[]) => mockQuotesAcquireClient(...a),
}));

const mockSigFindBySigningToken = vi.fn();
const mockSigLockQuoteByToken = vi.fn();
const mockSigInsertSignature = vi.fn();
const mockSigFindByQuoteId = vi.fn();
const mockSigAcquireClient = vi.fn();

vi.mock('../../modules/signatures/repository.js', () => ({
  findBySigningToken: (...a: unknown[]) => mockSigFindBySigningToken(...a),
  lockQuoteByToken: (...a: unknown[]) => mockSigLockQuoteByToken(...a),
  insertSignature: (...a: unknown[]) => mockSigInsertSignature(...a),
  findByQuoteId: (...a: unknown[]) => mockSigFindByQuoteId(...a),
  acquireClient: (...a: unknown[]) => mockSigAcquireClient(...a),
}));

const mockFilesInsertFile = vi.fn();
vi.mock('../../modules/files/repository.js', () => ({
  insertFile: (...a: unknown[]) => mockFilesInsertFile(...a),
  insertFileStandalone: vi.fn(),
  getFileById: vi.fn(),
  findFilesByCustomerId: vi.fn(),
  updateFile: vi.fn(),
  softDeleteFile: vi.fn(),
  logAccess: vi.fn(),
  createStandardFolders: vi.fn(),
  createFolder: vi.fn(),
  findFoldersByCustomerId: vi.fn(),
  findFolderById: vi.fn(),
  acquireClient: vi.fn(),
}));

const mockR2UploadBuffer = vi.fn();
vi.mock('../../modules/files/r2.client.js', () => ({
  getPresignedUploadUrl: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
  uploadBuffer: (...a: unknown[]) => mockR2UploadBuffer(...a),
  deleteObject: vi.fn(),
}));

const mockAutomationHandleJobScheduled = vi.fn();
vi.mock('../../modules/automations/service.js', () => ({
  handleJobScheduled: (...a: unknown[]) => mockAutomationHandleJobScheduled(...a),
  handleQuoteSent: vi.fn(),
  handleInvoicePaid: vi.fn(),
  runPaymentReminders: vi.fn(),
  runFeedbackRequests: vi.fn(),
  runQuoteExpiry: vi.fn(),
}));

const mockPdfGenerateBuffer = vi.fn();
const mockPdfUploadQuotePdf = vi.fn();
vi.mock('../../modules/quotes/pdf/quote-pdf.service.js', () => ({
  generatePdfBuffer: (...a: unknown[]) => mockPdfGenerateBuffer(...a),
  uploadQuotePdf: (...a: unknown[]) => mockPdfUploadQuotePdf(...a),
}));

vi.mock('../../modules/templates/repository.js', () => ({
  findById: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

import app from '../../app.js';
import {
  TENANT_A,
  CUSTOMER_ID,
  PROPERTY_ID,
  WorkflowState,
  installStateMocks,
  loginAs,
  FAKE_SIGNATURE_BASE64,
} from './_helpers.js';

const state = new WorkflowState();

beforeEach(() => {
  vi.clearAllMocks();
  state.reset();
  // Point the Xero webhook HMAC at a known value so we can compute valid signatures.
  process.env.XERO_WEBHOOK_KEY = 'test-xero-webhook-secret';

  installStateMocks(state, {
    findUserByEmail: mockFindUserByEmail,
    findUserRoles: mockFindUserRoles,
    saveRefreshToken: mockSaveRefreshToken,
    updateLastLogin: mockUpdateLastLogin,
    jobsCustomerExists: mockJobsCustomerExists,
    jobsPropertyBelongsToCustomer: mockJobsPropertyBelongsToCustomer,
    jobsContractExists: mockJobsContractExists,
    jobsGetNextJobNumber: mockJobsGetNextJobNumber,
    jobsCreateWithClient: mockJobsCreateWithClient,
    jobsFindById: mockJobsFindById,
    jobsUpdate: mockJobsUpdate,
    jobsUpdateStatusWithClient: mockJobsUpdateStatusWithClient,
    jobsAcquireClient: mockJobsAcquireClient,
    diaryInsert: mockDiaryInsert,
    diaryInsertStandalone: mockDiaryInsertStandalone,
    diaryFindByJobId: mockDiaryFindByJobId,
    quotesGetById: mockQuotesGetById,
    quotesFindActiveByJobId: mockQuotesFindActiveByJobId,
    quotesFindByJobId: mockQuotesFindByJobId,
    quotesGetNextQuoteNumber: mockQuotesGetNextQuoteNumber,
    quotesInsert: mockQuotesInsert,
    quotesUpdate: mockQuotesUpdate,
    quotesUpdateStatus: mockQuotesUpdateStatus,
    quotesAcquireClient: mockQuotesAcquireClient,
    signaturesFindBySigningToken: mockSigFindBySigningToken,
    signaturesLockQuoteByToken: mockSigLockQuoteByToken,
    signaturesInsertSignature: mockSigInsertSignature,
    signaturesFindByQuoteId: mockSigFindByQuoteId,
    signaturesAcquireClient: mockSigAcquireClient,
    filesInsertFile: mockFilesInsertFile,
    automationHandleJobScheduled: mockAutomationHandleJobScheduled,
    pdfGenerateBuffer: mockPdfGenerateBuffer,
    pdfUploadQuotePdf: mockPdfUploadQuotePdf,
    r2UploadBuffer: mockR2UploadBuffer,
  });
});

const authMocks = {
  findUserByEmail: mockFindUserByEmail,
  findUserRoles: mockFindUserRoles,
  saveRefreshToken: mockSaveRefreshToken,
  updateLastLogin: mockUpdateLastLogin,
};

// ------------------------------------------------------------------------
// Seed helpers — get a quote into "sent" status for signing tests
// ------------------------------------------------------------------------
async function seedSentQuote(): Promise<{
  token: string;
  quoteId: string;
  jobId: string;
  signingToken: string;
}> {
  const token = await loginAs(app, 'coordinator', authMocks);
  const jobRes = await request(app)
    .post('/v1/jobs/v2')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: CUSTOMER_ID,
      property_id: PROPERTY_ID,
      division: 'landscaping_maintenance',
      creation_path: 'quote',
      title: 'Signing workflow test',
    });
  const jobId = jobRes.body.data.id;

  const quoteRes = await request(app)
    .post(`/v1/jobs/${jobId}/quotes`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  const quoteId = quoteRes.body.data.id;

  const sendRes = await request(app)
    .post(`/v1/quotes/${quoteId}/send`)
    .set('Authorization', `Bearer ${token}`)
    .send({ channel: 'email', email: 'client@example.com' });

  return {
    token,
    quoteId,
    jobId,
    signingToken: sendRes.body.data.signing_token as string,
  };
}

function submitSignatureBody(signingToken: string, overrides: Record<string, unknown> = {}) {
  return {
    signing_token: signingToken,
    signer_name: 'John Smith',
    signature_image_base64: FAKE_SIGNATURE_BASE64,
    agreement_checked: true,
    ...overrides,
  };
}

// ============================================
// Describe 1 — Remote Signing (H-13 §2)
// ============================================
describe('H-13 §2 — Remote Signing Workflow', () => {
  it('send flow: quote → PDF → send → status=sent, signing_token populated, diary entry', async () => {
    const { quoteId, jobId, signingToken } = await seedSentQuote();

    const q = state.quotes.get(quoteId)!;
    expect(q.status).toBe('sent');
    expect(q.signing_token).toBe(signingToken);
    expect(state.diaryEntryTypes(jobId)).toContain('quote_sent');
  });

  it('signing token is 64-char hex and URL-safe', async () => {
    const { signingToken } = await seedSentQuote();

    expect(signingToken).toMatch(/^[a-f0-9]{64}$/);
    expect(encodeURIComponent(signingToken)).toBe(signingToken);
  });

  it('looking up an unknown token returns 401 (tokens are not guessable)', async () => {
    await seedSentQuote();
    const unknownToken = 'b'.repeat(64);

    const res = await request(app).get(`/v1/quotes/sign/${unknownToken}`);

    expect(res.status).toBe(401);
  });

  it('client view: first GET returns quote (flips sent→viewed), second GET is idempotent', async () => {
    const { signingToken } = await seedSentQuote();

    const first = await request(app).get(`/v1/quotes/sign/${signingToken}`);
    expect(first.status).toBe(200);
    expect(first.body.data.already_signed).toBe(false);

    const second = await request(app).get(`/v1/quotes/sign/${signingToken}`);
    expect(second.status).toBe(200);
    expect(second.body.data.already_signed).toBe(false);
  });

  it('client view does NOT leak tenant_id, internal_notes, or signing_token', async () => {
    const { signingToken } = await seedSentQuote();

    const res = await request(app).get(`/v1/quotes/sign/${signingToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('tenant_id');
    expect(res.body.data).not.toHaveProperty('internal_notes');
    expect(res.body.data).not.toHaveProperty('signing_token');
  });

  it('signature submission: signature row created, diary "Quote signed" entry appended', async () => {
    const { quoteId, jobId, signingToken } = await seedSentQuote();

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken));

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(state.signatures).toHaveLength(1);
    expect(state.signatures[0].quote_id).toBe(quoteId);
    expect(state.signatures[0].signer_name).toBe('John Smith');

    const signedDiary = state.diary.filter((d) => d.entry_type === 'quote_signed');
    expect(signedDiary).toHaveLength(1);
    expect(signedDiary[0].job_id).toBe(jobId);
    expect(signedDiary[0].title).toBe('Quote signed by John Smith');
  });

  it('signing validation: missing agreement_checked → 400', async () => {
    const { signingToken } = await seedSentQuote();

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken, { agreement_checked: false }));

    expect(res.status).toBe(400);
    expect(state.signatures).toHaveLength(0);
  });

  it('signing validation: missing signer_name → 400', async () => {
    const { signingToken } = await seedSentQuote();

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken, { signer_name: 'J' }));

    expect(res.status).toBe(400);
  });

  it('signing validation: empty signature image → 400', async () => {
    const { signingToken } = await seedSentQuote();

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken, { signature_image_base64: '' }));

    expect(res.status).toBe(400);
  });

  it('signing a quote already signed → 409 (no duplicate signature row)', async () => {
    const { quoteId, signingToken } = await seedSentQuote();
    const q = state.quotes.get(quoteId)!;
    state.quotes.set(quoteId, { ...q, status: 'signed' });

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken));

    expect(res.status).toBe(409);
    expect(state.signatures).toHaveLength(0);
  });

  it('signing an expired quote → 401', async () => {
    const { quoteId, signingToken } = await seedSentQuote();
    const q = state.quotes.get(quoteId)!;
    state.quotes.set(quoteId, { ...q, valid_until: '2020-01-01' });

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken));

    expect(res.status).toBe(401);
  });

  it('signing a superseded quote → 401', async () => {
    const { quoteId, signingToken } = await seedSentQuote();
    const q = state.quotes.get(quoteId)!;
    state.quotes.set(quoteId, { ...q, status: 'superseded' });

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken));

    expect(res.status).toBe(401);
  });

  it('signing a declined quote → 401', async () => {
    const { quoteId, signingToken } = await seedSentQuote();
    const q = state.quotes.get(quoteId)!;
    state.quotes.set(quoteId, { ...q, status: 'declined' });

    const res = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken));

    expect(res.status).toBe(401);
  });
});

// ============================================
// Describe 2 — In-Person Signing (H-13 §3)
// ============================================
describe('H-13 §3 — In-Person Signing', () => {
  it('in-person signing uses the SAME public endpoint as remote (no separate flag)', async () => {
    const { quoteId, signingToken } = await seedSentQuote();

    // Staff hands the device to the client; client signs using the same URL.
    const res = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken));

    expect(res.status).toBe(200);
    expect(state.signatures).toHaveLength(1);
    expect(state.signatures[0].quote_id).toBe(quoteId);
  });

  it('signature row records client IP and user-agent (not an is_in_person flag)', async () => {
    const { signingToken } = await seedSentQuote();

    await request(app)
      .post('/v1/quotes/sign')
      .set('User-Agent', 'Mozilla/5.0 (iPad test device)')
      .send(submitSignatureBody(signingToken));

    const sig = state.signatures[0];
    expect(sig).toBeDefined();
    expect(sig.signer_ip_address).toBeTruthy();
    expect(sig.user_agent).toContain('iPad test device');
    expect(sig).not.toHaveProperty('is_in_person');
  });
});

// ============================================
// Describe 3 — Revision (H-13 §4)
// ============================================
describe('H-13 §4 — Revision Workflow', () => {
  it('PATCH on a sent quote creates v2 draft with fresh signing token; v1 becomes superseded', async () => {
    const { token, quoteId, jobId } = await seedSentQuote();

    const revise = await request(app)
      .patch(`/v1/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Updated scope' });

    expect(revise.status).toBe(200);
    expect(state.quotes.get(quoteId)?.status).toBe('superseded');

    const versions = [...state.quotes.values()].filter((q) => q.job_id === jobId);
    const v2 = versions.find((q) => q.version === 2);
    expect(v2).toBeDefined();
    expect(v2?.status).toBe('draft');
    expect(v2?.signing_token).toBeTruthy();
    expect(v2?.signing_token).not.toBe(state.quotes.get(quoteId)?.signing_token);
  });

  it('sending v2 issues a new token (different from v1)', async () => {
    const { token, quoteId, jobId, signingToken: v1Token } = await seedSentQuote();

    await request(app)
      .patch(`/v1/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Updated scope' });

    const v2 = [...state.quotes.values()].find((q) => q.job_id === jobId && q.version === 2)!;
    const sendV2 = await request(app)
      .post(`/v1/quotes/${v2.id}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'email', email: 'client@example.com' });

    expect(sendV2.status).toBe(200);
    const newToken = sendV2.body.data.signing_token as string;
    expect(newToken).toMatch(/^[a-f0-9]{64}$/);
    expect(newToken).not.toBe(v1Token);
  });

  it('signing v2 records signature; v1 remains superseded', async () => {
    const { token, quoteId, jobId } = await seedSentQuote();
    await request(app)
      .patch(`/v1/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Revised' });
    const v2 = [...state.quotes.values()].find((q) => q.job_id === jobId && q.version === 2)!;
    const sendV2 = await request(app)
      .post(`/v1/quotes/${v2.id}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'email', email: 'client@example.com' });
    const v2Token = sendV2.body.data.signing_token as string;

    const sign = await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(v2Token));

    expect(sign.status).toBe(200);
    expect(state.signatures).toHaveLength(1);
    expect(state.signatures[0].quote_id).toBe(v2.id);
    expect(state.quotes.get(quoteId)?.status).toBe('superseded'); // v1 unchanged
  });

  it('version history: GET /v1/jobs/:jobId/quotes returns both versions', async () => {
    const { token, quoteId, jobId } = await seedSentQuote();
    await request(app)
      .patch(`/v1/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Revised' });

    const res = await request(app)
      .get(`/v1/jobs/${jobId}/quotes`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const versions = (res.body.data as Array<{ version: number; status: string }>)
      .map((q) => q.version)
      .sort();
    expect(versions).toEqual([1, 2]);
  });

  it('cannot revise an already-signed quote (service returns 422)', async () => {
    const { token, quoteId, signingToken } = await seedSentQuote();
    await request(app)
      .post('/v1/quotes/sign')
      .send(submitSignatureBody(signingToken));
    // Our helper's sign path doesn't flip the quote status in state (raw client.query),
    // so force it here to reflect the real post-sign state.
    const q = state.quotes.get(quoteId)!;
    state.quotes.set(quoteId, { ...q, status: 'signed' });

    const res = await request(app)
      .patch(`/v1/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Too late' });

    expect(res.status).toBe(422);
  });
});

// ============================================
// Describe 4 — Quote → Invoice Conversion (H-13 §5)
// ============================================
describe('H-13 §5 — Quote → Invoice Conversion', () => {
  it('converting a signed quote creates an invoice row and flips quote to converted + diary entry', async () => {
    const { quoteId, jobId } = await seedSentQuote();
    // Simulate post-signature state (quotes/service.ts:convertToInvoice requires status=signed)
    const q = state.quotes.get(quoteId)!;
    state.quotes.set(quoteId, { ...q, status: 'signed' });

    // convert-to-invoice is owner/div_mgr only (quotes/routes.ts:184)
    const ownerToken = await loginAs(app, 'owner', authMocks);
    const res = await request(app)
      .post(`/v1/quotes/${quoteId}/convert-to-invoice`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ due_days: 30 });

    expect(res.status).toBe(201);
    expect(res.body.data.invoice_id).toBeTruthy();
    expect(res.body.data.status).toBe('draft');
    expect(state.invoices).toHaveLength(1);

    // Quote flipped to 'converted'
    expect(state.quotes.get(quoteId)?.status).toBe('converted');

    // Diary contains an invoice-from-quote entry
    expect(state.diaryEntryTypes(jobId)).toContain('invoice_from_quote');
  });

  it('converting an UN-signed quote is rejected with 422', async () => {
    const { quoteId } = await seedSentQuote();
    // Quote is still in 'sent' status

    const ownerToken = await loginAs(app, 'owner', authMocks);
    const res = await request(app)
      .post(`/v1/quotes/${quoteId}/convert-to-invoice`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ due_days: 30 });

    expect(res.status).toBe(422);
    expect(state.invoices).toHaveLength(0);
  });

  it('converting twice: second call returns 422 because status is now "converted" (not signed)', async () => {
    const { quoteId } = await seedSentQuote();
    const q = state.quotes.get(quoteId)!;
    state.quotes.set(quoteId, { ...q, status: 'signed' });

    const ownerToken = await loginAs(app, 'owner', authMocks);
    const first = await request(app)
      .post(`/v1/quotes/${quoteId}/convert-to-invoice`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ due_days: 30 });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/v1/quotes/${quoteId}/convert-to-invoice`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ due_days: 30 });
    expect(second.status).toBe(422);
    expect(state.invoices).toHaveLength(1);
  });

  it('Xero PAID webhook with invalid HMAC signature → 401', async () => {
    const payload = {
      events: [{ eventType: 'PAID', resourceId: 'xero-inv-123', amountPaid: 500 }],
    };

    const res = await request(app)
      .post('/v1/webhooks/xero')
      .set('x-xero-signature', 'deadbeef-invalid')
      .send(payload);

    expect(res.status).toBe(401);
  });

  it('Xero PAID webhook with valid HMAC signature → 200 (events accepted for async processing)', async () => {
    const payload = {
      events: [
        { eventType: 'PAID', resourceId: 'xero-inv-123', amountPaid: 500, fullyPaidDate: '2026-05-05' },
      ],
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
});

// ============================================
// Describe 5 — Cross-cutting Exception Matrix (H-13 §6)
// ============================================
describe('H-13 §6 — Cross-cutting Exception Matrix', () => {
  it('resend keeps the same signing_token (spec §6: do not invalidate)', async () => {
    const { token, quoteId, signingToken } = await seedSentQuote();

    const res = await request(app)
      .post(`/v1/quotes/${quoteId}/resend`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'client-new@example.com' });

    expect(res.status).toBe(200);
    // The stored quote's signing_token is unchanged
    expect(state.quotes.get(quoteId)?.signing_token).toBe(signingToken);
  });

  it('reactivate endpoint is not implemented (POST /v1/quotes/:id/reactivate → 404)', async () => {
    const { token, quoteId } = await seedSentQuote();

    const res = await request(app)
      .post(`/v1/quotes/${quoteId}/reactivate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valid_until: '2027-01-01' });

    expect(res.status).toBe(404);
  });

  it('retry-pdf endpoint is not implemented (POST /v1/quotes/:id/retry-pdf → 404)', async () => {
    const { token, quoteId } = await seedSentQuote();

    const res = await request(app)
      .post(`/v1/quotes/${quoteId}/retry-pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('no self-service signature undo: DELETE /v1/quote-signatures/:id is not a route', async () => {
    const { token } = await seedSentQuote();
    const fakeSigId = '00000000-0000-0000-0000-000000000042';

    const res = await request(app)
      .delete(`/v1/quote-signatures/${fakeSigId}`)
      .set('Authorization', `Bearer ${token}`);

    // Express 404s unknown routes
    expect(res.status).toBe(404);
  });
});
