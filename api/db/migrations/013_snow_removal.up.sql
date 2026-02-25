-- ============================================
-- Snow Removal Operations (Phase 4 - D-8)
-- ============================================

-- Enum types
CREATE TYPE snow_season_status AS ENUM ('planning', 'active', 'completed', 'archived');
CREATE TYPE snow_run_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE snow_trigger_type AS ENUM ('snowfall', 'ice', 'pretreat', 'emergency', 'scheduled');
CREATE TYPE snow_entry_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped', 'issue_reported');
CREATE TYPE snow_service_type AS ENUM ('plow', 'salt', 'sand', 'shovel', 'pretreat', 'ice_melt', 'combination');

-- ============================================
-- Snow Seasons
-- ============================================

CREATE TABLE snow_seasons (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),

    season_name             VARCHAR(100) NOT NULL,
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    status                  snow_season_status NOT NULL DEFAULT 'planning',
    default_trigger_inches  DECIMAL(4, 1) NOT NULL DEFAULT 2.0,
    notes                   TEXT,

    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_snow_seasons_tenant ON snow_seasons(tenant_id);
CREATE INDEX idx_snow_seasons_status ON snow_seasons(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_snow_seasons_dates ON snow_seasons(tenant_id, start_date, end_date) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_snow_seasons_updated_at
    BEFORE UPDATE ON snow_seasons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_snow_seasons
    AFTER INSERT OR UPDATE OR DELETE ON snow_seasons
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Snow Runs
-- ============================================

CREATE TABLE snow_runs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    season_id                   UUID NOT NULL REFERENCES snow_seasons(id),

    run_number                  INTEGER NOT NULL,
    run_date                    DATE NOT NULL,
    status                      snow_run_status NOT NULL DEFAULT 'planned',
    trigger_type                snow_trigger_type NOT NULL,
    snowfall_inches             DECIMAL(4, 1),
    temperature_f               DECIMAL(5, 1),
    weather_notes               TEXT,

    start_time                  TIMESTAMPTZ,
    end_time                    TIMESTAMPTZ,
    total_properties_serviced   INTEGER NOT NULL DEFAULT 0,
    notes                       TEXT,

    created_by                  UUID REFERENCES users(id),
    updated_by                  UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE INDEX idx_snow_runs_tenant ON snow_runs(tenant_id);
CREATE INDEX idx_snow_runs_season ON snow_runs(tenant_id, season_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_snow_runs_date ON snow_runs(tenant_id, run_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_snow_runs_status ON snow_runs(tenant_id, status) WHERE deleted_at IS NULL;

-- Unique run number per season
CREATE UNIQUE INDEX idx_snow_runs_number_unique
    ON snow_runs(tenant_id, season_id, run_number)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_snow_runs_updated_at
    BEFORE UPDATE ON snow_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_snow_runs
    AFTER INSERT OR UPDATE OR DELETE ON snow_runs
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Snow Run Entries
-- ============================================

CREATE TABLE snow_run_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    run_id              UUID NOT NULL REFERENCES snow_runs(id),
    property_id         UUID NOT NULL REFERENCES properties(id),
    contract_id         UUID REFERENCES service_contracts(id),
    crew_id             UUID REFERENCES crews(id),

    status              snow_entry_status NOT NULL DEFAULT 'pending',
    service_type        snow_service_type NOT NULL DEFAULT 'combination',
    arrival_time        TIMESTAMPTZ,
    departure_time      TIMESTAMPTZ,
    duration_minutes    INTEGER,
    notes               TEXT,
    issue_description   TEXT,
    photos_url          TEXT[],

    completed_by        UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snow_run_entries_tenant ON snow_run_entries(tenant_id);
CREATE INDEX idx_snow_run_entries_run ON snow_run_entries(tenant_id, run_id);
CREATE INDEX idx_snow_run_entries_property ON snow_run_entries(tenant_id, property_id);
CREATE INDEX idx_snow_run_entries_status ON snow_run_entries(tenant_id, status);

CREATE TRIGGER trg_snow_run_entries_updated_at
    BEFORE UPDATE ON snow_run_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
