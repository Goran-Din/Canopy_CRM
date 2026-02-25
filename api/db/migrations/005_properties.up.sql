-- ============================================
-- Properties table (Phase 2 - D-2)
-- ============================================

-- Enum types for properties
CREATE TYPE property_type AS ENUM ('residential', 'commercial', 'hoa', 'municipal', 'other');
CREATE TYPE property_status AS ENUM ('active', 'inactive', 'pending', 'archived');
CREATE TYPE service_frequency AS ENUM ('weekly', 'biweekly', 'monthly', 'per_visit', 'seasonal', 'on_demand');

CREATE TABLE properties (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    customer_id         UUID NOT NULL REFERENCES customers(id),

    -- Identity
    property_name       VARCHAR(255),
    property_type       property_type NOT NULL DEFAULT 'residential',
    status              property_status NOT NULL DEFAULT 'pending',

    -- Address
    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    city                VARCHAR(100),
    state               VARCHAR(50),
    zip                 VARCHAR(20),
    country             VARCHAR(3) NOT NULL DEFAULT 'US',

    -- Geolocation
    latitude            DECIMAL(10, 7),
    longitude           DECIMAL(10, 7),
    google_maps_url     TEXT,

    -- Property details
    lot_size_sqft       INTEGER,
    lawn_area_sqft      INTEGER,
    zone                VARCHAR(50),
    service_frequency   service_frequency NOT NULL DEFAULT 'weekly',

    -- Media & metadata
    property_photos_url TEXT[],
    notes               TEXT,
    tags                TEXT[] DEFAULT '{}',

    -- Tracking
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_properties_tenant_id ON properties(tenant_id);
CREATE INDEX idx_properties_customer_id ON properties(tenant_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_status ON properties(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_zone ON properties(tenant_id, zone) WHERE deleted_at IS NULL AND zone IS NOT NULL;
CREATE INDEX idx_properties_lat_lng ON properties(latitude, longitude) WHERE deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER trg_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log trigger
CREATE TRIGGER trg_audit_properties
    AFTER INSERT OR UPDATE OR DELETE ON properties
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
