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

// --- Mock hardscape repository ---
const mockFindAllProjects = vi.fn();
const mockFindProjectById = vi.fn();
const mockCreateProject = vi.fn();
const mockUpdateProject = vi.fn();
const mockUpdateStage = vi.fn();
const mockSoftDeleteProject = vi.fn();
const mockGenerateProjectNumber = vi.fn();
const mockFindMilestonesByProjectId = vi.fn();
const mockFindMilestoneById = vi.fn();
const mockCreateMilestone = vi.fn();
const mockUpdateMilestone = vi.fn();
const mockGetStageHistory = vi.fn();
const mockRecordStageChange = vi.fn();
const mockGetPipelineStats = vi.fn();

vi.mock('../repository.js', () => ({
  findAllProjects: (...args: unknown[]) => mockFindAllProjects(...args),
  findProjectById: (...args: unknown[]) => mockFindProjectById(...args),
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  updateStage: (...args: unknown[]) => mockUpdateStage(...args),
  softDeleteProject: (...args: unknown[]) => mockSoftDeleteProject(...args),
  generateProjectNumber: (...args: unknown[]) => mockGenerateProjectNumber(...args),
  findMilestonesByProjectId: (...args: unknown[]) => mockFindMilestonesByProjectId(...args),
  findMilestoneById: (...args: unknown[]) => mockFindMilestoneById(...args),
  createMilestone: (...args: unknown[]) => mockCreateMilestone(...args),
  updateMilestone: (...args: unknown[]) => mockUpdateMilestone(...args),
  getStageHistory: (...args: unknown[]) => mockGetStageHistory(...args),
  recordStageChange: (...args: unknown[]) => mockRecordStageChange(...args),
  getPipelineStats: (...args: unknown[]) => mockGetPipelineStats(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const PROJECT_ID = '11111111-0000-0000-0000-000000000001';
const MILESTONE_ID = '22222222-0000-0000-0000-000000000001';

const SAMPLE_PROJECT = {
  id: PROJECT_ID,
  tenant_id: TENANT_A,
  customer_id: CUSTOMER_ID,
  property_id: PROPERTY_ID,
  contract_id: null,
  project_number: 'HP-2026-0001',
  title: 'Backyard Patio Installation',
  description: 'Full patio with retaining wall',
  status: 'lead',
  stage_entered_at: new Date().toISOString(),
  estimated_value: 15000,
  actual_value: null,
  estimated_start_date: '2026-05-01',
  actual_start_date: null,
  estimated_end_date: '2026-06-15',
  actual_end_date: null,
  project_type: 'patio',
  assigned_to: USER_ID,
  division: 'hardscape',
  source: 'referral',
  loss_reason: null,
  notes: null,
  tags: ['premium', 'residential'],
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  customer_display_name: 'John Doe',
  property_name: '123 Main St',
  milestones: [],
  stage_history: [],
};

const SAMPLE_MILESTONE = {
  id: MILESTONE_ID,
  tenant_id: TENANT_A,
  project_id: PROJECT_ID,
  milestone_name: 'Excavation Complete',
  description: 'Complete excavation and grading',
  due_date: '2026-05-10',
  completed_date: null,
  status: 'pending',
  sort_order: 0,
  payment_amount: 5000,
  payment_status: 'not_due',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SAMPLE_HISTORY = {
  id: '33333333-0000-0000-0000-000000000001',
  tenant_id: TENANT_A,
  project_id: PROJECT_ID,
  from_stage: null,
  to_stage: 'lead',
  changed_by: USER_ID,
  changed_at: new Date().toISOString(),
  notes: null,
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
// GET /v1/hardscape/projects — List
// ============================================
describe('GET /v1/hardscape/projects', () => {
  it('should return paginated project list', async () => {
    const token = await loginAs('owner');
    mockFindAllProjects.mockResolvedValue({ rows: [SAMPLE_PROJECT], total: 1 });

    const res = await request(app)
      .get('/v1/hardscape/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should pass filters to repository', async () => {
    const token = await loginAs('coordinator');
    mockFindAllProjects.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get(`/v1/hardscape/projects?status=lead&project_type=patio&assigned_to=${USER_ID}&value_min=5000&value_max=20000`)
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllProjects).toHaveBeenCalledWith(
      TENANT_A,
      expect.objectContaining({
        status: 'lead',
        project_type: 'patio',
        assigned_to: USER_ID,
        value_min: 5000,
        value_max: 20000,
      }),
    );
  });

  it('should deny crew_leader from listing projects', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .get('/v1/hardscape/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/hardscape/projects/:id — Detail
// ============================================
describe('GET /v1/hardscape/projects/:id', () => {
  it('should return project with milestones and stage history', async () => {
    const token = await loginAs('owner');
    mockFindProjectById.mockResolvedValue({
      ...SAMPLE_PROJECT,
      milestones: [SAMPLE_MILESTONE],
      stage_history: [SAMPLE_HISTORY],
    });

    const res = await request(app)
      .get(`/v1/hardscape/projects/${PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.project_number).toBe('HP-2026-0001');
    expect(res.body.data.milestones).toHaveLength(1);
    expect(res.body.data.stage_history).toHaveLength(1);
  });

  it('should return 404 for non-existent project', async () => {
    const token = await loginAs('owner');
    mockFindProjectById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/hardscape/projects/${PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/hardscape/projects — Create
// ============================================
describe('POST /v1/hardscape/projects', () => {
  it('should create a project with auto-generated number', async () => {
    const token = await loginAs('coordinator');
    mockGenerateProjectNumber.mockResolvedValue('HP-2026-0001');
    mockCreateProject.mockResolvedValue(SAMPLE_PROJECT);
    mockRecordStageChange.mockResolvedValue(SAMPLE_HISTORY);

    const res = await request(app)
      .post('/v1/hardscape/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        title: 'Backyard Patio Installation',
        project_type: 'patio',
        estimated_value: 15000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.project_number).toBe('HP-2026-0001');
    expect(mockGenerateProjectNumber).toHaveBeenCalledWith(TENANT_A);
    // Initial stage history recorded
    expect(mockRecordStageChange).toHaveBeenCalledWith(
      TENANT_A, PROJECT_ID, null, 'lead', USER_ID,
    );
  });

  it('should deny crew_leader from creating projects', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post('/v1/hardscape/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        title: 'Test',
      });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PUT /v1/hardscape/projects/:id — Update
// ============================================
describe('PUT /v1/hardscape/projects/:id', () => {
  it('should update a project', async () => {
    const token = await loginAs('coordinator');
    const updated = { ...SAMPLE_PROJECT, estimated_value: 18000 };
    mockFindProjectById.mockResolvedValue(SAMPLE_PROJECT);
    mockUpdateProject.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/hardscape/projects/${PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estimated_value: 18000 });

    expect(res.status).toBe(200);
  });

  it('should return 404 for non-existent project', async () => {
    const token = await loginAs('owner');
    mockFindProjectById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/hardscape/projects/${PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
  });
});

// ============================================
// PATCH /v1/hardscape/projects/:id/stage — Stage Change
// ============================================
describe('PATCH /v1/hardscape/projects/:id/stage', () => {
  it('should change stage and record history', async () => {
    const token = await loginAs('coordinator');
    const updated = { ...SAMPLE_PROJECT, status: 'estimate_scheduled' };
    mockFindProjectById.mockResolvedValue(SAMPLE_PROJECT);
    mockUpdateStage.mockResolvedValue(updated);
    mockRecordStageChange.mockResolvedValue({ ...SAMPLE_HISTORY, from_stage: 'lead', to_stage: 'estimate_scheduled' });

    const res = await request(app)
      .patch(`/v1/hardscape/projects/${PROJECT_ID}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'estimate_scheduled', notes: 'Estimate booked for May 5th' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('estimate_scheduled');
    expect(mockRecordStageChange).toHaveBeenCalledWith(
      TENANT_A, PROJECT_ID, 'lead', 'estimate_scheduled', USER_ID, 'Estimate booked for May 5th',
    );
  });

  it('should require loss_reason when setting to lost', async () => {
    const token = await loginAs('owner');
    mockFindProjectById.mockResolvedValue(SAMPLE_PROJECT);

    const res = await request(app)
      .patch(`/v1/hardscape/projects/${PROJECT_ID}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'lost' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Loss reason is required');
  });

  it('should accept lost with loss_reason', async () => {
    const token = await loginAs('owner');
    const lost = { ...SAMPLE_PROJECT, status: 'lost', loss_reason: 'Price too high' };
    mockFindProjectById.mockResolvedValue(SAMPLE_PROJECT);
    mockUpdateStage.mockResolvedValue(lost);
    mockRecordStageChange.mockResolvedValue({});

    const res = await request(app)
      .patch(`/v1/hardscape/projects/${PROJECT_ID}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'lost', loss_reason: 'Price too high' });

    expect(res.status).toBe(200);
    expect(mockUpdateStage).toHaveBeenCalledWith(
      TENANT_A, PROJECT_ID, 'lost', USER_ID,
      expect.objectContaining({ loss_reason: 'Price too high' }),
    );
  });

  it('should auto-set actual_end_date on completed', async () => {
    const token = await loginAs('coordinator');
    const inProgress = { ...SAMPLE_PROJECT, status: 'in_progress', actual_end_date: null };
    const completed = { ...inProgress, status: 'completed', actual_end_date: '2026-06-10' };
    mockFindProjectById.mockResolvedValue(inProgress);
    mockUpdateStage.mockResolvedValue(completed);
    mockRecordStageChange.mockResolvedValue({});

    const res = await request(app)
      .patch(`/v1/hardscape/projects/${PROJECT_ID}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'completed' });

    expect(res.status).toBe(200);
    expect(mockUpdateStage).toHaveBeenCalledWith(
      TENANT_A, PROJECT_ID, 'completed', USER_ID,
      expect.objectContaining({ actual_end_date: expect.any(String) }),
    );
  });

  it('should auto-set actual_start_date on in_progress', async () => {
    const token = await loginAs('coordinator');
    const approved = { ...SAMPLE_PROJECT, status: 'approved', actual_start_date: null };
    const inProg = { ...approved, status: 'in_progress' };
    mockFindProjectById.mockResolvedValue(approved);
    mockUpdateStage.mockResolvedValue(inProg);
    mockRecordStageChange.mockResolvedValue({});

    const res = await request(app)
      .patch(`/v1/hardscape/projects/${PROJECT_ID}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'in_progress' });

    expect(res.status).toBe(200);
    expect(mockUpdateStage).toHaveBeenCalledWith(
      TENANT_A, PROJECT_ID, 'in_progress', USER_ID,
      expect.objectContaining({ actual_start_date: expect.any(String) }),
    );
  });

  it('should set actual_value on approved if provided', async () => {
    const token = await loginAs('owner');
    const negotiation = { ...SAMPLE_PROJECT, status: 'negotiation' };
    const approved = { ...negotiation, status: 'approved', actual_value: 14500 };
    mockFindProjectById.mockResolvedValue(negotiation);
    mockUpdateStage.mockResolvedValue(approved);
    mockRecordStageChange.mockResolvedValue({});

    const res = await request(app)
      .patch(`/v1/hardscape/projects/${PROJECT_ID}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'approved', actual_value: 14500 });

    expect(res.status).toBe(200);
    expect(mockUpdateStage).toHaveBeenCalledWith(
      TENANT_A, PROJECT_ID, 'approved', USER_ID,
      expect.objectContaining({ actual_value: 14500 }),
    );
  });

  it('should return same project when stage unchanged', async () => {
    const token = await loginAs('coordinator');
    mockFindProjectById.mockResolvedValue(SAMPLE_PROJECT);

    const res = await request(app)
      .patch(`/v1/hardscape/projects/${PROJECT_ID}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'lead' });

    expect(res.status).toBe(200);
    // Stage didn't change, no history recorded
    expect(mockRecordStageChange).not.toHaveBeenCalled();
  });
});

// ============================================
// DELETE /v1/hardscape/projects/:id — Delete
// ============================================
describe('DELETE /v1/hardscape/projects/:id', () => {
  it('should soft delete a project', async () => {
    const token = await loginAs('owner');
    mockFindProjectById.mockResolvedValue(SAMPLE_PROJECT);
    mockSoftDeleteProject.mockResolvedValue(SAMPLE_PROJECT);

    const res = await request(app)
      .delete(`/v1/hardscape/projects/${PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockSoftDeleteProject).toHaveBeenCalledWith(TENANT_A, PROJECT_ID);
  });

  it('should deny coordinator from deleting projects', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .delete(`/v1/hardscape/projects/${PROJECT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Milestones
// ============================================
describe('GET /v1/hardscape/projects/:id/milestones', () => {
  it('should return milestones for a project', async () => {
    const token = await loginAs('coordinator');
    mockFindProjectById.mockResolvedValue(SAMPLE_PROJECT);
    mockFindMilestonesByProjectId.mockResolvedValue([SAMPLE_MILESTONE]);

    const res = await request(app)
      .get(`/v1/hardscape/projects/${PROJECT_ID}/milestones`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].milestone_name).toBe('Excavation Complete');
  });
});

describe('POST /v1/hardscape/projects/:id/milestones', () => {
  it('should add a milestone to a project', async () => {
    const token = await loginAs('coordinator');
    mockFindProjectById.mockResolvedValue(SAMPLE_PROJECT);
    mockCreateMilestone.mockResolvedValue(SAMPLE_MILESTONE);

    const res = await request(app)
      .post(`/v1/hardscape/projects/${PROJECT_ID}/milestones`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        milestone_name: 'Excavation Complete',
        due_date: '2026-05-10',
        payment_amount: 5000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.milestone_name).toBe('Excavation Complete');
  });

  it('should return 404 for non-existent project', async () => {
    const token = await loginAs('coordinator');
    mockFindProjectById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/v1/hardscape/projects/${PROJECT_ID}/milestones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ milestone_name: 'Test' });

    expect(res.status).toBe(404);
  });
});

describe('PUT /v1/hardscape/milestones/:milestoneId', () => {
  it('should update a milestone', async () => {
    const token = await loginAs('coordinator');
    const updated = { ...SAMPLE_MILESTONE, status: 'completed', completed_date: '2026-05-09' };
    mockFindMilestoneById.mockResolvedValue(SAMPLE_MILESTONE);
    mockUpdateMilestone.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/hardscape/milestones/${MILESTONE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed', completed_date: '2026-05-09' });

    expect(res.status).toBe(200);
  });

  it('should update milestone payment status', async () => {
    const token = await loginAs('owner');
    const updated = { ...SAMPLE_MILESTONE, payment_status: 'invoiced' };
    mockFindMilestoneById.mockResolvedValue(SAMPLE_MILESTONE);
    mockUpdateMilestone.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/hardscape/milestones/${MILESTONE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ payment_status: 'invoiced' });

    expect(res.status).toBe(200);
    expect(res.body.data.payment_status).toBe('invoiced');
  });

  it('should return 404 for non-existent milestone', async () => {
    const token = await loginAs('coordinator');
    mockFindMilestoneById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/hardscape/milestones/${MILESTONE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(404);
  });
});

// ============================================
// Stage History
// ============================================
describe('GET /v1/hardscape/projects/:id/history', () => {
  it('should return stage history', async () => {
    const token = await loginAs('owner');
    mockFindProjectById.mockResolvedValue(SAMPLE_PROJECT);
    mockGetStageHistory.mockResolvedValue([
      SAMPLE_HISTORY,
      { ...SAMPLE_HISTORY, id: '33333333-0000-0000-0000-000000000002', from_stage: 'lead', to_stage: 'estimate_scheduled' },
    ]);

    const res = await request(app)
      .get(`/v1/hardscape/projects/${PROJECT_ID}/history`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

// ============================================
// Pipeline Stats
// ============================================
describe('GET /v1/hardscape/pipeline', () => {
  it('should return pipeline statistics', async () => {
    const token = await loginAs('owner');
    mockGetPipelineStats.mockResolvedValue({
      byStage: [
        { stage: 'lead', count: '5', total_value: '75000' },
        { stage: 'approved', count: '3', total_value: '45000' },
      ],
      winLoss: { completed: '10', lost: '3' },
      byType: [
        { project_type: 'patio', count: '8', total_value: '96000' },
      ],
    });

    const res = await request(app)
      .get('/v1/hardscape/pipeline')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.byStage).toHaveLength(2);
    expect(res.body.data.winLoss.completed).toBe('10');
    expect(res.body.data.winLoss.lost).toBe('3');
  });

  it('should deny coordinator from viewing pipeline stats', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .get('/v1/hardscape/pipeline')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant isolation', () => {
  it('should scope projects to authenticated tenant', async () => {
    const token = await loginAs('owner', TENANT_B);
    mockFindAllProjects.mockResolvedValue({ rows: [], total: 0 });

    await request(app)
      .get('/v1/hardscape/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(mockFindAllProjects).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });

  it('should scope pipeline stats to authenticated tenant', async () => {
    const token = await loginAs('div_mgr', TENANT_B);
    mockGetPipelineStats.mockResolvedValue({ byStage: [], winLoss: { completed: '0', lost: '0' }, byType: [] });

    await request(app)
      .get('/v1/hardscape/pipeline')
      .set('Authorization', `Bearer ${token}`);

    expect(mockGetPipelineStats).toHaveBeenCalledWith(TENANT_B);
  });
});
