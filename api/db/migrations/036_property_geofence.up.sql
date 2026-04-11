-- Add geofence columns to existing properties table
ALTER TABLE properties ADD COLUMN geofence_lat NUMERIC(10, 7);
ALTER TABLE properties ADD COLUMN geofence_lng NUMERIC(10, 7);
ALTER TABLE properties ADD COLUMN geofence_radius_metres INTEGER NOT NULL DEFAULT 40;
ALTER TABLE properties ADD COLUMN geofence_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE properties ADD COLUMN geofence_last_set_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN geofence_set_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for geofence queries
CREATE INDEX idx_properties_geofence
  ON properties (tenant_id, geofence_enabled)
  WHERE geofence_enabled = TRUE AND deleted_at IS NULL;
