/**
 * Wave 7 Brief 04 — Service Package Analytics (I-5) tests.
 *
 * Verifies:
 *   GET /v1/reports/season-completion      (owner/div_mgr/coordinator)
 *   GET /v1/reports/occurrence-status      (owner/div_mgr/coordinator)
 *   GET /v1/reports/skipped-visits         (owner/div_mgr/coordinator)
 *   GET /v1/reports/tier-performance       (owner only)
 *
 * All four support `?format=csv` for download.
 *
 * Repository is mocked so SQL is never executed; tests assert response
 * shape, filter passthrough, role guards, and CSV formatting.
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

// Mock reports repository — inject only the 4 new functions we care about,
// plus the V1 ones used by other reports routes (stubbed to no-op).
const mockGetSeasonCompletion = vi.fn();
const mockGetOccurrenceStatus = vi.fn();
const mockGetSkippedVisits = vi.fn();
const mockGetTierPerformance = vi.fn();

vi.mock('../repository.js', () => ({
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
  getSeasonCompletion: (...a: unknown[]) => mockGetSeasonCompletion(...a),
  getOccurrenceStatus: (...a: unknown[]) => mockGetOccurrenceStatus(...a),
  getSkippedVisits: (...a: unknown[]) => mockGetSkippedVisits(...a),
  getTierPerformance: (...a: unknown[]) => mockGetTierPerformance(...a),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';

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
// R-PKG-01: season-completion
// ============================================
describe('GET /v1/reports/season-completion', () => {
  it('returns rows + totals + is_complete flag for each service', async () => {
    const token = await loginAs('coordinator');
    mockGetSeasonCompletion.mockResolvedValue([
      { service_code: 'FERT', service_name: 'Fertilization', per_season: 5, total: 100,
        done: 60, assigned: 20, pending: 15, skipped: 5, completion_rate: 80 },
      { service_code: 'AERATE', service_name: 'Aeration', per_season: 1, total: 40,
        done: 40, assigned: 0, pending: 0, skipped: 0, completion_rate: 100 },
    ]);

    const res = await request(app)
      .get('/v1/reports/season-completion?season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.season_year).toBe(2026);
    expect(res.body.data.rows).toHaveLength(2);

    // Totals summed across rows
    expect(res.body.data.totals.total).toBe(140);
    expect(res.body.data.totals.done).toBe(100);
    expect(res.body.data.totals.skipped).toBe(5);

    // is_complete true when pending=0 and skipped=0
    const aerate = res.body.data.rows.find((r: { service_code: string }) => r.service_code === 'AERATE');
    expect(aerate.is_complete).toBe(true);
    const fert = res.body.data.rows.find((r: { service_code: string }) => r.service_code === 'FERT');
    expect(fert.is_complete).toBe(false);
  });

  it('defaults season_year to current year when omitted', async () => {
    const token = await loginAs('owner');
    mockGetSeasonCompletion.mockResolvedValue([]);

    const res = await request(app)
      .get('/v1/reports/season-completion')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockGetSeasonCompletion).toHaveBeenCalledWith(
      TENANT_A,
      new Date().getFullYear(),
      undefined,
      undefined,
    );
  });

  it('passes tier and division filters through to repo', async () => {
    const token = await loginAs('owner');
    mockGetSeasonCompletion.mockResolvedValue([]);

    await request(app)
      .get('/v1/reports/season-completion?season_year=2026&tier=gold&division=landscaping_maintenance')
      .set('Authorization', `Bearer ${token}`);

    expect(mockGetSeasonCompletion).toHaveBeenCalledWith(
      TENANT_A, 2026, 'landscaping_maintenance', 'gold',
    );
  });

  it('tier filter accepts only gold/silver (bronze rejected — no occurrences for Bronze)', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/reports/season-completion?tier=bronze')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('empty result set: totals zeroed, rows empty', async () => {
    const token = await loginAs('owner');
    mockGetSeasonCompletion.mockResolvedValue([]);

    const res = await request(app)
      .get('/v1/reports/season-completion?season_year=2099')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(0);
    expect(res.body.data.totals.total).toBe(0);
    expect(res.body.data.totals.completion_rate).toBe(0);
  });

  it('role guard: coordinator allowed; crew_member rejected with 403', async () => {
    const crewToken = await loginAs('crew_member');
    const rejected = await request(app)
      .get('/v1/reports/season-completion')
      .set('Authorization', `Bearer ${crewToken}`);
    expect(rejected.status).toBe(403);

    const coordToken = await loginAs('coordinator');
    mockGetSeasonCompletion.mockResolvedValue([]);
    const allowed = await request(app)
      .get('/v1/reports/season-completion')
      .set('Authorization', `Bearer ${coordToken}`);
    expect(allowed.status).toBe(200);
  });

  it('format=csv returns text/csv with column headers', async () => {
    const token = await loginAs('owner');
    mockGetSeasonCompletion.mockResolvedValue([
      { service_code: 'FERT', service_name: 'Fertilization', per_season: 5, total: 10,
        done: 5, assigned: 3, pending: 1, skipped: 1, completion_rate: 80 },
    ]);

    const res = await request(app)
      .get('/v1/reports/season-completion?format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('service_code,service_name,per_season');
    expect(res.text).toContain('FERT,Fertilization,5');
  });
});

// ============================================
// R-PKG-02: occurrence-status
// ============================================
describe('GET /v1/reports/occurrence-status', () => {
  const sampleRow = {
    occurrence_id: '11111111-1111-1111-1111-111111111111',
    service_code: 'FERT',
    service_name: 'Fertilization',
    occurrence_number: 2,
    status: 'assigned',
    assigned_date: '2026-06-15',
    preferred_month: 'June',
    customer_id: '22222222-2222-2222-2222-222222222222',
    customer_name: 'Acme Co',
    customer_number: 'SS-0042',
    property_id: '33333333-3333-3333-3333-333333333333',
    street_address: '123 Elm St',
    city: 'Toronto',
    property_category: 'commercial',
    job_id: '44444444-4444-4444-4444-444444444444',
    job_number: '0100-26',
    service_tier: 'gold',
  };

  it('requires service_code (400 when missing)', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get('/v1/reports/occurrence-status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns rows + per-status totals for a single service_code', async () => {
    const token = await loginAs('coordinator');
    mockGetOccurrenceStatus.mockResolvedValue([
      { ...sampleRow, status: 'assigned' },
      { ...sampleRow, occurrence_id: 'x', status: 'pending' },
      { ...sampleRow, occurrence_id: 'y', status: 'completed' },
      { ...sampleRow, occurrence_id: 'z', status: 'skipped' },
    ]);

    const res = await request(app)
      .get('/v1/reports/occurrence-status?service_code=FERT&season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.service_code).toBe('FERT');
    expect(res.body.data.totals).toEqual({
      pending: 1, assigned: 1, completed: 1, skipped: 1,
    });
    expect(res.body.data.rows).toHaveLength(4);
  });

  it('passes status and category filters through', async () => {
    const token = await loginAs('owner');
    mockGetOccurrenceStatus.mockResolvedValue([]);

    await request(app)
      .get('/v1/reports/occurrence-status?service_code=FERT&season_year=2026&status=pending&category=commercial')
      .set('Authorization', `Bearer ${token}`);

    expect(mockGetOccurrenceStatus).toHaveBeenCalledWith(
      TENANT_A,
      'FERT',
      2026,
      expect.objectContaining({ status: 'pending', category: 'commercial' }),
    );
  });

  it('empty rows produces empty totals and null service_name', async () => {
    const token = await loginAs('owner');
    mockGetOccurrenceStatus.mockResolvedValue([]);

    const res = await request(app)
      .get('/v1/reports/occurrence-status?service_code=UNKNOWN&season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.service_name).toBeNull();
    expect(res.body.data.totals).toEqual({ pending: 0, assigned: 0, completed: 0, skipped: 0 });
  });

  it('role guard: crew_member rejected; div_mgr allowed', async () => {
    const crewToken = await loginAs('crew_member');
    const rejected = await request(app)
      .get('/v1/reports/occurrence-status?service_code=FERT')
      .set('Authorization', `Bearer ${crewToken}`);
    expect(rejected.status).toBe(403);

    const divMgrToken = await loginAs('div_mgr');
    mockGetOccurrenceStatus.mockResolvedValue([]);
    const allowed = await request(app)
      .get('/v1/reports/occurrence-status?service_code=FERT')
      .set('Authorization', `Bearer ${divMgrToken}`);
    expect(allowed.status).toBe(200);
  });

  it('format=csv yields a CSV body with key columns', async () => {
    const token = await loginAs('owner');
    mockGetOccurrenceStatus.mockResolvedValue([sampleRow]);

    const res = await request(app)
      .get('/v1/reports/occurrence-status?service_code=FERT&format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\n')[0]).toContain('occurrence_id');
    expect(res.text).toContain('Acme Co');
    expect(res.text).toContain('gold');
  });
});

// ============================================
// R-PKG-03: skipped-visits
// ============================================
describe('GET /v1/reports/skipped-visits', () => {
  const sampleRow = {
    id: '11111111-1111-1111-1111-111111111111',
    skipped_date: '2026-06-10',
    skipped_reason: 'rain',
    recovery_date: '2026-06-12',
    occurrence_number: 2,
    service_name: 'Mowing',
    is_included_in_invoice: true,
    customer_name: 'Acme',
    customer_number: 'SS-0042',
    street_address: '123 Elm',
    service_tier: 'bronze',
    bronze_billing_type: 'per_cut',
  };

  it('returns totals + by_reason grouping + enriched rows', async () => {
    const token = await loginAs('coordinator');
    mockGetSkippedVisits.mockResolvedValue([
      { ...sampleRow, skipped_reason: 'rain', recovery_date: '2026-06-12' },
      { ...sampleRow, id: 'b', skipped_reason: 'rain', recovery_date: null },
      { ...sampleRow, id: 'c', skipped_reason: 'client_request', recovery_date: null },
    ]);

    const res = await request(app)
      .get('/v1/reports/skipped-visits?season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.total).toBe(3);
    expect(res.body.data.totals.recovered).toBe(1);
    expect(res.body.data.totals.unrecovered).toBe(2);
    expect(res.body.data.totals.by_reason).toEqual({ rain: 2, client_request: 1 });
    expect(res.body.data.rows).toHaveLength(3);
  });

  it('billing_impact: Bronze per-cut recovered → "Recovered"; non-recovered → "Excluded"', async () => {
    const token = await loginAs('owner');
    mockGetSkippedVisits.mockResolvedValue([
      { ...sampleRow, service_tier: 'bronze', bronze_billing_type: 'per_cut', recovery_date: '2026-06-12' },
      { ...sampleRow, id: 'x', service_tier: 'bronze', bronze_billing_type: 'per_cut', recovery_date: null },
    ]);

    const res = await request(app)
      .get('/v1/reports/skipped-visits')
      .set('Authorization', `Bearer ${token}`);

    const impacts = res.body.data.rows.map((r: { billing_impact: string }) => r.billing_impact);
    expect(impacts).toEqual(['Recovered', 'Excluded']);
  });

  it('billing_impact: Gold/Silver/Bronze-flat → "None" regardless of recovery', async () => {
    const token = await loginAs('owner');
    mockGetSkippedVisits.mockResolvedValue([
      { ...sampleRow, service_tier: 'gold', bronze_billing_type: null, recovery_date: null },
      { ...sampleRow, id: 's', service_tier: 'silver', bronze_billing_type: null, recovery_date: '2026-06-12' },
      { ...sampleRow, id: 'bf', service_tier: 'bronze', bronze_billing_type: 'flat_monthly', recovery_date: null },
    ]);

    const res = await request(app)
      .get('/v1/reports/skipped-visits')
      .set('Authorization', `Bearer ${token}`);

    const impacts = res.body.data.rows.map((r: { billing_impact: string }) => r.billing_impact);
    expect(impacts.every((i: string) => i === 'None')).toBe(true);
  });

  it('passes date range and tier filters through', async () => {
    const token = await loginAs('owner');
    mockGetSkippedVisits.mockResolvedValue([]);

    await request(app)
      .get('/v1/reports/skipped-visits?season_year=2026&tier=bronze&from_date=2026-04-01&to_date=2026-10-31')
      .set('Authorization', `Bearer ${token}`);

    expect(mockGetSkippedVisits).toHaveBeenCalledWith(
      TENANT_A,
      2026,
      expect.objectContaining({
        tier: 'bronze',
        from_date: '2026-04-01',
        to_date: '2026-10-31',
      }),
    );
  });

  it('role guard: crew_member rejected', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get('/v1/reports/skipped-visits')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('invalid from_date format → 400', async () => {
    const token = await loginAs('owner');
    const res = await request(app)
      .get('/v1/reports/skipped-visits?from_date=not-a-date')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('format=csv yields a CSV response', async () => {
    const token = await loginAs('owner');
    mockGetSkippedVisits.mockResolvedValue([sampleRow]);

    const res = await request(app)
      .get('/v1/reports/skipped-visits?format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Acme');
    expect(res.text).toContain('Recovered');
  });
});

// ============================================
// R-PKG-04: tier-performance (owner only)
// ============================================
describe('GET /v1/reports/tier-performance', () => {
  const rows = [
    { tier: 'gold', active_contracts: 10, season_revenue: 80000, avg_contract_value: 8000,
      total_occurrences: 130, skipped_visits: 5, service_completion_rate: 90, clients_retained_pct: 85 },
    { tier: 'silver', active_contracts: 5, season_revenue: 30000, avg_contract_value: 6000,
      total_occurrences: 50, skipped_visits: 2, service_completion_rate: 85, clients_retained_pct: 70 },
    { tier: 'bronze', active_contracts: 15, season_revenue: 45000, avg_contract_value: 3000,
      total_occurrences: 0, skipped_visits: 0, service_completion_rate: null, clients_retained_pct: 50 },
  ];

  it('owner: returns rows (Gold, Silver, Bronze) + totals', async () => {
    const token = await loginAs('owner');
    mockGetTierPerformance.mockResolvedValue(rows);

    const res = await request(app)
      .get('/v1/reports/tier-performance?season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.season_year).toBe(2026);
    expect(res.body.data.rows).toHaveLength(3);
    expect(res.body.data.rows.map((r: { tier: string }) => r.tier)).toEqual(['gold', 'silver', 'bronze']);
    expect(res.body.data.totals.active_contracts).toBe(30);
    expect(res.body.data.totals.season_revenue).toBe(155000);
  });

  it('Bronze row has null service_completion_rate (no occurrences)', async () => {
    const token = await loginAs('owner');
    mockGetTierPerformance.mockResolvedValue(rows);

    const res = await request(app)
      .get('/v1/reports/tier-performance?season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    const bronze = res.body.data.rows.find((r: { tier: string }) => r.tier === 'bronze');
    expect(bronze.service_completion_rate).toBeNull();
  });

  it('role guard: div_mgr rejected with 403 (owner-only)', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .get('/v1/reports/tier-performance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('role guard: coordinator rejected with 403', async () => {
    const token = await loginAs('coordinator');
    const res = await request(app)
      .get('/v1/reports/tier-performance')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('zeroed rows when no data', async () => {
    const token = await loginAs('owner');
    mockGetTierPerformance.mockResolvedValue([
      { tier: 'gold', active_contracts: 0, season_revenue: 0, avg_contract_value: 0,
        total_occurrences: 0, skipped_visits: 0, service_completion_rate: 0, clients_retained_pct: 0 },
      { tier: 'silver', active_contracts: 0, season_revenue: 0, avg_contract_value: 0,
        total_occurrences: 0, skipped_visits: 0, service_completion_rate: 0, clients_retained_pct: 0 },
      { tier: 'bronze', active_contracts: 0, season_revenue: 0, avg_contract_value: 0,
        total_occurrences: 0, skipped_visits: 0, service_completion_rate: null, clients_retained_pct: 0 },
    ]);

    const res = await request(app)
      .get('/v1/reports/tier-performance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.active_contracts).toBe(0);
    expect(res.body.data.totals.season_revenue).toBe(0);
  });

  it('format=csv yields a CSV response for owner', async () => {
    const token = await loginAs('owner');
    mockGetTierPerformance.mockResolvedValue(rows);

    const res = await request(app)
      .get('/v1/reports/tier-performance?format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('tier,active_contracts,season_revenue');
    expect(res.text).toContain('gold,10,80000');
  });
});
