DROP TRIGGER IF EXISTS trg_audit_contacts ON contacts;
DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TYPE IF EXISTS preferred_contact_method;
DROP TYPE IF EXISTS contact_type;
