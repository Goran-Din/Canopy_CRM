-- Reverse 015_phase4_modules.up.sql

DROP TRIGGER IF EXISTS trg_audit_subcontractors ON subcontractors;
DROP TRIGGER IF EXISTS trg_subcontractors_updated_at ON subcontractors;
DROP TABLE IF EXISTS subcontractors;

DROP TABLE IF EXISTS material_transactions;

DROP TRIGGER IF EXISTS trg_audit_materials ON materials;
DROP TRIGGER IF EXISTS trg_materials_updated_at ON materials;
DROP TABLE IF EXISTS materials;

DROP TRIGGER IF EXISTS trg_audit_equipment ON equipment;
DROP TRIGGER IF EXISTS trg_equipment_updated_at ON equipment;
DROP TABLE IF EXISTS equipment;

DROP TRIGGER IF EXISTS trg_audit_prospects ON prospects;
DROP TRIGGER IF EXISTS trg_prospects_updated_at ON prospects;
DROP TABLE IF EXISTS prospects;

DROP TYPE IF EXISTS subcontractor_rate_type;
DROP TYPE IF EXISTS subcontractor_status;
DROP TYPE IF EXISTS material_transaction_type;
DROP TYPE IF EXISTS material_unit;
DROP TYPE IF EXISTS material_category;
DROP TYPE IF EXISTS equipment_status;
DROP TYPE IF EXISTS equipment_type;
DROP TYPE IF EXISTS prospect_status;
DROP TYPE IF EXISTS prospect_source;
