/**
 * H-12 Path B — Instant Work Order workflow E2E tests.
 *
 * Path B enters `unscheduled` immediately; crew assignment transitions to `scheduled`.
 * Covers: creation, booking_confirmation automation, after-the-fact quote, perf sanity.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../config/database.js', () => ({
  queryDb: vi.fn(),
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
  CREW_ID,
  WorkflowState,
  installStateMocks,
  loginAs,
} from './_helpers.js';

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

async function createInstantWOJob(token: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/v1/jobs/v2')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: CUSTOMER_ID,
      property_id: PROPERTY_ID,
      division: 'landscaping_maintenance',
      creation_path: 'instant_work_order',
      title: 'Emergency Brush Clearing',
      ...overrides,
    });
}

// ============================================
// Path B — Instant Work Order
// ============================================
describe('H-12 Path B — Instant Work Order', () => {
  it('coordinator creates Path B job → status=unscheduled immediately, job_number assigned, diary entry', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);

    const res = await createInstantWOJob(token);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('unscheduled');
    expect(res.body.data.creation_path).toBe('instant_work_order');
    expect(res.body.data.job_number).toMatch(/^\d{4}-\d{2}$/);

    // Diary entry title shape: "Job #NNNN-YY created as Instant Work Order"
    expect(state.diaryTitles()).toContainEqual(
      expect.stringMatching(/^Job #\d{4}-\d{2} created as Instant Work Order$/),
    );
  });

  it('assigning crew + moving to scheduled fires booking_confirmation automation', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createInstantWOJob(token);
    const jobId = createRes.body.data.id;

    // Assign crew + date
    const assignRes = await request(app)
      .put(`/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assigned_crew_id: CREW_ID, scheduled_date: '2026-05-15' });
    expect(assignRes.status).toBe(200);

    // Transition to scheduled
    const statusRes = await request(app)
      .post(`/v1/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'scheduled' });
    expect(statusRes.status).toBe(200);
    expect(state.jobs.get(jobId)?.status).toBe('scheduled');

    // Fire-and-forget: let the microtask queue flush
    await new Promise((r) => setImmediate(r));
    expect(mockAutomationHandleJobScheduled).toHaveBeenCalledWith(TENANT_A, jobId);
  });

  it('no automation fires on bare creation (handleJobScheduled only fires on status=scheduled)', async () => {
    // The spec's `send_confirmation` flag does not appear in the current Zod schema.
    // createJobV2 never calls handleJobScheduled; it only fires on a status transition.
    const token = await loginAs(app, 'coordinator', authMocks);

    await createInstantWOJob(token);

    expect(mockAutomationHandleJobScheduled).not.toHaveBeenCalled();
  });

  it('after-the-fact quote: quote created on Path B unscheduled job does NOT change job status', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createInstantWOJob(token);
    const jobId = createRes.body.data.id;
    expect(state.jobs.get(jobId)?.status).toBe('unscheduled');

    const quoteRes = await request(app)
      .post(`/v1/jobs/${jobId}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(quoteRes.status).toBe(201);
    expect(quoteRes.body.data.status).toBe('draft');

    // Job status must remain unscheduled (the job is already a WO)
    expect(state.jobs.get(jobId)?.status).toBe('unscheduled');

    // Diary shows quote_created but NOT a status_change
    expect(state.diaryEntryTypes(jobId)).toContain('quote_created');
    expect(state.diaryEntryTypes(jobId)).not.toContain('status_change');
  });

  it('performance sanity: Path B job creation round-trips in <2s', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);

    const start = Date.now();
    const res = await createInstantWOJob(token);
    const elapsed = Date.now() - start;

    expect(res.status).toBe(201);
    expect(elapsed).toBeLessThan(2000);
  });

  it('role guard: crew_member cannot create Path B job', async () => {
    const token = await loginAs(app, 'crew_member', authMocks);

    const res = await createInstantWOJob(token);

    expect(res.status).toBe(403);
  });

  it('division scoping: accepts landscaping_projects division', async () => {
    const token = await loginAs(app, 'owner', authMocks);

    const res = await createInstantWOJob(token, { division: 'landscaping_projects' });

    expect(res.status).toBe(201);
    expect(res.body.data.division).toBe('landscaping_projects');
  });
});
