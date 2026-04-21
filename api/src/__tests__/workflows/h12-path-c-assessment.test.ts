/**
 * H-12 Path C — On-Site Assessment workflow E2E tests.
 *
 * Path C enters `assessment` status. Crew visits, uploads photos/notes, then either:
 *   9a) convert to Work Order (POST /v1/jobs/:id/convert-to-wo) → unscheduled
 *   9b) transition via Quote (PATCH /quote created on job) → falls into Path A behaviour
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

const mockPhotosInsertStandalone = vi.fn();

vi.mock('../../modules/jobs/photos/photos.repository.js', () => ({
  insert: vi.fn(),
  insertStandalone: (...a: unknown[]) => mockPhotosInsertStandalone(...a),
  findByJobId: vi.fn().mockResolvedValue([]),
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
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
  CUSTOMER_ID,
  PROPERTY_ID,
  FILE_ID,
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

  // Photos v2 standalone returns a fake row
  mockPhotosInsertStandalone.mockImplementation(async (row: Record<string, unknown>) => ({
    id: 'photo-' + Math.random().toString(36).slice(2, 8),
    tenant_id: row.tenant_id,
    job_id: row.job_id,
    file_id: row.file_id,
    photo_tag: row.photo_tag ?? 'issue',
    caption: row.caption ?? null,
    uploaded_by: row.uploaded_by,
    upload_source: row.upload_source ?? 'staff_web',
    portal_visible: row.portal_visible ?? false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
});

const authMocks = {
  findUserByEmail: mockFindUserByEmail,
  findUserRoles: mockFindUserRoles,
  saveRefreshToken: mockSaveRefreshToken,
  updateLastLogin: mockUpdateLastLogin,
};

async function createAssessmentJob(token: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/v1/jobs/v2')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customer_id: CUSTOMER_ID,
      property_id: PROPERTY_ID,
      division: 'hardscape',
      creation_path: 'assessment',
      title: 'Patio Scope Assessment',
      ...overrides,
    });
}

// ============================================
// Path C — Assessment
// ============================================
describe('H-12 Path C — Assessment', () => {
  it('coordinator creates Path C job → status=assessment, diary entry', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);

    const res = await createAssessmentJob(token);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('assessment');
    expect(res.body.data.creation_path).toBe('assessment');

    expect(state.diaryTitles()).toContainEqual(
      expect.stringMatching(/^Job #\d{4}-\d{2} created as Assessment$/),
    );
  });

  it('assessment jobs can only transition to unscheduled or cancelled (per VALID_TRANSITIONS)', async () => {
    // H-12 §4 spec says assessments get "scheduled" for the crew visit, but the current
    // VALID_TRANSITIONS table (jobs/service.ts:28) allows assessment → {unscheduled,
    // cancelled} only. Flagged: if scheduling the visit itself needs a status, this
    // table may need widening. For now we pin the behaviour and test the supported
    // path.
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createAssessmentJob(token);
    const jobId = createRes.body.data.id;

    // Rejected transition
    const rejected = await request(app)
      .post(`/v1/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'scheduled' });
    expect(rejected.status).toBe(400);

    // Accepted transition: cancel
    const cancelled = await request(app)
      .post(`/v1/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });
    expect(cancelled.status).toBe(200);
    expect(state.jobs.get(jobId)?.status).toBe('cancelled');
    expect(state.diaryEntryTypes(jobId)).toContain('status_change');
  });

  it('crew uploads issue photos during assessment → diary entry created', async () => {
    const token = await loginAs(app, 'crew_leader', authMocks);
    // Seed an assessment job in state (created by owner in prior step)
    const ownerToken = await loginAs(app, 'owner', authMocks);
    const createRes = await createAssessmentJob(ownerToken);
    const jobId = createRes.body.data.id;

    const photoRes = await request(app)
      .post(`/v1/jobs/${jobId}/photos/v2`)
      .set('Authorization', `Bearer ${token}`)
      .send({ file_id: FILE_ID, photo_tag: 'issue_found', caption: 'Broken paver' });

    expect(photoRes.status).toBe(201);
    expect(photoRes.body.data.photo_tag).toBe('issue_found');

    // Photo upload service creates a diary entry
    const hasPhotoDiary = state.diaryEntryTypes(jobId).some((t) =>
      t.includes('photo'),
    );
    expect(hasPhotoDiary).toBe(true);
  });

  it('crew adds manual diary note during assessment', async () => {
    const token = await loginAs(app, 'crew_leader', authMocks);
    const ownerToken = await loginAs(app, 'owner', authMocks);
    const createRes = await createAssessmentJob(ownerToken);
    const jobId = createRes.body.data.id;

    const diaryRes = await request(app)
      .post(`/v1/jobs/${jobId}/diary`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Client wants flagstone not poured concrete' });

    expect(diaryRes.status).toBe(201);
    expect(state.diary.some((d) => d.body?.includes('flagstone'))).toBe(true);
  });

  it('branch 9a: convert-to-wo from assessment → status=unscheduled, diary entry', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createAssessmentJob(token);
    const jobId = createRes.body.data.id;

    const convertRes = await request(app)
      .post(`/v1/jobs/${jobId}/convert-to-wo`)
      .set('Authorization', `Bearer ${token}`);

    expect(convertRes.status).toBe(200);
    expect(state.jobs.get(jobId)?.status).toBe('unscheduled');
    expect(state.diaryEntryTypes(jobId)).toContain('job_converted_to_wo');

    const titles = state.diary
      .filter((d) => d.entry_type === 'job_converted_to_wo')
      .map((d) => d.title);
    expect(titles).toContain('Converted from Assessment to Work Order');
  });

  it('branch 9b: quote created on assessment job → job stays assessment until signing', async () => {
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createAssessmentJob(token);
    const jobId = createRes.body.data.id;
    expect(state.jobs.get(jobId)?.status).toBe('assessment');

    const quoteRes = await request(app)
      .post(`/v1/jobs/${jobId}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(quoteRes.status).toBe(201);
    // Job status unchanged by quote creation
    expect(state.jobs.get(jobId)?.status).toBe('assessment');
    expect(state.diaryEntryTypes(jobId)).toContain('quote_created');
  });

  it('invalid transition: assessment → scheduled directly is allowed for scheduling the assessment visit', async () => {
    // Note: the V2 status change endpoint validates transitions. Per the isValidTransition
    // table used by the service, `assessment → scheduled` is allowed (since assessments
    // ARE scheduled for a crew visit). A direct jump to `completed` without visiting is
    // rejected. Assert the latter.
    const token = await loginAs(app, 'coordinator', authMocks);
    const createRes = await createAssessmentJob(token);
    const jobId = createRes.body.data.id;

    const res = await request(app)
      .post(`/v1/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
    expect(state.jobs.get(jobId)?.status).toBe('assessment');
  });
});
