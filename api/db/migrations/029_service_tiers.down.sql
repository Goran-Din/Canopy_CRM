DROP INDEX IF EXISTS idx_contracts_tier;

ALTER TABLE service_contracts DROP CONSTRAINT IF EXISTS chk_contract_snow_freq;
ALTER TABLE service_contracts DROP CONSTRAINT IF EXISTS chk_contract_snow_package;
ALTER TABLE service_contracts DROP CONSTRAINT IF EXISTS chk_contract_bronze_billing;
ALTER TABLE service_contracts DROP CONSTRAINT IF EXISTS chk_contract_service_tier;

ALTER TABLE service_contracts DROP COLUMN IF EXISTS snow_invoice_frequency;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS snow_calcium_addon;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS snow_package_name;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS package_services;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS season_end_date;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS season_start_date;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS season_invoice_count;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS per_cut_price;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS season_monthly_price;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS bronze_billing_type;
ALTER TABLE service_contracts DROP COLUMN IF EXISTS service_tier;
