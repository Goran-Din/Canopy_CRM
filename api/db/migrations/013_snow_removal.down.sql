-- Reverse 013_snow_removal.up.sql

DROP TRIGGER IF EXISTS trg_snow_run_entries_updated_at ON snow_run_entries;
DROP TABLE IF EXISTS snow_run_entries;

DROP TRIGGER IF EXISTS trg_audit_snow_runs ON snow_runs;
DROP TRIGGER IF EXISTS trg_snow_runs_updated_at ON snow_runs;
DROP TABLE IF EXISTS snow_runs;

DROP TRIGGER IF EXISTS trg_audit_snow_seasons ON snow_seasons;
DROP TRIGGER IF EXISTS trg_snow_seasons_updated_at ON snow_seasons;
DROP TABLE IF EXISTS snow_seasons;

DROP TYPE IF EXISTS snow_service_type;
DROP TYPE IF EXISTS snow_entry_status;
DROP TYPE IF EXISTS snow_trigger_type;
DROP TYPE IF EXISTS snow_run_status;
DROP TYPE IF EXISTS snow_season_status;
