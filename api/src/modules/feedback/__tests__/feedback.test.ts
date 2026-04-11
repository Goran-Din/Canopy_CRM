import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// --- Mock database ---
const mockQueryDb = vi.fn();

vi.mock('../../../config/database.js', () => ({
  queryDb: (...args: unknown[]) => mockQueryDb(...args),
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

// --- Mock feedback repository ---
const mockCreate = vi.fn();
const mockFindByToken = vi.fn();
const mockSubmitFeedback = vi.fn();
const mockFindAll = vi.fn();
const mockGetSummary = vi.fn();
const mockGetRecentFeedback = vi.fn();
const mockAddStaffNote = vi.fn();
const mockExpireOldFeedback = vi.fn();
const mockMarkReviewClicked = vi.fn();
const mockFeedbackFindById = vi.fn();

vi.mock('../repository.js', () => ({
  create: (...args: unknown[]) => mockCreate(...args),
  findByToken: (...args: unknown[]) => mockFindByToken(...args),
  submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args),
  findAll: (...args: unknown[]) => mockFindAll(...args),
  getSummary: (...args: unknown[]) => mockGetSummary(...args),
  getRecentFeedback: (...args: unknown[]) => mockGetRecentFeedback(...args),
  addStaffNote: (...args: unknown[]) => mockAddStaffNote(...args),
  expireOldFeedback: (...args: unknown[]) => mockExpireOldFeedback(...args),
  markReviewClicked: (...args: unknown[]) => mockMarkReviewClicked(...args),
  findById: (...args: unknown[]) => mockFeedbackFindById(...args),
}));

import app from '../../../app.js';
import { runExpiryNightlyCron } from '../service.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const FEEDBACK_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const TOKEN = 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd';

const makeFeedback = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: FEEDBACK_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  invoice_id: '11111111-0000-0000-0000-000000000001',
  job_id: JOB_ID,
  feedback_token: TOKEN,
  sent_via: 'email',
  sent_at: new Date().toISOString(),
  rating: null,
  comment: null,
  responded_at: null,
  respondent_ip: null,
  google_review_prompted: false,
  google_review_clicked: false,
  status: 'sent',
  staff_note: null,
  staff_note_by: null,
  staff_noted_at: null,
  created_at: new Date().toISOString(),
  customer_name: 'John Smith',
  customer_first_name: 'John',
  job_number: '0047-26',
  property_address: '123 Main St',
  ...overrides,
});

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
  // Default mock for queryDb (customer_notes insert, etc.)
  mockQueryDb.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ============================================
// 1. POST /feedback/submit with valid token: rating saved, status='responded'
// ============================================
describe('POST /v1/feedback/submit', () => {
  it('should save rating and set status to responded', async () => {
    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'sent' }));
    mockSubmitFeedback.mockResolvedValueOnce(makeFeedback({
      status: 'responded',
      rating: 4,
      comment: 'Great work!',
      responded_at: new Date().toISOString(),
    }));

    const res = await request(app)
      .post('/v1/feedback/submit')
      .send({
        feedback_token: TOKEN,
        rating: 4,
        comment: 'Great work!',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
    expect(mockSubmitFeedback).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({ rating: 4, comment: 'Great work!' }),
    );
  });

  // ============================================
  // 2. Rating=5 with GOOGLE_PLACE_ID set: google_review_prompted=TRUE
  // ============================================
  it('should prompt Google Review for rating >= 4 when GOOGLE_PLACE_ID is set', async () => {
    const originalPlaceId = process.env.GOOGLE_PLACE_ID;
    process.env.GOOGLE_PLACE_ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';

    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'sent' }));
    mockSubmitFeedback.mockResolvedValueOnce(makeFeedback({
      status: 'responded',
      rating: 5,
      google_review_prompted: true,
    }));

    const res = await request(app)
      .post('/v1/feedback/submit')
      .send({ feedback_token: TOKEN, rating: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.show_google_review).toBe(true);
    expect(res.body.data.google_review_url).toContain('g.page/r/');

    process.env.GOOGLE_PLACE_ID = originalPlaceId;
  });

  // ============================================
  // 3. Rating=2: customer_notes complaint entry created
  // ============================================
  it('should create complaint note for low rating (1-2)', async () => {
    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'sent' }));
    mockSubmitFeedback.mockResolvedValueOnce(makeFeedback({
      status: 'responded',
      rating: 2,
      comment: 'Poor service',
    }));

    const res = await request(app)
      .post('/v1/feedback/submit')
      .send({
        feedback_token: TOKEN,
        rating: 2,
        comment: 'Poor service',
      });

    expect(res.status).toBe(200);
    // Verify queryDb was called to insert complaint note
    expect(mockQueryDb).toHaveBeenCalledWith(
      expect.stringContaining('customer_notes'),
      expect.arrayContaining([
        TENANT_A,
        CUSTOMER_ID,
        expect.stringContaining('Low satisfaction feedback (rating: 2/5)'),
      ]),
    );
  });

  // ============================================
  // 4. Submit twice with same token: 409 Conflict
  // ============================================
  it('should return 409 if already submitted', async () => {
    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'responded', rating: 5 }));

    const res = await request(app)
      .post('/v1/feedback/submit')
      .send({
        feedback_token: TOKEN,
        rating: 4,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already been submitted');
  });

  // ============================================
  // 5. Invalid token: 401
  // ============================================
  it('should return 401 for invalid token', async () => {
    mockFindByToken.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/v1/feedback/submit')
      .send({
        feedback_token: 'invalid-token-that-does-not-exist',
        rating: 3,
      });

    expect(res.status).toBe(401);
  });

  it('should return 401 for expired feedback', async () => {
    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'expired' }));

    const res = await request(app)
      .post('/v1/feedback/submit')
      .send({
        feedback_token: TOKEN,
        rating: 3,
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('expired');
  });
});

// ============================================
// 6. Nightly cron: feedback older than 14 days → status='expired'
// ============================================
describe('Expiry cron', () => {
  it('should expire old feedback', async () => {
    mockExpireOldFeedback.mockResolvedValueOnce(5);

    const count = await runExpiryNightlyCron();

    expect(count).toBe(5);
    expect(mockExpireOldFeedback).toHaveBeenCalledTimes(1);
  });
});

// ============================================
// 7. GET /feedback/summary returns correct avg_rating and response_rate
// ============================================
describe('GET /v1/feedback/summary', () => {
  it('should return correct summary stats', async () => {
    const token = await loginAs('owner');
    mockGetSummary.mockResolvedValueOnce({
      avg_rating: '4.6',
      total_sent: '142',
      total_responded: '98',
      response_rate: '69.0',
      rating_1: '2',
      rating_2: '3',
      rating_3: '8',
      rating_4: '25',
      rating_5: '60',
      google_review_clicked: '34',
    });
    mockGetRecentFeedback.mockResolvedValueOnce([
      makeFeedback({
        status: 'responded', rating: 5,
        comment: 'Excellent!', google_review_clicked: true,
      }),
    ]);

    const res = await request(app)
      .get('/v1/feedback/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.avg_rating).toBe(4.6);
    expect(data.total_sent).toBe(142);
    expect(data.total_responded).toBe(98);
    expect(data.response_rate).toBe(69.0);
    expect(data.by_rating['5']).toBe(60);
    expect(data.google_review_clicked).toBe(34);
    expect(data.recent).toHaveLength(1);
  });
});

// ============================================
// 8. Rating >= 4 with comment: notification fired (logged)
// ============================================
describe('Positive feedback notification', () => {
  it('should log positive feedback notification for rating >= 4 with comment', async () => {
    const { logger } = await import('../../../config/logger.js');

    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'sent' }));
    mockSubmitFeedback.mockResolvedValueOnce(makeFeedback({
      status: 'responded', rating: 5, comment: 'Excellent crew!',
    }));

    await request(app)
      .post('/v1/feedback/submit')
      .send({
        feedback_token: TOKEN,
        rating: 5,
        comment: 'Excellent crew!',
      });

    expect(logger.info).toHaveBeenCalledWith(
      'Positive feedback received',
      expect.objectContaining({
        customer_id: CUSTOMER_ID,
        rating: 5,
        comment: 'Excellent crew!',
      }),
    );
  });
});

// ============================================
// 9. google_review_clicked tracked when /review-clicked called
// ============================================
describe('POST /v1/feedback/:token/review-clicked', () => {
  it('should record Google Review click', async () => {
    mockMarkReviewClicked.mockResolvedValueOnce(makeFeedback({
      google_review_clicked: true,
    }));

    const res = await request(app)
      .post(`/v1/feedback/${TOKEN}/review-clicked`);

    expect(res.status).toBe(200);
    expect(mockMarkReviewClicked).toHaveBeenCalledWith(TOKEN);
  });

  it('should return 404 for invalid token', async () => {
    mockMarkReviewClicked.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/v1/feedback/invalid-token/review-clicked');

    expect(res.status).toBe(404);
  });
});

// ============================================
// 10. Multi-tenant isolation test
// ============================================
describe('Multi-tenant isolation', () => {
  it('should list feedback only for authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockFindAll.mockResolvedValueOnce({ data: [makeFeedback()], total: 1, page: 1, limit: 25 });

    const res = await request(app)
      .get('/v1/feedback')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith(TENANT_A, expect.any(Object));
  });

  it('should list summary only for authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockGetSummary.mockResolvedValueOnce({
      avg_rating: '4.0', total_sent: '10', total_responded: '5',
      response_rate: '50.0', rating_1: '0', rating_2: '0',
      rating_3: '1', rating_4: '2', rating_5: '2',
      google_review_clicked: '1',
    });
    mockGetRecentFeedback.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/v1/feedback/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockGetSummary).toHaveBeenCalledWith(TENANT_A);
  });
});

// ============================================
// Feedback page data (public)
// ============================================
describe('GET /v1/feedback/page/:token', () => {
  it('should return rating state for valid sent feedback', async () => {
    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'sent' }));

    const res = await request(app)
      .get(`/v1/feedback/page/${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('rating');
    expect(res.body.data.customer_first_name).toBe('John');
  });

  it('should return responded state for already submitted', async () => {
    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'responded', rating: 5 }));

    const res = await request(app)
      .get(`/v1/feedback/page/${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('responded');
  });

  it('should return expired state', async () => {
    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'expired' }));

    const res = await request(app)
      .get(`/v1/feedback/page/${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('expired');
  });

  it('should return invalid for unknown token', async () => {
    mockFindByToken.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/v1/feedback/page/nonexistent-token');

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('invalid');
  });
});

// ============================================
// Staff note
// ============================================
describe('PATCH /v1/feedback/:id/note', () => {
  it('should add staff note', async () => {
    const token = await loginAs('coordinator');
    mockFeedbackFindById.mockResolvedValueOnce(makeFeedback());
    mockAddStaffNote.mockResolvedValueOnce(makeFeedback({
      staff_note: 'Followed up with customer',
      staff_note_by: USER_ID,
    }));

    const res = await request(app)
      .patch(`/v1/feedback/${FEEDBACK_ID}/note`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Followed up with customer' });

    expect(res.status).toBe(200);
    expect(res.body.data.staff_note).toBe('Followed up with customer');
  });
});

// ============================================
// RBAC
// ============================================
describe('RBAC', () => {
  it('should deny crew_member from listing feedback', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get('/v1/feedback')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated requests to staff endpoints', async () => {
    const res = await request(app).get('/v1/feedback/summary');
    expect(res.status).toBe(401);
  });

  it('should allow public access to feedback page', async () => {
    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'sent' }));
    const res = await request(app).get(`/v1/feedback/page/${TOKEN}`);
    expect(res.status).toBe(200);
  });

  it('should allow public access to submit feedback', async () => {
    mockFindByToken.mockResolvedValueOnce(makeFeedback({ status: 'sent' }));
    mockSubmitFeedback.mockResolvedValueOnce(makeFeedback({ status: 'responded', rating: 3 }));

    const res = await request(app)
      .post('/v1/feedback/submit')
      .send({ feedback_token: TOKEN, rating: 3 });
    expect(res.status).toBe(200);
  });
});
