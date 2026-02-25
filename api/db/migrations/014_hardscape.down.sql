-- Reverse 014_hardscape.up.sql

DROP TABLE IF EXISTS hardscape_stage_history;

DROP TRIGGER IF EXISTS trg_hardscape_milestones_updated_at ON hardscape_milestones;
DROP TABLE IF EXISTS hardscape_milestones;

DROP TRIGGER IF EXISTS trg_audit_hardscape_projects ON hardscape_projects;
DROP TRIGGER IF EXISTS trg_hardscape_projects_updated_at ON hardscape_projects;
DROP TABLE IF EXISTS hardscape_projects;

DROP TYPE IF EXISTS milestone_payment_status;
DROP TYPE IF EXISTS milestone_status;
DROP TYPE IF EXISTS hardscape_source;
DROP TYPE IF EXISTS hardscape_project_type;
DROP TYPE IF EXISTS hardscape_project_status;
