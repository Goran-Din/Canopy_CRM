DROP INDEX IF EXISTS idx_properties_snow;
DROP INDEX IF EXISTS idx_properties_category;

ALTER TABLE properties DROP CONSTRAINT IF EXISTS chk_dogs_on_property;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS chk_equipment_access;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS chk_crew_parking;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS chk_entry_method;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS chk_driveway_material;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS chk_property_category;

ALTER TABLE properties DROP COLUMN IF EXISTS special_crew_instructions;
ALTER TABLE properties DROP COLUMN IF EXISTS dogs_on_property;
ALTER TABLE properties DROP COLUMN IF EXISTS equipment_access;
ALTER TABLE properties DROP COLUMN IF EXISTS crew_parking;
ALTER TABLE properties DROP COLUMN IF EXISTS entry_method;
ALTER TABLE properties DROP COLUMN IF EXISTS snow_hand_shoveling_sqft;
ALTER TABLE properties DROP COLUMN IF EXISTS snow_salting_area_sqft;
ALTER TABLE properties DROP COLUMN IF EXISTS snow_plow_area_sqft;
ALTER TABLE properties DROP COLUMN IF EXISTS snow_service_active;
ALTER TABLE properties DROP COLUMN IF EXISTS parking_lot_sqft;
ALTER TABLE properties DROP COLUMN IF EXISTS patio_sqft;
ALTER TABLE properties DROP COLUMN IF EXISTS walkway_linear_ft;
ALTER TABLE properties DROP COLUMN IF EXISTS driveway_material;
ALTER TABLE properties DROP COLUMN IF EXISTS driveway_sqft;
ALTER TABLE properties DROP COLUMN IF EXISTS num_trees;
ALTER TABLE properties DROP COLUMN IF EXISTS num_bushes_shrubs;
ALTER TABLE properties DROP COLUMN IF EXISTS bed_area_sqft;
ALTER TABLE properties DROP COLUMN IF EXISTS property_description;
ALTER TABLE properties DROP COLUMN IF EXISTS property_category;
