-- ============================================
-- Service Tiers on Contracts (V2)
-- Adds tier, pricing, package, and snow fields
-- No V1 columns are modified or dropped
-- ============================================

-- Service tier classification
ALTER TABLE service_contracts ADD COLUMN service_tier VARCHAR(20);
ALTER TABLE service_contracts ADD COLUMN bronze_billing_type VARCHAR(20);

ALTER TABLE service_contracts ADD CONSTRAINT chk_contract_service_tier CHECK (service_tier IN (
    'gold', 'silver', 'bronze', 'snow_seasonal', 'snow_per_event',
    'landscape_project', 'hardscape', 'one_time'
));

ALTER TABLE service_contracts ADD CONSTRAINT chk_contract_bronze_billing CHECK (bronze_billing_type IN (
    'per_cut', 'flat_monthly'
));

-- Seasonal pricing
ALTER TABLE service_contracts ADD COLUMN season_monthly_price NUMERIC(10,2);
ALTER TABLE service_contracts ADD COLUMN per_cut_price NUMERIC(10,2);
ALTER TABLE service_contracts ADD COLUMN season_invoice_count SMALLINT;
ALTER TABLE service_contracts ADD COLUMN season_start_date DATE;
ALTER TABLE service_contracts ADD COLUMN season_end_date DATE;

-- Package services (array of service definitions for Gold/Silver)
ALTER TABLE service_contracts ADD COLUMN package_services JSONB NOT NULL DEFAULT '[]';

-- Snow-specific fields
ALTER TABLE service_contracts ADD COLUMN snow_package_name VARCHAR(50);
ALTER TABLE service_contracts ADD COLUMN snow_calcium_addon BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE service_contracts ADD COLUMN snow_invoice_frequency VARCHAR(20);

ALTER TABLE service_contracts ADD CONSTRAINT chk_contract_snow_package CHECK (snow_package_name IN (
    'plowing_only', 'plowing_salt', 'walkways_deicing', 'full_service'
));

ALTER TABLE service_contracts ADD CONSTRAINT chk_contract_snow_freq CHECK (snow_invoice_frequency IN (
    'per_event', 'monthly_batch'
));

-- Indexes
CREATE INDEX idx_contracts_tier ON service_contracts(tenant_id, service_tier)
    WHERE deleted_at IS NULL AND status = 'active';
