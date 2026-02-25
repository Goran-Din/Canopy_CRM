-- ============================================
-- Contacts table (Phase 2 - D-3)
-- ============================================

-- Enum types for contacts
CREATE TYPE contact_type AS ENUM ('primary', 'billing', 'site', 'emergency', 'other');
CREATE TYPE preferred_contact_method AS ENUM ('email', 'phone', 'sms', 'any');

CREATE TABLE contacts (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id),
    customer_id                 UUID NOT NULL REFERENCES customers(id),
    property_id                 UUID REFERENCES properties(id),

    -- Classification
    contact_type                contact_type NOT NULL DEFAULT 'other',
    is_primary                  BOOLEAN NOT NULL DEFAULT false,
    preferred_contact_method    preferred_contact_method NOT NULL DEFAULT 'any',

    -- Identity
    first_name                  VARCHAR(100) NOT NULL,
    last_name                   VARCHAR(100) NOT NULL,
    display_name                VARCHAR(255) NOT NULL,
    email                       VARCHAR(255),
    phone                       VARCHAR(30),
    mobile                      VARCHAR(30),
    job_title                   VARCHAR(100),

    -- Metadata
    notes                       TEXT,

    -- Tracking
    created_by                  UUID REFERENCES users(id),
    updated_by                  UUID REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_contacts_customer_id ON contacts(tenant_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_property_id ON contacts(tenant_id, property_id) WHERE deleted_at IS NULL AND property_id IS NOT NULL;
CREATE INDEX idx_contacts_email ON contacts(tenant_id, email) WHERE deleted_at IS NULL AND email IS NOT NULL;

-- Only one primary contact per customer within a tenant
CREATE UNIQUE INDEX idx_contacts_one_primary_per_customer
    ON contacts(tenant_id, customer_id)
    WHERE is_primary = true AND deleted_at IS NULL;

-- Updated_at trigger
CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log trigger
CREATE TRIGGER trg_audit_contacts
    AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
