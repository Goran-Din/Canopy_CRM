-- ============================================
-- Billing Milestones (V2)
-- Hardscape project payment milestones
-- Each milestone triggers an invoice when reached
-- ============================================

CREATE TABLE billing_milestones (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    job_id                  UUID        NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    contract_id             UUID        REFERENCES service_contracts(id) ON DELETE SET NULL,
    milestone_name          VARCHAR(255) NOT NULL,
    milestone_description   TEXT,
    amount_type             VARCHAR(20) NOT NULL,
    amount_value            NUMERIC(10,4) NOT NULL,
    computed_amount         NUMERIC(10,2),
    project_total           NUMERIC(10,2),
    status                  VARCHAR(30) NOT NULL DEFAULT 'pending',
    invoice_id              UUID        REFERENCES invoices(id) ON DELETE SET NULL,
    xero_invoice_id         VARCHAR(255),
    sort_order              SMALLINT    NOT NULL DEFAULT 0,
    due_date                DATE,
    triggered_at            TIMESTAMPTZ,
    paid_at                 TIMESTAMPTZ,
    notes                   TEXT,
    created_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_milestone_amount_type CHECK (amount_type IN ('fixed', 'percentage')),
    CONSTRAINT chk_milestone_status CHECK (status IN (
        'pending', 'invoiced', 'approved', 'paid', 'cancelled'
    ))
);

CREATE INDEX idx_billing_milestones_job ON billing_milestones(job_id, sort_order);
CREATE INDEX idx_billing_milestones_status ON billing_milestones(tenant_id, status)
    WHERE status IN ('pending', 'invoiced', 'approved');

CREATE TRIGGER billing_milestones_updated_at
    BEFORE UPDATE ON billing_milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
