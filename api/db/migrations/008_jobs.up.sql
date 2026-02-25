-- ============================================
-- Jobs & Scheduling tables (Phase 2 - D-5)
-- ============================================

-- Enum types for jobs
CREATE TYPE job_type AS ENUM ('scheduled_service', 'one_time', 'emergency', 'inspection', 'estimate');
CREATE TYPE job_status AS ENUM ('unscheduled', 'scheduled', 'in_progress', 'completed', 'verified', 'cancelled', 'skipped');
CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE photo_type AS ENUM ('before', 'during', 'after', 'issue');

CREATE TABLE jobs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    contract_id                 UUID REFERENCES service_contracts(id),
    customer_id                 UUID NOT NULL REFERENCES customers(id),
    property_id                 UUID NOT NULL REFERENCES properties(id),

    -- Classification
    division                    division_type NOT NULL,
    job_type                    job_type NOT NULL DEFAULT 'scheduled_service',
    status                      job_status NOT NULL DEFAULT 'unscheduled',
    priority                    job_priority NOT NULL DEFAULT 'normal',

    -- Identity
    title                       VARCHAR(255) NOT NULL,
    description                 TEXT,

    -- Scheduling
    scheduled_date              DATE,
    scheduled_start_time        TIME,
    estimated_duration_minutes  INTEGER,

    -- Actuals
    actual_start_time           TIMESTAMPTZ,
    actual_end_time             TIMESTAMPTZ,
    actual_duration_minutes     INTEGER,

    -- Assignment
    assigned_crew_id            UUID,
    assigned_to                 UUID REFERENCES users(id),

    -- Metadata
    notes                       TEXT,
    completion_notes            TEXT,
    requires_photos             BOOLEAN NOT NULL DEFAULT false,
    invoice_id                  UUID,
    weather_condition           VARCHAR(100),
    tags                        TEXT[] DEFAULT '{}',

    -- Tracking
    created_by                  UUID REFERENCES users(id),
    updated_by                  UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_jobs_tenant_id ON jobs(tenant_id);
CREATE INDEX idx_jobs_contract_id ON jobs(tenant_id, contract_id) WHERE deleted_at IS NULL AND contract_id IS NOT NULL;
CREATE INDEX idx_jobs_customer_id ON jobs(tenant_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_property_id ON jobs(tenant_id, property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_status ON jobs(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_scheduled_date ON jobs(tenant_id, scheduled_date) WHERE deleted_at IS NULL AND scheduled_date IS NOT NULL;
CREATE INDEX idx_jobs_division ON jobs(tenant_id, division) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_assigned_crew ON jobs(tenant_id, assigned_crew_id) WHERE deleted_at IS NULL AND assigned_crew_id IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER trg_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log trigger
CREATE TRIGGER trg_audit_jobs
    AFTER INSERT OR UPDATE OR DELETE ON jobs
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Job Photos
-- ============================================

CREATE TABLE job_photos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    job_id          UUID NOT NULL REFERENCES jobs(id),

    photo_url       TEXT NOT NULL,
    photo_type      photo_type NOT NULL DEFAULT 'after',
    caption         VARCHAR(255),

    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_job_photos_job ON job_photos(tenant_id, job_id) WHERE deleted_at IS NULL;

-- ============================================
-- Job Checklist Items
-- ============================================

CREATE TABLE job_checklist_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    job_id          UUID NOT NULL REFERENCES jobs(id),

    description     VARCHAR(255) NOT NULL,
    is_completed    BOOLEAN NOT NULL DEFAULT false,
    completed_by    UUID REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    sort_order      INTEGER NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_checklist_job ON job_checklist_items(tenant_id, job_id);

CREATE TRIGGER trg_checklist_updated_at
    BEFORE UPDATE ON job_checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
