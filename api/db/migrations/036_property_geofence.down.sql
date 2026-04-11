DROP INDEX IF EXISTS idx_properties_geofence;
ALTER TABLE properties DROP COLUMN IF EXISTS geofence_set_by;
ALTER TABLE properties DROP COLUMN IF EXISTS geofence_last_set_at;
ALTER TABLE properties DROP COLUMN IF EXISTS geofence_enabled;
ALTER TABLE properties DROP COLUMN IF EXISTS geofence_radius_metres;
ALTER TABLE properties DROP COLUMN IF EXISTS geofence_lng;
ALTER TABLE properties DROP COLUMN IF EXISTS geofence_lat;
