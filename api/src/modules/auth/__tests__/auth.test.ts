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

vi.mock('../repository.js', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  findUserRoles: (...args: unknown[]) => mockFindUserRoles(...args),
  saveRefreshToken: (...args: unknown[]) => mockSaveRefreshToken(...args),
  findRefreshToken: (...args: unknown[]) => mockFindRefreshToken(...args),
  revokeRefreshToken: (...args: unknown[]) => mockRevokeRefreshToken(...args),
  revokeAllUserRefreshTokens: (...args: unknown[]) => mockRevokeAllUserRefreshTokens(...args),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
}));

import app from '../../../app.js';
import { authenticate } from '../../../middleware/auth.js';
import { requireRole } from '../../../middleware/rbac.js';
import { tenantScope } from '../../../middleware/tenant.js';
import express from 'express';

// --- Test fixtures ---
const TEST_PASSWORD = 'CanopyAdmin2026!';
let TEST_HASH: string;

const TEST_USER = {
  id: 'aaaaaaaa-1111-2222-3333-444444444444',
  tenant_id: 'bbbbbbbb-1111-2222-3333-444444444444',
  email: 'erick@sunsetservicesus.com',
  first_name: 'Erick',
  last_name: 'Sunset',
  is_active: true,
  password_hash: '', // set in beforeEach
};

const TEST_ROLES = [
  { role_name: 'owner', division_id: null },
];

// Helper to extract cookie from set-cookie header
function extractCookie(res: request.Response, name: string): string | undefined {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return undefined;
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  const match = arr.find((c: string) => c.startsWith(`${name}=`));
  return match?.split(';')[0]?.split('=').slice(1).join('=');
}

beforeEach(async () => {
  vi.clearAllMocks();
  TEST_HASH = await bcrypt.hash(TEST_PASSWORD, 4); // low rounds for fast tests
  TEST_USER.password_hash = TEST_HASH;
});

// ============================================
// Login Tests
// ============================================
describe('POST /auth/login', () => {
  it('should return access token and set refresh cookie on success', async () => {
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue(TEST_ROLES);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.roles).toEqual([{ role: 'owner', division_id: null }]);

    // Refresh token cookie should be set
    const refreshToken = extractCookie(res, 'refresh_token');
    expect(refreshToken).toBeDefined();

    // Repo calls
    expect(mockFindUserByEmail).toHaveBeenCalledWith(TEST_USER.email);
    expect(mockSaveRefreshToken).toHaveBeenCalled();
    expect(mockUpdateLastLogin).toHaveBeenCalledWith(TEST_USER.id);
  });

  it('should return 401 for wrong password', async () => {
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should return 401 for non-existent email', async () => {
    mockFindUserByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should return 401 for deactivated user', async () => {
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER, is_active: false });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Account is deactivated');
  });

  it('should return 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  it('should return 400 for missing password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
});

// ============================================
// Token Refresh Tests
// ============================================
describe('POST /auth/refresh', () => {
  it('should return new access token with valid refresh cookie', async () => {
    // First login to get a refresh token
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue(TEST_ROLES);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    const refreshToken = extractCookie(loginRes, 'refresh_token');
    const setCookieHeader = loginRes.headers['set-cookie'];

    // Now use the refresh endpoint
    mockFindRefreshToken.mockResolvedValue({
      id: 'some-id',
      user_id: TEST_USER.id,
      tenant_id: TEST_USER.tenant_id,
      token: refreshToken,
      expires_at: new Date(Date.now() + 86400000),
    });
    mockFindUserById.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue(TEST_ROLES);

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', setCookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('should return 401 with no refresh cookie', async () => {
    const res = await request(app).post('/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No refresh token provided');
  });

  it('should return 401 with invalid refresh token', async () => {
    mockFindRefreshToken.mockResolvedValue(null);

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'refresh_token=invalid-token-value');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired refresh token');
  });
});

// ============================================
// Logout Tests
// ============================================
describe('POST /auth/logout', () => {
  it('should clear cookie and revoke token', async () => {
    mockRevokeRefreshToken.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', 'refresh_token=some-token-value');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
    expect(mockRevokeRefreshToken).toHaveBeenCalledWith('some-token-value');

    // Cookie should be cleared
    const cookies = res.headers['set-cookie'];
    const arr = Array.isArray(cookies) ? cookies : [cookies];
    const cleared = arr.find((c: string) => c.includes('refresh_token='));
    expect(cleared).toBeDefined();
  });
});

// ============================================
// Expired Token Rejection Tests
// ============================================
describe('Expired token rejection', () => {
  it('should reject expired access token with 401', async () => {
    // Create a test app with a protected route
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/protected', authenticate, (_req, res) => {
      res.json({ status: 'ok' });
    });

    // Use a clearly invalid/expired token
    const res = await request(testApp)
      .get('/protected')
      .set('Authorization', 'Bearer expired.invalid.token');

    expect(res.status).toBe(401);
  });

  it('should reject requests without Authorization header', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/protected', authenticate, (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing or invalid authorization header');
  });

  it('should accept valid access token', async () => {
    // Login first to get a valid token
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue(TEST_ROLES);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    const accessToken = loginRes.body.data.accessToken;

    // Use the token on a protected route
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/protected', authenticate, (req, res) => {
      res.json({ status: 'ok', user: req.user });
    });

    const res = await request(testApp)
      .get('/protected')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(TEST_USER.id);
    expect(res.body.user.tenant_id).toBe(TEST_USER.tenant_id);
  });
});

// ============================================
// Role-Based Access Control Tests
// ============================================
describe('RBAC middleware', () => {
  it('should allow access for user with required role', async () => {
    // Login to get a valid token with owner role
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue(TEST_ROLES);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    const accessToken = loginRes.body.data.accessToken;

    const testApp = express();
    testApp.use(express.json());
    testApp.get('/admin', authenticate, requireRole('owner'), (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp)
      .get('/admin')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  it('should deny access for user without required role', async () => {
    // Login with crew_member role (not owner)
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue([{ role_name: 'crew_member', division_id: null }]);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    const accessToken = loginRes.body.data.accessToken;

    const testApp = express();
    testApp.use(express.json());
    testApp.get('/admin', authenticate, requireRole('owner', 'div_mgr'), (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp)
      .get('/admin')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Insufficient permissions');
  });

  it('should allow if user has any of the allowed roles', async () => {
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue([{ role_name: 'coordinator', division_id: null }]);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    const accessToken = loginRes.body.data.accessToken;

    const testApp = express();
    testApp.use(express.json());
    testApp.get(
      '/ops',
      authenticate,
      requireRole('owner', 'div_mgr', 'coordinator'),
      (_req, res) => {
        res.json({ status: 'ok' });
      },
    );

    const res = await request(testApp)
      .get('/ops')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });
});

// ============================================
// Cross-Tenant Blocking Tests
// ============================================
describe('Tenant scoping middleware', () => {
  it('should set tenantId from authenticated user', async () => {
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue(TEST_ROLES);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    const accessToken = loginRes.body.data.accessToken;

    const testApp = express();
    testApp.use(express.json());
    testApp.get('/data', authenticate, tenantScope, (req, res) => {
      res.json({ tenantId: req.tenantId });
    });

    const res = await request(testApp)
      .get('/data')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe(TEST_USER.tenant_id);
  });

  it('should block cross-tenant access via URL param', async () => {
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue(TEST_ROLES);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    const accessToken = loginRes.body.data.accessToken;
    const otherTenantId = 'cccccccc-9999-8888-7777-666666666666';

    const testApp = express();
    testApp.use(express.json());
    testApp.get('/tenants/:tenantId/data', authenticate, tenantScope, (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp)
      .get(`/tenants/${otherTenantId}/data`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Cross-tenant access denied');
  });

  it('should block cross-tenant access via request body', async () => {
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue(TEST_ROLES);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    const accessToken = loginRes.body.data.accessToken;
    const otherTenantId = 'cccccccc-9999-8888-7777-666666666666';

    const testApp = express();
    testApp.use(express.json());
    testApp.post('/data', authenticate, tenantScope, (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp)
      .post('/data')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tenant_id: otherTenantId });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Cross-tenant access denied');
  });

  it('should allow same-tenant access via URL param', async () => {
    mockFindUserByEmail.mockResolvedValue({ ...TEST_USER });
    mockFindUserRoles.mockResolvedValue(TEST_ROLES);
    mockSaveRefreshToken.mockResolvedValue(undefined);
    mockUpdateLastLogin.mockResolvedValue(undefined);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_PASSWORD });

    const accessToken = loginRes.body.data.accessToken;

    const testApp = express();
    testApp.use(express.json());
    testApp.get('/tenants/:tenantId/data', authenticate, tenantScope, (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp)
      .get(`/tenants/${TEST_USER.tenant_id}/data`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });
});
