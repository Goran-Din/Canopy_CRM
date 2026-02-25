-- ============================================
-- Phase 4 Registry Modules: Prospects, Equipment,
-- Materials, Subcontractors (D-18, D-14, D-15, D-16)
-- ============================================

-- ============================================
-- Enum types
-- ============================================

CREATE TYPE prospect_source AS ENUM ('mautic', 'website', 'referral', 'cold_call', 'trade_show', 'other');
CREATE TYPE prospect_status AS ENUM ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost', 'dormant');

CREATE TYPE equipment_type AS ENUM (
    'truck', 'trailer', 'mower', 'plow', 'salter', 'skid_steer',
    'excavator', 'hand_tool', 'blower', 'trimmer', 'other'
);
CREATE TYPE equipment_status AS ENUM ('active', 'maintenance', 'out_of_service', 'retired', 'sold');

CREATE TYPE material_category AS ENUM (
    'salt', 'sand', 'mulch', 'soil', 'stone', 'fertilizer', 'seed',
    'ice_melt', 'fuel', 'plants', 'pavers', 'retaining_blocks', 'other'
);
CREATE TYPE material_unit AS ENUM ('ton', 'yard', 'bag', 'gallon', 'pallet', 'piece', 'sqft', 'lbs', 'other');
CREATE TYPE material_transaction_type AS ENUM ('purchase', 'usage', 'adjustment', 'return');

CREATE TYPE subcontractor_status AS ENUM ('active', 'inactive', 'blacklisted');
CREATE TYPE subcontractor_rate_type AS ENUM ('hourly', 'per_job', 'per_visit', 'contract');

-- ============================================
-- Prospects
-- ============================================

CREATE TABLE prospects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),

    company_name            VARCHAR(255),
    first_name              VARCHAR(100),
    last_name               VARCHAR(100),
    email                   VARCHAR(255),
    phone                   VARCHAR(50),
    mobile                  VARCHAR(50),

    source                  prospect_source,
    status                  prospect_status NOT NULL DEFAULT 'new',
    assigned_to             UUID REFERENCES users(id),
    estimated_value         DECIMAL(12, 2),
    interest_services       TEXT[],

    address_line1           VARCHAR(255),
    city                    VARCHAR(100),
    state                   VARCHAR(50),
    zip                     VARCHAR(20),

    notes                   TEXT,
    next_follow_up_date     DATE,
    last_contacted_at       TIMESTAMPTZ,
    lost_reason             TEXT,
    converted_customer_id   UUID REFERENCES customers(id),
    mautic_contact_id       VARCHAR(255),

    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_prospects_tenant ON prospects(tenant_id);
CREATE INDEX idx_prospects_status ON prospects(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_prospects_assigned ON prospects(tenant_id, assigned_to) WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;
CREATE INDEX idx_prospects_source ON prospects(tenant_id, source) WHERE deleted_at IS NULL;
CREATE INDEX idx_prospects_follow_up ON prospects(tenant_id, next_follow_up_date) WHERE deleted_at IS NULL AND next_follow_up_date IS NOT NULL;

CREATE TRIGGER trg_prospects_updated_at
    BEFORE UPDATE ON prospects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_prospects
    AFTER INSERT OR UPDATE OR DELETE ON prospects
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Equipment
-- ============================================

CREATE TABLE equipment (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),

    equipment_name          VARCHAR(255) NOT NULL,
    equipment_type          equipment_type NOT NULL DEFAULT 'other',
    status                  equipment_status NOT NULL DEFAULT 'active',

    make                    VARCHAR(100),
    model                   VARCHAR(100),
    year                    INTEGER,
    serial_number           VARCHAR(100),
    license_plate           VARCHAR(20),
    vin                     VARCHAR(50),

    purchase_date           DATE,
    purchase_price          DECIMAL(10, 2),
    current_value           DECIMAL(10, 2),

    assigned_crew_id        UUID REFERENCES crews(id),
    assigned_division       division_type,

    last_maintenance_date   DATE,
    next_maintenance_date   DATE,
    mileage                 INTEGER,
    hours_used              DECIMAL(8, 1),

    notes                   TEXT,

    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_equipment_tenant ON equipment(tenant_id);
CREATE INDEX idx_equipment_type ON equipment(tenant_id, equipment_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_equipment_status ON equipment(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_equipment_crew ON equipment(tenant_id, assigned_crew_id) WHERE deleted_at IS NULL AND assigned_crew_id IS NOT NULL;
CREATE INDEX idx_equipment_maintenance ON equipment(tenant_id, next_maintenance_date) WHERE deleted_at IS NULL AND next_maintenance_date IS NOT NULL;

CREATE TRIGGER trg_equipment_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_equipment
    AFTER INSERT OR UPDATE OR DELETE ON equipment
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Materials
-- ============================================

CREATE TABLE materials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),

    material_name       VARCHAR(255) NOT NULL,
    category            material_category NOT NULL DEFAULT 'other',
    unit_of_measure     material_unit NOT NULL DEFAULT 'other',
    current_stock       DECIMAL(10, 2) NOT NULL DEFAULT 0,
    reorder_level       DECIMAL(10, 2),
    cost_per_unit       DECIMAL(10, 2),
    preferred_supplier  VARCHAR(255),
    storage_location    VARCHAR(255),

    notes               TEXT,

    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_materials_tenant ON materials(tenant_id);
CREATE INDEX idx_materials_category ON materials(tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_materials_stock ON materials(tenant_id, current_stock) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_materials_updated_at
    BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_materials
    AFTER INSERT OR UPDATE OR DELETE ON materials
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Material Transactions
-- ============================================

CREATE TABLE material_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    material_id         UUID NOT NULL REFERENCES materials(id),

    transaction_type    material_transaction_type NOT NULL,
    quantity            DECIMAL(10, 2) NOT NULL,
    unit_cost           DECIMAL(10, 2),
    job_id              UUID REFERENCES jobs(id),
    notes               TEXT,
    recorded_by         UUID REFERENCES users(id),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_material_transactions_tenant ON material_transactions(tenant_id);
CREATE INDEX idx_material_transactions_material ON material_transactions(tenant_id, material_id);
CREATE INDEX idx_material_transactions_job ON material_transactions(tenant_id, job_id) WHERE job_id IS NOT NULL;

-- ============================================
-- Subcontractors
-- ============================================

CREATE TABLE subcontractors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),

    company_name        VARCHAR(255) NOT NULL,
    contact_name        VARCHAR(200),
    email               VARCHAR(255),
    phone               VARCHAR(50),
    mobile              VARCHAR(50),

    specialty           TEXT[],
    status              subcontractor_status NOT NULL DEFAULT 'active',
    insurance_expiry    DATE,
    license_number      VARCHAR(100),
    rate_type           subcontractor_rate_type,
    default_rate        DECIMAL(10, 2),
    rating              INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),

    notes               TEXT,

    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_subcontractors_tenant ON subcontractors(tenant_id);
CREATE INDEX idx_subcontractors_status ON subcontractors(tenant_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_subcontractors_updated_at
    BEFORE UPDATE ON subcontractors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_subcontractors
    AFTER INSERT OR UPDATE OR DELETE ON subcontractors
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
