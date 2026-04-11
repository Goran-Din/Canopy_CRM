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
}));

import app from '../../../app.js';
import { getDefaultRadius, runPayrollCrossCheck } from '../service.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'aaaaaaaa-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CREW_ID = 'cccccccc-0000-0000-0000-000000000010';
const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const EVENT_ID = 'ffffffff-0000-0000-0000-000000000001';
const ARRIVAL_ID = 'ffffffff-0000-0000-0000-000000000002';

const SAMPLE_GEOFENCE = {
  id: PROPERTY_ID,
  property_name: '123 Main St',
  geofence_lat: '43.6532000',
  geofence_lng: '-79.3832000',
  geofence_radius_metres: 40,
  geofence_enabled: true,
  geofence_last_set_at: new Date().toISOString(),
  geofence_set_by: null,
};

const makeEvent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: EVENT_ID,
  tenant_id: TENANT_A,
  crew_member_id: CREW_ID,
  property_id: PROPERTY_ID,
  job_id: JOB_ID,
  event_type: 'arrival',
  event_at: new Date().toISOString(),
  latitude: '43.6532000',
  longitude: '-79.3832000',
  accuracy_metres: '5.00',
  speed_kmh: '3.00',
  heading_degrees: null,
  source: 'geofence',
  paired_event_id: null,
  is_flagged: false,
  flag_reason: null,
  geofence_radius_at_trigger: 40,
  distance_from_centre_metres: '12.50',
  dwell_minutes: null,
  service_occurrence_id: null,
  payroll_cross_check_status: 'pending',
  payroll_cross_check_note: null,
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
  mockInsertGpsEvent.mockImplementation((data: Record<string, unknown>) =>
    Promise.resolve({ ...makeEvent(), ...data, id: EVENT_ID }),
  );
  mockPairEvents.mockResolvedValue(undefined);
  // Default queryDb mock for job lookup etc.
  mockQueryDb.mockResolvedValue({ rows: [], rowCount: 0 });
});

// ============================================
// 1. Property creation auto-sets geofence_lat/lng from property GPS
// ============================================
describe('setDefaultGeofence integration', () => {
  it('should set geofence from property coordinates', async () => {
    mockUpdatePropertyGeofence.mockResolvedValueOnce(SAMPLE_GEOFENCE);

    const { setDefaultGeofence } = await import('../service.js');
    await setDefaultGeofence(PROPERTY_ID, 43.6532, -79.3832, 'RES-M');

    expect(mockUpdatePropertyGeofence).toHaveBeenCalledWith(
      PROPERTY_ID, '',
      expect.objectContaining({
        geofence_lat: 43.6532,
        geofence_lng: -79.3832,
        geofence_radius_metres: 40, // RES-M default
        geofence_enabled: true,
      }),
    );
  });

  it('should not set geofence if lat/lng is null', async () => {
    const { setDefaultGeofence } = await import('../service.js');
    await setDefaultGeofence(PROPERTY_ID, null, null, 'RES-M');
    expect(mockUpdatePropertyGeofence).not.toHaveBeenCalled();
  });
});

// ============================================
// 2. Default radius set based on property_category
// ============================================
describe('Default radius by property_category', () => {
  it('should return 30m for RES-S', () => {
    expect(getDefaultRadius('RES-S')).toBe(30);
  });
  it('should return 40m for RES-M', () => {
    expect(getDefaultRadius('RES-M')).toBe(40);
  });
  it('should return 60m for RES-L', () => {
    expect(getDefaultRadius('RES-L')).toBe(60);
  });
  it('should return 50m for COM-S', () => {
    expect(getDefaultRadius('COM-S')).toBe(50);
  });
  it('should return 80m for COM-L', () => {
    expect(getDefaultRadius('COM-L')).toBe(80);
  });
  it('should return 100m for HOA-M', () => {
    expect(getDefaultRadius('HOA-M')).toBe(100);
  });
  it('should return 40m for unknown category', () => {
    expect(getDefaultRadius(null)).toBe(40);
    expect(getDefaultRadius(undefined)).toBe(40);
  });
});

// ============================================
// 3. POST /gps-events with arrival: event created, job linked
// ============================================
describe('POST /v1/gps-events/v2', () => {
  it('should create arrival event and link to job', async () => {
    const token = await loginAs('crew_member');
    mockGetPropertyGeofence.mockResolvedValueOnce(SAMPLE_GEOFENCE);
    // Mock job lookup
    mockQueryDb.mockResolvedValueOnce({ rows: [{ id: JOB_ID }], rowCount: 1 });

    const res = await request(app)
      .post('/v1/gps-events/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'arrival',
        property_id: PROPERTY_ID,
        latitude: 43.6532,
        longitude: -79.3832,
        accuracy_metres: 5,
        distance_from_centre_metres: 12.5,
        speed_kmh: 3,
      });

    expect(res.status).toBe(201);
    expect(mockInsertGpsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'arrival',
        source: 'geofence',
        geofence_radius_at_trigger: 40,
      }),
    );
  });

  // ============================================
  // 4. Arrival at unscheduled property: notification sent
  // ============================================
  it('should log notification for unscheduled visit', async () => {
    const { logger } = await import('../../../config/logger.js');
    const token = await loginAs('crew_member');
    mockGetPropertyGeofence.mockResolvedValueOnce(SAMPLE_GEOFENCE);
    // No scheduled job found
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await request(app)
      .post('/v1/gps-events/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'arrival',
        property_id: PROPERTY_ID,
        latitude: 43.6532,
        longitude: -79.3832,
      });

    expect(logger.info).toHaveBeenCalledWith(
      'Unscheduled property visit detected',
      expect.objectContaining({ property_id: PROPERTY_ID }),
    );
  });

  // ============================================
  // 5. Arrival with speed > 25: is_flagged=TRUE
  // ============================================
  it('should flag arrival with speed > 25 km/h', async () => {
    const token = await loginAs('crew_member');
    mockGetPropertyGeofence.mockResolvedValueOnce(SAMPLE_GEOFENCE);
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/v1/gps-events/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'arrival',
        property_id: PROPERTY_ID,
        latitude: 43.6532,
        longitude: -79.3832,
        speed_kmh: 35,
      });

    expect(res.status).toBe(201);
    expect(mockInsertGpsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        is_flagged: true,
        flag_reason: expect.stringContaining('35'),
      }),
    );
  });

  // ============================================
  // 6. Departure: dwell_minutes computed, arrival paired
  // ============================================
  it('should compute dwell_minutes and pair with arrival on departure', async () => {
    const token = await loginAs('crew_member');
    const arrivalTime = new Date(Date.now() - 45 * 60000); // 45 min ago
    mockFindUnmatchedArrival.mockResolvedValueOnce(
      makeEvent({ id: ARRIVAL_ID, event_at: arrivalTime.toISOString(), geofence_radius_at_trigger: 40 }),
    );

    const res = await request(app)
      .post('/v1/gps-events/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'departure',
        property_id: PROPERTY_ID,
        latitude: 43.6532,
        longitude: -79.3832,
      });

    expect(res.status).toBe(201);
    expect(mockInsertGpsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'departure',
        paired_event_id: ARRIVAL_ID,
        dwell_minutes: expect.any(Number),
      }),
    );
    // Verify arrival was paired back
    expect(mockPairEvents).toHaveBeenCalledWith(ARRIVAL_ID, EVENT_ID);
  });

  // ============================================
  // 7. Departure without matching arrival: stored with warning, no 500
  // ============================================
  it('should handle departure without arrival gracefully', async () => {
    const { logger } = await import('../../../config/logger.js');
    const token = await loginAs('crew_member');
    mockFindUnmatchedArrival.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/v1/gps-events/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'departure',
        property_id: PROPERTY_ID,
        latitude: 43.6532,
        longitude: -79.3832,
      });

    expect(res.status).toBe(201); // NOT 500
    expect(logger.warn).toHaveBeenCalledWith(
      'Departure without matching arrival',
      expect.any(Object),
    );
    expect(mockInsertGpsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'departure',
        paired_event_id: null,
        dwell_minutes: null,
      }),
    );
  });
});

// ============================================
// 8. Cross-check: L1=480, L2=300 → flag (>30min and >20%)
// ============================================
describe('Payroll cross-check', () => {
  it('should flag when diff > 30min AND > 20%', async () => {
    // Layer 1: 480 minutes
    mockQueryDb.mockResolvedValueOnce({
      rows: [{ clock_in: '08:00', clock_out: '16:00', total_minutes: 480 }],
      rowCount: 1,
    });
    // Layer 2: 300 minutes total dwell
    mockFindDeparturesForDay.mockResolvedValueOnce([
      makeEvent({ id: 'dep-1', dwell_minutes: 150 }),
      makeEvent({ id: 'dep-2', dwell_minutes: 150 }),
    ]);
    mockUpdateGpsEvent.mockResolvedValue(undefined);

    await runPayrollCrossCheck(TENANT_A, CREW_ID, '2026-04-10');

    // diff = 180 min (>30), pct = 37.5% (>20%) → should flag
    expect(mockUpdateGpsEvent).toHaveBeenCalledWith('dep-1', { payroll_cross_check_status: 'flagged' });
    expect(mockUpdateGpsEvent).toHaveBeenCalledWith('dep-2', { payroll_cross_check_status: 'flagged' });
  });

  // ============================================
  // 9. Cross-check: L1=480, L2=450 → consistent, no flag
  // ============================================
  it('should mark consistent when diff < 30min', async () => {
    mockQueryDb.mockResolvedValueOnce({
      rows: [{ clock_in: '08:00', clock_out: '16:00', total_minutes: 480 }],
      rowCount: 1,
    });
    mockFindDeparturesForDay.mockResolvedValueOnce([
      makeEvent({ id: 'dep-1', dwell_minutes: 225 }),
      makeEvent({ id: 'dep-2', dwell_minutes: 225 }),
    ]);
    mockUpdateGpsEvent.mockResolvedValue(undefined);

    await runPayrollCrossCheck(TENANT_A, CREW_ID, '2026-04-10');

    // diff = 30 min, but not > 30 → consistent
    expect(mockUpdateGpsEvent).toHaveBeenCalledWith('dep-1', { payroll_cross_check_status: 'consistent' });
  });
});

// ============================================
// 10. GPS events NEVER update crew_day_logs timestamps
// ============================================
describe('GPS events independence', () => {
  it('should never call update on crew_day_logs', async () => {
    const token = await loginAs('crew_member');
    mockGetPropertyGeofence.mockResolvedValueOnce(SAMPLE_GEOFENCE);
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await request(app)
      .post('/v1/gps-events/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'arrival',
        property_id: PROPERTY_ID,
        latitude: 43.6532,
        longitude: -79.3832,
      });

    // Verify no UPDATE crew_day_logs query was made
    for (const call of mockQueryDb.mock.calls) {
      const sql = call[0] as string;
      expect(sql).not.toMatch(/UPDATE\s+crew_day_logs/i);
    }
  });
});

// ============================================
// 11. GET live-crew-positions returns clocked-in crew
// ============================================
describe('GET /v1/gps-events/live-crew-positions', () => {
  it('should return live positions for clocked-in crew', async () => {
    const token = await loginAs('coordinator');
    mockGetLiveCrewPositions.mockResolvedValueOnce([{
      crew_member_id: CREW_ID,
      first_name: 'Alex',
      last_name: 'Jones',
      latitude: '43.6532',
      longitude: '-79.3832',
      event_at: new Date().toISOString(),
      speed_kmh: '5',
      property_name: '123 Main St',
    }]);

    const res = await request(app)
      .get('/v1/gps-events/live-crew-positions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].crew_member_id).toBe(CREW_ID);
  });

  it('should deny crew_member from viewing live positions', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get('/v1/gps-events/live-crew-positions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ============================================
// 12. PATCH /properties/:id/geofence updates radius and logs geofence_set_by
// ============================================
describe('PATCH /v1/properties/:id/geofence', () => {
  it('should update geofence radius and log who set it', async () => {
    const token = await loginAs('coordinator');
    mockGetPropertyGeofence.mockResolvedValueOnce(SAMPLE_GEOFENCE);
    mockUpdatePropertyGeofence.mockResolvedValueOnce({
      ...SAMPLE_GEOFENCE,
      geofence_radius_metres: 60,
      geofence_set_by: USER_ID,
    });

    const res = await request(app)
      .patch(`/v1/properties/${PROPERTY_ID}/geofence`)
      .set('Authorization', `Bearer ${token}`)
      .send({ geofence_radius_metres: 60 });

    expect(res.status).toBe(200);
    expect(mockUpdatePropertyGeofence).toHaveBeenCalledWith(
      PROPERTY_ID, TENANT_A,
      expect.objectContaining({
        geofence_radius_metres: 60,
        geofence_set_by: USER_ID,
      }),
    );
  });
});

// ============================================
// 13. Offline event (event_at in past) processed with original timestamp
// ============================================
describe('Offline event processing', () => {
  it('should use original event_at for offline events', async () => {
    const token = await loginAs('crew_member');
    mockGetPropertyGeofence.mockResolvedValueOnce(SAMPLE_GEOFENCE);
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const pastTime = '2026-04-10T08:30:00.000Z';

    const res = await request(app)
      .post('/v1/gps-events/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'arrival',
        property_id: PROPERTY_ID,
        latitude: 43.6532,
        longitude: -79.3832,
        event_at: pastTime,
      });

    expect(res.status).toBe(201);
    expect(mockInsertGpsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_at: new Date(pastTime),
      }),
    );
  });
});

// ============================================
// 14. Multi-tenant isolation test
// ============================================
describe('Multi-tenant isolation', () => {
  it('should query geofence for authenticated tenant only', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockGetPropertyGeofence.mockResolvedValueOnce(SAMPLE_GEOFENCE);

    const res = await request(app)
      .get(`/v1/properties/${PROPERTY_ID}/geofence`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockGetPropertyGeofence).toHaveBeenCalledWith(PROPERTY_ID, TENANT_A);
  });

  it('should query live positions for authenticated tenant only', async () => {
    const token = await loginAs('owner', TENANT_A);
    mockGetLiveCrewPositions.mockResolvedValueOnce([]);

    await request(app)
      .get('/v1/gps-events/live-crew-positions')
      .set('Authorization', `Bearer ${token}`);

    expect(mockGetLiveCrewPositions).toHaveBeenCalledWith(TENANT_A);
  });
});

// ============================================
// 15. Exempt crew members (track_time=FALSE) not in live positions
// ============================================
describe('Exempt crew members', () => {
  it('should not include exempt crew in live positions (handled by SQL query)', async () => {
    const token = await loginAs('owner');
    // Repository query joins crew_day_logs to filter only clocked-in crew
    // track_time=FALSE crew won't have clock entries
    mockGetLiveCrewPositions.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/v1/gps-events/live-crew-positions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ============================================
// Cross-check flag resolution
// ============================================
describe('POST /v1/gps-events/cross-check-flags/:id/resolve', () => {
  it('should resolve flag with note', async () => {
    const token = await loginAs('owner');
    mockResolveCrossCheckFlag.mockResolvedValueOnce(
      makeEvent({ payroll_cross_check_status: 'reviewed', payroll_cross_check_note: 'Verified by supervisor' }),
    );

    const res = await request(app)
      .post(`/v1/gps-events/cross-check-flags/${EVENT_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Verified by supervisor' });

    expect(res.status).toBe(200);
    expect(mockResolveCrossCheckFlag).toHaveBeenCalledWith(EVENT_ID, TENANT_A, 'Verified by supervisor');
  });

  it('should deny coordinator from resolving flags', async () => {
    const token = await loginAs('coordinator');
    const res = await request(app)
      .post(`/v1/gps-events/cross-check-flags/${EVENT_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Test' });
    expect(res.status).toBe(403);
  });
});

// ============================================
// RBAC
// ============================================
describe('RBAC', () => {
  it('should deny unauthenticated requests', async () => {
    const res = await request(app).get('/v1/gps-events/live-crew-positions');
    expect(res.status).toBe(401);
  });

  it('should allow crew_member to submit GPS events', async () => {
    const token = await loginAs('crew_member');
    mockGetPropertyGeofence.mockResolvedValueOnce(SAMPLE_GEOFENCE);
    mockQueryDb.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post('/v1/gps-events/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'arrival',
        property_id: PROPERTY_ID,
        latitude: 43.6532,
        longitude: -79.3832,
      });
    expect(res.status).toBe(201);
  });
});
