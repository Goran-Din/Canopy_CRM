-- ============================================
-- Seed: Admin User for Sunset Services
-- Email: erick@sunsetservicesus.com
-- Password: CanopyAdmin2026! (development only)
-- ============================================

-- Insert admin user (bcrypt hash via pgcrypto)
INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
SELECT
    t.id,
    'erick@sunsetservicesus.com',
    crypt('CanopyAdmin2026!', gen_salt('bf', 12)),
    'Erick',
    'Sunset'
FROM tenants t
WHERE t.slug = 'sunset-services'
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Assign owner role
INSERT INTO user_roles (tenant_id, user_id, role_id)
SELECT u.tenant_id, u.id, r.id
FROM users u
JOIN tenants t ON t.id = u.tenant_id
JOIN roles r ON r.name = 'owner'
WHERE u.email = 'erick@sunsetservicesus.com'
  AND t.slug = 'sunset-services'
ON CONFLICT DO NOTHING;
