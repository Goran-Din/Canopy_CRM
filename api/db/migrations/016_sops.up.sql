-- ============================================
-- D-21: SOP Library & Template Task Management
-- ============================================

-- ============================================
-- Enum types
-- ============================================

CREATE TYPE sop_category AS ENUM (
    'lawn_care', 'snow_removal', 'hardscape', 'safety',
    'equipment', 'customer_service', 'quality_check', 'seasonal', 'other'
);

CREATE TYPE sop_status AS ENUM ('draft', 'active', 'archived');

CREATE TYPE sop_assignment_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');

-- ============================================
-- SOP Templates
-- ============================================

CREATE TABLE sop_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),

    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    category        sop_category NOT NULL DEFAULT 'other',
    division        division_type,
    status          sop_status NOT NULL DEFAULT 'draft',
    version         INTEGER NOT NULL DEFAULT 1,

    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_sop_templates_tenant ON sop_templates(tenant_id);
CREATE INDEX idx_sop_templates_category ON sop_templates(tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_sop_templates_division ON sop_templates(tenant_id, division) WHERE deleted_at IS NULL AND division IS NOT NULL;
CREATE INDEX idx_sop_templates_status ON sop_templates(tenant_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_sop_templates_updated_at
    BEFORE UPDATE ON sop_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_sop_templates
    AFTER INSERT OR UPDATE OR DELETE ON sop_templates
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- SOP Steps
-- ============================================

CREATE TABLE sop_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    template_id         UUID NOT NULL REFERENCES sop_templates(id),

    step_number         INTEGER NOT NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    estimated_minutes   INTEGER,
    requires_photo      BOOLEAN NOT NULL DEFAULT FALSE,
    requires_signature  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order          INTEGER NOT NULL,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_sop_steps_template ON sop_steps(tenant_id, template_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_sop_steps_updated_at
    BEFORE UPDATE ON sop_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SOP Assignments
-- ============================================

CREATE TABLE sop_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    template_id     UUID NOT NULL REFERENCES sop_templates(id),

    job_id          UUID REFERENCES jobs(id),
    crew_id         UUID REFERENCES crews(id),
    assigned_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    status          sop_assignment_status NOT NULL DEFAULT 'pending',
    completed_at    TIMESTAMPTZ,
    completed_by    UUID REFERENCES users(id),
    notes           TEXT,

    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sop_assignments_tenant ON sop_assignments(tenant_id);
CREATE INDEX idx_sop_assignments_template ON sop_assignments(tenant_id, template_id);
CREATE INDEX idx_sop_assignments_job ON sop_assignments(tenant_id, job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_sop_assignments_crew ON sop_assignments(tenant_id, crew_id) WHERE crew_id IS NOT NULL;
CREATE INDEX idx_sop_assignments_status ON sop_assignments(tenant_id, status);

CREATE TRIGGER trg_sop_assignments_updated_at
    BEFORE UPDATE ON sop_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SOP Step Completions
-- ============================================

CREATE TABLE sop_step_completions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    assignment_id   UUID NOT NULL REFERENCES sop_assignments(id),
    step_id         UUID NOT NULL REFERENCES sop_steps(id),

    is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_by    UUID REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    photo_url       TEXT,
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sop_step_completions_assignment ON sop_step_completions(tenant_id, assignment_id);
CREATE INDEX idx_sop_step_completions_step ON sop_step_completions(tenant_id, step_id);

CREATE UNIQUE INDEX idx_sop_step_completions_unique ON sop_step_completions(assignment_id, step_id);
