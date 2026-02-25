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

// --- Mock seasonal repository ---
const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockSeasonalCreate = vi.fn();
const mockSeasonalUpdate = vi.fn();
const mockUpdateChecklist = vi.fn();
const mockSoftDelete = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  create: (...args: unknown[]) => mockSeasonalCreate(...args),
  update: (...args: unknown[]) => mockSeasonalUpdate(...args),
  updateChecklist: (...args: unknown[]) => mockUpdateChecklist(...args),
  softDelete: (...args: unknown[]) => mockSoftDelete(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const TRANSITION_ID = 'dddddddd-0000-0000-0000-000000000001';

const SAMPLE_TRANSITION = {
  id: TRANSITION_ID,
  tenant_id: TENANT_A,
  transition_type: 'spring_startup',
  season_year: 2026,
  status: 'planned',
  scheduled_date: '2026-03-15',
  completed_date: null,
  checklist: [
    { task: 'Inspect equipment', completed: false, completed_by: null, completed_at: null },
    { task: 'Test irrigation', completed: false, completed_by: null, completed_at: null },
  ],
  notes: 'Prepare for spring season',
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

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
// GET /v1/seasonal — List
// ============================================
describe('GET /v1/seasonal', () => {
  it('should return paginated seasonal transitions', async () => {
    const token = await loginAs('owner');
    mockFindAll.mockResolvedValue({ rows: [SAMPLE_TRANSITION], total: 1 });

    const res = await request(app)
      .get('/v1/seasonal')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.data[0].transition_type).toBe('spring_startup');
  });

  it('should filter by transition_type and season_year', async () => {
    const token = await loginAs('div_mgr');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/seasonal?transition_type=winter_prep&season_year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ transition_type: 'winter_prep', season_year: 2026 }),
    );
  });

  it('should deny crew_member access', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/seasonal')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/seasonal/:id — Detail
// ============================================
describe('GET /v1/seasonal/:id', () => {
  it('should return single transition with checklist', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_TRANSITION);

    const res = await request(app)
      .get(`/v1/seasonal/${TRANSITION_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(TRANSITION_ID);
    expect(res.body.data.checklist).toHaveLength(2);
  });

  it('should return 404 for non-existent transition', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/seasonal/${TRANSITION_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/seasonal — Create
// ============================================
describe('POST /v1/seasonal', () => {
  it('should create a seasonal transition', async () => {
    const token = await loginAs('owner');
    mockSeasonalCreate.mockResolvedValue(SAMPLE_TRANSITION);

    const res = await request(app)
      .post('/v1/seasonal')
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition_type: 'spring_startup',
        season_year: 2026,
        scheduled_date: '2026-03-15',
        checklist: [{ task: 'Inspect equipment' }, { task: 'Test irrigation' }],
        notes: 'Prepare for spring season',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.transition_type).toBe('spring_startup');
    expect(mockSeasonalCreate).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({ transition_type: 'spring_startup' }),
      USER_ID,
    );
  });

  it('should reject invalid transition_type', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/seasonal')
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition_type: 'invalid_type',
        season_year: 2026,
        scheduled_date: '2026-03-15',
      });

    expect(res.status).toBe(400);
  });

  it('should deny coordinator from creating', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/seasonal')
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition_type: 'spring_startup',
        season_year: 2026,
        scheduled_date: '2026-03-15',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/seasonal/:id — Update
// ============================================
describe('PUT /v1/seasonal/:id', () => {
  it('should update transition fields', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_TRANSITION);
    mockSeasonalUpdate.mockResolvedValue({ ...SAMPLE_TRANSITION, status: 'in_progress' });

    const res = await request(app)
      .put(`/v1/seasonal/${TRANSITION_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
  });

  it('should return 404 for non-existent transition', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/seasonal/${TRANSITION_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(404);
  });
});

// ============================================
// PATCH /v1/seasonal/:id/checklist — Update Checklist
// ============================================
describe('PATCH /v1/seasonal/:id/checklist', () => {
  it('should update checklist items', async () => {
    const token = await loginAs('coordinator');
    const updatedChecklist = [
      { task: 'Inspect equipment', completed: true, completed_by: USER_ID, completed_at: new Date().toISOString() },
      { task: 'Test irrigation', completed: false, completed_by: null, completed_at: null },
    ];
    mockFindById.mockResolvedValue(SAMPLE_TRANSITION);
    mockUpdateChecklist.mockResolvedValue({ ...SAMPLE_TRANSITION, checklist: updatedChecklist });

    const res = await request(app)
      .patch(`/v1/seasonal/${TRANSITION_ID}/checklist`)
      .set('Authorization', `Bearer ${token}`)
      .send({ checklist: updatedChecklist });

    expect(res.status).toBe(200);
    expect(res.body.data.checklist[0].completed).toBe(true);
  });

  it('should auto-complete status when all items done', async () => {
    const token = await loginAs('owner');
    const allDoneChecklist = [
      { task: 'Inspect equipment', completed: true, completed_by: USER_ID, completed_at: new Date().toISOString() },
      { task: 'Test irrigation', completed: true, completed_by: USER_ID, completed_at: new Date().toISOString() },
    ];
    mockFindById.mockResolvedValue(SAMPLE_TRANSITION);
    mockUpdateChecklist.mockResolvedValue({ ...SAMPLE_TRANSITION, checklist: allDoneChecklist, status: 'planned' });
    mockSeasonalUpdate.mockResolvedValue({ ...SAMPLE_TRANSITION, checklist: allDoneChecklist, status: 'completed', completed_date: '2026-02-25' });

    const res = await request(app)
      .patch(`/v1/seasonal/${TRANSITION_ID}/checklist`)
      .set('Authorization', `Bearer ${token}`)
      .send({ checklist: allDoneChecklist });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  it('should allow coordinator to update checklist', async () => {
    const token = await loginAs('coordinator');
    mockFindById.mockResolvedValue(SAMPLE_TRANSITION);
    mockUpdateChecklist.mockResolvedValue(SAMPLE_TRANSITION);

    const res = await request(app)
      .patch(`/v1/seasonal/${TRANSITION_ID}/checklist`)
      .set('Authorization', `Bearer ${token}`)
      .send({ checklist: SAMPLE_TRANSITION.checklist });

    expect(res.status).toBe(200);
  });

  it('should deny crew_leader from updating checklist', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .patch(`/v1/seasonal/${TRANSITION_ID}/checklist`)
      .set('Authorization', `Bearer ${token}`)
      .send({ checklist: SAMPLE_TRANSITION.checklist });

    expect(res.status).toBe(403);
  });
});

// ============================================
// DELETE /v1/seasonal/:id — Soft Delete
// ============================================
describe('DELETE /v1/seasonal/:id', () => {
  it('should soft delete transition (owner only)', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(SAMPLE_TRANSITION);
    mockSoftDelete.mockResolvedValue(SAMPLE_TRANSITION);

    const res = await request(app)
      .delete(`/v1/seasonal/${TRANSITION_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Seasonal transition deleted');
  });

  it('should deny div_mgr from deleting', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .delete(`/v1/seasonal/${TRANSITION_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent transition', async () => {
    const token = await loginAs('owner');
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/v1/seasonal/${TRANSITION_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Seasonal tenant isolation', () => {
  it('should scope queries to the authenticated tenant', async () => {
    const token = await loginAs('owner');
    mockFindAll.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/seasonal')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAll).toHaveBeenCalledWith(TENANT_A, expect.anything());
  });

  it('should deny unauthenticated access', async () => {
    const res = await request(app).get('/v1/seasonal');
    expect(res.status).toBe(401);
  });
});
