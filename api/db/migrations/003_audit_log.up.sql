-- ============================================
-- Audit Log table and automatic triggers
-- ============================================

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID REFERENCES tenants(id),
    user_id     UUID,
    action      VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name  VARCHAR(100) NOT NULL,
    record_id   UUID NOT NULL,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================
-- Reusable trigger function
-- Reads optional session variables for user context:
--   app.current_user_id, app.current_ip_address, app.current_user_agent
-- ============================================
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    _tenant_id  UUID;
    _record_id  UUID;
    _user_id    UUID;
    _ip         INET;
    _ua         TEXT;
    _old        JSONB;
    _new        JSONB;
BEGIN
    -- Read optional session context (set by application middleware)
    BEGIN
        _user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        _user_id := NULL;
    END;
    BEGIN
        _ip := NULLIF(current_setting('app.current_ip_address', true), '')::INET;
    EXCEPTION WHEN OTHERS THEN
        _ip := NULL;
    END;
    _ua := NULLIF(current_setting('app.current_user_agent', true), '');

    -- Use JSONB extraction to avoid field-not-found errors on tables
    -- that lack tenant_id (e.g. tenants table uses its own id)
    IF TG_OP = 'DELETE' THEN
        _old := to_jsonb(OLD) - 'password_hash';
        _record_id := (to_jsonb(OLD)->>'id')::UUID;
        _tenant_id := COALESCE((_old->>'tenant_id')::UUID, _record_id);

        INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, old_values, ip_address, user_agent)
        VALUES (_tenant_id, _user_id, 'DELETE', TG_TABLE_NAME, _record_id, _old, _ip, _ua);
        RETURN OLD;
    ELSE
        _new := to_jsonb(NEW) - 'password_hash';
        _record_id := (to_jsonb(NEW)->>'id')::UUID;
        _tenant_id := COALESCE((_new->>'tenant_id')::UUID, _record_id);

        IF TG_OP = 'INSERT' THEN
            INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, new_values, ip_address, user_agent)
            VALUES (_tenant_id, _user_id, 'INSERT', TG_TABLE_NAME, _record_id, _new, _ip, _ua);
        ELSIF TG_OP = 'UPDATE' THEN
            _old := to_jsonb(OLD) - 'password_hash';
            INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
            VALUES (_tenant_id, _user_id, 'UPDATE', TG_TABLE_NAME, _record_id, _old, _new, _ip, _ua);
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Apply triggers to existing tables
-- ============================================
CREATE TRIGGER trg_audit_tenants
    AFTER INSERT OR UPDATE OR DELETE ON tenants
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER trg_audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER trg_audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER trg_audit_divisions
    AFTER INSERT OR UPDATE OR DELETE ON divisions
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
