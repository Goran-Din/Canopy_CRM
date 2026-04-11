import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

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

// --- Mock geofence repository ---
const mockGetPropertyGeofence = vi.fn();
const mockUpdatePropertyGeofence = vi.fn();
const mockGetGeofenceSetupStatus = vi.fn();
const mockInsertGpsEvent = vi.fn();
const mockFindUnmatchedArrival = vi.fn();
const mockPairEvents = vi.fn();
const mockGetLiveCrewPositions = vi.fn();
const mockGetEventsByJob = vi.fn();
const mockGetEventsByProperty = vi.fn();
const mockGetCrossCheckFlags = vi.fn();
const mockResolveCrossCheckFlag = vi.fn();
const mockFindDeparturesForDay = vi.fn();
const mockUpdateGpsEvent = vi.fn();
const mockGetTodayProperties = vi.fn();

vi.mock('../repository.js', () => ({
  getPropertyGeofence: (...args: unknown[]) => mockGetPropertyGeofence(...args),
  updatePropertyGeofence: (...args: unknown[]) => mockUpdatePropertyGeofence(...args),
  getGeofenceSetupStatus: (...args: unknown[]) => mockGetGeofenceSetupStatus(...args),
  bulkConfirmGeofences: vi.fn(),
  insertGpsEvent: (...args: unknown[]) => mockInsertGpsEvent(...args),
  findUnmatchedArrival: (...args: unknown[]) => mockFindUnmatchedArrival(...args),
  pairEvents: (...args: unknown[]) => mockPairEvents(...args),
  getLiveCrewPositions: (...args: unknown[]) => mockGetLiveCrewPositions(...args),
  getEventsByJob: (...args: unknown[]) => mockGetEventsByJob(...args),
  getEventsByProperty: (...args: unknown[]) => mockGetEventsByProperty(...args),
  getCrossCheckFlags: (...args: unknown[]) => mockGetCrossCheckFlags(...args),
  resolveCrossCheckFlag: (...args: unknown[]) => mockResolveCrossCheckFlag(...args),
  findDeparturesForDay: (...args: unknown[]) => mockFindDeparturesForDay(...args),
  updateGpsEvent: (...args: unknown[]) => mockUpdateGpsEvent(...args),
  getTodayProperties: (...args: unknown[]) => mockGetTodayProperties(...args),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';

const SAMPLE_TODAY_PROPERTY = {
  property_id: PROPERTY_ID,
  address: '123 Main St, Toronto ON',
  lat: 43.6532,
  lng: -79.3832,
  geofence_radius_metres: 40,
  job_id: JOB_ID,
  job_number: 'JOB-001',
  crew_name: 'Team Alpha',
  scheduled_date: '2026-04-11',
};

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
  mockQueryDb.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ============================================
// GET /v1/geofence/today-office-properties
// ============================================
describe('GET /v1/geofence/today-office-properties', () => {
  it('should return properties with jobs scheduled today', async () => {
    const token = await loginAs('coordinator');
    mockGetTodayProperties.mockResolvedValueOnce([SAMPLE_TODAY_PROPERTY]);

    const res = await request(app)
      .get('/v1/geofence/today-office-properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.properties).toHaveLength(1);
    expect(res.body.data.properties[0].property_id).toBe(PROPERTY_ID);
    expect(res.body.data.properties[0].address).toBe('123 Main St, Toronto ON');
    expect(res.body.data.properties[0].job_id).toBe(JOB_ID);
    expect(mockGetTodayProperties).toHaveBeenCalledWith(TENANT_A);
  });

  it('should return empty array when no jobs today', async () => {
    const token = await loginAs('owner');
    mockGetTodayProperties.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/v1/geofence/today-office-properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.properties).toEqual([]);
  });

  it('should require authentication (401 without token)', async () => {
    const res = await request(app)
      .get('/v1/geofence/today-office-properties');

    expect(res.status).toBe(401);
  });

  it('should deny crew_member role (403)', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/geofence/today-office-properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should allow owner role', async () => {
    const token = await loginAs('owner');
    mockGetTodayProperties.mockResolvedValueOnce([SAMPLE_TODAY_PROPERTY]);

    const res = await request(app)
      .get('/v1/geofence/today-office-properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should allow div_mgr role', async () => {
    const token = await loginAs('div_mgr');
    mockGetTodayProperties.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/v1/geofence/today-office-properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should allow coordinator role', async () => {
    const token = await loginAs('coordinator');
    mockGetTodayProperties.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/v1/geofence/today-office-properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_leader role (403)', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/geofence/today-office-properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should scope query to authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockGetTodayProperties.mockResolvedValueOnce([]);

    await request(app)
      .get('/v1/geofence/today-office-properties')
      .set('Authorization', `Bearer ${token}`);

    expect(mockGetTodayProperties).toHaveBeenCalledWith(TENANT_A);
  });

  it('should return multiple properties when multiple jobs today', async () => {
    const token = await loginAs('coordinator');
    const PROPERTY_ID_2 = 'eeeeeeee-0000-0000-0000-000000000002';
    const JOB_ID_2 = '33333333-0000-0000-0000-000000000002';
    mockGetTodayProperties.mockResolvedValueOnce([
      SAMPLE_TODAY_PROPERTY,
      {
        property_id: PROPERTY_ID_2,
        address: '456 Oak Ave, Toronto ON',
        lat: 43.7000,
        lng: -79.4000,
        geofence_radius_metres: 30,
        job_id: JOB_ID_2,
        job_number: 'JOB-002',
        crew_name: 'Team Beta',
        scheduled_date: '2026-04-11',
      },
    ]);

    const res = await request(app)
      .get('/v1/geofence/today-office-properties')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.properties).toHaveLength(2);
  });
});
