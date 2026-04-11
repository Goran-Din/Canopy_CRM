import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

vi.mock('../../../config/database.js', () => ({
  queryDb: vi.fn(),
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }), on: vi.fn() },
  testConnection: vi.fn().mockResolvedValue(true),
  getClient: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }),
}));

vi.mock('../../../config/redis.js', () => ({
  redis: { isOpen: true, ping: vi.fn().mockResolvedValue('PONG'), connect: vi.fn(), on: vi.fn() },
  connectRedis: vi.fn(),
}));

const mockFindUserByEmail = vi.fn();
const mockFindUserRoles = vi.fn();
const mockSaveRefreshToken = vi.fn();
const mockUpdateLastLogin = vi.fn();

vi.mock('../../auth/repository.js', () => ({
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  findUserById: vi.fn(),
  findUserRoles: (...args: unknown[]) => mockFindUserRoles(...args),
  saveRefreshToken: (...args: unknown[]) => mockSaveRefreshToken(...args),
  findRefreshToken: vi.fn(), revokeRefreshToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
}));

// --- Mock property repository (V1 + V2) ---
const mockFindById = vi.fn();
const mockUpdateProfile = vi.fn();
const mockGetKnowledgeCard = vi.fn();
const mockGetCategorySummary = vi.fn();
const mockInsertCrewNote = vi.fn();
const mockFindCrewNotes = vi.fn();
const mockGetJobHistory = vi.fn();
const mockGetPropertyPhotos = vi.fn();

vi.mock('../repository.js', () => ({
  findAll: vi.fn(),
  findById: (...args: unknown[]) => mockFindById(...args),
  findByCustomerId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  getStats: vi.fn(),
  hasActiveContracts: vi.fn(),
  customerExists: vi.fn(),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  getKnowledgeCard: (...args: unknown[]) => mockGetKnowledgeCard(...args),
  getCategorySummary: (...args: unknown[]) => mockGetCategorySummary(...args),
  insertCrewNote: (...args: unknown[]) => mockInsertCrewNote(...args),
  findCrewNotes: (...args: unknown[]) => mockFindCrewNotes(...args),
  getJobHistory: (...args: unknown[]) => mockGetJobHistory(...args),
  getPropertyPhotos: (...args: unknown[]) => mockGetPropertyPhotos(...args),
}));

// --- Mock service history ---
const mockGetServiceHistory = vi.fn();
const mockGetEstimationContext = vi.fn();

vi.mock('../service-history/service-history.service.js', () => ({
  getServiceHistory: (...args: unknown[]) => mockGetServiceHistory(...args),
  getEstimationContext: (...args: unknown[]) => mockGetEstimationContext(...args),
}));

import app from '../../../app.js';

const TEST_PASSWORD = 'TestPass123';
let TEST_HASH: string;
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';

const SAMPLE_PROPERTY = {
  id: PROPERTY_ID, tenant_id: TENANT_A, customer_id: 'dddddddd-0000-0000-0000-000000000001',
  property_name: 'Main Residence', property_type: 'residential', status: 'active',
  address_line1: '123 Main St', city: 'Toronto', state: 'ON', zip: 'M5V 1A1',
  property_category: null, customer_display_name: 'John Doe',
};

async function loginAs(role: string) {
  mockFindUserByEmail.mockResolvedValue({
    id: USER_ID, tenant_id: TENANT_A, email: 'test@test.com',
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
// Property Profile Update
// ============================================
describe('PATCH /v1/properties/:id/profile', () => {
  it('should update V2 profile fields', async () => {
    const token = await loginAs('coordinator');
    mockFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockUpdateProfile.mockResolvedValue({
      ...SAMPLE_PROPERTY,
      property_category: 'RES-M',
      bed_area_sqft: 500,
      dogs_on_property: 'yes',
    });

    const res = await request(app)
      .patch(`/v1/properties/${PROPERTY_ID}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        property_category: 'RES-M',
        bed_area_sqft: 500,
        dogs_on_property: 'yes',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.property_category).toBe('RES-M');
    expect(res.body.data.bed_area_sqft).toBe(500);
  });

  it('should reject invalid property_category', async () => {
    const token = await loginAs('owner');
    const res = await request(app)
      .patch(`/v1/properties/${PROPERTY_ID}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ property_category: 'INVALID' });
    expect(res.status).toBe(400);
  });

  it('should deny crew_member from updating profile', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .patch(`/v1/properties/${PROPERTY_ID}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ property_category: 'RES-M' });
    expect(res.status).toBe(403);
  });
});

// ============================================
// Knowledge Card
// ============================================
describe('GET /v1/properties/:id/knowledge-card', () => {
  it('should return full knowledge card data', async () => {
    const token = await loginAs('owner');
    mockGetKnowledgeCard.mockResolvedValue({
      ...SAMPLE_PROPERTY,
      total_jobs: 12,
      contracts: [{ id: 'c1', title: 'Gold Package', status: 'active' }],
    });

    const res = await request(app)
      .get(`/v1/properties/${PROPERTY_ID}/knowledge-card`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total_jobs).toBe(12);
    expect(res.body.data.contracts).toHaveLength(1);
  });

  it('should return 404 for missing property', async () => {
    const token = await loginAs('owner');
    mockGetKnowledgeCard.mockResolvedValue(null);

    const res = await request(app)
      .get(`/v1/properties/${PROPERTY_ID}/knowledge-card`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ============================================
// Service History
// ============================================
describe('GET /v1/properties/:id/service-history', () => {
  it('should return service history', async () => {
    const token = await loginAs('coordinator');
    mockFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockGetServiceHistory.mockResolvedValue([
      { service_code: 'FERT', service_name: 'Fertilization', season_year: 2026, status: 'completed' },
    ]);

    const res = await request(app)
      .get(`/v1/properties/${PROPERTY_ID}/service-history`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ============================================
// Estimation Context
// ============================================
describe('GET /v1/properties/:id/estimation-context', () => {
  it('should return estimation context with history and similar pricing', async () => {
    const token = await loginAs('coordinator');
    mockFindById.mockResolvedValue({ ...SAMPLE_PROPERTY, property_category: 'RES-M' });
    mockGetEstimationContext.mockResolvedValue({
      property: { address: '123 Main St, Toronto ON', category: 'RES-M' },
      service_history: { history_by_year: [] },
      similar_properties: { count: '5', price_range_min: '30', price_range_max: '50' },
    });

    const res = await request(app)
      .get(`/v1/properties/${PROPERTY_ID}/estimation-context?service_code=FERT`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.similar_properties).toBeDefined();
  });

  it('should require service_code parameter', async () => {
    const token = await loginAs('owner');
    const res = await request(app)
      .get(`/v1/properties/${PROPERTY_ID}/estimation-context`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ============================================
// Crew Notes (append-only)
// ============================================
describe('POST /v1/properties/:id/crew-notes', () => {
  it('should add crew note', async () => {
    const token = await loginAs('crew_leader');
    mockFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockInsertCrewNote.mockResolvedValue({
      id: '11111111-0000-0000-0000-000000000001',
      property_id: PROPERTY_ID,
      note: 'Sprinkler head broken near front bed',
      created_by_user_id: USER_ID,
      created_at: new Date().toISOString(),
    });

    const res = await request(app)
      .post(`/v1/properties/${PROPERTY_ID}/crew-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Sprinkler head broken near front bed' });

    expect(res.status).toBe(201);
    expect(res.body.data.note).toContain('Sprinkler');
  });

  it('should reject empty note', async () => {
    const token = await loginAs('crew_member');
    const res = await request(app)
      .post(`/v1/properties/${PROPERTY_ID}/crew-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: '' });
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/properties/:id/crew-notes', () => {
  it('should return crew notes newest first', async () => {
    const token = await loginAs('coordinator');
    mockFindById.mockResolvedValue(SAMPLE_PROPERTY);
    mockFindCrewNotes.mockResolvedValue([
      { id: '1', note: 'Recent note', created_at: new Date().toISOString() },
    ]);

    const res = await request(app)
      .get(`/v1/properties/${PROPERTY_ID}/crew-notes`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ============================================
// Category Summary
// ============================================
describe('GET /v1/properties/categories/summary', () => {
  it('should return property category counts', async () => {
    const token = await loginAs('owner');
    mockGetCategorySummary.mockResolvedValue([
      { label: 'RES-M', count: '45' },
      { label: 'COM-S', count: '12' },
    ]);

    const res = await request(app)
      .get('/v1/properties/categories/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

// ============================================
// Auth
// ============================================
describe('Authentication', () => {
  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get(`/v1/properties/${PROPERTY_ID}/knowledge-card`);
    expect(res.status).toBe(401);
  });
});
