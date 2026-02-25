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

// --- Mock reports repository ---
const mockRevenueSummary = vi.fn();
const mockRevenueByDivision = vi.fn();
const mockRevenueByCustomer = vi.fn();
const mockInvoiceAging = vi.fn();
const mockContractRenewals = vi.fn();
const mockCrewProductivity = vi.fn();
const mockTimeTrackingSummary = vi.fn();
const mockSnowProfitability = vi.fn();
const mockHardscapePipeline = vi.fn();
const mockProspectConversion = vi.fn();
const mockEquipmentSummary = vi.fn();
const mockMaterialUsage = vi.fn();

vi.mock('../repository.js', () => ({
  getRevenueSummary: (...args: unknown[]) => mockRevenueSummary(...args),
  getRevenueByDivision: (...args: unknown[]) => mockRevenueByDivision(...args),
  getRevenueByCustomer: (...args: unknown[]) => mockRevenueByCustomer(...args),
  getInvoiceAging: (...args: unknown[]) => mockInvoiceAging(...args),
  getContractRenewals: (...args: unknown[]) => mockContractRenewals(...args),
  getCrewProductivity: (...args: unknown[]) => mockCrewProductivity(...args),
  getTimeTrackingSummary: (...args: unknown[]) => mockTimeTrackingSummary(...args),
  getSnowProfitability: (...args: unknown[]) => mockSnowProfitability(...args),
  getHardscapePipeline: (...args: unknown[]) => mockHardscapePipeline(...args),
  getProspectConversion: (...args: unknown[]) => mockProspectConversion(...args),
  getEquipmentSummary: (...args: unknown[]) => mockEquipmentSummary(...args),
  getMaterialUsage: (...args: unknown[]) => mockMaterialUsage(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';

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
// Revenue Summary
// ============================================
describe('GET /v1/reports/revenue-summary', () => {
  it('should return revenue summary for owner', async () => {
    const token = await loginAs('owner');
    mockRevenueSummary.mockResolvedValue({
      monthly: [{ period: '2026-01', revenue: '15000' }],
      ytd: '15000',
      priorYtd: '12000',
    });

    const res = await request(app)
      .get('/v1/reports/revenue-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.monthly).toHaveLength(1);
    expect(res.body.data.ytd).toBe('15000');
    expect(res.body.data.priorYtd).toBe('12000');
  });

  it('should pass date range and division filters', async () => {
    const token = await loginAs('owner');
    mockRevenueSummary.mockResolvedValue({ monthly: [], ytd: '0', priorYtd: '0' });

    await request(app)
      .get('/v1/reports/revenue-summary?date_from=2026-01-01&date_to=2026-01-31&division=snow_removal')
      .set('Authorization', `Bearer ${token}`);

    expect(mockRevenueSummary).toHaveBeenCalledWith(TENANT_A, '2026-01-01', '2026-01-31', 'snow_removal');
  });

  it('should deny crew_member access', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .get('/v1/reports/revenue-summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ============================================
// Revenue by Division
// ============================================
describe('GET /v1/reports/revenue-by-division', () => {
  it('should return revenue breakdown by division', async () => {
    const token = await loginAs('div_mgr');
    mockRevenueByDivision.mockResolvedValue([
      { division: 'landscaping_maintenance', revenue: '8000' },
      { division: 'snow_removal', revenue: '7000' },
    ]);

    const res = await request(app)
      .get('/v1/reports/revenue-by-division')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].division).toBe('landscaping_maintenance');
  });
});

// ============================================
// Revenue by Customer
// ============================================
describe('GET /v1/reports/revenue-by-customer', () => {
  it('should return top customers by revenue', async () => {
    const token = await loginAs('owner');
    mockRevenueByCustomer.mockResolvedValue([
      { customer_id: 'c1', customer_name: 'Acme Corp', revenue: '5000', invoice_count: '3' },
    ]);

    const res = await request(app)
      .get('/v1/reports/revenue-by-customer?limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].customer_name).toBe('Acme Corp');
  });
});

// ============================================
// Invoice Aging
// ============================================
describe('GET /v1/reports/invoice-aging', () => {
  it('should return aging buckets', async () => {
    const token = await loginAs('owner');
    mockInvoiceAging.mockResolvedValue([
      { bucket: 'current', total: '5000', count: '3' },
      { bucket: '30_days', total: '2000', count: '1' },
      { bucket: '90_plus', total: '800', count: '2' },
    ]);

    const res = await request(app)
      .get('/v1/reports/invoice-aging')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].bucket).toBe('current');
  });
});

// ============================================
// Contract Renewals
// ============================================
describe('GET /v1/reports/contract-renewals', () => {
  it('should return expiring contracts', async () => {
    const token = await loginAs('owner');
    mockContractRenewals.mockResolvedValue([
      { id: 'c1', contract_number: 'SC-2026-001', customer_name: 'John Doe', end_date: '2026-03-15', total_value: '5000', division: 'landscaping_maintenance', days_until_expiry: '18' },
    ]);

    const res = await request(app)
      .get('/v1/reports/contract-renewals?days_ahead=30')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].contract_number).toBe('SC-2026-001');
  });
});

// ============================================
// Crew Productivity
// ============================================
describe('GET /v1/reports/crew-productivity', () => {
  it('should return crew productivity metrics', async () => {
    const token = await loginAs('owner');
    mockCrewProductivity.mockResolvedValue([
      { crew_id: 'cr1', crew_name: 'Alpha Crew', jobs_completed: '25', total_estimated_minutes: '3000', total_actual_minutes: '2800', avg_efficiency: '107.1' },
    ]);

    const res = await request(app)
      .get('/v1/reports/crew-productivity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].crew_name).toBe('Alpha Crew');
    expect(res.body.data[0].avg_efficiency).toBe('107.1');
  });
});

// ============================================
// Time Tracking Summary
// ============================================
describe('GET /v1/reports/time-tracking-summary', () => {
  it('should return time tracking with overtime detection', async () => {
    const token = await loginAs('owner');
    mockTimeTrackingSummary.mockResolvedValue([
      { user_id: 'u1', user_name: 'John Doe', crew_name: 'Alpha', total_hours: '45.50', regular_hours: '40.00', overtime_hours: '5.50', division: 'landscaping_maintenance' },
    ]);

    const res = await request(app)
      .get('/v1/reports/time-tracking-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].overtime_hours).toBe('5.50');
  });
});

// ============================================
// Snow Profitability
// ============================================
describe('GET /v1/reports/snow-profitability', () => {
  it('should return snow season profitability', async () => {
    const token = await loginAs('owner');
    mockSnowProfitability.mockResolvedValue([
      { season_id: 's1', season_name: 'Winter 2025-2026', total_runs: '15', total_entries: '120', total_revenue: '25000', total_labor_cost: '12000', profit: '13000' },
    ]);

    const res = await request(app)
      .get('/v1/reports/snow-profitability')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].profit).toBe('13000');
  });
});

// ============================================
// Hardscape Pipeline
// ============================================
describe('GET /v1/reports/hardscape-pipeline', () => {
  it('should return pipeline stats by stage', async () => {
    const token = await loginAs('owner');
    mockHardscapePipeline.mockResolvedValue({
      byStage: [
        { stage: 'lead', count: '5', total_value: '50000', avg_value: '10000' },
        { stage: 'quoted', count: '3', total_value: '45000', avg_value: '15000' },
      ],
      metrics: { total_projects: '20', won: '8', lost: '4', win_rate: '66.7', avg_days_to_close: '45' },
    });

    const res = await request(app)
      .get('/v1/reports/hardscape-pipeline')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.byStage).toHaveLength(2);
    expect(res.body.data.metrics.win_rate).toBe('66.7');
  });
});

// ============================================
// Prospect Conversion
// ============================================
describe('GET /v1/reports/prospect-conversion', () => {
  it('should return conversion rates by source', async () => {
    const token = await loginAs('owner');
    mockProspectConversion.mockResolvedValue([
      { source: 'referral', total: '20', converted: '8', conversion_rate: '40.0', total_value: '80000' },
      { source: 'website', total: '15', converted: '3', conversion_rate: '20.0', total_value: '35000' },
    ]);

    const res = await request(app)
      .get('/v1/reports/prospect-conversion')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].conversion_rate).toBe('40.0');
  });
});

// ============================================
// Equipment Summary
// ============================================
describe('GET /v1/reports/equipment-summary', () => {
  it('should return equipment counts by status', async () => {
    const token = await loginAs('owner');
    mockEquipmentSummary.mockResolvedValue([
      { status: 'active', count: '12' },
      { status: 'maintenance', count: '3' },
      { status: 'retired', count: '1' },
    ]);

    const res = await request(app)
      .get('/v1/reports/equipment-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });
});

// ============================================
// Material Usage
// ============================================
describe('GET /v1/reports/material-usage', () => {
  it('should return material usage trends', async () => {
    const token = await loginAs('owner');
    mockMaterialUsage.mockResolvedValue([
      { category: 'fertilizer', month: '2026-01', total_quantity: '500', total_cost: '2500' },
    ]);

    const res = await request(app)
      .get('/v1/reports/material-usage?date_from=2026-01-01&date_to=2026-01-31')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category).toBe('fertilizer');
  });
});

// ============================================
// Access Control
// ============================================
describe('Report access control', () => {
  it('should allow div_mgr access to reports', async () => {
    const token = await loginAs('div_mgr');
    mockRevenueSummary.mockResolvedValue({ monthly: [], ytd: '0', priorYtd: '0' });

    const res = await request(app)
      .get('/v1/reports/revenue-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny coordinator access to reports', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/reports/revenue-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny unauthenticated access', async () => {
    const res = await request(app).get('/v1/reports/revenue-summary');
    expect(res.status).toBe(401);
  });

  it('should scope queries to tenant', async () => {
    const token = await loginAs('owner');
    mockRevenueSummary.mockResolvedValue({ monthly: [], ytd: '0', priorYtd: '0' });

    await request(app)
      .get('/v1/reports/revenue-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(mockRevenueSummary).toHaveBeenCalledWith(TENANT_A, undefined, undefined, undefined);
  });
});
