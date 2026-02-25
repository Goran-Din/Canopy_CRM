DROP TRIGGER IF EXISTS trg_audit_properties ON properties;
DROP TRIGGER IF EXISTS trg_properties_updated_at ON properties;
DROP TABLE IF EXISTS properties CASCADE;
DROP TYPE IF EXISTS service_frequency;
DROP TYPE IF EXISTS property_status;
DROP TYPE IF EXISTS property_type;
