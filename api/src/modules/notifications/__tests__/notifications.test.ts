import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// --- Mock database ---
vi.mock('../../../config/database.js', () => ({
  queryDb: vi.fn(),
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }), on: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  getClient: vi.fn(),
}));

// --- Mock redis ---
vi.mock('../../../config/redis.js', () => ({
  redis: { isOpen: true, ping: vi.fn().mockResolvedValue('PONG'), connect: vi.fn(), on: vi.fn() },
  connectRedis: vi.fn(),
}));

// --- Mock auth repository ---
const mockFindUserByEmail = vi.fn();
const mockFindUserById = vi.fn();
const mockFindUserRoles = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockUpdateLastLogin = vi.fn();

vi.mock('../../auth/repository.js', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  findUserRoles: (...args: unknown[]) => mockFindUserRoles(...args),
  saveRefreshToken: (...args: unknown[]) => mockSaveRefreshToken(...args),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
}));

// --- Mock notification repository ---
const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockGetUnreadCount = vi.fn();
const mockGetUserPreferences = vi.fn();
const mockUpsertPreference = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  create: (...args: unknown[]) => mockCreate(...args),
  markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
  markAllAsRead: (...args: unknown[]) => mockMarkAllAsRead(...args),
  getUnreadCount: (...args: unknown[]) => mockGetUnreadCount(...args),
  getUserPreferences: (...args: unknown[]) => mockGetUserPreferences(...args),
  upsertPreference: (...args: unknown[]) => mockUpsertPreference(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const NOTIFICATION_ID = 'dddddddd-0000-0000-0000-000000000001';

const SAMPLE_NOTIFICATION = {
  id: NOTIFICATION_ID,
  tenant_id: TENANT_A,
  user_id: USER_ID,
  type: 'job_assigned',
  title: 'New Job Assigned',
  message: 'You have been assigned a new mowing job.',
  entity_type: 'job',
  entity_id: 'eeeeeeee-0000-0000-0000-000000000001',
  is_read: false,
  read_at: null,
  priority: 'normal',
  delivery_method: 'in_app',
  delivered_at: null,
  created_at: new Date().toISOString(),
};

async function loginAs(role: string, tenantId: string = TENANT_A) {
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
});

// ============================================
// GET /v1/notifications — List
// ============================================
describe('GET /v1/notifications', () => {
  it('should return paginated notifications for current user', async () => {
    const token = await loginAs('crew_member');
    mockFindAll.mockResolvedValue({ rows: [SAMPLE_NOTIFICATION], total: 1 });

    const res = await request(app)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should filter by unread_only', async () => {
    const token = await loginAs('crew_member');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/notifications?unread_only=true')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAll).toHaveBeenCalledWith(
      TENANT_A, USER_ID,
      expect.objectContaining({ unread_only: true }),
    );
  });

  it('should allow any authenticated role', async () => {
    const token = await loginAs('crew_leader');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny unauthenticated access', async () => {
    const res = await request(app).get('/v1/notifications');
    expect(res.status).toBe(401);
  });
});

// ============================================
// GET /v1/notifications/unread-count
// ============================================
describe('GET /v1/notifications/unread-count', () => {
  it('should return unread count', async () => {
    const token = await loginAs('crew_member');
    mockGetUnreadCount.mockResolvedValue(5);

    const res = await request(app)
      .get('/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(5);
  });
});

// ============================================
// PATCH /v1/notifications/:id/read — Mark as Read
// ============================================
describe('PATCH /v1/notifications/:id/read', () => {
  it('should mark notification as read', async () => {
    const token = await loginAs('crew_member');
    mockFindById.mockResolvedValue(SAMPLE_NOTIFICATION);
    mockMarkAsRead.mockResolvedValue({ ...SAMPLE_NOTIFICATION, is_read: true, read_at: new Date().toISOString() });

    const res = await request(app)
      .patch(`/v1/notifications/${NOTIFICATION_ID}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_read).toBe(true);
  });

  it('should return 404 for non-existent notification', async () => {
    const token = await loginAs('crew_member');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/v1/notifications/${NOTIFICATION_ID}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should handle already-read notification gracefully', async () => {
    const token = await loginAs('crew_member');
    mockFindById.mockResolvedValue({ ...SAMPLE_NOTIFICATION, is_read: true });

    const res = await request(app)
      .patch(`/v1/notifications/${NOTIFICATION_ID}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should return 400 for invalid UUID', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .patch('/v1/notifications/not-a-uuid/read')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// POST /v1/notifications/mark-all-read
// ============================================
describe('POST /v1/notifications/mark-all-read', () => {
  it('should mark all notifications as read', async () => {
    const token = await loginAs('crew_member');
    mockMarkAllAsRead.mockResolvedValue(5);

    const res = await request(app)
      .post('/v1/notifications/mark-all-read')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.marked).toBe(5);
  });
});

// ============================================
// GET /v1/notifications/preferences
// ============================================
describe('GET /v1/notifications/preferences', () => {
  it('should return user notification preferences', async () => {
    const token = await loginAs('owner');
    mockGetUserPreferences.mockResolvedValue([
      { id: 'p1', tenant_id: TENANT_A, user_id: USER_ID, notification_type: 'job_assigned', in_app: true, email: true, sms: false, push: false },
      { id: 'p2', tenant_id: TENANT_A, user_id: USER_ID, notification_type: 'invoice_overdue', in_app: true, email: false, sms: false, push: false },
    ]);

    const res = await request(app)
      .get('/v1/notifications/preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].notification_type).toBe('job_assigned');
  });
});

// ============================================
// PUT /v1/notifications/preferences
// ============================================
describe('PUT /v1/notifications/preferences', () => {
  it('should update notification preferences', async () => {
    const token = await loginAs('owner');
    mockUpsertPreference.mockResolvedValue({
      id: 'p1', tenant_id: TENANT_A, user_id: USER_ID,
      notification_type: 'job_assigned', in_app: true, email: true, sms: false, push: true,
    });

    const res = await request(app)
      .put('/v1/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        preferences: [
          { notification_type: 'job_assigned', in_app: true, email: true, push: true },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].push).toBe(true);
  });

  it('should reject empty preferences array', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .put('/v1/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: [] });

    expect(res.status).toBe(400);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Notification tenant isolation', () => {
  it('should scope all queries to the authenticated tenant', async () => {
    const token = await loginAs('crew_member');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAll).toHaveBeenCalledWith(TENANT_A, USER_ID, expect.anything());
  });
});
