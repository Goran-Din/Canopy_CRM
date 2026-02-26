-- ============================================
-- Seed: Users for Sunset Services
-- ============================================

-- 1. Primary admin (owner): Goran Dinov
INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
SELECT
    t.id,
    'goran@sunsetservices.us',
    crypt('CanopyAdmin2026!', gen_salt('bf', 12)),
    'Goran',
    'Dinov'
FROM tenants t
WHERE t.slug = 'sunset-services'
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO user_roles (tenant_id, user_id, role_id)
SELECT u.tenant_id, u.id, r.id
FROM users u
JOIN tenants t ON t.id = u.tenant_id
JOIN roles r ON r.name = 'owner'
WHERE u.email = 'goran@sunsetservices.us'
  AND t.slug = 'sunset-services'
ON CONFLICT DO NOTHING;

-- 2. Second owner: Erick Sunset
INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
SELECT
    t.id,
    'erick@sunsetservices.us',
    crypt('CanopyAdmin2026!', gen_salt('bf', 12)),
    'Erick',
    'Sunset'
FROM tenants t
WHERE t.slug = 'sunset-services'
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO user_roles (tenant_id, user_id, role_id)
SELECT u.tenant_id, u.id, r.id
FROM users u
JOIN tenants t ON t.id = u.tenant_id
JOIN roles r ON r.name = 'owner'
WHERE u.email = 'erick@sunsetservices.us'
  AND t.slug = 'sunset-services'
ON CONFLICT DO NOTHING;

-- 3. Division manager: Marcin
INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
SELECT
    t.id,
    'marcin@sunsetservices.us',
    crypt('CanopyAdmin2026!', gen_salt('bf', 12)),
    'Marcin',
    'Nowak'
FROM tenants t
WHERE t.slug = 'sunset-services'
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO user_roles (tenant_id, user_id, role_id)
SELECT u.tenant_id, u.id, r.id
FROM users u
JOIN tenants t ON t.id = u.tenant_id
JOIN roles r ON r.name = 'div_mgr'
WHERE u.email = 'marcin@sunsetservices.us'
  AND t.slug = 'sunset-services'
ON CONFLICT DO NOTHING;
