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

// --- Mock SOP repository ---
const mockFindAllTemplates = vi.fn();
const mockFindTemplateById = vi.fn();
const mockCreateTemplate = vi.fn();
const mockUpdateTemplate = vi.fn();
const mockSoftDeleteTemplate = vi.fn();
const mockDuplicateTemplate = vi.fn();
const mockFindStepsByTemplateId = vi.fn();
const mockFindStepById = vi.fn();
const mockCreateStep = vi.fn();
const mockUpdateStep = vi.fn();
const mockSoftDeleteStep = vi.fn();
const mockReorderSteps = vi.fn();
const mockFindAllAssignments = vi.fn();
const mockFindAssignmentById = vi.fn();
const mockCreateAssignment = vi.fn();
const mockUpdateAssignmentStatus = vi.fn();
const mockCreateStepCompletions = vi.fn();
const mockGetCompletionsByAssignment = vi.fn();
const mockFindStepCompletion = vi.fn();
const mockCompleteStep = vi.fn();
const mockUncompleteStep = vi.fn();

vi.mock('../repository.js', () => ({
  findAllTemplates: (...args: unknown[]) => mockFindAllTemplates(...args),
  findTemplateById: (...args: unknown[]) => mockFindTemplateById(...args),
  createTemplate: (...args: unknown[]) => mockCreateTemplate(...args),
  updateTemplate: (...args: unknown[]) => mockUpdateTemplate(...args),
  softDeleteTemplate: (...args: unknown[]) => mockSoftDeleteTemplate(...args),
  duplicateTemplate: (...args: unknown[]) => mockDuplicateTemplate(...args),
  findStepsByTemplateId: (...args: unknown[]) => mockFindStepsByTemplateId(...args),
  findStepById: (...args: unknown[]) => mockFindStepById(...args),
  createStep: (...args: unknown[]) => mockCreateStep(...args),
  updateStep: (...args: unknown[]) => mockUpdateStep(...args),
  softDeleteStep: (...args: unknown[]) => mockSoftDeleteStep(...args),
  reorderSteps: (...args: unknown[]) => mockReorderSteps(...args),
  findAllAssignments: (...args: unknown[]) => mockFindAllAssignments(...args),
  findAssignmentById: (...args: unknown[]) => mockFindAssignmentById(...args),
  createAssignment: (...args: unknown[]) => mockCreateAssignment(...args),
  updateAssignmentStatus: (...args: unknown[]) => mockUpdateAssignmentStatus(...args),
  createStepCompletions: (...args: unknown[]) => mockCreateStepCompletions(...args),
  getCompletionsByAssignment: (...args: unknown[]) => mockGetCompletionsByAssignment(...args),
  findStepCompletion: (...args: unknown[]) => mockFindStepCompletion(...args),
  completeStep: (...args: unknown[]) => mockCompleteStep(...args),
  uncompleteStep: (...args: unknown[]) => mockUncompleteStep(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const TEMPLATE_ID = '11111111-0000-0000-0000-000000000001';
const STEP_ID_1 = '22222222-0000-0000-0000-000000000001';
const STEP_ID_2 = '22222222-0000-0000-0000-000000000002';
const ASSIGNMENT_ID = '33333333-0000-0000-0000-000000000001';
const JOB_ID = '44444444-0000-0000-0000-000000000001';
const CREW_ID = '55555555-0000-0000-0000-000000000001';
const COMPLETION_ID = '66666666-0000-0000-0000-000000000001';

const SAMPLE_STEP_1 = {
  id: STEP_ID_1,
  tenant_id: TENANT_A,
  template_id: TEMPLATE_ID,
  step_number: 1,
  title: 'Inspect area',
  description: 'Walk the area and identify hazards',
  estimated_minutes: 10,
  requires_photo: false,
  requires_signature: false,
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_STEP_2 = {
  id: STEP_ID_2,
  tenant_id: TENANT_A,
  template_id: TEMPLATE_ID,
  step_number: 2,
  title: 'Apply salt',
  description: 'Apply salt evenly across surface',
  estimated_minutes: 30,
  requires_photo: true,
  requires_signature: false,
  sort_order: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_TEMPLATE_DRAFT = {
  id: TEMPLATE_ID,
  tenant_id: TENANT_A,
  title: 'Snow Removal - Parking Lot',
  description: 'Standard procedure for parking lot snow removal',
  category: 'snow_removal',
  division: 'snow_removal',
  status: 'draft',
  version: 1,
  steps: [SAMPLE_STEP_1, SAMPLE_STEP_2],
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_TEMPLATE_ACTIVE = {
  ...SAMPLE_TEMPLATE_DRAFT,
  status: 'active',
};

const SAMPLE_ASSIGNMENT = {
  id: ASSIGNMENT_ID,
  tenant_id: TENANT_A,
  template_id: TEMPLATE_ID,
  job_id: JOB_ID,
  crew_id: CREW_ID,
  assigned_date: '2026-02-25',
  status: 'pending',
  completed_at: null,
  completed_by: null,
  notes: null,
  created_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  step_completions: [],
  completion_percentage: 0,
};

const SAMPLE_COMPLETION = {
  id: COMPLETION_ID,
  tenant_id: TENANT_A,
  assignment_id: ASSIGNMENT_ID,
  step_id: STEP_ID_1,
  is_completed: false,
  completed_by: null,
  completed_at: null,
  photo_url: null,
  notes: null,
  created_at: new Date().toISOString(),
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
// GET /v1/sops/templates — List Templates
// ============================================
describe('GET /v1/sops/templates', () => {
  it('should return paginated template list', async () => {
    const token = await loginAs('owner');
    mockFindAllTemplates.mockResolvedValue({ rows: [SAMPLE_TEMPLATE_DRAFT], total: 1 });

    const res = await request(app)
      .get('/v1/sops/templates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should filter by category', async () => {
    const token = await loginAs('div_mgr');
    mockFindAllTemplates.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/sops/templates?category=snow_removal')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAllTemplates).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ category: 'snow_removal' }));
  });

  it('should filter by status', async () => {
    const token = await loginAs('coordinator');
    mockFindAllTemplates.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/sops/templates?status=active')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAllTemplates).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ status: 'active' }));
  });

  it('should reject crew_leader from list', async () => {
    const token = await loginAs('crew_leader');
    const res = await request(app)
      .get('/v1/sops/templates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/sops/templates/:id — Get Template
// ============================================
describe('GET /v1/sops/templates/:id', () => {
  it('should return template with steps', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_DRAFT);

    const res = await request(app)
      .get(`/v1/sops/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Snow Removal - Parking Lot');
    expect(res.body.data.steps).toHaveLength(2);
  });

  it('should allow crew_leader to view template detail', async () => {
    const token = await loginAs('crew_leader');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_ACTIVE);

    const res = await request(app)
      .get(`/v1/sops/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should return 404 for non-existent template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/sops/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/sops/templates — Create Template
// ============================================
describe('POST /v1/sops/templates', () => {
  it('should create a new template (defaults to draft)', async () => {
    const token = await loginAs('owner');
    mockCreateTemplate.mockResolvedValue(SAMPLE_TEMPLATE_DRAFT);

    const res = await request(app)
      .post('/v1/sops/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Snow Removal - Parking Lot',
        description: 'Standard procedure for parking lot snow removal',
        category: 'snow_removal',
        division: 'snow_removal',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
  });

  it('should reject coordinator from creating', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/sops/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test SOP' });

    expect(res.status).toBe(403);
  });

  it('should require title', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/sops/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'safety' });

    expect(res.status).toBe(400);
  });
});

// ============================================
// PUT /v1/sops/templates/:id — Update Template
// ============================================
describe('PUT /v1/sops/templates/:id', () => {
  it('should update a draft template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_DRAFT);
    const updated = { ...SAMPLE_TEMPLATE_DRAFT, title: 'Updated Title' };
    mockUpdateTemplate.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/sops/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('should reject content edits on active template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_ACTIVE);

    const res = await request(app)
      .put(`/v1/sops/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('draft');
  });

  it('should allow status change on active template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_ACTIVE);
    const archived = { ...SAMPLE_TEMPLATE_ACTIVE, status: 'archived' };
    mockUpdateTemplate.mockResolvedValue(archived);

    const res = await request(app)
      .put(`/v1/sops/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'archived' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('archived');
  });

  it('should return 404 for non-existent template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/sops/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'X' });

    expect(res.status).toBe(404);
  });
});

// ============================================
// DELETE /v1/sops/templates/:id — Delete
// ============================================
describe('DELETE /v1/sops/templates/:id', () => {
  it('should soft delete a template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_DRAFT);
    mockSoftDeleteTemplate.mockResolvedValue({ ...SAMPLE_TEMPLATE_DRAFT, deleted_at: new Date().toISOString() });

    const res = await request(app)
      .delete(`/v1/sops/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });

  it('should reject non-owner delete', async () => {
    const token = await loginAs('div_mgr');

    const res = await request(app)
      .delete(`/v1/sops/templates/${TEMPLATE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /v1/sops/templates/:id/duplicate — Duplicate
// ============================================
describe('POST /v1/sops/templates/:id/duplicate', () => {
  it('should duplicate template with new version', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_ACTIVE);
    const duplicated = { ...SAMPLE_TEMPLATE_DRAFT, id: '99999999-0000-0000-0000-000000000001', version: 2, status: 'draft' };
    mockDuplicateTemplate.mockResolvedValue(duplicated);

    const res = await request(app)
      .post(`/v1/sops/templates/${TEMPLATE_ID}/duplicate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.status).toBe('draft');
  });

  it('should return 404 for non-existent template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/v1/sops/templates/${TEMPLATE_ID}/duplicate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/sops/templates/:id/steps — Add Step
// ============================================
describe('POST /v1/sops/templates/:id/steps', () => {
  it('should add a step to a draft template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_DRAFT);
    const newStep = { ...SAMPLE_STEP_1, step_number: 3, sort_order: 2, title: 'Final check' };
    mockCreateStep.mockResolvedValue(newStep);

    const res = await request(app)
      .post(`/v1/sops/templates/${TEMPLATE_ID}/steps`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Final check', estimated_minutes: 5 });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Final check');
  });

  it('should reject adding step to active template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_ACTIVE);

    const res = await request(app)
      .post(`/v1/sops/templates/${TEMPLATE_ID}/steps`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New step' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('draft');
  });

  it('should require step title', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post(`/v1/sops/templates/${TEMPLATE_ID}/steps`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estimated_minutes: 5 });

    expect(res.status).toBe(400);
  });
});

// ============================================
// PUT /v1/sops/steps/:stepId — Update Step
// ============================================
describe('PUT /v1/sops/steps/:stepId', () => {
  it('should update a step on a draft template', async () => {
    const token = await loginAs('owner');
    mockFindStepById.mockResolvedValue(SAMPLE_STEP_1);
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_DRAFT);
    const updated = { ...SAMPLE_STEP_1, title: 'Updated step title' };
    mockUpdateStep.mockResolvedValue(updated);

    const res = await request(app)
      .put(`/v1/sops/steps/${STEP_ID_1}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated step title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated step title');
  });

  it('should reject editing step on active template', async () => {
    const token = await loginAs('owner');
    mockFindStepById.mockResolvedValue(SAMPLE_STEP_1);
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_ACTIVE);

    const res = await request(app)
      .put(`/v1/sops/steps/${STEP_ID_1}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Nope' });

    expect(res.status).toBe(400);
  });

  it('should return 404 for non-existent step', async () => {
    const token = await loginAs('owner');
    mockFindStepById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/v1/sops/steps/${STEP_ID_1}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'X' });

    expect(res.status).toBe(404);
  });
});

// ============================================
// DELETE /v1/sops/steps/:stepId — Delete Step
// ============================================
describe('DELETE /v1/sops/steps/:stepId', () => {
  it('should delete step from draft template', async () => {
    const token = await loginAs('owner');
    mockFindStepById.mockResolvedValue(SAMPLE_STEP_1);
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_DRAFT);
    mockSoftDeleteStep.mockResolvedValue({ ...SAMPLE_STEP_1, deleted_at: new Date().toISOString() });

    const res = await request(app)
      .delete(`/v1/sops/steps/${STEP_ID_1}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });

  it('should reject deleting step from active template', async () => {
    const token = await loginAs('owner');
    mockFindStepById.mockResolvedValue(SAMPLE_STEP_1);
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_ACTIVE);

    const res = await request(app)
      .delete(`/v1/sops/steps/${STEP_ID_1}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ============================================
// PUT /v1/sops/templates/:id/steps/reorder — Reorder Steps
// ============================================
describe('PUT /v1/sops/templates/:id/steps/reorder', () => {
  it('should reorder steps on a draft template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_DRAFT);
    const reordered = [
      { ...SAMPLE_STEP_2, sort_order: 0, step_number: 1 },
      { ...SAMPLE_STEP_1, sort_order: 1, step_number: 2 },
    ];
    mockReorderSteps.mockResolvedValue(reordered);

    const res = await request(app)
      .put(`/v1/sops/templates/${TEMPLATE_ID}/steps/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ step_ids: [STEP_ID_2, STEP_ID_1] });

    expect(res.status).toBe(200);
    expect(res.body.data[0].id).toBe(STEP_ID_2);
  });

  it('should reject reorder on active template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_ACTIVE);

    const res = await request(app)
      .put(`/v1/sops/templates/${TEMPLATE_ID}/steps/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ step_ids: [STEP_ID_2, STEP_ID_1] });

    expect(res.status).toBe(400);
  });

  it('should require at least one step_id', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .put(`/v1/sops/templates/${TEMPLATE_ID}/steps/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ step_ids: [] });

    expect(res.status).toBe(400);
  });
});

// ============================================
// GET /v1/sops/assignments — List Assignments
// ============================================
describe('GET /v1/sops/assignments', () => {
  it('should return paginated assignment list', async () => {
    const token = await loginAs('owner');
    mockFindAllAssignments.mockResolvedValue({ rows: [SAMPLE_ASSIGNMENT], total: 1 });

    const res = await request(app)
      .get('/v1/sops/assignments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('should filter by job_id', async () => {
    const token = await loginAs('crew_leader');
    mockFindAllAssignments.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get(`/v1/sops/assignments?job_id=${JOB_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAllAssignments).toHaveBeenCalledWith(TENANT_A, expect.objectContaining({ job_id: JOB_ID }));
  });

  it('should reject crew_member from listing assignments', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .get('/v1/sops/assignments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// GET /v1/sops/assignments/:id — Get Assignment
// ============================================
describe('GET /v1/sops/assignments/:id', () => {
  it('should return assignment with completions and percentage', async () => {
    const token = await loginAs('owner');
    const completions = [
      { ...SAMPLE_COMPLETION, is_completed: true },
      { ...SAMPLE_COMPLETION, id: '66666666-0000-0000-0000-000000000002', step_id: STEP_ID_2, is_completed: false },
    ];
    mockFindAssignmentById.mockResolvedValue({
      ...SAMPLE_ASSIGNMENT,
      step_completions: completions,
      completion_percentage: 50,
    });

    const res = await request(app)
      .get(`/v1/sops/assignments/${ASSIGNMENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.completion_percentage).toBe(50);
    expect(res.body.data.step_completions).toHaveLength(2);
  });

  it('should allow crew_member to view assignment detail', async () => {
    const token = await loginAs('crew_member');
    mockFindAssignmentById.mockResolvedValue({ ...SAMPLE_ASSIGNMENT, step_completions: [], completion_percentage: 0 });

    const res = await request(app)
      .get(`/v1/sops/assignments/${ASSIGNMENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should return 404 for non-existent assignment', async () => {
    const token = await loginAs('owner');
    mockFindAssignmentById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/sops/assignments/${ASSIGNMENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/sops/assignments — Create Assignment
// ============================================
describe('POST /v1/sops/assignments', () => {
  it('should assign active template and create step completions', async () => {
    const token = await loginAs('coordinator');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_ACTIVE);
    mockCreateAssignment.mockResolvedValue(SAMPLE_ASSIGNMENT);
    mockFindStepsByTemplateId.mockResolvedValue([SAMPLE_STEP_1, SAMPLE_STEP_2]);
    mockCreateStepCompletions.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/v1/sops/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        template_id: TEMPLATE_ID,
        job_id: JOB_ID,
        crew_id: CREW_ID,
      });

    expect(res.status).toBe(201);
    expect(mockCreateStepCompletions).toHaveBeenCalledWith(
      TENANT_A, ASSIGNMENT_ID, [SAMPLE_STEP_1, SAMPLE_STEP_2],
    );
  });

  it('should reject assignment of draft template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(SAMPLE_TEMPLATE_DRAFT);

    const res = await request(app)
      .post('/v1/sops/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ template_id: TEMPLATE_ID });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('active');
  });

  it('should return 404 for non-existent template', async () => {
    const token = await loginAs('owner');
    mockFindTemplateById.mockResolvedValue(null);

    const res = await request(app)
      .post('/v1/sops/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ template_id: TEMPLATE_ID });

    expect(res.status).toBe(404);
  });

  it('should reject crew_leader from creating assignments', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post('/v1/sops/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ template_id: TEMPLATE_ID });

    expect(res.status).toBe(403);
  });
});

// ============================================
// PATCH /v1/sops/assignments/:id/status — Update Status
// ============================================
describe('PATCH /v1/sops/assignments/:id/status', () => {
  it('should update assignment status', async () => {
    const token = await loginAs('crew_leader');
    mockFindAssignmentById.mockResolvedValue({ ...SAMPLE_ASSIGNMENT, step_completions: [], completion_percentage: 0 });
    mockUpdateAssignmentStatus.mockResolvedValue({ ...SAMPLE_ASSIGNMENT, status: 'in_progress' });

    const res = await request(app)
      .patch(`/v1/sops/assignments/${ASSIGNMENT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
  });

  it('should return 404 for non-existent assignment', async () => {
    const token = await loginAs('owner');
    mockFindAssignmentById.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/v1/sops/assignments/${ASSIGNMENT_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(404);
  });
});

// ============================================
// POST /v1/sops/assignments/:assignmentId/steps/:stepId/complete — Complete Step
// ============================================
describe('POST /v1/sops/assignments/:assignmentId/steps/:stepId/complete', () => {
  it('should complete a step', async () => {
    const token = await loginAs('crew_leader');
    mockFindAssignmentById.mockResolvedValue({ ...SAMPLE_ASSIGNMENT, step_completions: [SAMPLE_COMPLETION], completion_percentage: 0 });
    mockFindStepCompletion.mockResolvedValue(SAMPLE_COMPLETION);
    const completed = { ...SAMPLE_COMPLETION, is_completed: true, completed_by: USER_ID, completed_at: new Date().toISOString() };
    mockCompleteStep.mockResolvedValue(completed);

    const res = await request(app)
      .post(`/v1/sops/assignments/${ASSIGNMENT_ID}/steps/${STEP_ID_1}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Done' });

    expect(res.status).toBe(200);
    expect(res.body.data.is_completed).toBe(true);
  });

  it('should allow crew_member to complete a step', async () => {
    const token = await loginAs('crew_member');
    mockFindAssignmentById.mockResolvedValue({ ...SAMPLE_ASSIGNMENT, step_completions: [SAMPLE_COMPLETION], completion_percentage: 0 });
    mockFindStepCompletion.mockResolvedValue(SAMPLE_COMPLETION);
    const completed = { ...SAMPLE_COMPLETION, is_completed: true, completed_by: USER_ID };
    mockCompleteStep.mockResolvedValue(completed);

    const res = await request(app)
      .post(`/v1/sops/assignments/${ASSIGNMENT_ID}/steps/${STEP_ID_1}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.is_completed).toBe(true);
  });

  it('should return 404 for non-existent assignment', async () => {
    const token = await loginAs('crew_leader');
    mockFindAssignmentById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/v1/sops/assignments/${ASSIGNMENT_ID}/steps/${STEP_ID_1}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it('should return 404 for non-existent step completion', async () => {
    const token = await loginAs('crew_leader');
    mockFindAssignmentById.mockResolvedValue({ ...SAMPLE_ASSIGNMENT, step_completions: [], completion_percentage: 0 });
    mockFindStepCompletion.mockResolvedValue(null);

    const res = await request(app)
      .post(`/v1/sops/assignments/${ASSIGNMENT_ID}/steps/${STEP_ID_1}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });
});

// ============================================
// Tenant Isolation
// ============================================
describe('Tenant Isolation', () => {
  it('should scope templates to tenant', async () => {
    const token = await loginAs('owner', TENANT_B);
    mockFindAllTemplates.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/sops/templates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAllTemplates).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });

  it('should scope assignments to tenant', async () => {
    const token = await loginAs('owner', TENANT_B);
    mockFindAllAssignments.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get('/v1/sops/assignments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFindAllAssignments).toHaveBeenCalledWith(TENANT_B, expect.anything());
  });
});
