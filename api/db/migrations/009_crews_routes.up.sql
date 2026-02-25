-- ============================================
-- Crews & Routes tables (Phase 2 - D-6)
-- ============================================

-- Enum types
CREATE TYPE crew_status AS ENUM ('active', 'inactive', 'on_leave', 'seasonal');
CREATE TYPE crew_role AS ENUM ('leader', 'member');
CREATE TYPE route_status AS ENUM ('active', 'inactive', 'seasonal');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- ============================================
-- Crews
-- ============================================

CREATE TABLE crews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),

    crew_name           VARCHAR(100) NOT NULL,
    division            division_type NOT NULL,
    crew_leader_id      UUID REFERENCES users(id),
    status              crew_status NOT NULL DEFAULT 'active',
    color_code          VARCHAR(20),
    max_jobs_per_day    INTEGER NOT NULL DEFAULT 12,
    notes               TEXT,

    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_crews_tenant_id ON crews(tenant_id);
CREATE INDEX idx_crews_division ON crews(tenant_id, division) WHERE deleted_at IS NULL;
CREATE INDEX idx_crews_leader ON crews(tenant_id, crew_leader_id) WHERE deleted_at IS NULL AND crew_leader_id IS NOT NULL;

CREATE TRIGGER trg_crews_updated_at
    BEFORE UPDATE ON crews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_crews
    AFTER INSERT OR UPDATE OR DELETE ON crews
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Crew Members
-- ============================================

CREATE TABLE crew_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    crew_id         UUID NOT NULL REFERENCES crews(id),
    user_id         UUID NOT NULL REFERENCES users(id),

    role_in_crew    crew_role NOT NULL DEFAULT 'member',
    joined_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    left_date       DATE,
    is_active       BOOLEAN NOT NULL DEFAULT true,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crew_members_crew ON crew_members(tenant_id, crew_id) WHERE is_active = true;
CREATE INDEX idx_crew_members_user ON crew_members(tenant_id, user_id) WHERE is_active = true;

-- One active membership per user per crew
CREATE UNIQUE INDEX idx_crew_members_unique_active
    ON crew_members(crew_id, user_id)
    WHERE is_active = true;

CREATE TRIGGER trg_crew_members_updated_at
    BEFORE UPDATE ON crew_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Routes
-- ============================================

CREATE TABLE routes (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),

    route_name                  VARCHAR(100) NOT NULL,
    division                    division_type NOT NULL,
    crew_id                     UUID REFERENCES crews(id),
    day_of_week                 day_of_week NOT NULL,
    status                      route_status NOT NULL DEFAULT 'active',
    zone                        VARCHAR(50),
    estimated_duration_hours    DECIMAL(4, 1),
    notes                       TEXT,
    color_code                  VARCHAR(20),

    created_by                  UUID REFERENCES users(id),
    updated_by                  UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE INDEX idx_routes_tenant_id ON routes(tenant_id);
CREATE INDEX idx_routes_division ON routes(tenant_id, division) WHERE deleted_at IS NULL;
CREATE INDEX idx_routes_crew ON routes(tenant_id, crew_id) WHERE deleted_at IS NULL AND crew_id IS NOT NULL;
CREATE INDEX idx_routes_day ON routes(tenant_id, day_of_week) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_routes_updated_at
    BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_routes
    AFTER INSERT OR UPDATE OR DELETE ON routes
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Route Stops
-- ============================================

CREATE TABLE route_stops (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    route_id                    UUID NOT NULL REFERENCES routes(id),
    property_id                 UUID NOT NULL REFERENCES properties(id),

    stop_order                  INTEGER NOT NULL,
    estimated_arrival_time      TIME,
    estimated_duration_minutes  INTEGER,
    notes                       TEXT,
    is_active                   BOOLEAN NOT NULL DEFAULT true,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_route_stops_route ON route_stops(tenant_id, route_id) WHERE is_active = true;
CREATE INDEX idx_route_stops_property ON route_stops(tenant_id, property_id) WHERE is_active = true;

-- No duplicate positions per route
CREATE UNIQUE INDEX idx_route_stops_order
    ON route_stops(route_id, stop_order)
    WHERE is_active = true;

CREATE TRIGGER trg_route_stops_updated_at
    BEFORE UPDATE ON route_stops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Now add the FK from jobs.assigned_crew_id to crews
ALTER TABLE jobs ADD CONSTRAINT fk_jobs_crew FOREIGN KEY (assigned_crew_id) REFERENCES crews(id);
