# Wave 1, Task 8: Migration 029 — Service Tiers on Contracts

> **Branch:** `feature/wave1-service-tiers`
> **Source docs:** D-27 (Service Tier & Package Module)
> **Dependencies:** V1 complete (service_contracts table exists)

---

## Migration 029: `029_service_tiers.up.sql`

Adds V2 columns to the existing `service_contracts` table for service tier classification, package pricing, and snow-specific fields. Does NOT modify or drop any V1 columns.

```sql
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
```

### Down: `029_service_tiers.down.sql`
```sql
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
```

---

## Key Rules
- Gold/Silver package services NEVER appear as individual invoice line items — they're bundled into `season_monthly_price`
- `bronze_billing_type` only relevant when `service_tier = 'bronze'`
- `season_invoice_count`: Gold/Silver = 8 (April–November), Snow seasonal = 5 (November–March)
- `package_services` JSONB stores the array of included services with occurrence counts
- Snow fields only relevant when `service_tier` starts with `snow_`
- Prices always entered manually — never auto-populated from Xero

## Testing

```bash
npm run migrate:up -w api
npm run test -w api
```

## Done When
- [ ] Migration 029 created (up + down)
- [ ] Applied to staging
- [ ] All tests pass (existing contract tests unaffected)
- [ ] Committed to branch
