-- ============================================
-- Service Contracts tables (Phase 2 - D-4)
-- ============================================

-- Enum types for contracts
CREATE TYPE contract_type AS ENUM ('maintenance', 'landscape_project', 'snow_removal', 'hardscape');
CREATE TYPE contract_status AS ENUM ('draft', 'pending_approval', 'active', 'on_hold', 'completed', 'cancelled', 'expired');
CREATE TYPE billing_frequency AS ENUM ('per_visit', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'project_complete', 'per_event');
CREATE TYPE division_type AS ENUM ('landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal');

CREATE TABLE service_contracts (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    customer_id                 UUID NOT NULL REFERENCES customers(id),
    property_id                 UUID NOT NULL REFERENCES properties(id),

    -- Classification
    contract_type               contract_type NOT NULL,
    status                      contract_status NOT NULL DEFAULT 'draft',
    division                    division_type NOT NULL,

    -- Identity
    contract_number             VARCHAR(50) NOT NULL,
    title                       VARCHAR(255) NOT NULL,
    description                 TEXT,

    -- Dates
    start_date                  DATE NOT NULL,
    end_date                    DATE,
    signed_date                 DATE,
    signed_by                   VARCHAR(255),

    -- Billing
    billing_frequency           billing_frequency NOT NULL DEFAULT 'monthly',
    contract_value              DECIMAL(10, 2),
    recurring_amount            DECIMAL(10, 2),

    -- Renewal
    auto_renew                  BOOLEAN NOT NULL DEFAULT false,
    renewal_increase_percent    DECIMAL(5, 2) NOT NULL DEFAULT 0,

    -- Metadata
    notes                       TEXT,
    tags                        TEXT[] DEFAULT '{}',
    xero_repeating_invoice_id   VARCHAR(255),

    -- Tracking
    created_by                  UUID REFERENCES users(id),
    updated_by                  UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

-- Unique contract number per tenant
CREATE UNIQUE INDEX idx_contracts_number_tenant
    ON service_contracts(tenant_id, contract_number)
    WHERE deleted_at IS NULL;

-- Query indexes
CREATE INDEX idx_contracts_tenant_id ON service_contracts(tenant_id);
CREATE INDEX idx_contracts_customer_id ON service_contracts(tenant_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_property_id ON service_contracts(tenant_id, property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_status ON service_contracts(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_type ON service_contracts(tenant_id, contract_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_division ON service_contracts(tenant_id, division) WHERE deleted_at IS NULL;

-- Updated_at trigger
CREATE TRIGGER trg_contracts_updated_at
    BEFORE UPDATE ON service_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log trigger
CREATE TRIGGER trg_audit_contracts
    AFTER INSERT OR UPDATE OR DELETE ON service_contracts
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Contract Line Items
-- ============================================

CREATE TABLE contract_line_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    contract_id     UUID NOT NULL REFERENCES service_contracts(id),

    service_name    VARCHAR(255) NOT NULL,
    description     TEXT,
    quantity        DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10, 2) NOT NULL,
    frequency       billing_frequency,
    division        division_type,
    sort_order      INTEGER NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_line_items_contract ON contract_line_items(tenant_id, contract_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_line_items_updated_at
    BEFORE UPDATE ON contract_line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_line_items
    AFTER INSERT OR UPDATE OR DELETE ON contract_line_items
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Contract Price History
-- ============================================

CREATE TABLE contract_price_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    contract_id     UUID NOT NULL REFERENCES service_contracts(id),

    old_value       DECIMAL(10, 2),
    new_value       DECIMAL(10, 2),
    change_reason   TEXT,
    changed_by      UUID REFERENCES users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_history_contract ON contract_price_history(tenant_id, contract_id);
