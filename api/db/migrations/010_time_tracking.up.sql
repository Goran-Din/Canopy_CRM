-- ============================================
-- Time Tracking & GPS Events (Phase 2 - D-7)
-- ============================================

-- Enum types
CREATE TYPE time_entry_status AS ENUM ('clocked_in', 'clocked_out', 'approved', 'disputed', 'adjusted');
CREATE TYPE clock_method AS ENUM ('mobile_gps', 'manual', 'qr_code', 'auto');
CREATE TYPE gps_event_type AS ENUM ('arrival', 'departure', 'location_update', 'geofence_enter', 'geofence_exit');

-- ============================================
-- Time Entries
-- ============================================

CREATE TABLE time_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    job_id              UUID REFERENCES jobs(id),
    crew_id             UUID REFERENCES crews(id),

    clock_in            TIMESTAMPTZ NOT NULL,
    clock_out           TIMESTAMPTZ,
    break_minutes       INTEGER NOT NULL DEFAULT 0,
    total_minutes       INTEGER,
    status              time_entry_status NOT NULL DEFAULT 'clocked_in',

    clock_in_latitude   DECIMAL(10, 7),
    clock_in_longitude  DECIMAL(10, 7),
    clock_out_latitude  DECIMAL(10, 7),
    clock_out_longitude DECIMAL(10, 7),
    clock_in_method     clock_method NOT NULL DEFAULT 'manual',
    clock_out_method    clock_method,

    notes               TEXT,
    admin_notes         TEXT,
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,

    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_time_entries_tenant ON time_entries(tenant_id);
CREATE INDEX idx_time_entries_user ON time_entries(tenant_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_time_entries_job ON time_entries(tenant_id, job_id) WHERE deleted_at IS NULL AND job_id IS NOT NULL;
CREATE INDEX idx_time_entries_crew ON time_entries(tenant_id, crew_id) WHERE deleted_at IS NULL AND crew_id IS NOT NULL;
CREATE INDEX idx_time_entries_clock_in ON time_entries(tenant_id, clock_in) WHERE deleted_at IS NULL;
CREATE INDEX idx_time_entries_status ON time_entries(tenant_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_time_entries_updated_at
    BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_time_entries
    AFTER INSERT OR UPDATE OR DELETE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- GPS Events
-- ============================================

CREATE TABLE gps_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    job_id          UUID REFERENCES jobs(id),
    crew_id         UUID REFERENCES crews(id),

    event_type      gps_event_type NOT NULL,
    latitude        DECIMAL(10, 7) NOT NULL,
    longitude       DECIMAL(10, 7) NOT NULL,
    accuracy_meters DECIMAL(8, 2),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_info     VARCHAR(255),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gps_events_tenant ON gps_events(tenant_id);
CREATE INDEX idx_gps_events_user ON gps_events(tenant_id, user_id);
CREATE INDEX idx_gps_events_job ON gps_events(tenant_id, job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_gps_events_crew ON gps_events(tenant_id, crew_id) WHERE crew_id IS NOT NULL;
CREATE INDEX idx_gps_events_recorded_at ON gps_events(tenant_id, recorded_at);
