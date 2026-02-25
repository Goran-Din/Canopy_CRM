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

// --- Mock snow repository ---
const mockFindAllSeasons = vi.fn();
const mockFindSeasonById = vi.fn();
const mockGetActiveSeason = vi.fn();
const mockCreateSeason = vi.fn();
const mockUpdateSeason = vi.fn();
const mockSoftDeleteSeason = vi.fn();
const mockFindAllRuns = vi.fn();
const mockFindRunById = vi.fn();
const mockCreateRun = vi.fn();
const mockUpdateRun = vi.fn();
const mockUpdateRunStatus = vi.fn();
const mockGenerateRunNumber = vi.fn();
const mockUpdateTotalPropertiesServiced = vi.fn();
const mockFindEntriesByRunId = vi.fn();
const mockFindEntryById = vi.fn();
const mockCreateEntry = vi.fn();
const mockUpdateEntry = vi.fn();
const mockUpdateEntryStatus = vi.fn();
const mockGetSnowContractProperties = vi.fn();
const mockBulkCreateEntries = vi.fn();
const mockGetStats = vi.fn();

vi.mock('../repository.js', () => ({
  findAllSeasons: (...args: unknown[]) => mockFindAllSeasons(...args),
  findSeasonById: (...args: unknown[]) => mockFindSeasonById(...args),
  getActiveSeason: (...args: unknown[]) => mockGetActiveSeason(...args),
  createSeason: (...args: unknown[]) => mockCreateSeason(...args),
  updateSeason: (...args: unknown[]) => mockUpdateSeason(...args),
  softDeleteSeason: (...args: unknown[]) => mockSoftDeleteSeason(...args),
  findAllRuns: (...args: unknown[]) => mockFindAllRuns(...args),
  findRunById: (...args: unknown[]) => mockFindRunById(...args),
  createRun: (...args: unknown[]) => mockCreateRun(...args),
  updateRun: (...args: unknown[]) => mockUpdateRun(...args),
  updateRunStatus: (...args: unknown[]) => mockUpdateRunStatus(...args),
  generateRunNumber: (...args: unknown[]) => mockGenerateRunNumber(...args),
  updateTotalPropertiesServiced: (...args: unknown[]) => mockUpdateTotalPropertiesServiced(...args),
  findEntriesByRunId: (...args: unknown[]) => mockFindEntriesByRunId(...args),
  findEntryById: (...args: unknown[]) => mockFindEntryById(...args),
  createEntry: (...args: unknown[]) => mockCreateEntry(...args),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  updateEntryStatus: (...args: unknown[]) => mockUpdateEntryStatus(...args),
  getSnowContractProperties: (...args: unknown[]) => mockGetSnowContractProperties(...args),
  bulkCreateEntries: (...args: unknown[]) => mockBulkCreateEntries(...args),
  getStats: (...args: unknown[]) => mockGetStats(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const SEASON_ID = '11111111-0000-0000-0000-000000000001';
const RUN_ID = '22222222-0000-0000-0000-000000000001';
const ENTRY_ID = '33333333-0000-0000-0000-000000000001';
const PROPERTY_ID = '44444444-0000-0000-0000-000000000001';
const CONTRACT_ID = '55555555-0000-0000-0000-000000000001';
const CREW_ID = '66666666-0000-0000-0000-000000000001';

const SAMPLE_SEASON = {
  id: SEASON_ID,
  tenant_id: TENANT_A,
  season_name: '2025-2026 Winter',
  start_date: '2025-11-01',
  end_date: '2026-04-30',
  status: 'active',
  default_trigger_inches: 2.0,
  notes: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_RUN = {
  id: RUN_ID,
  tenant_id: TENANT_A,
  season_id: SEASON_ID,
  run_number: 1,
  run_date: '2026-01-15',
  status: 'planned',
  trigger_type: 'snowfall',
  snowfall_inches: 4.5,
  temperature_f: 28.0,
  weather_notes: 'Heavy snowfall expected overnight',
  start_time: null,
  end_time: null,
  total_properties_serviced: 0,
  notes: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  season_name: '2025-2026 Winter',
  entries: [],
};

const SAMPLE_ENTRY = {
  id: ENTRY_ID,
  tenant_id: TENANT_A,
  run_id: RUN_ID,
  property_id: PROPERTY_ID,
  contract_id: CONTRACT_ID,
  crew_id: CREW_ID,
  status: 'pending',
  service_type: 'combination',
  arrival_time: null,
  departure_time: null,
  duration_minutes: null,
  notes: null,
  issue_description: null,
  photos_url: null,
  completed_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  property_name: '123 Main St',
  crew_name: 'Snow Alpha',
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
// SEASONS
// ============================================
describe('GET /v1/snow/seasons', () => {
  it('should return paginated season list', async () => {
    const token = await loginAs('owner');
    mockFindAllSeasons.mockResolvedValue({ rows: [SAMPLE_SEASON], total: 1 });

    const res = await request(app)
      .get('/v1/snow/seasons')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass status filter', async () => {
    const token = await loginAs('coordinator');
    mockFindAllSeasons.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/snow/seasons?status=active')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllSeasons).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('should deny crew_member from listing seasons', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/snow/seasons')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /v1/snow/seasons/:id', () => {
  it('should return season detail', async () => {
    const token = await loginAs('owner');
    mockFindSeasonById.mockResolvedValue(SAMPLE_SEASON);

    const res = await request(app)
      .get(`/v1/snow/seasons/${SEASON_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.season_name).toBe('2025-2026 Winter');
  });

  it('should return 404 for non-existent season', async () => {
    const token = await loginAs('owner');
    mockFindSeasonById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/snow/seasons/${SEASON_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /v1/snow/seasons', () => {
  it('should create a season', async () => {
    const token = await loginAs('owner');
    mockGetActiveSeason.mockResolvedValue(null);
    mockCreateSeason.mockResolvedValue(SAMPLE_SEASON);

    const res = await request(app)
      .post('/v1/snow/seasons')
      .set('Authorization', `Bearer ${token}`)
      .send({
        season_name: '2025-2026 Winter',
        start_date: '2025-11-01',
        end_date: '2026-04-30',
        status: 'active',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.season_name).toBe('2025-2026 Winter');
  });

  it('should reject creating second active season', async () => {
    const token = await loginAs('owner');
    mockGetActiveSeason.mockResolvedValue(SAMPLE_SEASON);

    const res = await request(app)
      .post('/v1/snow/seasons')
      .set('Authorization', `Bearer ${token}`)
      .send({
        season_name: '2026-2027 Winter',
        start_date: '2026-11-01',
        end_date: '2027-04-30',
        status: 'active',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already active');
  });

  it('should allow creating planning season when active exists', async () => {
    const token = await loginAs('owner');
    mockCreateSeason.mockResolvedValue({ ...SAMPLE_SEASON, status: 'planning' });

    const res = await request(app)
      .post('/v1/snow/seasons')
      .set('Authorization', `Bearer ${token}`)
      .send({
        season_name: '2026-2027 Winter',
        start_date: '2026-11-01',
        end_date: '2027-04-30',
      });

    expect(res.status).toBe(201);
  });

  it('should deny coordinator from creating seasons', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/snow/seasons')
      .set('Authorization', `Bearer ${token}`)
      .send({
        season_name: 'Test',
        start_date: '2026-11-01',
        end_date: '2027-04-30',
      });

    expect(res.status).toBe(403);
  });
});

describe('PUT /v1/snow/seasons/:id', () => {
  it('should update a season', async () => {
    const token = await loginAs('owner');
    const updated = { ...SAMPLE_SEASON, default_trigger_inches: 3.0 };
    mockFindSeasonById.mockResolvedValue(SAMPLE_SEASON);
    mockUpdateSeason.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/snow/seasons/${SEASON_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ default_trigger_inches: 3.0 });

    expect(res.status).toBe(200);
  });

  it('should reject setting active when another active season exists', async () => {
    const token = await loginAs('owner');
    const planning = { ...SAMPLE_SEASON, status: 'planning' };
    const otherActive = { ...SAMPLE_SEASON, id: '99999999-0000-0000-0000-000000000099' };
    mockFindSeasonById.mockResolvedValue(planning);
    mockGetActiveSeason.mockResolvedValue(otherActive);

    const res = await request(app)
      .put(`/v1/snow/seasons/${SEASON_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /v1/snow/seasons/:id', () => {
  it('should delete a planning season', async () => {
    const token = await loginAs('owner');
    const planning = { ...SAMPLE_SEASON, status: 'planning' };
    mockFindSeasonById.mockResolvedValue(planning);
    mockSoftDeleteSeason.mockResolvedValue(planning);

    const res = await request(app)
      .delete(`/v1/snow/seasons/${SEASON_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should reject deleting active season', async () => {
    const token = await loginAs('owner');
    mockFindSeasonById.mockResolvedValue(SAMPLE_SEASON); // status: active

    const res = await request(app)
      .delete(`/v1/snow/seasons/${SEASON_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Only planning seasons');
  });
});

// ============================================
// RUNS
// ============================================
describe('GET /v1/snow/runs', () => {
  it('should return paginated run list', async () => {
    const token = await loginAs('crew_leader');
    mockFindAllRuns.mockResolvedValue({ rows: [SAMPLE_RUN], total: 1 });

    const res = await request(app)
      .get('/v1/snow/runs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('should pass season_id and date filters', async () => {
    const token = await loginAs('coordinator');
    mockFindAllRuns.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/snow/runs?season_id=${SEASON_ID}&date_from=2026-01-01&date_to=2026-01-31`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllRuns).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        season_id: SEASON_ID,
        date_from: '2026-01-01',
        date_to: '2026-01-31',
      }),
    );
  });
});

describe('GET /v1/snow/runs/:id', () => {
  it('should return run detail with entries', async () => {
    const token = await loginAs('owner');
    mockFindRunById.mockResolvedValue({
      ...SAMPLE_RUN,
      entries: [SAMPLE_ENTRY],
    });

    const res = await request(app)
      .get(`/v1/snow/runs/${RUN_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.run_number).toBe(1);
    expect(res.body.data.entries).toHaveLength(1);
  });
});

describe('POST /v1/snow/runs', () => {
  it('should create a run with auto-generated run_number', async () => {
    const token = await loginAs('coordinator');
    mockFindSeasonById.mockResolvedValue(SAMPLE_SEASON);
    mockGenerateRunNumber.mockResolvedValue(1);
    mockCreateRun.mockResolvedValue(SAMPLE_RUN);

    const res = await request(app)
      .post('/v1/snow/runs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        season_id: SEASON_ID,
        run_date: '2026-01-15',
        trigger_type: 'snowfall',
        snowfall_inches: 4.5,
      });

    expect(res.status).toBe(201);
    expect(mockGenerateRunNumber).toHaveBeenCalledWith(TENANT_A, SEASON_ID);
  });

  it('should reject run for completed season', async () => {
    const token = await loginAs('coordinator');
    const completed = { ...SAMPLE_SEASON, status: 'completed' };
    mockFindSeasonById.mockResolvedValue(completed);

    const res = await request(app)
      .post('/v1/snow/runs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        season_id: SEASON_ID,
        run_date: '2026-01-15',
        trigger_type: 'snowfall',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Only planning or active seasons');
  });

  it('should deny crew_leader from creating runs', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post('/v1/snow/runs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        season_id: SEASON_ID,
        run_date: '2026-01-15',
        trigger_type: 'snowfall',
      });

    expect(res.status).toBe(403);
  });
});

describe('PUT /v1/snow/runs/:id', () => {
  it('should update a planned run', async () => {
    const token = await loginAs('coordinator');
    const updated = { ...SAMPLE_RUN, snowfall_inches: 6.0 };
    mockFindRunById.mockResolvedValue(SAMPLE_RUN);
    mockUpdateRun.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/snow/runs/${RUN_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ snowfall_inches: 6.0 });

    expect(res.status).toBe(200);
  });

  it('should reject editing completed run', async () => {
    const token = await loginAs('coordinator');
    const completed = { ...SAMPLE_RUN, status: 'completed' };
    mockFindRunById.mockResolvedValue(completed);

    const res = await request(app)
      .put(`/v1/snow/runs/${RUN_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Updated notes' });

    expect(res.status).toBe(409);
  });
});

describe('PATCH /v1/snow/runs/:id/status', () => {
  it('should transition from planned to in_progress', async () => {
    const token = await loginAs('coordinator');
    const inProgress = { ...SAMPLE_RUN, status: 'in_progress' };
    mockFindRunById.mockResolvedValue(SAMPLE_RUN);
    mockUpdateRunStatus.mockResolvedValue(inProgress);

    const res = await request(app)
      .patch(`/v1/snow/runs/${RUN_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
  });

  it('should reject invalid status transition', async () => {
    const token = await loginAs('coordinator');
    mockFindRunById.mockResolvedValue(SAMPLE_RUN); // planned

    const res = await request(app)
      .patch(`/v1/snow/runs/${RUN_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Cannot transition');
  });
});

// ============================================
// ENTRIES
// ============================================
describe('POST /v1/snow/runs/:id/entries', () => {
  it('should add an entry to a run', async () => {
    const token = await loginAs('crew_leader');
    mockFindRunById.mockResolvedValue(SAMPLE_RUN);
    mockCreateEntry.mockResolvedValue(SAMPLE_ENTRY);

    const res = await request(app)
      .post(`/v1/snow/runs/${RUN_ID}/entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        property_id: PROPERTY_ID,
        contract_id: CONTRACT_ID,
        service_type: 'plow',
      });

    expect(res.status).toBe(201);
  });

  it('should return 404 for non-existent run', async () => {
    const token = await loginAs('coordinator');
    mockFindRunById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/v1/snow/runs/${RUN_ID}/entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        property_id: PROPERTY_ID,
        service_type: 'plow',
      });

    expect(res.status).toBe(404);
  });
});

describe('POST /v1/snow/runs/:id/bulk-entries', () => {
  it('should bulk create entries for all snow contract properties', async () => {
    const token = await loginAs('owner');
    mockFindRunById.mockResolvedValue(SAMPLE_RUN);
    mockGetSnowContractProperties.mockResolvedValue([
      { property_id: PROPERTY_ID, contract_id: CONTRACT_ID },
      { property_id: '44444444-0000-0000-0000-000000000002', contract_id: '55555555-0000-0000-0000-000000000002' },
    ]);
    mockBulkCreateEntries.mockResolvedValue([SAMPLE_ENTRY, { ...SAMPLE_ENTRY, id: '33333333-0000-0000-0000-000000000002' }]);

    const res = await request(app)
      .post(`/v1/snow/runs/${RUN_ID}/bulk-entries`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(mockBulkCreateEntries).toHaveBeenCalledWith(
      TENANT_A,
      RUN_ID,
      expect.arrayContaining([
        expect.objectContaining({ property_id: PROPERTY_ID }),
      ]),
    );
  });

  it('should return 404 when no snow contracts found', async () => {
    const token = await loginAs('coordinator');
    mockFindRunById.mockResolvedValue(SAMPLE_RUN);
    mockGetSnowContractProperties.mockResolvedValue([]);

    const res = await request(app)
      .post(`/v1/snow/runs/${RUN_ID}/bulk-entries`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('No properties with active snow removal contracts');
  });

  it('should deny crew_leader from bulk creating entries', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post(`/v1/snow/runs/${RUN_ID}/bulk-entries`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('PUT /v1/snow/entries/:entryId', () => {
  it('should update an entry', async () => {
    const token = await loginAs('crew_leader');
    const updated = { ...SAMPLE_ENTRY, service_type: 'plow' };
    mockFindEntryById.mockResolvedValue(SAMPLE_ENTRY);
    mockUpdateEntry.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/snow/entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ service_type: 'plow' });

    expect(res.status).toBe(200);
  });

  it('should calculate duration from arrival and departure times', async () => {
    const token = await loginAs('coordinator');
    const withTimes = {
      ...SAMPLE_ENTRY,
      arrival_time: '2026-01-15T06:00:00Z',
    };
    mockFindEntryById.mockResolvedValue(withTimes);
    mockUpdateEntry.mockResolvedValue({ ...withTimes, departure_time: '2026-01-15T06:45:00Z', duration_minutes: 45 });

    await request(app)
      .put(`/v1/snow/entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ departure_time: '2026-01-15T06:45:00Z' });

    // Verify duration_minutes was calculated and passed to repo
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      TENANT_A,
      ENTRY_ID,
      expect.objectContaining({ duration_minutes: 45 }),
    );
  });

  it('should deny crew_member from updating entries', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .put(`/v1/snow/entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ service_type: 'salt' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /v1/snow/entries/:entryId/status', () => {
  it('should update entry status to completed', async () => {
    const token = await loginAs('crew_leader');
    const completed = { ...SAMPLE_ENTRY, status: 'completed', completed_by: USER_ID };
    mockFindEntryById.mockResolvedValue(SAMPLE_ENTRY);
    mockUpdateEntryStatus.mockResolvedValue(completed);
    mockUpdateTotalPropertiesServiced.mockResolvedValue(undefined);

    const res = await request(app)
      .patch(`/v1/snow/entries/${ENTRY_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    // Verify total_properties_serviced was updated
    expect(mockUpdateTotalPropertiesServiced).toHaveBeenCalledWith(TENANT_A, RUN_ID);
  });

  it('should update entry status to skipped without updating total', async () => {
    const token = await loginAs('crew_member');
    const skipped = { ...SAMPLE_ENTRY, status: 'skipped' };
    mockFindEntryById.mockResolvedValue(SAMPLE_ENTRY);
    mockUpdateEntryStatus.mockResolvedValue(skipped);

    const res = await request(app)
      .patch(`/v1/snow/entries/${ENTRY_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'skipped' });

    expect(res.status).toBe(200);
    // Not completed, so total not updated
    expect(mockUpdateTotalPropertiesServiced).not.toHaveBeenCalled();
  });

  it('should allow crew_member to update entry status', async () => {
    const token = await loginAs('crew_member');
    mockFindEntryById.mockResolvedValue(SAMPLE_ENTRY);
    mockUpdateEntryStatus.mockResolvedValue({ ...SAMPLE_ENTRY, status: 'in_progress' });

    const res = await request(app)
      .patch(`/v1/snow/entries/${ENTRY_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
  });
});

// ============================================
// STATS
// ============================================
describe('GET /v1/snow/stats', () => {
  it('should return snow statistics', async () => {
    const token = await loginAs('owner');
    mockGetStats.mockResolvedValue({
      totalRuns: '15',
      avgPropertiesPerRun: '12.5',
      totalSnowfall: '45.5',
      completedEntries: '180',
    });

    const res = await request(app)
      .get('/v1/snow/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalRuns).toBe('15');
    expect(res.body.data.totalSnowfall).toBe('45.5');
  });

  it('should deny coordinator from viewing stats', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/snow/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// TENANT ISOLATION
// ============================================
describe('Tenant isolation', () => {
  it('should scope seasons to authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_B);
    mockFindAllSeasons.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/snow/seasons')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllSeasons).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });

  it('should scope runs to authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_B);
    mockFindAllRuns.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/snow/runs')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllRuns).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });
});
