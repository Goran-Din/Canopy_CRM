-- ============================================
-- Property V2 Fields
-- Adds category, measurements, access, snow, crew instructions
-- No V1 columns are modified or dropped
-- ============================================

-- Classification
ALTER TABLE properties ADD COLUMN property_category VARCHAR(10);
ALTER TABLE properties ADD COLUMN property_description TEXT;

ALTER TABLE properties ADD CONSTRAINT chk_property_category CHECK (property_category IN (
    'RES-S', 'RES-M', 'RES-L',
    'COM-S', 'COM-M', 'COM-L',
    'HOA-S', 'HOA-M', 'HOA-L',
    'PORT-R', 'PORT-C'
));

-- Landscaping measurements
ALTER TABLE properties ADD COLUMN bed_area_sqft INTEGER;
ALTER TABLE properties ADD COLUMN num_bushes_shrubs INTEGER;
ALTER TABLE properties ADD COLUMN num_trees INTEGER;

-- Hardscape measurements
ALTER TABLE properties ADD COLUMN driveway_sqft INTEGER;
ALTER TABLE properties ADD COLUMN driveway_material VARCHAR(50);
ALTER TABLE properties ADD COLUMN walkway_linear_ft INTEGER;
ALTER TABLE properties ADD COLUMN patio_sqft INTEGER;
ALTER TABLE properties ADD COLUMN parking_lot_sqft INTEGER;

ALTER TABLE properties ADD CONSTRAINT chk_driveway_material CHECK (driveway_material IN (
    'asphalt', 'concrete', 'pavers', 'gravel', 'other'
));

-- Snow profile
ALTER TABLE properties ADD COLUMN snow_service_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN snow_plow_area_sqft INTEGER;
ALTER TABLE properties ADD COLUMN snow_salting_area_sqft INTEGER;
ALTER TABLE properties ADD COLUMN snow_hand_shoveling_sqft INTEGER;

-- Access and crew info
ALTER TABLE properties ADD COLUMN entry_method VARCHAR(50);
ALTER TABLE properties ADD COLUMN crew_parking VARCHAR(50);
ALTER TABLE properties ADD COLUMN equipment_access VARCHAR(50);
ALTER TABLE properties ADD COLUMN dogs_on_property VARCHAR(20);
ALTER TABLE properties ADD COLUMN special_crew_instructions TEXT;

ALTER TABLE properties ADD CONSTRAINT chk_entry_method CHECK (entry_method IN (
    'street_access', 'side_gate', 'back_gate', 'key_required',
    'code_required', 'call_client', 'other'
));

ALTER TABLE properties ADD CONSTRAINT chk_crew_parking CHECK (crew_parking IN (
    'available_street', 'available_driveway', 'restricted', 'call_first'
));

ALTER TABLE properties ADD CONSTRAINT chk_equipment_access CHECK (equipment_access IN (
    'full_access', 'tight_access', 'hand_tools_only', 'assess_on_arrival'
));

ALTER TABLE properties ADD CONSTRAINT chk_dogs_on_property CHECK (dogs_on_property IN (
    'no', 'yes', 'sometimes', 'unknown'
));

-- Indexes
CREATE INDEX idx_properties_category ON properties(tenant_id, property_category) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_snow ON properties(tenant_id, snow_service_active) WHERE deleted_at IS NULL AND snow_service_active = TRUE;
