-- Reverse 016_sops.up.sql

DROP TABLE IF EXISTS sop_step_completions;

DROP TRIGGER IF EXISTS trg_sop_assignments_updated_at ON sop_assignments;
DROP TABLE IF EXISTS sop_assignments;

DROP TRIGGER IF EXISTS trg_sop_steps_updated_at ON sop_steps;
DROP TABLE IF EXISTS sop_steps;

DROP TRIGGER IF EXISTS trg_audit_sop_templates ON sop_templates;
DROP TRIGGER IF EXISTS trg_sop_templates_updated_at ON sop_templates;
DROP TABLE IF EXISTS sop_templates;

DROP TYPE IF EXISTS sop_assignment_status;
DROP TYPE IF EXISTS sop_status;
DROP TYPE IF EXISTS sop_category;
