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

// --- Mock users repository ---
const mockUsersFindAll = vi.fn();
const mockUsersFindById = vi.fn();
const mockUsersGetUserRoles = vi.fn();
const mockUsersCreate = vi.fn();
const mockUsersUpdate = vi.fn();
const mockUsersUpdatePassword = vi.fn();
const mockUsersDeactivate = vi.fn();
const mockUsersActivate = vi.fn();
const mockUsersAssignRole = vi.fn();
const mockUsersRemoveRole = vi.fn();
const mockUsersAssignDivision = vi.fn();
const mockUsersRemoveDivision = vi.fn();
const mockUsersCountByRole = vi.fn();
const mockUsersGetStats = vi.fn();
const mockUsersEmailExists = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: (...args: unknown[]) => mockUsersFindAll(...args),
  findById: (...args: unknown[]) => mockUsersFindById(...args),
  getUserRoles: (...args: unknown[]) => mockUsersGetUserRoles(...args),
  create: (...args: unknown[]) => mockUsersCreate(...args),
  update: (...args: unknown[]) => mockUsersUpdate(...args),
  updatePassword: (...args: unknown[]) => mockUsersUpdatePassword(...args),
  deactivate: (...args: unknown[]) => mockUsersDeactivate(...args),
  activate: (...args: unknown[]) => mockUsersActivate(...args),
  assignRole: (...args: unknown[]) => mockUsersAssignRole(...args),
  removeRole: (...args: unknown[]) => mockUsersRemoveRole(...args),
  assignDivision: (...args: unknown[]) => mockUsersAssignDivision(...args),
  removeDivision: (...args: unknown[]) => mockUsersRemoveDivision(...args),
  countByRole: (...args: unknown[]) => mockUsersCountByRole(...args),
  getStats: (...args: unknown[]) => mockUsersGetStats(...args),
  emailExists: (...args: unknown[]) => mockUsersEmailExists(...args),
}));

import app from '../../../app.js';

// --- Test fixtures ---
const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const OWNER_ID = 'cccccccc-0000-0000-0000-000000000001';
const USER_ID = 'dddddddd-0000-0000-0000-000000000001';
const NON_OWNER_ID = 'eeeeeeee-0000-0000-0000-000000000001';

const SAMPLE_USER = {
  id: USER_ID,
  tenant_id: TENANT_A,
  email: 'testuser@example.com',
  first_name: 'Test',
  last_name: 'User',
  phone: '555-0100',
  is_active: true,
  last_login_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SAMPLE_ROLES = [
  { role_name: 'crew_member', division_id: null, division_name: null },
];

// --- Helper: log in as owner ---
async function loginAsOwner(): Promise<string> {
  mockFindUserByEmail.mockResolvedValueOnce({
    id: OWNER_ID,
    tenant_id: TENANT_A,
    email: 'owner@test.com',
    password_hash: TEST_HASH,
    first_name: 'Owner',
    last_name: 'Admin',
    is_active: true,
  });
  mockFindUserRoles.mockResolvedValueOnce([
    { role_name: 'owner', division_id: null, division_name: null },
  ]);
  mockSaveRefreshToken.mockResolvedValueOnce(undefined);
  mockUpdateLastLogin.mockResolvedValueOnce(undefined);

  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'owner@test.com', password: TEST_PASSWORD });
  return res.body.data.accessToken;
}

// --- Helper: log in as non-owner ---
async function loginAsNonOwner(): Promise<string> {
  mockFindUserByEmail.mockResolvedValueOnce({
    id: NON_OWNER_ID,
    tenant_id: TENANT_A,
    email: 'crew@test.com',
    password_hash: TEST_HASH,
    first_name: 'Crew',
    last_name: 'Member',
    is_active: true,
  });
  mockFindUserRoles.mockResolvedValueOnce([
    { role_name: 'crew_member', division_id: null, division_name: null },
  ]);
  mockSaveRefreshToken.mockResolvedValueOnce(undefined);
  mockUpdateLastLogin.mockResolvedValueOnce(undefined);

  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'crew@test.com', password: TEST_PASSWORD });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  vi.clearAllMocks();
  TEST_HASH = await bcrypt.hash(TEST_PASSWORD, 4);
});

// ============ TESTS ============

describe('GET /v1/users', () => {
  it('should return paginated user list for owner', async () => {
    const token = await loginAsOwner();
    mockUsersFindAll.mockResolvedValueOnce({ rows: [SAMPLE_USER], total: 1 });
    mockUsersGetUserRoles.mockResolvedValueOnce(SAMPLE_ROLES);

    const res = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].email).toBe('testuser@example.com');
    expect(res.body.pagination.total).toBe(1);
  });

  it('should reject non-owner access', async () => {
    const token = await loginAsNonOwner();

    const res = await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/v1/users');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/users/:id', () => {
  it('should return user with roles', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersGetUserRoles.mockResolvedValueOnce(SAMPLE_ROLES);

    const res = await request(app)
      .get(`/v1/users/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('testuser@example.com');
    expect(res.body.data.roles).toHaveLength(1);
    expect(res.body.data.roles[0].role).toBe('crew_member');
  });

  it('should return 404 for non-existent user', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get(`/v1/users/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /v1/users', () => {
  it('should create a new user', async () => {
    const token = await loginAsOwner();
    mockUsersEmailExists.mockResolvedValueOnce(false);
    mockUsersCreate.mockResolvedValueOnce({ ...SAMPLE_USER, id: 'new-user-id' });
    mockUsersFindById.mockResolvedValueOnce({ ...SAMPLE_USER, id: 'new-user-id' });
    mockUsersGetUserRoles.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newuser@example.com',
        password: 'Password123',
        first_name: 'New',
        last_name: 'User',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(mockUsersCreate).toHaveBeenCalled();
  });

  it('should reject duplicate email', async () => {
    const token = await loginAsOwner();
    mockUsersEmailExists.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'duplicate@example.com',
        password: 'Password123',
        first_name: 'Dup',
        last_name: 'User',
      });

    expect(res.status).toBe(409);
  });

  it('should reject password shorter than 8 characters', async () => {
    const token = await loginAsOwner();

    const res = await request(app)
      .post('/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'short@example.com',
        password: 'short',
        first_name: 'Short',
        last_name: 'Pass',
      });

    expect(res.status).toBe(400);
  });
});

describe('PUT /v1/users/:id', () => {
  it('should update user details', async () => {
    const token = await loginAsOwner();
    const updated = { ...SAMPLE_USER, first_name: 'Updated' };
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER); // existence check
    mockUsersUpdate.mockResolvedValueOnce(updated);
    mockUsersFindById.mockResolvedValueOnce(updated); // getUser after update
    mockUsersGetUserRoles.mockResolvedValueOnce(SAMPLE_ROLES);

    const res = await request(app)
      .put(`/v1/users/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('Updated');
  });

  it('should reject duplicate email on update', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersEmailExists.mockResolvedValueOnce(true);

    const res = await request(app)
      .put(`/v1/users/${USER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
  });
});

describe('PUT /v1/users/:id/password', () => {
  it('should change password', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersUpdatePassword.mockResolvedValueOnce(true);

    const res = await request(app)
      .put(`/v1/users/${USER_ID}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'NewPassword123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password updated');
  });

  it('should reject short password', async () => {
    const token = await loginAsOwner();

    const res = await request(app)
      .put(`/v1/users/${USER_ID}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'short' });

    expect(res.status).toBe(400);
  });
});

describe('POST /v1/users/:id/deactivate', () => {
  it('should deactivate user', async () => {
    const token = await loginAsOwner();
    const deactivated = { ...SAMPLE_USER, is_active: false };
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER); // existence check
    mockUsersCountByRole.mockResolvedValueOnce(2); // 2 owners
    mockUsersGetUserRoles.mockResolvedValueOnce(SAMPLE_ROLES); // user is crew_member, not owner
    mockUsersDeactivate.mockResolvedValueOnce(deactivated);
    mockUsersFindById.mockResolvedValueOnce(deactivated); // getUser after deactivate
    mockUsersGetUserRoles.mockResolvedValueOnce(SAMPLE_ROLES);

    const res = await request(app)
      .post(`/v1/users/${USER_ID}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);
  });

  it('should prevent deactivating the last owner', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersCountByRole.mockResolvedValueOnce(1); // only 1 owner
    mockUsersGetUserRoles.mockResolvedValueOnce([
      { role_name: 'owner', division_id: null, division_name: null },
    ]);

    const res = await request(app)
      .post(`/v1/users/${USER_ID}/deactivate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('last owner');
  });
});

describe('POST /v1/users/:id/activate', () => {
  it('should activate user', async () => {
    const token = await loginAsOwner();
    const activated = { ...SAMPLE_USER, is_active: true };
    mockUsersFindById.mockResolvedValueOnce({ ...SAMPLE_USER, is_active: false });
    mockUsersActivate.mockResolvedValueOnce(activated);
    mockUsersFindById.mockResolvedValueOnce(activated);
    mockUsersGetUserRoles.mockResolvedValueOnce(SAMPLE_ROLES);

    const res = await request(app)
      .post(`/v1/users/${USER_ID}/activate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(true);
  });
});

describe('POST /v1/users/:id/roles', () => {
  it('should assign a role', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersAssignRole.mockResolvedValueOnce(undefined);
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER); // getUser after
    mockUsersGetUserRoles.mockResolvedValueOnce([
      ...SAMPLE_ROLES,
      { role_name: 'coordinator', division_id: null, division_name: null },
    ]);

    const res = await request(app)
      .post(`/v1/users/${USER_ID}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'coordinator' });

    expect(res.status).toBe(200);
    expect(res.body.data.roles).toHaveLength(2);
  });

  it('should validate role name', async () => {
    const token = await loginAsOwner();

    const res = await request(app)
      .post(`/v1/users/${USER_ID}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'invalid_role' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /v1/users/:id/roles/:role', () => {
  it('should remove a role', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersRemoveRole.mockResolvedValueOnce(undefined);
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersGetUserRoles.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete(`/v1/users/${USER_ID}/roles/crew_member`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should prevent removing the last owner role', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersCountByRole.mockResolvedValueOnce(1);

    const res = await request(app)
      .delete(`/v1/users/${USER_ID}/roles/owner`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('last owner');
  });
});

describe('POST /v1/users/:id/divisions', () => {
  it('should assign a division', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersAssignDivision.mockResolvedValueOnce(undefined);
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersGetUserRoles.mockResolvedValueOnce([
      { role_name: 'crew_member', division_id: 'div-1', division_name: 'snow_removal' },
    ]);

    const res = await request(app)
      .post(`/v1/users/${USER_ID}/divisions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ division: 'snow_removal' });

    expect(res.status).toBe(200);
  });
});

describe('DELETE /v1/users/:id/divisions/:division', () => {
  it('should remove a division', async () => {
    const token = await loginAsOwner();
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersRemoveDivision.mockResolvedValueOnce(undefined);
    mockUsersFindById.mockResolvedValueOnce(SAMPLE_USER);
    mockUsersGetUserRoles.mockResolvedValueOnce(SAMPLE_ROLES);

    const res = await request(app)
      .delete(`/v1/users/${USER_ID}/divisions/snow_removal`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /v1/users/stats', () => {
  it('should return user stats', async () => {
    const token = await loginAsOwner();
    mockUsersGetStats.mockResolvedValueOnce({
      total: 5,
      active: 4,
      inactive: 1,
      byRole: [
        { role: 'owner', count: 2 },
        { role: 'crew_member', count: 3 },
      ],
    });

    const res = await request(app)
      .get('/v1/users/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(5);
    expect(res.body.data.active).toBe(4);
    expect(res.body.data.byRole).toHaveLength(2);
  });
});

describe('Tenant isolation', () => {
  it('should scope queries to tenant_id', async () => {
    const token = await loginAsOwner();
    mockUsersFindAll.mockResolvedValueOnce({ rows: [], total: 0 });

    await request(app)
      .get('/v1/users')
      .set('Authorization', `Bearer ${token}`);

    expect(mockUsersFindAll).toHaveBeenCalledWith(
      TENANT_A,
      expect.any(Object),
    );
  });
});
