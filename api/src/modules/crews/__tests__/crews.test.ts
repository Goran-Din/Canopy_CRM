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

// --- Mock crews repository ---
const mockFindAllCrews = vi.fn();
const mockFindCrewById = vi.fn();
const mockCreateCrew = vi.fn();
const mockUpdateCrew = vi.fn();
const mockSoftDeleteCrew = vi.fn();
const mockHasActiveJobs = vi.fn();
const mockGetCrewMembers = vi.fn();
const mockAddCrewMember = vi.fn();
const mockRemoveCrewMember = vi.fn();
const mockIsUserActiveMemberOfCrew = vi.fn();
const mockUserExists = vi.fn();
const mockCrewExists = vi.fn();
const mockFindAllRoutes = vi.fn();
const mockFindRouteById = vi.fn();
const mockCreateRoute = vi.fn();
const mockUpdateRoute = vi.fn();
const mockSoftDeleteRoute = vi.fn();
const mockGetRouteStops = vi.fn();
const mockAddStop = vi.fn();
const mockUpdateStop = vi.fn();
const mockRemoveStop = vi.fn();
const mockGetStopById = vi.fn();
const mockReorderStops = vi.fn();
const mockPropertyExists = vi.fn();

vi.mock('../repository.js', () => ({
  findAllCrews: (...args: unknown[]) => mockFindAllCrews(...args),
  findCrewById: (...args: unknown[]) => mockFindCrewById(...args),
  createCrew: (...args: unknown[]) => mockCreateCrew(...args),
  updateCrew: (...args: unknown[]) => mockUpdateCrew(...args),
  softDeleteCrew: (...args: unknown[]) => mockSoftDeleteCrew(...args),
  hasActiveJobs: (...args: unknown[]) => mockHasActiveJobs(...args),
  getCrewMembers: (...args: unknown[]) => mockGetCrewMembers(...args),
  addCrewMember: (...args: unknown[]) => mockAddCrewMember(...args),
  removeCrewMember: (...args: unknown[]) => mockRemoveCrewMember(...args),
  isUserActiveMemberOfCrew: (...args: unknown[]) => mockIsUserActiveMemberOfCrew(...args),
  userExists: (...args: unknown[]) => mockUserExists(...args),
  crewExists: (...args: unknown[]) => mockCrewExists(...args),
  findAllRoutes: (...args: unknown[]) => mockFindAllRoutes(...args),
  findRouteById: (...args: unknown[]) => mockFindRouteById(...args),
  createRoute: (...args: unknown[]) => mockCreateRoute(...args),
  updateRoute: (...args: unknown[]) => mockUpdateRoute(...args),
  softDeleteRoute: (...args: unknown[]) => mockSoftDeleteRoute(...args),
  getRouteStops: (...args: unknown[]) => mockGetRouteStops(...args),
  addStop: (...args: unknown[]) => mockAddStop(...args),
  updateStop: (...args: unknown[]) => mockUpdateStop(...args),
  removeStop: (...args: unknown[]) => mockRemoveStop(...args),
  getStopById: (...args: unknown[]) => mockGetStopById(...args),
  reorderStops: (...args: unknown[]) => mockReorderStops(...args),
  propertyExists: (...args: unknown[]) => mockPropertyExists(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CREW_ID = 'dddddddd-0000-0000-0000-000000000001';
const ROUTE_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const MEMBER_USER_ID = 'ffffffff-0000-0000-0000-000000000001';
const PROPERTY_ID = '11111111-0000-0000-0000-000000000001';
const STOP_ID = '22222222-0000-0000-0000-000000000001';
const STOP_ID_2 = '22222222-0000-0000-0000-000000000002';

const SAMPLE_CREW = {
  id: CREW_ID,
  tenant_id: TENANT_A,
  crew_name: 'Alpha Crew',
  division: 'landscaping_maintenance',
  crew_leader_id: USER_ID,
  status: 'active',
  color_code: '#00FF00',
  max_jobs_per_day: 12,
  notes: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  members: [],
};

const SAMPLE_MEMBER = {
  id: '33333333-0000-0000-0000-000000000001',
  tenant_id: TENANT_A,
  crew_id: CREW_ID,
  user_id: MEMBER_USER_ID,
  role_in_crew: 'member',
  joined_date: '2026-01-15',
  left_date: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_first_name: 'John',
  user_last_name: 'Worker',
  user_email: 'john@example.com',
};

const SAMPLE_ROUTE = {
  id: ROUTE_ID,
  tenant_id: TENANT_A,
  route_name: 'Monday North',
  division: 'landscaping_maintenance',
  crew_id: CREW_ID,
  day_of_week: 'monday',
  status: 'active',
  zone: 'North',
  estimated_duration_hours: 8,
  notes: null,
  color_code: '#0000FF',
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  stops: [],
};

const SAMPLE_STOP = {
  id: STOP_ID,
  tenant_id: TENANT_A,
  route_id: ROUTE_ID,
  property_id: PROPERTY_ID,
  stop_order: 1,
  estimated_arrival_time: '08:00',
  estimated_duration_minutes: 30,
  notes: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  property_name: '123 Main St',
  address_line1: '123 Main St',
  city: 'Ottawa',
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
// GET /v1/crews — List
// ============================================
describe('GET /v1/crews', () => {
  it('should return paginated crew list', async () => {
    const token = await loginAs('owner');
    mockFindAllCrews.mockResolvedValue({ rows: [SAMPLE_CREW], total: 1 });

    const res = await request(app)
      .get('/v1/crews')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass filters to repository', async () => {
    const token = await loginAs('coordinator');
    mockFindAllCrews.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/crews?status=active&division=landscaping_maintenance&search=Alpha')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllCrews).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        status: 'active',
        division: 'landscaping_maintenance',
        search: 'Alpha',
      }),
    );
  });

  it('should deny crew_leader from listing crews', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/crews')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/crews/:id — Detail
// ============================================
describe('GET /v1/crews/:id', () => {
  it('should return crew with members', async () => {
    const token = await loginAs('owner');
    mockFindCrewById.mockResolvedValue({ ...SAMPLE_CREW, members: [SAMPLE_MEMBER] });

    const res = await request(app)
      .get(`/v1/crews/${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.crew_name).toBe('Alpha Crew');
    expect(res.body.data.members).toHaveLength(1);
  });

  it('should allow crew_leader to view crew detail', async () => {
    const token = await loginAs('crew_leader');
    mockFindCrewById.mockResolvedValue(SAMPLE_CREW);

    const res = await request(app)
      .get(`/v1/crews/${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should return 404 for non-existent crew', async () => {
    const token = await loginAs('owner');
    mockFindCrewById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/crews/${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/crews — Create
// ============================================
describe('POST /v1/crews', () => {
  it('should create a crew', async () => {
    const token = await loginAs('owner');
    mockUserExists.mockResolvedValue(true);
    mockCreateCrew.mockResolvedValue(SAMPLE_CREW);

    const res = await request(app)
      .post('/v1/crews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        crew_name: 'Alpha Crew',
        division: 'landscaping_maintenance',
        crew_leader_id: USER_ID,
        color_code: '#00FF00',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.crew_name).toBe('Alpha Crew');
  });

  it('should create crew without leader', async () => {
    const token = await loginAs('div_mgr');
    mockCreateCrew.mockResolvedValue({ ...SAMPLE_CREW, crew_leader_id: null });

    const res = await request(app)
      .post('/v1/crews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        crew_name: 'Beta Crew',
        division: 'hardscape',
      });

    expect(res.status).toBe(201);
  });

  it('should reject if crew leader not found', async () => {
    const token = await loginAs('owner');
    mockUserExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/crews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        crew_name: 'Test Crew',
        division: 'landscaping_maintenance',
        crew_leader_id: MEMBER_USER_ID,
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Crew leader user not found');
  });

  it('should deny coordinator from creating crews', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/crews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        crew_name: 'Test',
        division: 'landscaping_maintenance',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/crews/:id — Update
// ============================================
describe('PUT /v1/crews/:id', () => {
  it('should update crew', async () => {
    const token = await loginAs('owner');
    mockFindCrewById.mockResolvedValue(SAMPLE_CREW);
    mockUpdateCrew.mockResolvedValue({ ...SAMPLE_CREW, crew_name: 'Alpha Prime' });

    const res = await request(app)
      .put(`/v1/crews/${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ crew_name: 'Alpha Prime' });

    expect(res.status).toBe(200);
    expect(res.body.data.crew_name).toBe('Alpha Prime');
  });

  it('should return 404 for non-existent crew', async () => {
    const token = await loginAs('owner');
    mockFindCrewById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/crews/${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ crew_name: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('should return 409 on optimistic concurrency conflict', async () => {
    const token = await loginAs('owner');
    mockFindCrewById.mockResolvedValue(SAMPLE_CREW);
    mockUpdateCrew.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/crews/${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ crew_name: 'Updated', updated_at: '2020-01-01T00:00:00.000Z' });

    expect(res.status).toBe(409);
  });
});

// ============================================
// DELETE /v1/crews/:id
// ============================================
describe('DELETE /v1/crews/:id', () => {
  it('should soft delete crew without active jobs', async () => {
    const token = await loginAs('owner');
    mockFindCrewById.mockResolvedValue(SAMPLE_CREW);
    mockHasActiveJobs.mockResolvedValue(false);
    mockSoftDeleteCrew.mockResolvedValue(SAMPLE_CREW);

    const res = await request(app)
      .delete(`/v1/crews/${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Crew deleted');
  });

  it('should block deletion when crew has active jobs', async () => {
    const token = await loginAs('owner');
    mockFindCrewById.mockResolvedValue(SAMPLE_CREW);
    mockHasActiveJobs.mockResolvedValue(true);

    const res = await request(app)
      .delete(`/v1/crews/${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Cannot delete crew with active jobs');
  });

  it('should deny div_mgr from deleting crews', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .delete(`/v1/crews/${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Crew Members
// ============================================
describe('GET /v1/crews/:id/members', () => {
  it('should return crew members', async () => {
    const token = await loginAs('owner');
    mockCrewExists.mockResolvedValue(true);
    mockGetCrewMembers.mockResolvedValue([SAMPLE_MEMBER]);

    const res = await request(app)
      .get(`/v1/crews/${CREW_ID}/members`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].user_first_name).toBe('John');
  });

  it('should return 404 for non-existent crew', async () => {
    const token = await loginAs('owner');
    mockCrewExists.mockResolvedValue(false);

    const res = await request(app)
      .get(`/v1/crews/${CREW_ID}/members`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /v1/crews/:id/members', () => {
  it('should add a member to crew', async () => {
    const token = await loginAs('owner');
    mockCrewExists.mockResolvedValue(true);
    mockUserExists.mockResolvedValue(true);
    mockIsUserActiveMemberOfCrew.mockResolvedValue(false);
    mockAddCrewMember.mockResolvedValue(SAMPLE_MEMBER);

    const res = await request(app)
      .post(`/v1/crews/${CREW_ID}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: MEMBER_USER_ID, role_in_crew: 'member' });

    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBe(MEMBER_USER_ID);
  });

  it('should reject adding non-existent user', async () => {
    const token = await loginAs('owner');
    mockCrewExists.mockResolvedValue(true);
    mockUserExists.mockResolvedValue(false);

    const res = await request(app)
      .post(`/v1/crews/${CREW_ID}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: MEMBER_USER_ID, role_in_crew: 'member' });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('User not found');
  });

  it('should reject duplicate active membership', async () => {
    const token = await loginAs('owner');
    mockCrewExists.mockResolvedValue(true);
    mockUserExists.mockResolvedValue(true);
    mockIsUserActiveMemberOfCrew.mockResolvedValue(true);

    const res = await request(app)
      .post(`/v1/crews/${CREW_ID}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: MEMBER_USER_ID, role_in_crew: 'member' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already an active member');
  });

  it('should deny coordinator from managing members', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post(`/v1/crews/${CREW_ID}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: MEMBER_USER_ID, role_in_crew: 'member' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /v1/crews/:id/members/:userId', () => {
  it('should remove member from crew', async () => {
    const token = await loginAs('owner');
    mockCrewExists.mockResolvedValue(true);
    mockRemoveCrewMember.mockResolvedValue(SAMPLE_MEMBER);

    const res = await request(app)
      .delete(`/v1/crews/${CREW_ID}/members/${MEMBER_USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Member removed from crew');
  });

  it('should return 404 for non-member', async () => {
    const token = await loginAs('owner');
    mockCrewExists.mockResolvedValue(true);
    mockRemoveCrewMember.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/v1/crews/${CREW_ID}/members/${MEMBER_USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// GET /v1/routes — List
// ============================================
describe('GET /v1/routes', () => {
  it('should return paginated route list', async () => {
    const token = await loginAs('owner');
    mockFindAllRoutes.mockResolvedValue({ rows: [SAMPLE_ROUTE], total: 1 });

    const res = await request(app)
      .get('/v1/routes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass filters to repository', async () => {
    const token = await loginAs('coordinator');
    mockFindAllRoutes.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/routes?day_of_week=monday&division=landscaping_maintenance&crew_id=${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllRoutes).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        day_of_week: 'monday',
        division: 'landscaping_maintenance',
        crew_id: CREW_ID,
      }),
    );
  });

  it('should allow crew_leader to list routes', async () => {
    const token = await loginAs('crew_leader');
    mockFindAllRoutes.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/routes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_member from listing routes', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/routes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/routes/:id — Detail
// ============================================
describe('GET /v1/routes/:id', () => {
  it('should return route with stops', async () => {
    const token = await loginAs('owner');
    mockFindRouteById.mockResolvedValue({ ...SAMPLE_ROUTE, stops: [SAMPLE_STOP] });

    const res = await request(app)
      .get(`/v1/routes/${ROUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.route_name).toBe('Monday North');
    expect(res.body.data.stops).toHaveLength(1);
  });

  it('should return 404 for non-existent route', async () => {
    const token = await loginAs('owner');
    mockFindRouteById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/routes/${ROUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/routes — Create
// ============================================
describe('POST /v1/routes', () => {
  it('should create a route with crew', async () => {
    const token = await loginAs('owner');
    mockCrewExists.mockResolvedValue(true);
    mockCreateRoute.mockResolvedValue(SAMPLE_ROUTE);

    const res = await request(app)
      .post('/v1/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        route_name: 'Monday North',
        division: 'landscaping_maintenance',
        crew_id: CREW_ID,
        day_of_week: 'monday',
        zone: 'North',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.route_name).toBe('Monday North');
  });

  it('should create route without crew', async () => {
    const token = await loginAs('coordinator');
    mockCreateRoute.mockResolvedValue({ ...SAMPLE_ROUTE, crew_id: null });

    const res = await request(app)
      .post('/v1/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        route_name: 'Unassigned Route',
        division: 'landscaping_maintenance',
        day_of_week: 'tuesday',
      });

    expect(res.status).toBe(201);
  });

  it('should reject if crew not found', async () => {
    const token = await loginAs('owner');
    mockCrewExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/v1/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        route_name: 'Test Route',
        division: 'landscaping_maintenance',
        crew_id: CREW_ID,
        day_of_week: 'monday',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Crew not found');
  });

  it('should deny crew_leader from creating routes', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post('/v1/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        route_name: 'Test',
        division: 'landscaping_maintenance',
        day_of_week: 'monday',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/routes/:id — Update
// ============================================
describe('PUT /v1/routes/:id', () => {
  it('should update route', async () => {
    const token = await loginAs('owner');
    mockFindRouteById.mockResolvedValue(SAMPLE_ROUTE);
    mockUpdateRoute.mockResolvedValue({ ...SAMPLE_ROUTE, route_name: 'Monday South' });

    const res = await request(app)
      .put(`/v1/routes/${ROUTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_name: 'Monday South' });

    expect(res.status).toBe(200);
    expect(res.body.data.route_name).toBe('Monday South');
  });

  it('should return 404 for non-existent route', async () => {
    const token = await loginAs('owner');
    mockFindRouteById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/routes/${ROUTE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_name: 'Updated' });

    expect(res.status).toBe(404);
  });
});

// ============================================
// DELETE /v1/routes/:id
// ============================================
describe('DELETE /v1/routes/:id', () => {
  it('should soft delete route', async () => {
    const token = await loginAs('owner');
    mockFindRouteById.mockResolvedValue(SAMPLE_ROUTE);
    mockSoftDeleteRoute.mockResolvedValue(SAMPLE_ROUTE);

    const res = await request(app)
      .delete(`/v1/routes/${ROUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Route deleted');
  });

  it('should deny coordinator from deleting routes', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .delete(`/v1/routes/${ROUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Route Stops
// ============================================
describe('GET /v1/routes/:id/stops', () => {
  it('should return stops for a route', async () => {
    const token = await loginAs('owner');
    mockFindRouteById.mockResolvedValue(SAMPLE_ROUTE);
    mockGetRouteStops.mockResolvedValue([SAMPLE_STOP]);

    const res = await request(app)
      .get(`/v1/routes/${ROUTE_ID}/stops`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].property_name).toBe('123 Main St');
  });
});

describe('POST /v1/routes/:id/stops', () => {
  it('should add a stop to route', async () => {
    const token = await loginAs('coordinator');
    mockFindRouteById.mockResolvedValue(SAMPLE_ROUTE);
    mockPropertyExists.mockResolvedValue(true);
    mockAddStop.mockResolvedValue(SAMPLE_STOP);

    const res = await request(app)
      .post(`/v1/routes/${ROUTE_ID}/stops`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        property_id: PROPERTY_ID,
        estimated_duration_minutes: 30,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.property_id).toBe(PROPERTY_ID);
  });

  it('should reject if property not found', async () => {
    const token = await loginAs('owner');
    mockFindRouteById.mockResolvedValue(SAMPLE_ROUTE);
    mockPropertyExists.mockResolvedValue(false);

    const res = await request(app)
      .post(`/v1/routes/${ROUTE_ID}/stops`)
      .set('Authorization', `Bearer ${token}`)
      .send({ property_id: PROPERTY_ID });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Property not found');
  });

  it('should reject if route not found', async () => {
    const token = await loginAs('owner');
    mockFindRouteById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/v1/routes/${ROUTE_ID}/stops`)
      .set('Authorization', `Bearer ${token}`)
      .send({ property_id: PROPERTY_ID });

    expect(res.status).toBe(404);
  });

  it('should deny crew_leader from adding stops', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post(`/v1/routes/${ROUTE_ID}/stops`)
      .set('Authorization', `Bearer ${token}`)
      .send({ property_id: PROPERTY_ID });

    expect(res.status).toBe(403);
  });
});

describe('PUT /v1/routes/:id/stops/:stopId', () => {
  it('should update a stop', async () => {
    const token = await loginAs('coordinator');
    mockGetStopById.mockResolvedValue(SAMPLE_STOP);
    mockUpdateStop.mockResolvedValue({ ...SAMPLE_STOP, estimated_duration_minutes: 45 });

    const res = await request(app)
      .put(`/v1/routes/${ROUTE_ID}/stops/${STOP_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estimated_duration_minutes: 45 });

    expect(res.status).toBe(200);
    expect(res.body.data.estimated_duration_minutes).toBe(45);
  });

  it('should return 404 for non-existent stop', async () => {
    const token = await loginAs('owner');
    mockGetStopById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/routes/${ROUTE_ID}/stops/${STOP_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estimated_duration_minutes: 45 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /v1/routes/:id/stops/:stopId', () => {
  it('should remove stop from route', async () => {
    const token = await loginAs('coordinator');
    mockGetStopById.mockResolvedValue(SAMPLE_STOP);
    mockRemoveStop.mockResolvedValue(SAMPLE_STOP);

    const res = await request(app)
      .delete(`/v1/routes/${ROUTE_ID}/stops/${STOP_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Stop removed from route');
  });
});

describe('PUT /v1/routes/:id/stops/reorder', () => {
  it('should reorder stops', async () => {
    const token = await loginAs('coordinator');
    mockFindRouteById.mockResolvedValue(SAMPLE_ROUTE);
    mockReorderStops.mockResolvedValue(undefined);
    mockGetRouteStops.mockResolvedValue([
      { ...SAMPLE_STOP, stop_order: 1 },
      { ...SAMPLE_STOP, id: STOP_ID_2, stop_order: 2 },
    ]);

    const res = await request(app)
      .put(`/v1/routes/${ROUTE_ID}/stops/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stop_ids: [STOP_ID_2, STOP_ID] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(mockReorderStops).toHaveBeenCalledWith(TENANT_A, ROUTE_ID, [STOP_ID_2, STOP_ID]);
  });

  it('should return 404 for non-existent route', async () => {
    const token = await loginAs('owner');
    mockFindRouteById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/routes/${ROUTE_ID}/stops/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stop_ids: [STOP_ID] });

    expect(res.status).toBe(404);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant isolation', () => {
  it('should scope crew queries to authenticated tenant', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockFindAllCrews.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/crews')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mockFindAllCrews).toHaveBeenCalledWith(TENANT_A, expect.anything());
  });

  it('should scope route queries to authenticated tenant', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockFindAllRoutes.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/routes')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mockFindAllRoutes).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });
});

// ============================================
// Role-Based Access Control
// ============================================
describe('Role-based access', () => {
  it('should deny unauthenticated crew requests', async () => {
    const res = await request(app).get('/v1/crews');
    expect(res.status).toBe(401);
  });

  it('should deny unauthenticated route requests', async () => {
    const res = await request(app).get('/v1/routes');
    expect(res.status).toBe(401);
  });

  it('should allow crew_leader to view route details', async () => {
    const token = await loginAs('crew_leader');
    mockFindRouteById.mockResolvedValue(SAMPLE_ROUTE);

    const res = await request(app)
      .get(`/v1/routes/${ROUTE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_member from all crew endpoints', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/crews')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
