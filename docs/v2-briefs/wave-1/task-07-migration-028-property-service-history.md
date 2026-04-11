# Wave 1, Task 7: Migration 028 — Property Service History

> **Branch:** `feature/wave1-property-service-history`
> **Source docs:** D-34 (Property Knowledge Card)
> **Dependencies:** Migration 027 (property V2 fields)

---

## Migration 028: `028_property_service_history.up.sql`

Creates the property service history table. Tracks every service performed at a property across all customers and contracts — used by the Property Knowledge Card.

```sql
-- ============================================
-- Property Service History (V2)
-- Historical record of all services at a property
-- Used by Property Knowledge Card timeline
-- ============================================

CREATE TABLE property_service_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    customer_id     UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    contract_id     UUID        REFERENCES service_contracts(id) ON DELETE SET NULL,
    job_id          UUID        REFERENCES jobs(id) ON DELETE SET NULL,
    service_code    VARCHAR(100) NOT NULL,
    service_name    VARCHAR(500) NOT NULL,
    service_date    DATE        NOT NULL,
    season_year     SMALLINT    NOT NULL,
    division        VARCHAR(50) NOT NULL,
    crew_id         UUID        REFERENCES crews(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'completed',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_psh_status CHECK (status IN (
        'completed', 'skipped', 'partial', 'rescheduled'
    )),
    CONSTRAINT chk_psh_division CHECK (division IN (
        'landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'
    ))
);

CREATE INDEX idx_psh_property_date ON property_service_history(property_id, service_date DESC);
CREATE INDEX idx_psh_tenant_season ON property_service_history(tenant_id, season_year, service_code);
CREATE INDEX idx_psh_customer ON property_service_history(customer_id, service_date DESC);
CREATE INDEX idx_psh_job ON property_service_history(job_id) WHERE job_id IS NOT NULL;

CREATE TRIGGER property_service_history_updated_at
    BEFORE UPDATE ON property_service_history
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Down: `028_property_service_history.down.sql`
```sql
DROP TRIGGER IF EXISTS property_service_history_updated_at ON property_service_history;
DROP TABLE IF EXISTS property_service_history;
```

---

## Key Rules
- Records are written when a job/work order is completed — not created in advance
- `service_code` matches the codes used in service_occurrences and contract definitions
- One record per service visit per property (not per line item)
- `division` must match the V1 division values used everywhere else in the system

## Testing

```bash
npm run migrate:up -w api
npm run test -w api
```

## Done When
- [ ] Migration 028 created (up + down)
- [ ] Applied to staging
- [ ] All tests pass
- [ ] Committed to branch
