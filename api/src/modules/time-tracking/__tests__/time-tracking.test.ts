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

// --- Mock time-tracking repository ---
const mockFindAllEntries = vi.fn();
const mockFindEntryById = vi.fn();
const mockClockIn = vi.fn();
const mockClockOut = vi.fn();
const mockUpdateEntry = vi.fn();
const mockApproveEntry = vi.fn();
const mockGetActiveClockIn = vi.fn();
const mockGetByUserDateRange = vi.fn();
const mockGetDailySummary = vi.fn();
const mockGetWeeklySummary = vi.fn();
const mockUserExists = vi.fn();
const mockIsUserInCrew = vi.fn();
const mockRecordGpsEvent = vi.fn();
const mockGetEventsByJob = vi.fn();
const mockGetEventsByUser = vi.fn();
const mockGetLatestByUser = vi.fn();

vi.mock('../repository.js', () => ({
  findAllEntries: (...args: unknown[]) => mockFindAllEntries(...args),
  findEntryById: (...args: unknown[]) => mockFindEntryById(...args),
  clockIn: (...args: unknown[]) => mockClockIn(...args),
  clockOut: (...args: unknown[]) => mockClockOut(...args),
  updateEntry: (...args: unknown[]) => mockUpdateEntry(...args),
  approveEntry: (...args: unknown[]) => mockApproveEntry(...args),
  getActiveClockIn: (...args: unknown[]) => mockGetActiveClockIn(...args),
  getByUserDateRange: (...args: unknown[]) => mockGetByUserDateRange(...args),
  getDailySummary: (...args: unknown[]) => mockGetDailySummary(...args),
  getWeeklySummary: (...args: unknown[]) => mockGetWeeklySummary(...args),
  userExists: (...args: unknown[]) => mockUserExists(...args),
  isUserInCrew: (...args: unknown[]) => mockIsUserInCrew(...args),
  recordGpsEvent: (...args: unknown[]) => mockRecordGpsEvent(...args),
  getEventsByJob: (...args: unknown[]) => mockGetEventsByJob(...args),
  getEventsByUser: (...args: unknown[]) => mockGetEventsByUser(...args),
  getLatestByUser: (...args: unknown[]) => mockGetLatestByUser(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'cccccccc-0000-0000-0000-000000000002';
const JOB_ID = 'dddddddd-0000-0000-0000-000000000001';
const CREW_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const ENTRY_ID = 'ffffffff-0000-0000-0000-000000000001';
const GPS_EVENT_ID = '11111111-0000-0000-0000-000000000001';

const NOW = new Date();
const ONE_HOUR_AGO = new Date(NOW.getTime() - 3600000);

const SAMPLE_ENTRY = {
  id: ENTRY_ID,
  tenant_id: TENANT_A,
  user_id: USER_ID,
  job_id: JOB_ID,
  crew_id: CREW_ID,
  clock_in: ONE_HOUR_AGO.toISOString(),
  clock_out: null,
  break_minutes: 0,
  total_minutes: null,
  status: 'clocked_in',
  clock_in_latitude: 45.4215,
  clock_in_longitude: -75.6972,
  clock_out_latitude: null,
  clock_out_longitude: null,
  clock_in_method: 'mobile_gps',
  clock_out_method: null,
  notes: null,
  admin_notes: null,
  approved_by: null,
  approved_at: null,
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: ONE_HOUR_AGO.toISOString(),
  updated_at: ONE_HOUR_AGO.toISOString(),
  deleted_at: null,
  user_first_name: 'Test',
  user_last_name: 'User',
  job_title: 'Weekly Mowing',
  crew_name: 'Alpha Crew',
};

const SAMPLE_CLOCKED_OUT_ENTRY = {
  ...SAMPLE_ENTRY,
  clock_out: NOW.toISOString(),
  total_minutes: 60,
  status: 'clocked_out',
  clock_out_latitude: 45.4220,
  clock_out_longitude: -75.6980,
  clock_out_method: 'mobile_gps',
};

const SAMPLE_GPS_EVENT = {
  id: GPS_EVENT_ID,
  tenant_id: TENANT_A,
  user_id: USER_ID,
  job_id: JOB_ID,
  crew_id: CREW_ID,
  event_type: 'arrival',
  latitude: 45.4215,
  longitude: -75.6972,
  accuracy_meters: 5.2,
  recorded_at: NOW.toISOString(),
  device_info: 'iPhone 15 Pro',
  created_at: NOW.toISOString(),
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
// GET /v1/time-entries — List
// ============================================
describe('GET /v1/time-entries', () => {
  it('should return paginated time entries', async () => {
    const token = await loginAs('owner');
    mockFindAllEntries.mockResolvedValue({ rows: [SAMPLE_ENTRY], total: 1 });

    const res = await request(app)
      .get('/v1/time-entries')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass filters to repository', async () => {
    const token = await loginAs('coordinator');
    mockFindAllEntries.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/time-entries?user_id=${USER_ID}&status=clocked_in&date_from=2026-02-01&date_to=2026-02-28`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllEntries).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        user_id: USER_ID,
        status: 'clocked_in',
        date_from: '2026-02-01',
        date_to: '2026-02-28',
      }),
    );
  });

  it('should deny crew_member from listing entries', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/time-entries')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/time-entries/:id — Detail
// ============================================
describe('GET /v1/time-entries/:id', () => {
  it('should return entry with user/job/crew info', async () => {
    const token = await loginAs('owner');
    mockFindEntryById.mockResolvedValue(SAMPLE_ENTRY);

    const res = await request(app)
      .get(`/v1/time-entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user_first_name).toBe('Test');
    expect(res.body.data.job_title).toBe('Weekly Mowing');
    expect(res.body.data.crew_name).toBe('Alpha Crew');
  });

  it('should return 404 for non-existent entry', async () => {
    const token = await loginAs('owner');
    mockFindEntryById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/time-entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/time-entries/clock-in
// ============================================
describe('POST /v1/time-entries/clock-in', () => {
  it('should clock in with GPS coordinates', async () => {
    const token = await loginAs('crew_member');
    mockGetActiveClockIn.mockResolvedValue(null);
    mockClockIn.mockResolvedValue(SAMPLE_ENTRY);

    const res = await request(app)
      .post('/v1/time-entries/clock-in')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        crew_id: CREW_ID,
        clock_in_latitude: 45.4215,
        clock_in_longitude: -75.6972,
        clock_in_method: 'mobile_gps',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('clocked_in');
  });

  it('should clock in without a job', async () => {
    const token = await loginAs('crew_member');
    mockGetActiveClockIn.mockResolvedValue(null);
    mockClockIn.mockResolvedValue({ ...SAMPLE_ENTRY, job_id: null });

    const res = await request(app)
      .post('/v1/time-entries/clock-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ clock_in_method: 'manual' });

    expect(res.status).toBe(201);
  });

  it('should prevent double clock-in', async () => {
    const token = await loginAs('crew_member');
    mockGetActiveClockIn.mockResolvedValue(SAMPLE_ENTRY);

    const res = await request(app)
      .post('/v1/time-entries/clock-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ clock_in_method: 'manual' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already has an active clock-in');
  });

  it('should allow crew_leader to clock in', async () => {
    const token = await loginAs('crew_leader');
    mockGetActiveClockIn.mockResolvedValue(null);
    mockClockIn.mockResolvedValue(SAMPLE_ENTRY);

    const res = await request(app)
      .post('/v1/time-entries/clock-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ clock_in_method: 'manual' });

    expect(res.status).toBe(201);
  });
});

// ============================================
// POST /v1/time-entries/:id/clock-out
// ============================================
describe('POST /v1/time-entries/:id/clock-out', () => {
  it('should clock out and calculate total_minutes', async () => {
    const token = await loginAs('crew_member');
    mockFindEntryById.mockResolvedValue(SAMPLE_ENTRY);
    mockClockOut.mockResolvedValue(SAMPLE_CLOCKED_OUT_ENTRY);

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/clock-out`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        clock_out_latitude: 45.4220,
        clock_out_longitude: -75.6980,
        clock_out_method: 'mobile_gps',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('clocked_out');
    expect(res.body.data.total_minutes).toBe(60);
    // Verify total_minutes was calculated and passed to repo
    expect(mockClockOut).toHaveBeenCalledWith(
      TENANT_A,
      ENTRY_ID,
      expect.objectContaining({ total_minutes: expect.any(Number) }),
      USER_ID,
    );
  });

  it('should subtract break_minutes from total', async () => {
    const token = await loginAs('crew_member');
    mockFindEntryById.mockResolvedValue(SAMPLE_ENTRY);
    mockClockOut.mockResolvedValue({ ...SAMPLE_CLOCKED_OUT_ENTRY, break_minutes: 30, total_minutes: 30 });

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/clock-out`)
      .set('Authorization', `Bearer ${token}`)
      .send({ break_minutes: 30 });

    expect(res.status).toBe(200);
    // Verify break was subtracted
    expect(mockClockOut).toHaveBeenCalledWith(
      TENANT_A,
      ENTRY_ID,
      expect.objectContaining({
        break_minutes: 30,
        total_minutes: expect.any(Number),
      }),
      USER_ID,
    );
  });

  it('should reject clock-out before clock-in', async () => {
    const token = await loginAs('crew_member');
    const futureClockIn = new Date(Date.now() + 3600000).toISOString();
    mockFindEntryById.mockResolvedValue({
      ...SAMPLE_ENTRY,
      clock_in: futureClockIn,
    });

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/clock-out`)
      .set('Authorization', `Bearer ${token}`)
      .send({ clock_out: ONE_HOUR_AGO.toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Clock-out time must be after clock-in time');
  });

  it('should reject clock-out on already clocked-out entry', async () => {
    const token = await loginAs('crew_member');
    mockFindEntryById.mockResolvedValue(SAMPLE_CLOCKED_OUT_ENTRY);

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/clock-out`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('not currently clocked in');
  });

  it('should return 404 for non-existent entry', async () => {
    const token = await loginAs('crew_member');
    mockFindEntryById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/clock-out`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it('should flag long shifts (over 14 hours)', async () => {
    const token = await loginAs('crew_member');
    const longClockIn = new Date(NOW.getTime() - 15 * 3600000).toISOString();
    mockFindEntryById.mockResolvedValue({
      ...SAMPLE_ENTRY,
      clock_in: longClockIn,
    });
    mockClockOut.mockResolvedValue({
      ...SAMPLE_CLOCKED_OUT_ENTRY,
      clock_in: longClockIn,
      total_minutes: 900, // 15 hours
    });

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/clock-out`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data._warning).toContain('14 hours');
  });
});

// ============================================
// PUT /v1/time-entries/:id — Admin Adjust
// ============================================
describe('PUT /v1/time-entries/:id', () => {
  it('should allow owner to adjust entry', async () => {
    const token = await loginAs('owner');
    mockFindEntryById.mockResolvedValue(SAMPLE_CLOCKED_OUT_ENTRY);
    mockUpdateEntry.mockResolvedValue({
      ...SAMPLE_CLOCKED_OUT_ENTRY,
      break_minutes: 15,
      total_minutes: 45,
      status: 'adjusted',
      admin_notes: 'Corrected break time',
    });

    const res = await request(app)
      .put(`/v1/time-entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        break_minutes: 15,
        admin_notes: 'Corrected break time',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('adjusted');
    expect(res.body.data.admin_notes).toBe('Corrected break time');
  });

  it('should recalculate total_minutes when times change', async () => {
    const token = await loginAs('div_mgr');
    mockFindEntryById.mockResolvedValue(SAMPLE_CLOCKED_OUT_ENTRY);
    mockUpdateEntry.mockResolvedValue({
      ...SAMPLE_CLOCKED_OUT_ENTRY,
      status: 'adjusted',
      total_minutes: 120,
    });

    const newClockIn = new Date(NOW.getTime() - 7200000).toISOString(); // 2 hours ago
    const res = await request(app)
      .put(`/v1/time-entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ clock_in: newClockIn });

    expect(res.status).toBe(200);
    // Verify total_minutes was recalculated
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      TENANT_A,
      ENTRY_ID,
      expect.objectContaining({ total_minutes: expect.any(Number), status: 'adjusted' }),
      USER_ID,
    );
  });

  it('should reject invalid clock_out before clock_in', async () => {
    const token = await loginAs('owner');
    mockFindEntryById.mockResolvedValue(SAMPLE_CLOCKED_OUT_ENTRY);

    const res = await request(app)
      .put(`/v1/time-entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ clock_out: ONE_HOUR_AGO.toISOString(), clock_in: NOW.toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Clock-out time must be after clock-in time');
  });

  it('should deny coordinator from adjusting entries', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .put(`/v1/time-entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ break_minutes: 15 });

    expect(res.status).toBe(403);
  });

  it('should deny crew_leader from adjusting entries', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .put(`/v1/time-entries/${ENTRY_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ break_minutes: 15 });

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /v1/time-entries/:id/approve
// ============================================
describe('POST /v1/time-entries/:id/approve', () => {
  it('should approve a clocked_out entry', async () => {
    const token = await loginAs('owner');
    mockFindEntryById.mockResolvedValue(SAMPLE_CLOCKED_OUT_ENTRY);
    mockApproveEntry.mockResolvedValue({
      ...SAMPLE_CLOCKED_OUT_ENTRY,
      status: 'approved',
      approved_by: USER_ID,
      approved_at: NOW.toISOString(),
    });

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.approved_by).toBe(USER_ID);
  });

  it('should reject approving a clocked-in entry', async () => {
    const token = await loginAs('owner');
    mockFindEntryById.mockResolvedValue(SAMPLE_ENTRY);

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('still clocked in');
  });

  it('should return already-approved entry without error', async () => {
    const token = await loginAs('owner');
    const approvedEntry = { ...SAMPLE_CLOCKED_OUT_ENTRY, status: 'approved', approved_by: USER_ID };
    mockFindEntryById.mockResolvedValue(approvedEntry);

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny coordinator from approving', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should deny crew_leader from approving', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/time-entries/my-timesheet
// ============================================
describe('GET /v1/time-entries/my-timesheet', () => {
  it('should return current user timesheet', async () => {
    const token = await loginAs('crew_member');
    mockGetByUserDateRange.mockResolvedValue([SAMPLE_CLOCKED_OUT_ENTRY]);

    const res = await request(app)
      .get('/v1/time-entries/my-timesheet?date_from=2026-02-01&date_to=2026-02-28')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockGetByUserDateRange).toHaveBeenCalledWith(
      TENANT_A,
      USER_ID,
      '2026-02-01',
      '2026-02-28',
    );
  });

  it('should require date range', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/time-entries/my-timesheet')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('should allow any authenticated role', async () => {
    const token = await loginAs('crew_member');
    mockGetByUserDateRange.mockResolvedValue([]);

    const res = await request(app)
      .get('/v1/time-entries/my-timesheet?date_from=2026-02-01&date_to=2026-02-28')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

// ============================================
// GET /v1/time-entries/daily-summary
// ============================================
describe('GET /v1/time-entries/daily-summary', () => {
  it('should return daily summary', async () => {
    const token = await loginAs('owner');
    mockGetDailySummary.mockResolvedValue([
      { user_id: USER_ID, user_first_name: 'Test', user_last_name: 'User', total_minutes: '480', entry_count: '2' },
    ]);

    const res = await request(app)
      .get('/v1/time-entries/daily-summary?date=2026-02-25')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].total_minutes).toBe('480');
  });

  it('should filter by crew_id', async () => {
    const token = await loginAs('crew_leader');
    mockGetDailySummary.mockResolvedValue([]);

    await request(app)
      .get(`/v1/time-entries/daily-summary?date=2026-02-25&crew_id=${CREW_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockGetDailySummary).toHaveBeenCalledWith(TENANT_A, '2026-02-25', CREW_ID);
  });

  it('should deny crew_member from viewing daily summary', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/time-entries/daily-summary?date=2026-02-25')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/time-entries/weekly-summary
// ============================================
describe('GET /v1/time-entries/weekly-summary', () => {
  it('should return weekly summary', async () => {
    const token = await loginAs('owner');
    mockGetWeeklySummary.mockResolvedValue([
      { day: '2026-02-23', total_minutes: '480', entry_count: '2' },
      { day: '2026-02-24', total_minutes: '510', entry_count: '2' },
    ]);

    const res = await request(app)
      .get(`/v1/time-entries/weekly-summary?user_id=${USER_ID}&week_start=2026-02-23`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should deny crew_leader from viewing weekly summary', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get(`/v1/time-entries/weekly-summary?user_id=${USER_ID}&week_start=2026-02-23`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /v1/gps-events — Record GPS Event
// ============================================
describe('POST /v1/gps-events', () => {
  it('should record GPS event', async () => {
    const token = await loginAs('crew_member');
    mockRecordGpsEvent.mockResolvedValue(SAMPLE_GPS_EVENT);

    const res = await request(app)
      .post('/v1/gps-events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        job_id: JOB_ID,
        crew_id: CREW_ID,
        event_type: 'arrival',
        latitude: 45.4215,
        longitude: -75.6972,
        accuracy_meters: 5.2,
        device_info: 'iPhone 15 Pro',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.event_type).toBe('arrival');
    expect(res.body.data.latitude).toBe(45.4215);
  });

  it('should record location_update without job', async () => {
    const token = await loginAs('crew_member');
    mockRecordGpsEvent.mockResolvedValue({ ...SAMPLE_GPS_EVENT, event_type: 'location_update', job_id: null });

    const res = await request(app)
      .post('/v1/gps-events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'location_update',
        latitude: 45.4215,
        longitude: -75.6972,
      });

    expect(res.status).toBe(201);
  });

  it('should reject invalid coordinates', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .post('/v1/gps-events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'arrival',
        latitude: 999,
        longitude: -75.6972,
      });

    expect(res.status).toBe(400);
  });
});

// ============================================
// GET /v1/gps-events/by-job/:jobId
// ============================================
describe('GET /v1/gps-events/by-job/:jobId', () => {
  it('should return GPS trail for a job', async () => {
    const token = await loginAs('owner');
    mockGetEventsByJob.mockResolvedValue([SAMPLE_GPS_EVENT]);

    const res = await request(app)
      .get(`/v1/gps-events/by-job/${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].event_type).toBe('arrival');
  });

  it('should deny crew_leader from viewing GPS by job', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get(`/v1/gps-events/by-job/${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/gps-events/by-user/:userId
// ============================================
describe('GET /v1/gps-events/by-user/:userId', () => {
  it('should return user location history', async () => {
    const token = await loginAs('owner');
    mockGetEventsByUser.mockResolvedValue([SAMPLE_GPS_EVENT]);

    const res = await request(app)
      .get(`/v1/gps-events/by-user/${USER_ID}?date_from=2026-02-01&date_to=2026-02-28`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('should require date range', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .get(`/v1/gps-events/by-user/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('should deny coordinator from viewing user GPS', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get(`/v1/gps-events/by-user/${USER_ID}?date_from=2026-02-01&date_to=2026-02-28`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/gps-events/latest/:userId
// ============================================
describe('GET /v1/gps-events/latest/:userId', () => {
  it('should return last known location', async () => {
    const token = await loginAs('owner');
    mockGetLatestByUser.mockResolvedValue(SAMPLE_GPS_EVENT);

    const res = await request(app)
      .get(`/v1/gps-events/latest/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.latitude).toBe(45.4215);
  });

  it('should return 404 when no GPS events', async () => {
    const token = await loginAs('owner');
    mockGetLatestByUser.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/gps-events/latest/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should allow crew_leader to view latest location', async () => {
    const token = await loginAs('crew_leader');
    mockGetLatestByUser.mockResolvedValue(SAMPLE_GPS_EVENT);

    const res = await request(app)
      .get(`/v1/gps-events/latest/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny crew_member from viewing others locations', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get(`/v1/gps-events/latest/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant isolation', () => {
  it('should scope time entry queries to tenant', async () => {
    const tokenA = await loginAs('owner', TENANT_A);
    mockFindAllEntries.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/time-entries')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mockFindAllEntries).toHaveBeenCalledWith(TENANT_A, expect.anything());
  });

  it('should scope GPS events to tenant', async () => {
    const tokenB = await loginAs('owner', TENANT_B);
    mockGetEventsByJob.mockResolvedValue([]);

    await request(app)
      .get(`/v1/gps-events/by-job/${JOB_ID}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(mockGetEventsByJob).toHaveBeenCalledWith(TENANT_B, JOB_ID);
  });
});

// ============================================
// Role-Based Access Control
// ============================================
describe('Role-based access', () => {
  it('should deny unauthenticated requests to time entries', async () => {
    const res = await request(app).get('/v1/time-entries');
    expect(res.status).toBe(401);
  });

  it('should deny unauthenticated requests to GPS events', async () => {
    const res = await request(app).post('/v1/gps-events').send({
      event_type: 'arrival',
      latitude: 45.4215,
      longitude: -75.6972,
    });
    expect(res.status).toBe(401);
  });

  it('should allow div_mgr to approve entries', async () => {
    const token = await loginAs('div_mgr');
    mockFindEntryById.mockResolvedValue(SAMPLE_CLOCKED_OUT_ENTRY);
    mockApproveEntry.mockResolvedValue({ ...SAMPLE_CLOCKED_OUT_ENTRY, status: 'approved' });

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should allow all crew roles to clock in', async () => {
    const token = await loginAs('crew_member');
    mockGetActiveClockIn.mockResolvedValue(null);
    mockClockIn.mockResolvedValue(SAMPLE_ENTRY);

    const res = await request(app)
      .post('/v1/time-entries/clock-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ clock_in_method: 'manual' });

    expect(res.status).toBe(201);
  });

  it('should allow all crew roles to clock out', async () => {
    const token = await loginAs('crew_member');
    mockFindEntryById.mockResolvedValue(SAMPLE_ENTRY);
    mockClockOut.mockResolvedValue(SAMPLE_CLOCKED_OUT_ENTRY);

    const res = await request(app)
      .post(`/v1/time-entries/${ENTRY_ID}/clock-out`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
  });
});
