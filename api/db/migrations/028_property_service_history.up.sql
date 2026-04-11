-- ============================================
-- Property Service History (V2)
-- Historical record of all services at a property
-- Used by Property Knowledge Card timeline
-- ============================================

CREATE TABLE property_service_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    customer_id     UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    contract_id     UUID        REFERENCES service_contracts(id) ON DELETE SET NULL,
    job_id          UUID        REFERENCES jobs(id) ON DELETE SET NULL,
    service_code    VARCHAR(100) NOT NULL,
    service_name    VARCHAR(500) NOT NULL,
    service_date    DATE        NOT NULL,
    season_year     SMALLINT    NOT NULL,
    division        VARCHAR(50) NOT NULL,
    crew_id         UUID        REFERENCES crews(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'completed',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_psh_status CHECK (status IN (
        'completed', 'skipped', 'partial', 'rescheduled'
    )),
    CONSTRAINT chk_psh_division CHECK (division IN (
        'landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'
    ))
);

CREATE INDEX idx_psh_property_date ON property_service_history(property_id, service_date DESC);
CREATE INDEX idx_psh_tenant_season ON property_service_history(tenant_id, season_year, service_code);
CREATE INDEX idx_psh_customer ON property_service_history(customer_id, service_date DESC);
CREATE INDEX idx_psh_job ON property_service_history(job_id) WHERE job_id IS NOT NULL;

CREATE TRIGGER property_service_history_updated_at
    BEFORE UPDATE ON property_service_history
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
