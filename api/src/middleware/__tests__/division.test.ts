import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

// --- Mock database ---
vi.mock('../../config/database.js', () => ({
  queryDb: vi.fn(),
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }), on: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  getClient: vi.fn(),
}));

// --- Mock redis ---
vi.mock('../../config/redis.js', () => ({
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

vi.mock('../../modules/auth/repository.js', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  findUserRoles: (...args: unknown[]) => mockFindUserRoles(...args),
  saveRefreshToken: (...args: unknown[]) => mockSaveRefreshToken(...args),
  findRefreshToken: (...args: unknown[]) => mockFindRefreshToken(...args),
  revokeRefreshToken: (...args: unknown[]) => mockRevokeRefreshToken(...args),
  revokeAllUserRefreshTokens: (...args: unknown[]) => mockRevokeAllUserRefreshTokens(...args),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
}));

import app from '../../app.js';
import express from 'express';
import { authenticate } from '../auth.js';
import { requireDivision } from '../division.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;

const TEST_TENANT_ID = 'bbbbbbbb-1111-2222-3333-444444444444';

beforeEach(async () => {
  vi.clearAllMocks();
  TEST_HASH = await bcrypt.hash(TEST_PASSWORD, 4);
});

// Helper: login and get access token
async function loginAs(roles: Array<{ role_name: string; division_id: string | null; division_name: string | null }>) {
  mockFindUserByEmail.mockResolvedValue({
    id: 'aaaaaaaa-1111-2222-3333-444444444444',
    tenant_id: TEST_TENANT_ID,
    email: 'test@test.com',
    password_hash: TEST_HASH,
    first_name: 'Test',
    last_name: 'User',
    is_active: true,
  });
  mockFindUserRoles.mockResolvedValue(roles);
  mockSaveRefreshToken.mockResolvedValue(undefined);
  mockUpdateLastLogin.mockResolvedValue(undefined);

  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'test@test.com', password: TEST_PASSWORD });

  return res.body.data.accessToken as string;
}

describe('requireDivision middleware', () => {
  it('should allow owner to access any division', async () => {
    const token = await loginAs([
      { role_name: 'owner', division_id: null, division_name: null },
    ]);

    const testApp = express();
    testApp.use(express.json());
    testApp.get('/snow', authenticate, requireDivision('snow_removal'), (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp)
      .get('/snow')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should allow user with matching division', async () => {
    const token = await loginAs([
      { role_name: 'crew_leader', division_id: 'dddddddd-1111-2222-3333-444444444444', division_name: 'snow_removal' },
    ]);

    const testApp = express();
    testApp.use(express.json());
    testApp.get('/snow', authenticate, requireDivision('snow_removal'), (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp)
      .get('/snow')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny user without matching division', async () => {
    const token = await loginAs([
      { role_name: 'crew_leader', division_id: 'dddddddd-1111-2222-3333-444444444444', division_name: 'landscaping_maintenance' },
    ]);

    const testApp = express();
    testApp.use(express.json());
    testApp.get('/snow', authenticate, requireDivision('snow_removal'), (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp)
      .get('/snow')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Division access denied');
  });

  it('should allow if user matches any of the allowed divisions', async () => {
    const token = await loginAs([
      { role_name: 'coordinator', division_id: 'dddddddd-1111-2222-3333-444444444444', division_name: 'hardscape' },
    ]);

    const testApp = express();
    testApp.use(express.json());
    testApp.get(
      '/field',
      authenticate,
      requireDivision('landscaping_maintenance', 'landscaping_projects', 'hardscape'),
      (_req, res) => {
        res.json({ status: 'ok' });
      },
    );

    const res = await request(testApp)
      .get('/field')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('should deny unauthenticated requests', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/snow', requireDivision('snow_removal'), (_req, res) => {
      res.json({ status: 'ok' });
    });

    const res = await request(testApp).get('/snow');

    expect(res.status).toBe(401);
  });
});
