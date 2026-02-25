-- ============================================
-- Customers table (Phase 2 - D-1)
-- ============================================

-- Enum types for customers
CREATE TYPE customer_type AS ENUM ('residential', 'commercial');
CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'suspended', 'prospect', 'archived');
CREATE TYPE customer_source AS ENUM ('referral', 'website', 'mautic', 'manual', 'other');

CREATE TABLE customers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),

    -- Classification
    customer_type           customer_type NOT NULL DEFAULT 'residential',
    status                  customer_status NOT NULL DEFAULT 'prospect',
    source                  customer_source NOT NULL DEFAULT 'manual',

    -- Identity
    company_name            VARCHAR(255),
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    display_name            VARCHAR(255) NOT NULL,
    email                   VARCHAR(255),
    phone                   VARCHAR(30),
    mobile                  VARCHAR(30),

    -- Billing address
    billing_address_line1   VARCHAR(255),
    billing_address_line2   VARCHAR(255),
    billing_city            VARCHAR(100),
    billing_state           VARCHAR(50),
    billing_zip             VARCHAR(20),
    billing_country         VARCHAR(3) NOT NULL DEFAULT 'US',

    -- Metadata
    notes                   TEXT,
    tags                    TEXT[] DEFAULT '{}',
    referred_by_customer_id UUID REFERENCES customers(id),
    xero_contact_id         VARCHAR(255),

    -- Tracking
    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT chk_commercial_company CHECK (
        customer_type != 'commercial' OR company_name IS NOT NULL
    )
);

-- Indexes
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_customers_email ON customers(tenant_id, email) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_status ON customers(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_display_name ON customers(tenant_id, display_name) WHERE deleted_at IS NULL;

-- Updated_at trigger
CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log trigger
CREATE TRIGGER trg_audit_customers
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
