# Wave 1, Task 9: Migration 030 — Service Occurrences

> **Branch:** `feature/wave1-service-occurrences`
> **Source docs:** D-28 (Service Occurrence & Work Order Generation)
> **Dependencies:** Migration 029 (service tiers on contracts)

---

## Migration 030: `030_service_occurrences.up.sql`

Creates the service occurrences table. Each row represents one planned service visit for a contract — e.g., "Mow #3 of 28" or "Spring Cleanup #1 of 1". Work orders (jobs) are generated from these.

```sql
-- ============================================
-- Service Occurrences (V2)
-- One row per planned service visit per contract
-- Work orders generated from pending occurrences
-- ============================================

CREATE TABLE service_occurrences (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    contract_id             UUID        NOT NULL REFERENCES service_contracts(id) ON DELETE RESTRICT,
    property_id             UUID        NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    customer_id             UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    service_code            VARCHAR(100) NOT NULL,
    service_name            VARCHAR(500) NOT NULL,
    occurrence_number       SMALLINT    NOT NULL,
    season_year             SMALLINT    NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',
    assigned_date           DATE,
    preferred_month         VARCHAR(20),
    job_id                  UUID        REFERENCES jobs(id) ON DELETE SET NULL,
    skipped_reason          VARCHAR(255),
    skipped_date            DATE,
    recovery_date           DATE,
    is_included_in_invoice  BOOLEAN     NOT NULL DEFAULT FALSE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_occurrence_status CHECK (status IN (
        'pending', 'assigned', 'completed', 'skipped'
    ))
);

CREATE INDEX idx_service_occ_tenant_season ON service_occurrences(tenant_id, season_year, service_code, status);
CREATE INDEX idx_service_occ_contract ON service_occurrences(contract_id, occurrence_number);
CREATE INDEX idx_service_occ_property ON service_occurrences(property_id, season_year, service_code);
CREATE INDEX idx_service_occ_job ON service_occurrences(job_id) WHERE job_id IS NOT NULL;

CREATE TRIGGER service_occurrences_updated_at
    BEFORE UPDATE ON service_occurrences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Down: `030_service_occurrences.down.sql`
```sql
DROP TRIGGER IF EXISTS service_occurrences_updated_at ON service_occurrences;
DROP TABLE IF EXISTS service_occurrences;
```

---

## Key Rules
- Occurrences are pre-generated at season start based on `package_services` JSONB in the contract
- `occurrence_number` is sequential per service_code per contract per season (e.g., Mow 1, Mow 2, ...)
- `status = 'skipped'` requires `skipped_reason` (enforced in application layer)
- `recovery_date` set when a skipped service is rescheduled
- `is_included_in_invoice` tracks whether this occurrence has been billed (for bronze per_cut billing)
- Gold/Silver occurrences are NOT individually invoiced — they're part of the monthly package price

## Testing

```bash
npm run migrate:up -w api
npm run test -w api
```

## Done When
- [ ] Migration 030 created (up + down)
- [ ] Applied to staging
- [ ] All tests pass
- [ ] Committed to branch
