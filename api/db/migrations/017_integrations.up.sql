-- ============================================
-- Phase 5: Integration Framework & Xero (F-4)
-- ============================================

-- ============================================
-- Enum types
-- ============================================

CREATE TYPE integration_provider AS ENUM (
    'xero', 'mautic', 'google_drive', 'canopy_quotes', 'canopy_ops', 'northchat'
);

CREATE TYPE integration_status AS ENUM ('active', 'inactive', 'error', 'pending_setup');

CREATE TYPE sync_direction AS ENUM ('push', 'pull');

CREATE TYPE sync_status AS ENUM ('pending', 'success', 'failed', 'skipped');

-- ============================================
-- Integration Configs
-- ============================================

CREATE TABLE integration_configs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),

    provider                integration_provider NOT NULL,
    status                  integration_status NOT NULL DEFAULT 'pending_setup',
    config_data             JSONB NOT NULL DEFAULT '{}',
    access_token_encrypted  TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMPTZ,
    last_sync_at            TIMESTAMPTZ,
    last_error              TEXT,
    webhook_secret          VARCHAR(255),

    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One config per provider per tenant
CREATE UNIQUE INDEX idx_integration_configs_unique ON integration_configs(tenant_id, provider);
CREATE INDEX idx_integration_configs_tenant ON integration_configs(tenant_id);
CREATE INDEX idx_integration_configs_status ON integration_configs(tenant_id, status);

CREATE TRIGGER trg_integration_configs_updated_at
    BEFORE UPDATE ON integration_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_integration_configs
    AFTER INSERT OR UPDATE OR DELETE ON integration_configs
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Integration Sync Log
-- ============================================

CREATE TABLE integration_sync_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),

    provider            VARCHAR(50) NOT NULL,
    direction           sync_direction NOT NULL,
    entity_type         VARCHAR(50) NOT NULL,
    entity_id           UUID NOT NULL,
    external_id         VARCHAR(255),
    status              sync_status NOT NULL DEFAULT 'pending',
    error_message       TEXT,
    request_payload     JSONB,
    response_payload    JSONB,
    duration_ms         INTEGER,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_log_tenant ON integration_sync_log(tenant_id);
CREATE INDEX idx_sync_log_provider ON integration_sync_log(tenant_id, provider);
CREATE INDEX idx_sync_log_entity ON integration_sync_log(tenant_id, entity_type, entity_id);
CREATE INDEX idx_sync_log_status ON integration_sync_log(tenant_id, status);
CREATE INDEX idx_sync_log_created ON integration_sync_log(tenant_id, created_at DESC);
