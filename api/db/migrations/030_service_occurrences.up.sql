-- ============================================
-- Service Occurrences (V2)
-- One row per planned service visit per contract
-- Work orders generated from pending occurrences
-- ============================================

CREATE TABLE service_occurrences (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    contract_id             UUID        NOT NULL REFERENCES service_contracts(id) ON DELETE RESTRICT,
    property_id             UUID        NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    customer_id             UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    service_code            VARCHAR(100) NOT NULL,
    service_name            VARCHAR(500) NOT NULL,
    occurrence_number       SMALLINT    NOT NULL,
    season_year             SMALLINT    NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    assigned_date           DATE,
    preferred_month         VARCHAR(20),
    job_id                  UUID        REFERENCES jobs(id) ON DELETE SET NULL,
    skipped_reason          VARCHAR(255),
    skipped_date            DATE,
    recovery_date           DATE,
    is_included_in_invoice  BOOLEAN     NOT NULL DEFAULT FALSE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_occurrence_status CHECK (status IN (
        'pending', 'assigned', 'completed', 'skipped'
    ))
);

CREATE INDEX idx_service_occ_tenant_season ON service_occurrences(tenant_id, season_year, service_code, status);
CREATE INDEX idx_service_occ_contract ON service_occurrences(contract_id, occurrence_number);
CREATE INDEX idx_service_occ_property ON service_occurrences(property_id, season_year, service_code);
CREATE INDEX idx_service_occ_job ON service_occurrences(job_id) WHERE job_id IS NOT NULL;

CREATE TRIGGER service_occurrences_updated_at
    BEFORE UPDATE ON service_occurrences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
