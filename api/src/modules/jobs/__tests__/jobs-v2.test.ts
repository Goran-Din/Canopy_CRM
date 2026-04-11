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

// --- Mock job repository ---
const mockJobFindAll = vi.fn();
const mockJobFindById = vi.fn();
const mockJobCreate = vi.fn();
const mockJobUpdate = vi.fn();
const mockJobUpdateStatus = vi.fn();
const mockJobSoftDelete = vi.fn();
const mockJobGetByDateRange = vi.fn();
const mockJobGetByProperty = vi.fn();
const mockJobAddPhoto = vi.fn();
const mockJobGetPhotos = vi.fn();
const mockJobAddChecklistItem = vi.fn();
const mockJobUpdateChecklistItem = vi.fn();
const mockJobGetChecklist = vi.fn();
const mockJobGetChecklistItemById = vi.fn();
const mockJobGetStats = vi.fn();
const mockJobCustomerExists = vi.fn();
const mockJobPropertyBelongsToCustomer = vi.fn();
const mockJobContractExists = vi.fn();
const mockGetNextJobNumber = vi.fn();
const mockCreateWithClient = vi.fn();
const mockUpdateStatusWithClient = vi.fn();
const mockAcquireClient = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockJobFindAll(...args),
  findById: (...args: unknown[]) => mockJobFindById(...args),
  create: (...args: unknown[]) => mockJobCreate(...args),
  update: (...args: unknown[]) => mockJobUpdate(...args),
  updateStatus: (...args: unknown[]) => mockJobUpdateStatus(...args),
  softDelete: (...args: unknown[]) => mockJobSoftDelete(...args),
  getByDateRange: (...args: unknown[]) => mockJobGetByDateRange(...args),
  getByProperty: (...args: unknown[]) => mockJobGetByProperty(...args),
  addPhoto: (...args: unknown[]) => mockJobAddPhoto(...args),
  getPhotos: (...args: unknown[]) => mockJobGetPhotos(...args),
  addChecklistItem: (...args: unknown[]) => mockJobAddChecklistItem(...args),
  updateChecklistItem: (...args: unknown[]) => mockJobUpdateChecklistItem(...args),
  getChecklist: (...args: unknown[]) => mockJobGetChecklist(...args),
  getChecklistItemById: (...args: unknown[]) => mockJobGetChecklistItemById(...args),
  getStats: (...args: unknown[]) => mockJobGetStats(...args),
  customerExists: (...args: unknown[]) => mockJobCustomerExists(...args),
  propertyBelongsToCustomer: (...args: unknown[]) => mockJobPropertyBelongsToCustomer(...args),
  contractExists: (...args: unknown[]) => mockJobContractExists(...args),
  getNextJobNumber: (...args: unknown[]) => mockGetNextJobNumber(...args),
  createWithClient: (...args: unknown[]) => mockCreateWithClient(...args),
  updateStatusWithClient: (...args: unknown[]) => mockUpdateStatusWithClient(...args),
  acquireClient: (...args: unknown[]) => mockAcquireClient(...args),
}));

// --- Mock diary repository ---
const mockDiaryInsert = vi.fn();
const mockDiaryInsertStandalone = vi.fn();
const mockDiaryFindByJobId = vi.fn();

vi.mock('../diary/diary.repository.js', () => ({
  insert: (...args: unknown[]) => mockDiaryInsert(...args),
  insertStandalone: (...args: unknown[]) => mockDiaryInsertStandalone(...args),
  findByJobId: (...args: unknown[]) => mockDiaryFindByJobId(...args),
}));

// --- Mock photos repository ---
const mockPhotosInsertStandalone = vi.fn();
const mockPhotosFindByJobId = vi.fn();
const mockPhotosFindById = vi.fn();
const mockPhotosUpdate = vi.fn();
const mockPhotosSoftDelete = vi.fn();

vi.mock('../photos/photos.repository.js', () => ({
  insert: vi.fn(),
  insertStandalone: (...args: unknown[]) => mockPhotosInsertStandalone(...args),
  findByJobId: (...args: unknown[]) => mockPhotosFindByJobId(...args),
  findById: (...args: unknown[]) => mockPhotosFindById(...args),
  update: (...args: unknown[]) => mockPhotosUpdate(...args),
  softDelete: (...args: unknown[]) => mockPhotosSoftDelete(...args),
}));

// --- Mock badges repository ---
const mockBadgesFindAll = vi.fn();
const mockBadgesFindById = vi.fn();
const mockBadgesUpsert = vi.fn();
const mockBadgesAssignToJob = vi.fn();

vi.mock('../badges/badges.repository.js', () => ({
  findAll: (...args: unknown[]) => mockBadgesFindAll(...args),
  findById: (...args: unknown[]) => mockBadgesFindById(...args),
  upsert: (...args: unknown[]) => mockBadgesUpsert(...args),
  assignToJob: (...args: unknown[]) => mockBadgesAssignToJob(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const JOB_ID = '33333333-0000-0000-0000-000000000001';
const PHOTO_ID = '44444444-0000-0000-0000-000000000001';
const FILE_ID = '66666666-0000-0000-0000-000000000001';
const BADGE_ID = '77777777-0000-0000-0000-000000000001';
const DIARY_ID = '88888888-0000-0000-0000-000000000001';

const SAMPLE_JOB_V2 = {
  id: JOB_ID,
  tenant_id: TENANT_A,
  contract_id: null,
  customer_id: CUSTOMER_ID,
  property_id: PROPERTY_ID,
  division: 'landscaping_maintenance',
  job_type: 'scheduled_service',
  status: 'quote',
  priority: 'normal',
  title: 'Garden Renovation',
  description: null,
  scheduled_date: null,
  scheduled_start_time: null,
  estimated_duration_minutes: null,
  actual_start_time: null,
  actual_end_time: null,
  actual_duration_minutes: null,
  assigned_crew_id: null,
  assigned_to: null,
  notes: null,
  completion_notes: null,
  requires_photos: false,
  invoice_id: null,
  weather_condition: null,
  tags: [],
  created_by: USER_ID,
  updated_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  job_number: '0001-26',
  creation_path: 'quote',
  badge_ids: [],
  customer_display_name: 'Jane Smith',
  property_name: 'Front Yard',
  contract_title: null,
  photos: [],
  checklist: [],
};

const SAMPLE_DIARY_ENTRY = {
  id: DIARY_ID,
  tenant_id: TENANT_A,
  job_id: JOB_ID,
  entry_type: 'job_created',
  title: 'Job #0001-26 created as Quote',
  body: null,
  metadata: { creation_path: 'quote', created_by: USER_ID },
  created_by_user_id: USER_ID,
  is_system_entry: false,
  northchat_thread_id: null,
  created_at: new Date().toISOString(),
};

const SAMPLE_PHOTO_V2 = {
  id: PHOTO_ID,
  tenant_id: TENANT_A,
  job_id: JOB_ID,
  file_id: FILE_ID,
  property_id: PROPERTY_ID,
  photo_tag: 'before_work',
  caption: 'Before work started',
  uploaded_by: USER_ID,
  upload_source: 'staff_web',
  portal_visible: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const SAMPLE_BADGE = {
  id: BADGE_ID,
  tenant_id: TENANT_A,
  badge_name: 'VIP',
  badge_color: '#7C3AED',
  badge_icon: 'crown',
  sort_order: 0,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function createMockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
}

let mockClient: ReturnType<typeof createMockClient>;

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
  mockClient = createMockClient();
  mockAcquireClient.mockResolvedValue(mockClient);
});

// ============================================
// POST /v1/jobs/v2 — V2 Job Creation
// ============================================
describe('POST /v1/jobs/v2', () => {
  it('should create job with job_number and diary entry', async () => {
    const token = await loginAs('owner');
    mockJobCustomerExists.mockResolvedValue(true);
    mockJobPropertyBelongsToCustomer.mockResolvedValue(true);
    mockGetNextJobNumber.mockResolvedValue('0001-26');
    mockCreateWithClient.mockResolvedValue(SAMPLE_JOB_V2);
    mockDiaryInsert.mockResolvedValue(SAMPLE_DIARY_ENTRY);

    const res = await request(app)
      .post('/v1/jobs/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        creation_path: 'quote',
        title: 'Garden Renovation',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.job_number).toBe('0001-26');
    expect(res.body.data.creation_path).toBe('quote');
    expect(mockGetNextJobNumber).toHaveBeenCalled();
    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        entry_type: 'job_created',
        job_id: JOB_ID,
      }),
    );
  });

  it('should set status to unscheduled for instant_work_order', async () => {
    const token = await loginAs('coordinator');
    mockJobCustomerExists.mockResolvedValue(true);
    mockJobPropertyBelongsToCustomer.mockResolvedValue(true);
    mockGetNextJobNumber.mockResolvedValue('0002-26');
    mockCreateWithClient.mockResolvedValue({
      ...SAMPLE_JOB_V2,
      status: 'unscheduled',
      creation_path: 'instant_work_order',
      job_number: '0002-26',
    });
    mockDiaryInsert.mockResolvedValue(SAMPLE_DIARY_ENTRY);

    const res = await request(app)
      .post('/v1/jobs/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        creation_path: 'instant_work_order',
        title: 'Emergency Fix',
      });

    expect(res.status).toBe(201);
    expect(mockCreateWithClient).toHaveBeenCalledWith(
      mockClient,
      TENANT_A,
      expect.objectContaining({ status: 'unscheduled', creation_path: 'instant_work_order' }),
      USER_ID,
    );
  });

  it('should set status to assessment for assessment path', async () => {
    const token = await loginAs('owner');
    mockJobCustomerExists.mockResolvedValue(true);
    mockJobPropertyBelongsToCustomer.mockResolvedValue(true);
    mockGetNextJobNumber.mockResolvedValue('0003-26');
    mockCreateWithClient.mockResolvedValue({
      ...SAMPLE_JOB_V2,
      status: 'assessment',
      creation_path: 'assessment',
    });
    mockDiaryInsert.mockResolvedValue(SAMPLE_DIARY_ENTRY);

    const res = await request(app)
      .post('/v1/jobs/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'hardscape',
        creation_path: 'assessment',
        title: 'Patio Assessment',
      });

    expect(res.status).toBe(201);
    expect(mockCreateWithClient).toHaveBeenCalledWith(
      mockClient,
      TENANT_A,
      expect.objectContaining({ status: 'assessment' }),
      USER_ID,
    );
  });

  it('should deny crew_leader from creating V2 jobs', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post('/v1/jobs/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        creation_path: 'quote',
        title: 'Test',
      });

    expect(res.status).toBe(403);
  });

  it('should reject missing creation_path', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post('/v1/jobs/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        title: 'Test',
      });

    expect(res.status).toBe(400);
  });
});

// ============================================
// POST /v1/jobs/:id/status — V2 Status Change (with diary)
// ============================================
describe('POST /v1/jobs/:id/status', () => {
  it('should change status and create diary entry', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB_V2, status: 'unscheduled' });
    mockUpdateStatusWithClient.mockResolvedValue({
      ...SAMPLE_JOB_V2,
      status: 'scheduled',
    });
    mockDiaryInsert.mockResolvedValue({
      ...SAMPLE_DIARY_ENTRY,
      entry_type: 'status_change',
    });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'scheduled' });

    expect(res.status).toBe(200);
    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        entry_type: 'status_change',
        title: expect.stringContaining('unscheduled → scheduled'),
      }),
    );
  });

  it('should return same job if already in target status', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB_V2, status: 'scheduled' });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'scheduled' });

    expect(res.status).toBe(200);
    expect(mockUpdateStatusWithClient).not.toHaveBeenCalled();
  });

  it('should reject invalid transition', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB_V2, status: 'scheduled' });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
  });

  it('should allow crew_member to change status (limited)', async () => {
    const token = await loginAs('crew_member');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB_V2, status: 'scheduled' });
    mockUpdateStatusWithClient.mockResolvedValue({
      ...SAMPLE_JOB_V2,
      status: 'in_progress',
    });
    mockDiaryInsert.mockResolvedValue(SAMPLE_DIARY_ENTRY);

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
  });
});

// ============================================
// POST /v1/jobs/:id/convert-to-wo — Convert Assessment
// ============================================
describe('POST /v1/jobs/:id/convert-to-wo', () => {
  it('should convert assessment to work order', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB_V2, status: 'assessment', creation_path: 'assessment' });
    mockUpdateStatusWithClient.mockResolvedValue({
      ...SAMPLE_JOB_V2,
      status: 'unscheduled',
      creation_path: 'instant_work_order',
    });
    mockDiaryInsert.mockResolvedValue({
      ...SAMPLE_DIARY_ENTRY,
      entry_type: 'job_converted_to_wo',
    });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/convert-to-wo`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockDiaryInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        entry_type: 'job_converted_to_wo',
        title: 'Converted from Assessment to Work Order',
      }),
    );
  });

  it('should reject non-assessment job', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue({ ...SAMPLE_JOB_V2, status: 'scheduled' });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/convert-to-wo`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('should deny crew_leader from converting', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/convert-to-wo`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Diary Endpoints
// ============================================
describe('GET /v1/jobs/:id/diary', () => {
  it('should return paginated diary entries', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB_V2);
    mockDiaryFindByJobId.mockResolvedValue({
      rows: [SAMPLE_DIARY_ENTRY],
      total: 1,
    });

    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}/diary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('should allow crew_member to view diary', async () => {
    const token = await loginAs('crew_member');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB_V2);
    mockDiaryFindByJobId.mockResolvedValue({ rows: [], total: 0 });

    const res = await request(app)
      .get(`/v1/jobs/${JOB_ID}/diary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /v1/jobs/:id/diary', () => {
  it('should add a manual diary note', async () => {
    const token = await loginAs('coordinator');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB_V2);
    mockDiaryInsertStandalone.mockResolvedValue({
      ...SAMPLE_DIARY_ENTRY,
      entry_type: 'note_added',
      body: 'Customer called to confirm appointment.',
    });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/diary`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Customer called to confirm appointment.' });

    expect(res.status).toBe(201);
    expect(mockDiaryInsertStandalone).toHaveBeenCalledWith(
      expect.objectContaining({
        entry_type: 'note_added',
        is_system_entry: false,
      }),
    );
  });

  it('should reject empty diary note', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/diary`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '' });

    expect(res.status).toBe(400);
  });
});

// ============================================
// V2 Photo CRUD
// ============================================
describe('POST /v1/jobs/:id/photos/v2', () => {
  it('should add V2 photo with tag and create diary entry', async () => {
    const token = await loginAs('crew_member');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB_V2);
    mockPhotosInsertStandalone.mockResolvedValue(SAMPLE_PHOTO_V2);
    mockDiaryInsertStandalone.mockResolvedValue({
      ...SAMPLE_DIARY_ENTRY,
      entry_type: 'photo_uploaded',
    });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/photos/v2`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        file_id: FILE_ID,
        photo_tag: 'before_work',
        caption: 'Before work started',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.photo_tag).toBe('before_work');
    expect(mockDiaryInsertStandalone).toHaveBeenCalledWith(
      expect.objectContaining({ entry_type: 'photo_uploaded' }),
    );
  });

  it('should default portal_visible to true for after_work tag', async () => {
    const token = await loginAs('crew_leader');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB_V2);
    mockPhotosInsertStandalone.mockResolvedValue({
      ...SAMPLE_PHOTO_V2,
      photo_tag: 'after_work',
      portal_visible: true,
    });
    mockDiaryInsertStandalone.mockResolvedValue(SAMPLE_DIARY_ENTRY);

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/photos/v2`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        file_id: FILE_ID,
        photo_tag: 'after_work',
      });

    expect(res.status).toBe(201);
    expect(mockPhotosInsertStandalone).toHaveBeenCalledWith(
      expect.objectContaining({ portal_visible: true }),
    );
  });

  it('should reject invalid photo_tag', async () => {
    const token = await loginAs('owner');

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/photos/v2`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        file_id: FILE_ID,
        photo_tag: 'invalid_tag',
      });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /v1/jobs/:id/photos/:photoId', () => {
  it('should update photo metadata', async () => {
    const token = await loginAs('coordinator');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB_V2);
    mockPhotosFindById.mockResolvedValue(SAMPLE_PHOTO_V2);
    mockPhotosUpdate.mockResolvedValue({
      ...SAMPLE_PHOTO_V2,
      portal_visible: true,
    });

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/photos/${PHOTO_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ portal_visible: true });

    expect(res.status).toBe(200);
    expect(res.body.data.portal_visible).toBe(true);
  });

  it('should deny crew_member from toggling portal_visible', async () => {
    const token = await loginAs('crew_member');

    const res = await request(app)
      .patch(`/v1/jobs/${JOB_ID}/photos/${PHOTO_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ portal_visible: true });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /v1/jobs/:id/photos/:photoId', () => {
  it('should soft-delete photo', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB_V2);
    mockPhotosFindById.mockResolvedValue(SAMPLE_PHOTO_V2);
    mockPhotosSoftDelete.mockResolvedValue(SAMPLE_PHOTO_V2);

    const res = await request(app)
      .delete(`/v1/jobs/${JOB_ID}/photos/${PHOTO_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Photo deleted');
  });

  it('should deny crew_leader from deleting photos', async () => {
    const token = await loginAs('crew_leader');

    const res = await request(app)
      .delete(`/v1/jobs/${JOB_ID}/photos/${PHOTO_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ============================================
// Badges
// ============================================
describe('GET /v1/jobs/badges', () => {
  it('should list badges for tenant', async () => {
    const token = await loginAs('owner');
    mockBadgesFindAll.mockResolvedValue([SAMPLE_BADGE]);

    const res = await request(app)
      .get('/v1/jobs/badges')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].badge_name).toBe('VIP');
  });
});

describe('POST /v1/jobs/badges', () => {
  it('should create a badge', async () => {
    const token = await loginAs('owner');
    mockBadgesUpsert.mockResolvedValue(SAMPLE_BADGE);

    const res = await request(app)
      .post('/v1/jobs/badges')
      .set('Authorization', `Bearer ${token}`)
      .send({
        badge_name: 'VIP',
        badge_color: '#7C3AED',
        badge_icon: 'crown',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.badge_name).toBe('VIP');
  });

  it('should deny coordinator from creating badges', async () => {
    const token = await loginAs('coordinator');

    const res = await request(app)
      .post('/v1/jobs/badges')
      .set('Authorization', `Bearer ${token}`)
      .send({
        badge_name: 'Test',
        badge_color: '#000000',
      });

    expect(res.status).toBe(403);
  });
});

describe('POST /v1/jobs/:id/badges', () => {
  it('should assign badges to job', async () => {
    const token = await loginAs('owner');
    mockJobFindById.mockResolvedValue(SAMPLE_JOB_V2);
    mockBadgesFindById.mockResolvedValue(SAMPLE_BADGE);
    mockBadgesAssignToJob.mockResolvedValue(undefined);
    mockJobFindById.mockResolvedValue({
      ...SAMPLE_JOB_V2,
      badge_ids: [BADGE_ID],
    });

    const res = await request(app)
      .post(`/v1/jobs/${JOB_ID}/badges`)
      .set('Authorization', `Bearer ${token}`)
      .send({ badge_ids: [BADGE_ID] });

    expect(res.status).toBe(200);
  });
});

// ============================================
// Role-Based Access for V2
// ============================================
describe('V2 Role-based access', () => {
  it('should allow div_mgr to create V2 jobs', async () => {
    const token = await loginAs('div_mgr');
    mockJobCustomerExists.mockResolvedValue(true);
    mockJobPropertyBelongsToCustomer.mockResolvedValue(true);
    mockGetNextJobNumber.mockResolvedValue('0010-26');
    mockCreateWithClient.mockResolvedValue(SAMPLE_JOB_V2);
    mockDiaryInsert.mockResolvedValue(SAMPLE_DIARY_ENTRY);

    const res = await request(app)
      .post('/v1/jobs/v2')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        division: 'landscaping_maintenance',
        creation_path: 'quote',
        title: 'Test',
      });

    expect(res.status).toBe(201);
  });

  it('should deny unauthenticated requests to V2 endpoints', async () => {
    const res = await request(app).post('/v1/jobs/v2');
    expect(res.status).toBe(401);
  });
});
