-- ============================================
-- Invoicing & Billing (Phase 3 - D-9)
-- ============================================

-- Enum types
CREATE TYPE invoice_status AS ENUM (
    'draft', 'pending', 'sent', 'viewed', 'paid',
    'partially_paid', 'overdue', 'disputed', 'cancelled', 'written_off'
);
CREATE TYPE payment_method AS ENUM ('bank_transfer', 'check', 'credit_card', 'cash', 'other');
CREATE TYPE xero_sync_status AS ENUM ('not_synced', 'pending', 'synced', 'error');

-- ============================================
-- Invoices
-- ============================================

CREATE TABLE invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    customer_id             UUID NOT NULL REFERENCES customers(id),
    property_id             UUID REFERENCES properties(id),
    contract_id             UUID REFERENCES service_contracts(id),

    invoice_number          VARCHAR(50) NOT NULL,
    status                  invoice_status NOT NULL DEFAULT 'draft',
    invoice_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date                DATE NOT NULL,
    paid_date               DATE,

    subtotal                DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_rate                DECIMAL(5, 4) NOT NULL DEFAULT 0,
    tax_amount              DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount         DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total                   DECIMAL(12, 2) NOT NULL DEFAULT 0,
    amount_paid             DECIMAL(12, 2) NOT NULL DEFAULT 0,
    balance_due             DECIMAL(12, 2) GENERATED ALWAYS AS (total - amount_paid) STORED,
    currency                VARCHAR(3) NOT NULL DEFAULT 'USD',

    division                division_type,
    billing_period_start    DATE,
    billing_period_end      DATE,

    notes                   TEXT,
    internal_notes          TEXT,

    xero_invoice_id         VARCHAR(255),
    xero_sync_status        xero_sync_status NOT NULL DEFAULT 'not_synced',
    xero_last_synced_at     TIMESTAMPTZ,

    pdf_url                 TEXT,
    sent_at                 TIMESTAMPTZ,
    sent_to_email           VARCHAR(255),

    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_customer ON invoices(tenant_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_property ON invoices(tenant_id, property_id) WHERE deleted_at IS NULL AND property_id IS NOT NULL;
CREATE INDEX idx_invoices_contract ON invoices(tenant_id, contract_id) WHERE deleted_at IS NULL AND contract_id IS NOT NULL;
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_date ON invoices(tenant_id, invoice_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due_date ON invoices(tenant_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_xero ON invoices(tenant_id, xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;
CREATE INDEX idx_invoices_xero_sync ON invoices(tenant_id, xero_sync_status) WHERE deleted_at IS NULL;

-- Unique invoice number per tenant
CREATE UNIQUE INDEX idx_invoices_number_unique
    ON invoices(tenant_id, invoice_number)
    WHERE deleted_at IS NULL;

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_invoices
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Invoice Line Items
-- ============================================

CREATE TABLE invoice_line_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    invoice_id          UUID NOT NULL REFERENCES invoices(id),
    job_id              UUID REFERENCES jobs(id),

    description         VARCHAR(500) NOT NULL,
    quantity            DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price          DECIMAL(10, 2) NOT NULL,
    line_total          DECIMAL(12, 2) NOT NULL,
    tax_rate            DECIMAL(5, 4) NOT NULL DEFAULT 0,
    tax_amount          DECIMAL(12, 2) NOT NULL DEFAULT 0,
    sort_order          INTEGER NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(tenant_id, invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_line_items_job ON invoice_line_items(tenant_id, job_id) WHERE deleted_at IS NULL AND job_id IS NOT NULL;

CREATE TRIGGER trg_invoice_line_items_updated_at
    BEFORE UPDATE ON invoice_line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Payments
-- ============================================

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    invoice_id          UUID NOT NULL REFERENCES invoices(id),

    payment_date        DATE NOT NULL,
    amount              DECIMAL(12, 2) NOT NULL,
    payment_method      payment_method NOT NULL,
    reference_number    VARCHAR(100),
    notes               TEXT,
    xero_payment_id     VARCHAR(255),

    recorded_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_invoice ON payments(tenant_id, invoice_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
