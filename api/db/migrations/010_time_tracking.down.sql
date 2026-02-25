DROP TRIGGER IF EXISTS trg_audit_time_entries ON time_entries;
DROP TRIGGER IF EXISTS trg_time_entries_updated_at ON time_entries;
DROP TABLE IF EXISTS gps_events CASCADE;
DROP TABLE IF EXISTS time_entries CASCADE;
DROP TYPE IF EXISTS gps_event_type;
DROP TYPE IF EXISTS clock_method;
DROP TYPE IF EXISTS time_entry_status;
