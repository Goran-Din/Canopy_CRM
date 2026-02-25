DROP TRIGGER IF EXISTS trg_audit_divisions ON divisions;
DROP TRIGGER IF EXISTS trg_audit_user_roles ON user_roles;
DROP TRIGGER IF EXISTS trg_audit_users ON users;
DROP TRIGGER IF EXISTS trg_audit_tenants ON tenants;
DROP FUNCTION IF EXISTS audit_log_trigger();
DROP TABLE IF EXISTS audit_log CASCADE;
