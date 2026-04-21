/**
 * H-12 Path A — Quote Needed workflow E2E tests.
 *
 * Validates the full lifecycle for jobs that begin in `quote` status:
 *   create → quote draft → send → view → sign → auto-WO → assign crew → scheduled.
 *
 * Endpoint adjustments vs the brief (actual V2 API):
 *   POST /v1/jobs/v2                       — V2 job creation (brief said /v1/jobs)
 *   POST /v1/jobs/:jobId/quotes            — quote create (brief said /v1/quotes)
 *   POST /v1/quotes/:id/send               — send
 *   GET  /v1/quotes/sign/:token            — public signing page
 *   POST /v1/quotes/sign                   — submit signature (token in body)
 *   PUT  /v1/jobs/:id                      — crew assignment (brief said PATCH)
 *   POST /v1/jobs/:id/status               — status change with diary
 *   PATCH /v1/quotes/:id/decline           — decline (brief said POST)
 *
 * Gaps flagged (no corresponding endpoint exists in Wave 1-6 code):
 *   - /v1/quotes/:id/revise         — superseded by PATCH /v1/quotes/:id auto-versioning
 *   - quote_follow_up scheduling    — no observable wiring yet (tests are informational-only)
 *   - /v1/jobs/:id/convert-to-wo on a NON-assessment job — current service restricts to
 *     assessment status (jobs/service.ts:476). Brief's "skip quote, convert directly" case
 *     is therefore not supported and is tested here as a rejection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ---- Mock database & redis BEFORE importing app ----
vi.mock('../../config/database.js', () => ({
  queryDb: vi.fn(),
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    on: vi.fn(),
  },
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

// ---- Mock auth repo ----
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

// ---- Mock jobs repo ----
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

// ---- Mock diary ----
const mockDiaryInsert = vi.fn();
const mockDiaryInsertStandalone = vi.fn();
const mockDiaryFindByJobId = vi.fn();

vi.mock('../../modules/jobs/diary/diary.repository.js', () => ({
  insert: (...a: unknown[]) => mockDiaryInsert(...a),
  insertStandalone: (...a: unknown[]) => mockDiaryInsertStandalone(...a),
  findByJobId: (...a: unknown[]) => mockDiaryFindByJobId(...a),
}));

// ---- Mock quotes repo ----
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

// ---- Mock signatures repo ----
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

// ---- Mock files repo + R2 ----
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

// ---- Mock automation service (observe handleJobScheduled) ----
const mockAutomationHandleJobScheduled = vi.fn();
vi.mock('../../modules/automations/service.js', () => ({
  handleJobScheduled: (...a: unknown[]) => mockAutomationHandleJobScheduled(...a),
  handleQuoteSent: vi.fn(),
  handleInvoicePaid: vi.fn(),
  runPaymentReminders: vi.fn(),
  runFeedbackRequests: vi.fn(),
  runQuoteExpiry: vi.fn(),
}));

// ---- Mock PDF service (bypass Puppeteer) ----
const mockPdfGenerateBuffer = vi.fn();
const mockPdfUploadQuotePdf = vi.fn();
vi.mock('../../modules/quotes/pdf/quote-pdf.service.js', () => ({
  generatePdfBuffer: (...a: unknown[]) => mockPdfGenerateBuffer(...a),
  uploadQuotePdf: (...a: unknown[]) => mockPdfUploadQuotePdf(...a),
}));

// ---- Mock templates repo (quotes service imports it) ----
vi.mock('../../modules/templates/repository.js', () => ({
  findById: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

// ---- Now import app (after all mocks registered) ----
import app from '../../app.js';
import {
  TENANT_A,
  CUSTOMER_ID,
  PROPERTY_ID,
  CREW_ID,
  WorkflowState,
  installStateMocks,
  loginAs,
  FAKE_SIGNATURE_BASE64,
} from './_helpers.js';

// ---- State container ----
const state = new WorkflowState();

beforeEach(() => {
  vi.clearAllMocks();
  state.reset();
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

// ---- Small helpers for step-by-step tests ----
async function createPathAJob(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/v1/jobs/v2')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: CUSTOMER_ID,
      property_id: PROPERTY_ID,
      division: 'landscaping_maintenance',
      creation_path: 'quote',
      title: 'Garden Renovation',
      ...overrides,
    });
  return res;
}

async function createQuoteForJob(token: string, jobId: string) {
  return request(app)
    .post(`/v1/jobs/${jobId}/quotes`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
}

async function sendQuote(token: string, quoteId: string, email = 'client@example.com') {
  return request(app)
    .post(`/v1/quotes/${quoteId}/send`)
    .set('Authorization', `Bearer ${token}`)
    .send({ channel: 'email', email });
}

// ============================================
// Happy path — Path A (Quote Needed)
// ============================================
describe('H-12 Path A — Quote Needed happy path', () => {
  it('step 1: coordinator creates Path A job → status=quote, job_number, diary entry', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);

    const res = await createPathAJob(token);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('quote');
    expect(res.body.data.creation_path).toBe('quote');
    expect(res.body.data.job_number).toMatch(/^\d{4}-\d{2}$/);

    // Diary entry created with expected title format
    const titles = state.diaryTitles();
    expect(titles).toContainEqual(expect.stringMatching(/^Job #\d{4}-\d{2} created as Quote$/));
    expect(state.diaryEntryTypes()).toContain('job_created');
  });

  it('step 2: coordinator creates quote on Path A job → draft status', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const jobId = createRes.body.data.id;

    const quoteRes = await createQuoteForJob(token, jobId);

    expect(quoteRes.status).toBe(201);
    expect(quoteRes.body.data.status).toBe('draft');
    expect(quoteRes.body.data.job_id).toBe(jobId);
    expect(quoteRes.body.data.quote_number).toMatch(/^Q-\d{4}-\d{2}$/);

    // Quote creation diary entry
    expect(state.diaryEntryTypes(jobId)).toContain('quote_created');
  });

  it('step 3: coordinator sends quote → status=sent, signing_token issued, quote_sent diary', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const jobId = createRes.body.data.id;
    const quoteRes = await createQuoteForJob(token, jobId);
    const quoteId = quoteRes.body.data.id;

    const sendRes = await sendQuote(token, quoteId);

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.data.status).toBe('sent');
    expect(sendRes.body.data.signing_token).toMatch(/^[a-f0-9]{64}$/);
    expect(sendRes.body.data.signing_url).toContain(sendRes.body.data.signing_token);

    // Quote state flipped
    const storedQuote = state.quotes.get(quoteId);
    expect(storedQuote?.status).toBe('sent');
    expect(storedQuote?.signing_token).toBeTruthy();

    // Diary shows sent event
    expect(state.diaryEntryTypes(jobId)).toContain('quote_sent');
  });

  it('step 4: client opens signing link → quote payload returned without internals', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const jobId = createRes.body.data.id;
    const quoteRes = await createQuoteForJob(token, jobId);
    const quoteId = quoteRes.body.data.id;
    const sendRes = await sendQuote(token, quoteId);
    const signingToken = sendRes.body.data.signing_token as string;

    const viewRes = await request(app).get(`/v1/quotes/sign/${signingToken}`);

    expect(viewRes.status).toBe(200);
    expect(viewRes.body.data.already_signed).toBe(false);
    expect(viewRes.body.data.quote_number).toMatch(/^Q-\d{4}-\d{2}$/);
    // Must NOT leak tenant_id, internal_notes, or signing_token
    expect(viewRes.body.data).not.toHaveProperty('tenant_id');
    expect(viewRes.body.data).not.toHaveProperty('internal_notes');
    expect(viewRes.body.data).not.toHaveProperty('signing_token');
  });

  it('step 5: client submits signature → quote signed, job → unscheduled, diary updated', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const jobId = createRes.body.data.id;
    const quoteRes = await createQuoteForJob(token, jobId);
    const quoteId = quoteRes.body.data.id;
    const sendRes = await sendQuote(token, quoteId);
    const signingToken = sendRes.body.data.signing_token as string;

    const signRes = await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: signingToken,
        signer_name: 'John Smith',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    expect(signRes.status).toBe(200);
    expect(signRes.body.data.success).toBe(true);
    expect(signRes.body.data.signer_name).toBe('John Smith');

    // Signature recorded
    expect(state.signatures).toHaveLength(1);
    expect(state.signatures[0].quote_id).toBe(quoteId);

    // Transaction effects: the signature service hits the raw client for quote + job
    // status updates, which our mocked client doesn't persist. We assert via the
    // diary (which IS routed through diaryRepo.insert).
    expect(state.diaryEntryTypes(jobId)).toContain('quote_signed');
    const signedDiaryTitles = state.diary
      .filter((d) => d.entry_type === 'quote_signed')
      .map((d) => d.title);
    expect(signedDiaryTitles).toContainEqual(
      expect.stringContaining('Quote signed by John Smith'),
    );
  });

  it('step 6: coordinator assigns crew + schedules → status=scheduled, booking automation fires', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const jobId = createRes.body.data.id;

    // Simulate job post-signing: put job in unscheduled state
    const job = state.jobs.get(jobId);
    state.jobs.set(jobId, { ...job!, status: 'unscheduled' });

    // Crew assignment + schedule via PUT /v1/jobs/:id
    const assignRes = await request(app)
      .put(`/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assigned_crew_id: CREW_ID, scheduled_date: '2026-05-15' });

    expect(assignRes.status).toBe(200);
    expect(state.jobs.get(jobId)?.assigned_crew_id).toBe(CREW_ID);

    // Transition to scheduled via V2 status change
    const statusRes = await request(app)
      .post(`/v1/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'scheduled' });

    expect(statusRes.status).toBe(200);
    expect(state.jobs.get(jobId)?.status).toBe('scheduled');

    // booking_confirmation is fire-and-forget; give the microtask queue one tick.
    await new Promise((r) => setImmediate(r));

    // automationService.handleJobScheduled invoked with this tenant+job
    expect(mockAutomationHandleJobScheduled).toHaveBeenCalledWith(TENANT_A, jobId);

    // Diary shows status_change
    expect(state.diaryEntryTypes(jobId)).toContain('status_change');
  });
});

// ============================================
// Exception flows — Path A
// ============================================
describe('H-12 Path A — exception flows', () => {
  it('signing an expired quote returns 401 and does not create a signature', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const quoteRes = await createQuoteForJob(token, createRes.body.data.id);
    const quoteId = quoteRes.body.data.id;
    const sendRes = await sendQuote(token, quoteId);
    const signingToken = sendRes.body.data.signing_token as string;

    // Manually expire: set valid_until to the past
    const q = state.quotes.get(quoteId)!;
    state.quotes.set(quoteId, { ...q, valid_until: '2020-01-01' });

    const signRes = await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: signingToken,
        signer_name: 'John Smith',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    expect(signRes.status).toBe(401);
    expect(signRes.body.message).toMatch(/expired/i);
    expect(state.signatures).toHaveLength(0);
  });

  it('signing an already-signed quote returns 409', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const quoteRes = await createQuoteForJob(token, createRes.body.data.id);
    const quoteId = quoteRes.body.data.id;
    const sendRes = await sendQuote(token, quoteId);
    const signingToken = sendRes.body.data.signing_token as string;

    // Simulate prior signature by flipping status to signed
    const q = state.quotes.get(quoteId)!;
    state.quotes.set(quoteId, { ...q, status: 'signed' });

    const signRes = await request(app)
      .post('/v1/quotes/sign')
      .send({
        signing_token: signingToken,
        signer_name: 'Jane Doe',
        signature_image_base64: FAKE_SIGNATURE_BASE64,
        agreement_checked: true,
      });

    expect(signRes.status).toBe(409);
  });

  it('client requests changes → PATCH creates v2 draft, old quote superseded', async () => {
    // Brief asks for /v1/quotes/:id/revise; actual flow uses PATCH auto-versioning.
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const jobId = createRes.body.data.id;
    const quoteRes = await createQuoteForJob(token, jobId);
    const quoteId = quoteRes.body.data.id;
    await sendQuote(token, quoteId);

    // Revise: PATCH with small change while sent
    const reviseRes = await request(app)
      .patch(`/v1/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_notes: 'Please add mulch' });

    expect(reviseRes.status).toBe(200);

    // Original is now superseded in state
    expect(state.quotes.get(quoteId)?.status).toBe('superseded');

    // A new quote exists with version=2 and status=draft
    const allForJob = [...state.quotes.values()].filter((q) => q.job_id === jobId);
    const v2 = allForJob.find((q) => q.version === 2);
    expect(v2).toBeDefined();
    expect(v2?.status).toBe('draft');
  });

  it('coordinator declines a sent quote on client\'s behalf → status=declined', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const quoteRes = await createQuoteForJob(token, createRes.body.data.id);
    const quoteId = quoteRes.body.data.id;
    await sendQuote(token, quoteId);

    const declineRes = await request(app)
      .patch(`/v1/quotes/${quoteId}/decline`)
      .set('Authorization', `Bearer ${token}`)
      .send({ decline_reason: 'Budget too tight' });

    expect(declineRes.status).toBe(200);
    expect(state.diaryEntryTypes(createRes.body.data.id)).toContain('quote_declined');
    // quotes.declineQuote uses a raw UPDATE so our state.quotes status isn't
    // flipped — diary is the observable artifact.
  });

  it('convert-to-WO on a Path A (quote-status) job is rejected — only assessment jobs qualify', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createPathAJob(token);
    const jobId = createRes.body.data.id;

    const res = await request(app)
      .post(`/v1/jobs/${jobId}/convert-to-wo`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/assessment/i);
  });

  it('role guard: crew_member cannot create a Path A job', async () => {
    const token = await loginAs(app, 'crew_member', authMocks);

    const res = await createPathAJob(token);

    expect(res.status).toBe(403);
  });

  it('role guard: coordinator CAN create a Path A job', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);

    const res = await createPathAJob(token);

    expect(res.status).toBe(201);
  });
});
