-- Add V2 columns to existing gps_events table
ALTER TABLE gps_events ADD COLUMN geofence_radius_at_trigger INTEGER;
ALTER TABLE gps_events ADD COLUMN distance_from_centre_metres NUMERIC(8, 2);
ALTER TABLE gps_events ADD COLUMN dwell_minutes INTEGER;
ALTER TABLE gps_events ADD COLUMN service_occurrence_id UUID REFERENCES service_occurrences(id) ON DELETE SET NULL;
ALTER TABLE gps_events ADD COLUMN payroll_cross_check_status VARCHAR(20) DEFAULT 'pending'
  CHECK (payroll_cross_check_status IN ('pending', 'consistent', 'flagged', 'reviewed'));
ALTER TABLE gps_events ADD COLUMN payroll_cross_check_note TEXT;
