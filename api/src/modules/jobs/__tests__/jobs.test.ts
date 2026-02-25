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

// --- Mock job repository ---
const mockJobFindAll = vi.fn();
const mockJobFindById = vi.fn();
const mockJobCreate = vi.fn();
const mockJobUpdate = vi.fn();
const mockJobUpdateStatus = vi.fn();
const mockJobSoftDelete = vi.fn();
const mockJobGetByDateRange = vi.fn();
const mockJobGetByProperty = vi.fn();
const mockJobAddPhoto = vi.fn();
const mockJobGetPhotos = vi.fn();
const mockJobAddChecklistItem = vi.fn();
const mockJobUpdateChecklistItem = vi.fn();
const mockJobGetChecklist = vi.fn();
const mockJobGetChecklistItemById = vi.fn();
const mockJobGetStats = vi.fn();
const mockJobCustomerExists = vi.fn();
const mockJobPropertyBelongsToCustomer = vi.fn();
const mockJobContractExists = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockJobFindAll(...args),
  findById: (...args: unknown[]) => mockJobFindById(...args),
  create: (...args: unknown[]) => mockJobCreate(...args),
  update: (...args: unknown[]) => mockJobUpdate(...args),
  updateStatus: (...args: unknown[]) => mockJobUpdateStatus(...args),
  softDelete: (...args: unknown[]) => mockJobSoftDelete(...args),
  getByDateRange: (...args: unknown[]) => mockJobGetByDateRange(...args),
  getByProperty: (...args: unknown[]) => mockJobGetByProperty(...args),
  addPhoto: (...args: unknown[]) => mockJobAddPhoto(...args),
  getPhotos: (...args: unknown[]) => mockJobGetPhotos(...args),
  addChecklistItem: (...args: unknown[]) => mockJobAddChecklistItem(...args),
  updateChecklistItem: (...args: unknown[]) => mockJobUpdateChecklistItem(...args),
  getChecklist: (...args: unknown[]) => mockJobGetChecklist(...args),
  getChecklistItemById: (...args: unknown[]) => mockJobGetChecklistItemById(...args),
  getStats: (...args: unknown[]) => mockJobGetStats(...args),
  customerExists: (...args: unknown[]) => mockJobCustomerExists(...args),
  propertyBelongsToCustomer: (...args: unknown[]) => mockJobPropertyBelongsToCustomer(...args),
  contractExists: (...args: unknown[]) => mockJobContractExists(...args),
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
const CONTRACT_ID = '11111111-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const PHOTO_ID = '44444444-0000-0000-0000-000000000001';
const CHECKLIST_ID = '55555555-0000-0000-0000-000000000001';

const SAMPLE_JOB = {
  id: JOB_ID,
  tenant_id: TENANT_A,
  contract_id: CONTRACT_ID,
  customer_id: CUSTOMER_ID,
  property_id: PROPERTY_ID,
  division: 'landscaping_maintenance',
  job_type: 'scheduled_service',
  status: 'scheduled',
  priority: 'normal',
  title: 'Weekly Mowing',
  description: 'Regular lawn mowing service',
  scheduled_date: '2026-04-15',
  scheduled_start_time: '08:00',
  estimated_duration_minutes: 60,
  actual_start_time: null,
  actual_end_time: null,
  actual_duration_minutes: null,
  assigned_crew_id: null,
  assigned_to: null,
  notes: null,
  completion_notes: null,
  requires_photos: true,
  invoice_id: null,
  weather_condition: null,
  tags: ['lawn'],
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  customer_display_name: 'John Doe',
  property_name: 'Main Residence',
  contract_title: 'Annual Lawn Maintenance',
  photos: [],
  checklist: [],
};

const SAMPLE_PHOTO = {
  id: PHOTO_ID,
  tenant_id: TENANT_A,
  job_id: JOB_ID,
  photo_url: 'https://r2.example.com/photos/before-1.jpg',
  photo_type: 'before',
  caption: 'Before mowing',
  uploaded_by: USER_ID,
  uploaded_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_CHECKLIST = {
  id: CHECKLIST_ID,
  tenant_id: TENANT_A,
  job_id: JOB_ID,
  description: 'Mow front lawn',
  is_completed: false,
  completed_by: null,
  completed_at: null,
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
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
// GET /v1/jobs — List
// ============================================
describe('GET /v1/jobs', () => {
  it('should return paginated job list', async () => {
    const token = await loginAs('owner');
    mockJobFindAll.mockResolvedValue({ rows: [SAMPLE_JOB], total: 1 });

    const res = await request(app)
      .get('/v1/jobs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass filters to repository', async () => {
    const token = await loginAs('coordinator');
    mockJobFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/jobs?status=scheduled&division=landscaping_maintenance&priority=high&date_from=2026-04-01&date_to=2026-04-30`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockJobFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        status: 'scheduled',
        division: 'landscaping_maintenance',
        priority: 'high',
        date_from: '2026-04-01',
        date_to: '2026-04-30',
      }),
    );
  });

  it('should allow crew_leader to list jobs', async () => {
    const token = await loginAs('crew_leader');
    mockJobFindAll.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/jobs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_member from listing jobs', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/jobs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/jobs/:id — Detail
// ============================================
describe('GET /v1/jobs/:id', () => {
  it('should return job with relations, photos, and checklist', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({
      ...SAMPLE_JOB,
      photos: [SAMPLE_PHOTO],
      checklist: [SAMPLE_CHECKLIST],
    });

    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.customer_display_name).toBe('John Doe');
    expect(res.body.data.property_name).toBe('Main Residence');
    expect(res.body.data.contract_title).toBe('Annual Lawn Maintenance');
    expect(res.body.data.photos).toHaveLength(1);
    expect(res.body.data.checklist).toHaveLength(1);
  });

  it('should return 404 for non-existent job', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/jobs — Create
// ============================================
describe('POST /v1/jobs', () => {
  it('should create a scheduled job', async () => {
    const token = await loginAs('owner');
    mockJobCustomerExists.mockResolvedValue(true);
    mockJobPropertyBelongsToCustomer.mockResolvedValue(true);
    mockJobContractExists.mockResolvedValue(true);
    mockJobCreate.mockResolvedValue(SAMPLE_JOB);

    const res = await request(app)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        contract_id: CONTRACT_ID,
        division: 'landscaping_maintenance',
        title: 'Weekly Mowing',
        scheduled_date: '2026-04-15',
        scheduled_start_time: '08:00',
        estimated_duration_minutes: 60,
        requires_photos: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Weekly Mowing');
  });

  it('should create a one-off job without contract', async () => {
    const token = await loginAs('coordinator');
    mockJobCustomerExists.mockResolvedValue(true);
    mockJobPropertyBelongsToCustomer.mockResolvedValue(true);
    mockJobCreate.mockResolvedValue({ ...SAMPLE_JOB, contract_id: null, job_type: 'one_time' });

    const res = await request(app)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        job_type: 'one_time',
        title: 'Tree Removal',
      });

    expect(res.status).toBe(201);
  });

  it('should reject if customer does not exist', async () => {
    const token = await loginAs('owner');
    mockJobCustomerExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        title: 'Test',
      });

    expect(res.status).toBe(404);
  });

  it('should reject if property does not belong to customer', async () => {
    const token = await loginAs('owner');
    mockJobCustomerExists.mockResolvedValue(true);
    mockJobPropertyBelongsToCustomer.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        title: 'Test',
      });

    expect(res.status).toBe(400);
  });

  it('should deny crew_leader from creating jobs', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        title: 'Test',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PATCH /v1/jobs/:id/status — Status Change
// ============================================
describe('PATCH /v1/jobs/:id/status', () => {
  it('should allow: scheduled -> in_progress (records actual_start_time)', async () => {
    const token = await loginAs('crew_leader');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'scheduled' });
    mockJobUpdateStatus.mockResolvedValue({
      ...SAMPLE_JOB,
      status: 'in_progress',
      actual_start_time: new Date().toISOString(),
    });

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
    // Verify extra fields were passed (actual_start_time)
    expect(mockJobUpdateStatus).toHaveBeenCalledWith(
      TENANT_A,
      JOB_ID,
      'in_progress',
      null,
      USER_ID,
      expect.objectContaining({ actual_start_time: expect.any(String) }),
    );
  });

  it('should allow: in_progress -> completed (records actual_end_time and duration)', async () => {
    const token = await loginAs('crew_leader');
    const startTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    mockJobFindById.mockResolvedValue({
      ...SAMPLE_JOB,
      status: 'in_progress',
      actual_start_time: startTime,
    });
    mockJobUpdateStatus.mockResolvedValue({
      ...SAMPLE_JOB,
      status: 'completed',
      actual_start_time: startTime,
      actual_end_time: new Date().toISOString(),
      actual_duration_minutes: 60,
    });

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed', completion_notes: 'All done' });

    expect(res.status).toBe(200);
    expect(mockJobUpdateStatus).toHaveBeenCalledWith(
      TENANT_A,
      JOB_ID,
      'completed',
      'All done',
      USER_ID,
      expect.objectContaining({
        actual_end_time: expect.any(String),
        actual_duration_minutes: expect.any(Number),
      }),
    );
  });

  it('should allow: completed -> verified', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'completed' });
    mockJobUpdateStatus.mockResolvedValue({ ...SAMPLE_JOB, status: 'verified' });

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'verified' });

    expect(res.status).toBe(200);
  });

  it('should reject invalid: scheduled -> completed (must go through in_progress)', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'scheduled' });

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Cannot transition from 'scheduled' to 'completed'");
  });

  it('should reject invalid: unscheduled -> in_progress', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'unscheduled' });

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(400);
  });

  it('should return same job if already in target status', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'scheduled' });

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'scheduled' });

    expect(res.status).toBe(200);
    expect(mockJobUpdateStatus).not.toHaveBeenCalled();
  });
});

// ============================================
// DELETE /v1/jobs/:id
// ============================================
describe('DELETE /v1/jobs/:id', () => {
  it('should soft delete unscheduled job', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'unscheduled' });
    mockJobSoftDelete.mockResolvedValue(SAMPLE_JOB);

    const res = await request(app)
      .delete(`/v1/jobs/${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Job deleted');
  });

  it('should soft delete cancelled job', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'cancelled' });
    mockJobSoftDelete.mockResolvedValue(SAMPLE_JOB);

    const res = await request(app)
      .delete(`/v1/jobs/${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should block deletion of scheduled job', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'scheduled' });

    const res = await request(app)
      .delete(`/v1/jobs/${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Cannot delete job with status 'scheduled'");
  });

  it('should block deletion of in_progress job', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'in_progress' });

    const res = await request(app)
      .delete(`/v1/jobs/${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('should deny coordinator from deleting', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .delete(`/v1/jobs/${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Schedule
// ============================================
describe('GET /v1/jobs/schedule', () => {
  it('should return jobs in date range', async () => {
    const token = await loginAs('owner');
    mockJobGetByDateRange.mockResolvedValue([SAMPLE_JOB]);

    const res = await request(app)
      .get('/v1/jobs/schedule?start_date=2026-04-01&end_date=2026-04-30')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('should reject without required date params', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/jobs/schedule')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// Photos
// ============================================
describe('POST /v1/jobs/:id/photos', () => {
  it('should allow crew_member to add photo', async () => {
    const token = await loginAs('crew_member');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB);
    mockJobAddPhoto.mockResolvedValue(SAMPLE_PHOTO);

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        photo_url: 'https://r2.example.com/photos/before-1.jpg',
        photo_type: 'before',
        caption: 'Before mowing',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.photo_type).toBe('before');
  });
});

describe('GET /v1/jobs/:id/photos', () => {
  it('should return photos for job', async () => {
    const token = await loginAs('crew_member');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB);
    mockJobGetPhotos.mockResolvedValue([SAMPLE_PHOTO]);

    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}/photos`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ============================================
// Checklist
// ============================================
describe('POST /v1/jobs/:id/checklist', () => {
  it('should add checklist item', async () => {
    const token = await loginAs('coordinator');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB);
    mockJobAddChecklistItem.mockResolvedValue(SAMPLE_CHECKLIST);

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/checklist`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Mow front lawn', sort_order: 0 });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('Mow front lawn');
  });

  it('should deny crew_member from adding checklist items', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/checklist`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Test item' });

    expect(res.status).toBe(403);
  });
});

describe('PUT /v1/jobs/checklist/:itemId', () => {
  it('should allow crew_member to toggle checklist item', async () => {
    const token = await loginAs('crew_member');
    mockJobGetChecklistItemById.mockResolvedValue(SAMPLE_CHECKLIST);
    mockJobUpdateChecklistItem.mockResolvedValue({
      ...SAMPLE_CHECKLIST,
      is_completed: true,
      completed_by: USER_ID,
      completed_at: new Date().toISOString(),
    });

    const res = await request(app)
      .put(`/v1/jobs/checklist/${CHECKLIST_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_completed: true });

    expect(res.status).toBe(200);
    expect(res.body.data.is_completed).toBe(true);
  });

  it('should return 404 for non-existent checklist item', async () => {
    const token = await loginAs('owner');
    mockJobGetChecklistItemById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/jobs/checklist/${CHECKLIST_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_completed: true });

    expect(res.status).toBe(404);
  });
});

describe('GET /v1/jobs/:id/checklist', () => {
  it('should return checklist for job', async () => {
    const token = await loginAs('crew_member');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB);
    mockJobGetChecklist.mockResolvedValue([SAMPLE_CHECKLIST]);

    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}/checklist`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ============================================
// Stats
// ============================================
describe('GET /v1/jobs/stats', () => {
  it('should return stats for owner', async () => {
    const token = await loginAs('owner');
    mockJobGetStats.mockResolvedValue({
      byStatus: [{ label: 'scheduled', count: '15' }],
      byDivision: [{ label: 'landscaping_maintenance', count: '12' }],
      todayCount: 5,
    });

    const res = await request(app)
      .get('/v1/jobs/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.todayCount).toBe(5);
  });

  it('should deny coordinator from viewing stats', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/jobs/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant isolation', () => {
  it('should scope queries to authenticated tenant', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockJobFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/jobs')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mockJobFindAll).toHaveBeenCalledWith(TENANT_A, expect.anything());
  });

  it('should isolate between tenants', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockJobFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/jobs')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mockJobFindAll).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });
});

// ============================================
// Role-Based Access Control
// ============================================
describe('Role-based access', () => {
  it('should allow crew_leader to change job status', async () => {
    const token = await loginAs('crew_leader');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB, status: 'scheduled' });
    mockJobUpdateStatus.mockResolvedValue({ ...SAMPLE_JOB, status: 'in_progress' });

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
  });

  it('should deny crew_member from changing job status', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get('/v1/jobs');
    expect(res.status).toBe(401);
  });
});
