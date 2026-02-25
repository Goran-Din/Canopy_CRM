DROP TRIGGER IF EXISTS trg_audit_customers ON customers;
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
DROP TABLE IF EXISTS customers CASCADE;
DROP TYPE IF EXISTS customer_source;
DROP TYPE IF EXISTS customer_status;
DROP TYPE IF EXISTS customer_type;
