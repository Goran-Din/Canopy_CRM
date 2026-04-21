/**
 * Wave 7 Brief 05 — GPS Analytics (I-3 v2) tests.
 *
 * Endpoints:
 *   GET  /v1/reports/property-visit-history               owner/div_mgr/coordinator
 *   GET  /v1/reports/payroll-cross-check                   owner only
 *   POST /v1/reports/payroll-cross-check/:id/resolve       owner only
 *   GET  /v1/reports/service-verification                  owner/div_mgr/coordinator
 *   GET  /v1/reports/route-performance                     owner/div_mgr
 *
 * Repository is mocked. Tests verify response shape, filter passthrough,
 * role guards, CSV export, and the Resolve action.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

vi.mock('../../../config/database.js', () => ({
  queryDb: vi.fn(),
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }), on: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  getClient: vi.fn(),
}));

vi.mock('../../../config/redis.js', () => ({
  redis: { isOpen: true, ping: vi.fn().mockResolvedValue('PONG'), connect: vi.fn(), on: vi.fn() },
  connectRedis: vi.fn(),
}));

const mockFindUserByEmail = vi.fn();
const mockFindUserRoles = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockUpdateLastLogin = vi.fn();

vi.mock('../../auth/repository.js', () => ({
  findUserByEmail: (...a: unknown[]) => mockFindUserByEmail(...a),
  findUserById: vi.fn(),
  findUserRoles: (...a: unknown[]) => mockFindUserRoles(...a),
  saveRefreshToken: (...a: unknown[]) => mockSaveRefreshToken(...a),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  updateLastLogin: (...a: unknown[]) => mockUpdateLastLogin(...a),
}));

const mockPropertyVisitHistory = vi.fn();
const mockPayrollCrossCheck = vi.fn();
const mockResolvePayrollCrossCheck = vi.fn();
const mockServiceVerification = vi.fn();
const mockRoutePerformance = vi.fn();

vi.mock('../repository.js', () => ({
  // V1
  getRevenueSummary: vi.fn(),
  getRevenueByDivision: vi.fn(),
  getRevenueByCustomer: vi.fn(),
  getInvoiceAging: vi.fn(),
  getContractRenewals: vi.fn(),
  getCrewProductivity: vi.fn(),
  getTimeTrackingSummary: vi.fn(),
  getSnowProfitability: vi.fn(),
  getHardscapePipeline: vi.fn(),
  getProspectConversion: vi.fn(),
  getEquipmentSummary: vi.fn(),
  getMaterialUsage: vi.fn(),
  // Brief 04
  getSeasonCompletion: vi.fn(),
  getOccurrenceStatus: vi.fn(),
  getSkippedVisits: vi.fn(),
  getTierPerformance: vi.fn(),
  // Brief 05
  getPropertyVisitHistory: (...a: unknown[]) => mockPropertyVisitHistory(...a),
  getPayrollCrossCheck: (...a: unknown[]) => mockPayrollCrossCheck(...a),
  resolvePayrollCrossCheck: (...a: unknown[]) => mockResolvePayrollCrossCheck(...a),
  getServiceVerification: (...a: unknown[]) => mockServiceVerification(...a),
  getRoutePerformance: (...a: unknown[]) => mockRoutePerformance(...a),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const GPS_EVENT_ID = 'ffffffff-0000-0000-0000-00000000ffff';

async function loginAs(role: string) {
  mockFindUserByEmail.mockResolvedValue({
    id: USER_ID, tenant_id: TENANT_A, email: 'test@test.com',
    password_hash: TEST_HASH, first_name: 'Test', last_name: role, is_active: true,
  });
  mockFindUserRoles.mockResolvedValue([{ role_name: role, division_id: null, division_name: null }]);
  mockSaveRefreshToken.mockResolvedValue(undefined);
  mockUpdateLastLogin.mockResolvedValue(undefined);
  const res = await request(app).post('/auth/login').send({
    email: 'test@test.com', password: TEST_PASSWORD,
  });
  return res.body.data.accessToken as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  TEST_HASH = await bcrypt.hash(TEST_PASSWORD, 4);
});

// ============================================
// R-GPS-01 — property-visit-history
// ============================================
describe('GET /v1/reports/property-visit-history', () => {
  const sampleVisit = {
    arrival_at: '2026-06-15T14:00:00Z',
    departure_at: '2026-06-15T14:45:00Z',
    time_on_site_minutes: 45,
    crew_member: 'John Smith',
    job_number: '0100-26',
    verification_status: 'verified',
    distance_from_centre_at_departure: 12.5,
  };

  it('requires property_id query param (400 when missing)', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/reports/property-visit-history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns rows + summary block for a property', async () => {
    const token = await loginAs('coordinator');
    mockPropertyVisitHistory.mockResolvedValue({
      rows: [sampleVisit],
      summary: {
        total_visits: 1, verified_visits: 1,
        avg_time_on_site_minutes: 45,
        scheduled_estimate_minutes: 30,
        variance_minutes: 15,
      },
    });

    const res = await request(app)
      .get(`/v1/reports/property-visit-history?property_id=${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.property_id).toBe(PROPERTY_ID);
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.summary.total_visits).toBe(1);
    expect(res.body.data.summary.variance_minutes).toBe(15);
  });

  it('passes verified_only + crew_member_id + date range through to repo', async () => {
    const token = await loginAs('owner');
    mockPropertyVisitHistory.mockResolvedValue({ rows: [], summary: {
      total_visits: 0, verified_visits: 0, avg_time_on_site_minutes: 0,
      scheduled_estimate_minutes: null, variance_minutes: null,
    } });
    const crewId = '11111111-2222-3333-4444-555555555555';

    await request(app)
      .get(`/v1/reports/property-visit-history?property_id=${PROPERTY_ID}&verified_only=true&crew_member_id=${crewId}&from_date=2026-04-01&to_date=2026-10-31`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockPropertyVisitHistory).toHaveBeenCalledWith(
      TENANT_A,
      PROPERTY_ID,
      expect.objectContaining({
        verified_only: true,
        crew_member_id: crewId,
        from_date: '2026-04-01',
        to_date: '2026-10-31',
      }),
    );
  });

  it('invalid property_id (not a UUID) → 400', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/reports/property-visit-history?property_id=not-a-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('role guard: crew_member rejected with 403', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get(`/v1/reports/property-visit-history?property_id=${PROPERTY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('format=csv returns CSV with header row', async () => {
    const token = await loginAs('owner');
    mockPropertyVisitHistory.mockResolvedValue({
      rows: [sampleVisit],
      summary: { total_visits: 1, verified_visits: 1, avg_time_on_site_minutes: 45,
        scheduled_estimate_minutes: 30, variance_minutes: 15 },
    });

    const res = await request(app)
      .get(`/v1/reports/property-visit-history?property_id=${PROPERTY_ID}&format=csv`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('arrival_at');
    expect(res.text).toContain('John Smith');
  });
});

// ============================================
// R-GPS-02 — payroll-cross-check (owner only)
// ============================================
describe('GET /v1/reports/payroll-cross-check', () => {
  const sampleRow = {
    gps_event_id: GPS_EVENT_ID,
    work_date: '2026-06-15',
    user_id: USER_ID,
    crew_member: 'Jane Doe',
    layer1_minutes: 480,
    layer2_minutes: 450,
    diff_minutes: 30,
    diff_pct: 6.3,
    properties_visited: 4,
    status: 'flagged' as const,
  };

  it('returns rows + totals block (days_reviewed/flagged_count/consistent_count)', async () => {
    const token = await loginAs('owner');
    mockPayrollCrossCheck.mockResolvedValue([
      sampleRow,
      { ...sampleRow, work_date: '2026-06-16', diff_minutes: 5, status: 'consistent' },
    ]);

    const res = await request(app)
      .get('/v1/reports/payroll-cross-check?from_date=2026-06-01&to_date=2026-06-30')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.days_reviewed).toBe(2);
    expect(res.body.data.totals.flagged_count).toBe(1);
    expect(res.body.data.totals.consistent_count).toBe(1);
    expect(res.body.data.rows).toHaveLength(2);
  });

  it('requires from_date and to_date (missing → 400)', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/reports/payroll-cross-check')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('role guard: div_mgr rejected (owner-only)', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .get('/v1/reports/payroll-cross-check?from_date=2026-06-01&to_date=2026-06-30')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('role guard: coordinator rejected', async () => {
    const token = await loginAs('coordinator');
    const res = await request(app)
      .get('/v1/reports/payroll-cross-check?from_date=2026-06-01&to_date=2026-06-30')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('passes user_id and status filters through', async () => {
    const token = await loginAs('owner');
    mockPayrollCrossCheck.mockResolvedValue([]);

    await request(app)
      .get(`/v1/reports/payroll-cross-check?from_date=2026-06-01&to_date=2026-06-30&user_id=${USER_ID}&status=flagged`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockPayrollCrossCheck).toHaveBeenCalledWith(
      TENANT_A,
      '2026-06-01',
      '2026-06-30',
      expect.objectContaining({ user_id: USER_ID, status: 'flagged' }),
    );
  });

  it('diff_pct null when layer1_minutes is 0 (no divide-by-zero)', async () => {
    const token = await loginAs('owner');
    mockPayrollCrossCheck.mockResolvedValue([
      { ...sampleRow, layer1_minutes: 0, diff_pct: null, status: 'flagged' },
    ]);

    const res = await request(app)
      .get('/v1/reports/payroll-cross-check?from_date=2026-06-01&to_date=2026-06-30')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data.rows[0].diff_pct).toBeNull();
  });

  it('format=csv yields a CSV body', async () => {
    const token = await loginAs('owner');
    mockPayrollCrossCheck.mockResolvedValue([sampleRow]);

    const res = await request(app)
      .get('/v1/reports/payroll-cross-check?from_date=2026-06-01&to_date=2026-06-30&format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Jane Doe');
    expect(res.text).toContain('flagged');
  });
});

// ============================================
// POST resolve action
// ============================================
describe('POST /v1/reports/payroll-cross-check/:id/resolve', () => {
  it('records the note and returns reviewed status', async () => {
    const token = await loginAs('owner');
    mockResolvePayrollCrossCheck.mockResolvedValue(true);

    const res = await request(app)
      .post(`/v1/reports/payroll-cross-check/${GPS_EVENT_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Reviewed with crew — difference is legitimate break time' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('reviewed');
    expect(mockResolvePayrollCrossCheck).toHaveBeenCalledWith(
      TENANT_A, GPS_EVENT_ID,
      'Reviewed with crew — difference is legitimate break time',
    );
  });

  it('unknown gps_event_id → 404', async () => {
    const token = await loginAs('owner');
    mockResolvePayrollCrossCheck.mockResolvedValue(false);

    const res = await request(app)
      .post(`/v1/reports/payroll-cross-check/${GPS_EVENT_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'note' });

    expect(res.status).toBe(404);
  });

  it('empty note → 400', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post(`/v1/reports/payroll-cross-check/${GPS_EVENT_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: '' });

    expect(res.status).toBe(400);
  });

  it('non-UUID gps_event_id → 400', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/reports/payroll-cross-check/not-a-uuid/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'test' });

    expect(res.status).toBe(400);
  });

  it('role guard: owner required', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .post(`/v1/reports/payroll-cross-check/${GPS_EVENT_ID}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'test' });

    expect(res.status).toBe(403);
  });
});

// ============================================
// R-GPS-03 — service-verification
// ============================================
describe('GET /v1/reports/service-verification', () => {
  const sample = {
    occurrence_id: '11111111-1111-1111-1111-111111111111',
    customer_name: 'Acme Co',
    street_address: '123 Elm St',
    service_code: 'FERT',
    service_name: 'Fertilization',
    occurrence_label: '2/5',
    assigned_date: '2026-06-15',
    job_number: '0100-26',
    verification_status: 'verified',
    time_on_site_minutes: 45,
    crew_member: 'John Smith',
    service_tier: 'gold',
  };

  it('returns totals (verified/unverified/no_gps/verification_rate) + rows', async () => {
    const token = await loginAs('coordinator');
    mockServiceVerification.mockResolvedValue([
      sample,
      { ...sample, occurrence_id: 'u', verification_status: 'unverified' },
      { ...sample, occurrence_id: 'n', verification_status: 'no_gps' },
    ]);

    const res = await request(app)
      .get('/v1/reports/service-verification?season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals).toEqual({
      total: 3, verified: 1, unverified: 1, no_gps: 1,
      verification_rate: 33.3,
    });
    expect(res.body.data.rows).toHaveLength(3);
  });

  it('verification_rate is 0 when no rows', async () => {
    const token = await loginAs('owner');
    mockServiceVerification.mockResolvedValue([]);

    const res = await request(app)
      .get('/v1/reports/service-verification')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.verification_rate).toBe(0);
  });

  it('filters (service_code, tier, verification, crew_member_id) pass through', async () => {
    const token = await loginAs('owner');
    mockServiceVerification.mockResolvedValue([]);

    await request(app)
      .get(`/v1/reports/service-verification?service_code=FERT&tier=gold&verification=verified&crew_member_id=${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockServiceVerification).toHaveBeenCalledWith(
      TENANT_A,
      new Date().getFullYear(),
      expect.objectContaining({
        service_code: 'FERT',
        tier: 'gold',
        verification: 'verified',
        crew_member_id: USER_ID,
      }),
    );
  });

  it('role guard: crew_member rejected', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get('/v1/reports/service-verification')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('format=csv returns CSV with occurrence_label column', async () => {
    const token = await loginAs('owner');
    mockServiceVerification.mockResolvedValue([sample]);

    const res = await request(app)
      .get('/v1/reports/service-verification?format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('occurrence_label');
    expect(res.text).toContain('2/5');
  });
});

// ============================================
// R-GPS-04 — route-performance
// ============================================
describe('GET /v1/reports/route-performance', () => {
  const sample = {
    property_id: '22222222-2222-2222-2222-222222222222',
    street_address: '45 Oak Ave',
    property_category: 'residential',
    estimated_duration_minutes: 30,
    avg_actual: 42,
    variance_minutes: 12,
    variance_pct: 40,
    visit_count: 8,
    trend: 'stable',
  };

  it('returns rows filtered by min_visit_count', async () => {
    const token = await loginAs('div_mgr');
    mockRoutePerformance.mockResolvedValue([sample]);

    const res = await request(app)
      .get('/v1/reports/route-performance?min_visit_count=3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(1);
    expect(mockRoutePerformance).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ min_visit_count: 3 }),
    );
  });

  it('defaults min_visit_count to 3 when omitted', async () => {
    const token = await loginAs('owner');
    mockRoutePerformance.mockResolvedValue([]);

    await request(app)
      .get('/v1/reports/route-performance')
      .set('Authorization', `Bearer ${token}`);

    expect(mockRoutePerformance).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ min_visit_count: 3 }),
    );
  });

  it('role guard: coordinator rejected (owner/div_mgr only)', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/reports/route-performance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('trend = stable returned verbatim from repo', async () => {
    const token = await loginAs('owner');
    mockRoutePerformance.mockResolvedValue([
      { ...sample, trend: 'increasing' },
      { ...sample, property_id: 'x', trend: 'decreasing' },
      { ...sample, property_id: 'y', trend: 'stable' },
    ]);

    const res = await request(app)
      .get('/v1/reports/route-performance')
      .set('Authorization', `Bearer ${token}`);

    const trends = res.body.data.rows.map((r: { trend: string }) => r.trend);
    expect(trends).toEqual(['increasing', 'decreasing', 'stable']);
  });

  it('format=csv yields a CSV body', async () => {
    const token = await loginAs('owner');
    mockRoutePerformance.mockResolvedValue([sample]);

    const res = await request(app)
      .get('/v1/reports/route-performance?format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('property_id');
    expect(res.text).toContain('45 Oak Ave');
  });
});
