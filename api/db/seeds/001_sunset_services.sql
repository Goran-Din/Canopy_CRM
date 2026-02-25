-- ============================================
-- Seed: Sunset Services (Tenant #1)
-- ============================================

-- Insert tenant (idempotent via ON CONFLICT)
INSERT INTO tenants (name, slug, settings)
VALUES (
    'Sunset Services',
    'sunset-services',
    '{"timezone": "America/Toronto", "currency": "CAD"}'
)
ON CONFLICT (slug) DO NOTHING;

-- Insert the four divisions for Sunset Services
INSERT INTO divisions (tenant_id, name, display_name)
SELECT t.id, d.name, d.display_name
FROM tenants t
CROSS JOIN (
    VALUES
        ('landscaping_maintenance', 'Landscaping Maintenance'),
        ('landscaping_projects',    'Landscaping Projects'),
        ('hardscape',               'Hardscape'),
        ('snow_removal',            'Snow Removal')
) AS d(name, display_name)
WHERE t.slug = 'sunset-services'
ON CONFLICT (tenant_id, name) DO NOTHING;
