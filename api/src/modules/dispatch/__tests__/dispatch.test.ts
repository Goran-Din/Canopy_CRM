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

// --- Mock dispatch repository ---
const mockGetBoardData = vi.fn();
const mockGetQueueData = vi.fn();
const mockAssignJob = vi.fn();
const mockRescheduleJob = vi.fn();
const mockUnassignJob = vi.fn();
const mockJobExists = vi.fn();
const mockCrewIsActive = vi.fn();

vi.mock('../repository.js', () => ({
  getBoardData: (...args: unknown[]) => mockGetBoardData(...args),
  getQueueData: (...args: unknown[]) => mockGetQueueData(...args),
  assignJob: (...args: unknown[]) => mockAssignJob(...args),
  rescheduleJob: (...args: unknown[]) => mockRescheduleJob(...args),
  unassignJob: (...args: unknown[]) => mockUnassignJob(...args),
  jobExists: (...args: unknown[]) => mockJobExists(...args),
  crewIsActive: (...args: unknown[]) => mockCrewIsActive(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const CREW_ID = '22222222-0000-0000-0000-000000000001';

const SAMPLE_CREW: Record<string, unknown> = {
  id: CREW_ID,
  crew_name: 'Alpha Crew',
  division: 'landscaping_maintenance',
  status: 'active',
  color_code: '#22C55E',
  crew_leader_first_name: 'Mike',
  crew_leader_last_name: 'Johnson',
  member_count: '4',
};

const SAMPLE_BOARD_JOB: Record<string, unknown> = {
  id: JOB_ID,
  title: 'Weekly Mowing',
  customer_name: 'John Doe',
  property_address: '123 Main St',
  job_type: 'scheduled_service',
  status: 'scheduled',
  priority: 'normal',
  division: 'landscaping_maintenance',
  scheduled_date: '2026-03-02',
  scheduled_start_time: '08:00:00',
  estimated_duration_minutes: 60,
  actual_start_time: null,
  actual_end_time: null,
  assigned_crew_id: CREW_ID,
};

const SAMPLE_QUEUE_JOB: Record<string, unknown> = {
  id: JOB_ID,
  title: 'One-Time Cleanup',
  customer_name: 'Jane Smith',
  property_address: '456 Oak Ave',
  job_type: 'one_time',
  status: 'unscheduled',
  priority: 'high',
  division: 'landscaping_maintenance',
  scheduled_date: null,
  estimated_duration_minutes: 90,
  contract_id: null,
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
// GET /v1/dispatch/board
// ============================================
describe('GET /v1/dispatch/board', () => {
  it('should return board data with crews and jobs', async () => {
    const token = await loginAs('owner');
    mockGetBoardData.mockResolvedValue({
      crews: [SAMPLE_CREW],
      jobs: [SAMPLE_BOARD_JOB],
    });

    const res = await request(app)
      .get('/v1/dispatch/board?start_date=2026-03-02&end_date=2026-03-08')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.crews).toHaveLength(1);
    expect(res.body.data.jobs).toHaveLength(1);
    expect(res.body.data.crews[0].crew_name).toBe('Alpha Crew');
    expect(mockGetBoardData).toHaveBeenCalledWith(TENANT_A, '2026-03-02', '2026-03-08', undefined);
  });

  it('should pass division filter', async () => {
    const token = await loginAs('coordinator');
    mockGetBoardData.mockResolvedValue({ crews: [], jobs: [] });

    await request(app)
      .get('/v1/dispatch/board?start_date=2026-03-02&end_date=2026-03-08&division=snow_removal')
      .set('Authorization', `Bearer ${token}`);

    expect(mockGetBoardData).toHaveBeenCalledWith(TENANT_A, '2026-03-02', '2026-03-08', 'snow_removal');
  });

  it('should reject without required date params', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/dispatch/board')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('should reject invalid date format', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/dispatch/board?start_date=2026/03/02&end_date=2026-03-08')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('should allow div_mgr access', async () => {
    const token = await loginAs('div_mgr');
    mockGetBoardData.mockResolvedValue({ crews: [], jobs: [] });

    const res = await request(app)
      .get('/v1/dispatch/board?start_date=2026-03-02&end_date=2026-03-08')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_leader access', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/dispatch/board?start_date=2026-03-02&end_date=2026-03-08')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated access', async () => {
    const res = await request(app)
      .get('/v1/dispatch/board?start_date=2026-03-02&end_date=2026-03-08');

    expect(res.status).toBe(401);
  });
});

// ============================================
// GET /v1/dispatch/queue
// ============================================
describe('GET /v1/dispatch/queue', () => {
  it('should return queue data in 4 categories', async () => {
    const token = await loginAs('owner');
    mockGetQueueData.mockResolvedValue({
      unassigned: [SAMPLE_QUEUE_JOB],
      work_orders: [],
      recurring_pending: [],
      overdue: [],
    });

    const res = await request(app)
      .get('/v1/dispatch/queue')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.unassigned).toHaveLength(1);
    expect(res.body.data.work_orders).toHaveLength(0);
    expect(res.body.data.recurring_pending).toHaveLength(0);
    expect(res.body.data.overdue).toHaveLength(0);
    expect(mockGetQueueData).toHaveBeenCalledWith(TENANT_A);
  });

  it('should allow coordinator access', async () => {
    const token = await loginAs('coordinator');
    mockGetQueueData.mockResolvedValue({
      unassigned: [],
      work_orders: [],
      recurring_pending: [],
      overdue: [],
    });

    const res = await request(app)
      .get('/v1/dispatch/queue')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_member access', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/dispatch/queue')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// PATCH /v1/dispatch/assign
// ============================================
describe('PATCH /v1/dispatch/assign', () => {
  it('should assign job to crew', async () => {
    const token = await loginAs('owner');
    mockJobExists.mockResolvedValue(true);
    mockCrewIsActive.mockResolvedValue(true);
    mockAssignJob.mockResolvedValue({ id: JOB_ID, status: 'scheduled' });

    const res = await request(app)
      .patch('/v1/dispatch/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        crew_id: CREW_ID,
        scheduled_date: '2026-03-02',
        scheduled_start_time: '08:00',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('scheduled');
    expect(mockAssignJob).toHaveBeenCalledWith(
      TENANT_A, JOB_ID, CREW_ID, '2026-03-02', '08:00', USER_ID,
    );
  });

  it('should return 404 for non-existent job', async () => {
    const token = await loginAs('owner');
    mockJobExists.mockResolvedValue(false);

    const res = await request(app)
      .patch('/v1/dispatch/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        crew_id: CREW_ID,
        scheduled_date: '2026-03-02',
        scheduled_start_time: '08:00',
      });

    expect(res.status).toBe(404);
  });

  it('should return 400 for inactive crew', async () => {
    const token = await loginAs('owner');
    mockJobExists.mockResolvedValue(true);
    mockCrewIsActive.mockResolvedValue(false);

    const res = await request(app)
      .patch('/v1/dispatch/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        crew_id: CREW_ID,
        scheduled_date: '2026-03-02',
        scheduled_start_time: '08:00',
      });

    expect(res.status).toBe(400);
  });

  it('should reject invalid body', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .patch('/v1/dispatch/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  it('should deny crew_leader from assigning', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .patch('/v1/dispatch/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        crew_id: CREW_ID,
        scheduled_date: '2026-03-02',
        scheduled_start_time: '08:00',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PATCH /v1/dispatch/reschedule
// ============================================
describe('PATCH /v1/dispatch/reschedule', () => {
  it('should reschedule job with new date and time', async () => {
    const token = await loginAs('coordinator');
    mockJobExists.mockResolvedValue(true);
    mockRescheduleJob.mockResolvedValue({ id: JOB_ID, status: 'scheduled' });

    const res = await request(app)
      .patch('/v1/dispatch/reschedule')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        scheduled_date: '2026-03-05',
        scheduled_start_time: '10:00',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('scheduled');
    expect(mockRescheduleJob).toHaveBeenCalledWith(
      TENANT_A, JOB_ID, USER_ID, undefined, '2026-03-05', '10:00',
    );
  });

  it('should reschedule to a different crew', async () => {
    const token = await loginAs('owner');
    const newCrewId = '22222222-0000-0000-0000-000000000002';
    mockJobExists.mockResolvedValue(true);
    mockCrewIsActive.mockResolvedValue(true);
    mockRescheduleJob.mockResolvedValue({ id: JOB_ID, status: 'scheduled' });

    const res = await request(app)
      .patch('/v1/dispatch/reschedule')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        crew_id: newCrewId,
      });

    expect(res.status).toBe(200);
    expect(mockCrewIsActive).toHaveBeenCalledWith(TENANT_A, newCrewId);
  });

  it('should return 404 for non-existent job', async () => {
    const token = await loginAs('owner');
    mockJobExists.mockResolvedValue(false);

    const res = await request(app)
      .patch('/v1/dispatch/reschedule')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        scheduled_date: '2026-03-05',
      });

    expect(res.status).toBe(404);
  });

  it('should return 400 if no update fields provided', async () => {
    const token = await loginAs('owner');
    mockJobExists.mockResolvedValue(true);

    const res = await request(app)
      .patch('/v1/dispatch/reschedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: JOB_ID });

    expect(res.status).toBe(400);
  });

  it('should return 400 for inactive crew on reschedule', async () => {
    const token = await loginAs('owner');
    mockJobExists.mockResolvedValue(true);
    mockCrewIsActive.mockResolvedValue(false);

    const res = await request(app)
      .patch('/v1/dispatch/reschedule')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        crew_id: CREW_ID,
      });

    expect(res.status).toBe(400);
  });
});

// ============================================
// PATCH /v1/dispatch/unassign
// ============================================
describe('PATCH /v1/dispatch/unassign', () => {
  it('should unassign job from crew', async () => {
    const token = await loginAs('owner');
    mockJobExists.mockResolvedValue(true);
    mockUnassignJob.mockResolvedValue({ id: JOB_ID, status: 'unscheduled' });

    const res = await request(app)
      .patch('/v1/dispatch/unassign')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: JOB_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('unscheduled');
    expect(mockUnassignJob).toHaveBeenCalledWith(TENANT_A, JOB_ID, USER_ID);
  });

  it('should return 404 for non-existent job', async () => {
    const token = await loginAs('owner');
    mockJobExists.mockResolvedValue(false);

    const res = await request(app)
      .patch('/v1/dispatch/unassign')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: JOB_ID });

    expect(res.status).toBe(404);
  });

  it('should reject invalid job_id', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .patch('/v1/dispatch/unassign')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('should deny crew_member from unassigning', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .patch('/v1/dispatch/unassign')
      .set('Authorization', `Bearer ${token}`)
      .send({ job_id: JOB_ID });

    expect(res.status).toBe(403);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Dispatch tenant isolation', () => {
  it('should scope board queries to authenticated tenant', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockGetBoardData.mockResolvedValue({ crews: [], jobs: [] });

    await request(app)
      .get('/v1/dispatch/board?start_date=2026-03-02&end_date=2026-03-08')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mockGetBoardData).toHaveBeenCalledWith(TENANT_A, '2026-03-02', '2026-03-08', undefined);
  });

  it('should scope queue queries to authenticated tenant', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockGetQueueData.mockResolvedValue({
      unassigned: [],
      work_orders: [],
      recurring_pending: [],
      overdue: [],
    });

    await request(app)
      .get('/v1/dispatch/queue')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mockGetQueueData).toHaveBeenCalledWith(TENANT_B);
  });

  it('should scope assign to authenticated tenant', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockJobExists.mockResolvedValue(true);
    mockCrewIsActive.mockResolvedValue(true);
    mockAssignJob.mockResolvedValue({ id: JOB_ID, status: 'scheduled' });

    await request(app)
      .patch('/v1/dispatch/assign')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        job_id: JOB_ID,
        crew_id: CREW_ID,
        scheduled_date: '2026-03-02',
        scheduled_start_time: '08:00',
      });

    expect(mockJobExists).toHaveBeenCalledWith(TENANT_A, JOB_ID);
    expect(mockCrewIsActive).toHaveBeenCalledWith(TENANT_A, CREW_ID);
  });
});
