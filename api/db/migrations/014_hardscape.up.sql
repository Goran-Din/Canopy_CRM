-- ============================================
-- Hardscape Sales & Project Pipeline (Phase 4 - D-10)
-- ============================================

-- Enum types
CREATE TYPE hardscape_project_status AS ENUM (
    'lead', 'estimate_scheduled', 'estimate_sent', 'negotiation',
    'approved', 'in_progress', 'on_hold', 'completed', 'cancelled', 'lost'
);
CREATE TYPE hardscape_project_type AS ENUM (
    'patio', 'retaining_wall', 'walkway', 'driveway',
    'fire_pit', 'outdoor_kitchen', 'full_landscape', 'other'
);
CREATE TYPE hardscape_source AS ENUM (
    'referral', 'website', 'mautic', 'walk_in', 'repeat_customer', 'other'
);
CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');
CREATE TYPE milestone_payment_status AS ENUM ('not_due', 'invoiced', 'paid');

-- ============================================
-- Hardscape Projects
-- ============================================

CREATE TABLE hardscape_projects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    customer_id             UUID NOT NULL REFERENCES customers(id),
    property_id             UUID NOT NULL REFERENCES properties(id),
    contract_id             UUID REFERENCES service_contracts(id),

    project_number          VARCHAR(50) NOT NULL,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT,
    status                  hardscape_project_status NOT NULL DEFAULT 'lead',
    stage_entered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    estimated_value         DECIMAL(12, 2),
    actual_value            DECIMAL(12, 2),
    estimated_start_date    DATE,
    actual_start_date       DATE,
    estimated_end_date      DATE,
    actual_end_date         DATE,

    project_type            hardscape_project_type NOT NULL DEFAULT 'other',
    assigned_to             UUID REFERENCES users(id),
    division                division_type NOT NULL DEFAULT 'hardscape',
    source                  hardscape_source,
    loss_reason             TEXT,
    notes                   TEXT,
    tags                    TEXT[],

    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_hardscape_projects_tenant ON hardscape_projects(tenant_id);
CREATE INDEX idx_hardscape_projects_customer ON hardscape_projects(tenant_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hardscape_projects_property ON hardscape_projects(tenant_id, property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hardscape_projects_status ON hardscape_projects(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_hardscape_projects_type ON hardscape_projects(tenant_id, project_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_hardscape_projects_assigned ON hardscape_projects(tenant_id, assigned_to) WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

-- Unique project number per tenant
CREATE UNIQUE INDEX idx_hardscape_projects_number_unique
    ON hardscape_projects(tenant_id, project_number)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_hardscape_projects_updated_at
    BEFORE UPDATE ON hardscape_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_hardscape_projects
    AFTER INSERT OR UPDATE OR DELETE ON hardscape_projects
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Hardscape Milestones
-- ============================================

CREATE TABLE hardscape_milestones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    project_id          UUID NOT NULL REFERENCES hardscape_projects(id),

    milestone_name      VARCHAR(255) NOT NULL,
    description         TEXT,
    due_date            DATE,
    completed_date      DATE,
    status              milestone_status NOT NULL DEFAULT 'pending',
    sort_order          INTEGER NOT NULL DEFAULT 0,

    payment_amount      DECIMAL(12, 2),
    payment_status      milestone_payment_status NOT NULL DEFAULT 'not_due',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hardscape_milestones_project ON hardscape_milestones(tenant_id, project_id);
CREATE INDEX idx_hardscape_milestones_status ON hardscape_milestones(tenant_id, status);

CREATE TRIGGER trg_hardscape_milestones_updated_at
    BEFORE UPDATE ON hardscape_milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Hardscape Stage History
-- ============================================

CREATE TABLE hardscape_stage_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    project_id      UUID NOT NULL REFERENCES hardscape_projects(id),

    from_stage      VARCHAR(50),
    to_stage        VARCHAR(50) NOT NULL,
    changed_by      UUID REFERENCES users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT
);

CREATE INDEX idx_hardscape_stage_history_project ON hardscape_stage_history(tenant_id, project_id);
