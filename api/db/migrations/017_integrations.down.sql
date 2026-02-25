-- Reverse 017_integrations.up.sql

DROP TABLE IF EXISTS integration_sync_log;

DROP TRIGGER IF EXISTS trg_audit_integration_configs ON integration_configs;
DROP TRIGGER IF EXISTS trg_integration_configs_updated_at ON integration_configs;
DROP TABLE IF EXISTS integration_configs;

DROP TYPE IF EXISTS sync_status;
DROP TYPE IF EXISTS sync_direction;
DROP TYPE IF EXISTS integration_status;
DROP TYPE IF EXISTS integration_provider;
