-- ============================================
-- Disputes & Credit Notes (Phase 3 - D-17)
-- ============================================

-- Enum types
CREATE TYPE dispute_status AS ENUM (
    'open', 'under_review', 'resolved_credit', 'resolved_adjusted',
    'resolved_no_action', 'closed'
);
CREATE TYPE dispute_reason AS ENUM (
    'service_not_performed', 'poor_quality', 'billing_error',
    'duplicate_charge', 'unauthorized_charge', 'other'
);
CREATE TYPE dispute_priority AS ENUM ('low', 'normal', 'high');
CREATE TYPE credit_note_status AS ENUM ('draft', 'approved', 'applied', 'voided');

-- ============================================
-- Disputes
-- ============================================

CREATE TABLE disputes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    invoice_id          UUID NOT NULL REFERENCES invoices(id),
    customer_id         UUID NOT NULL REFERENCES customers(id),

    dispute_number      VARCHAR(50) NOT NULL,
    status              dispute_status NOT NULL DEFAULT 'open',
    reason              dispute_reason NOT NULL,
    description         TEXT NOT NULL,
    disputed_amount     DECIMAL(12, 2) NOT NULL,

    resolution_notes    TEXT,
    resolved_by         UUID REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    assigned_to         UUID REFERENCES users(id),
    priority            dispute_priority NOT NULL DEFAULT 'normal',

    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_disputes_tenant ON disputes(tenant_id);
CREATE INDEX idx_disputes_invoice ON disputes(tenant_id, invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_disputes_customer ON disputes(tenant_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_disputes_status ON disputes(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_disputes_assigned ON disputes(tenant_id, assigned_to) WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;
CREATE INDEX idx_disputes_priority ON disputes(tenant_id, priority) WHERE deleted_at IS NULL;

-- Unique dispute number per tenant
CREATE UNIQUE INDEX idx_disputes_number_unique
    ON disputes(tenant_id, dispute_number)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_disputes_updated_at
    BEFORE UPDATE ON disputes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_disputes
    AFTER INSERT OR UPDATE OR DELETE ON disputes
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Credit Notes
-- ============================================

CREATE TABLE credit_notes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    invoice_id              UUID NOT NULL REFERENCES invoices(id),
    dispute_id              UUID REFERENCES disputes(id),
    customer_id             UUID NOT NULL REFERENCES customers(id),

    credit_note_number      VARCHAR(50) NOT NULL,
    status                  credit_note_status NOT NULL DEFAULT 'draft',
    amount                  DECIMAL(12, 2) NOT NULL,
    reason                  TEXT NOT NULL,

    applied_at              TIMESTAMPTZ,
    applied_by              UUID REFERENCES users(id),

    xero_credit_note_id     VARCHAR(255),

    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_credit_notes_tenant ON credit_notes(tenant_id);
CREATE INDEX idx_credit_notes_invoice ON credit_notes(tenant_id, invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_notes_dispute ON credit_notes(tenant_id, dispute_id) WHERE deleted_at IS NULL AND dispute_id IS NOT NULL;
CREATE INDEX idx_credit_notes_customer ON credit_notes(tenant_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_notes_status ON credit_notes(tenant_id, status) WHERE deleted_at IS NULL;

-- Unique credit note number per tenant
CREATE UNIQUE INDEX idx_credit_notes_number_unique
    ON credit_notes(tenant_id, credit_note_number)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_credit_notes_updated_at
    BEFORE UPDATE ON credit_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_credit_notes
    AFTER INSERT OR UPDATE OR DELETE ON credit_notes
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
