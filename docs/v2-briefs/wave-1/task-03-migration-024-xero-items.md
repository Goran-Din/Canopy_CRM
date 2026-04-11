# Wave 1, Task 3: Migration 024 — Xero Items Cache

> **Branch:** `feature/wave1-xero-items`
> **Source docs:** B-7 (Files & Storage Schema)
> **Dependencies:** V1 complete

---

## Migration 024: `024_xero_items.up.sql`

Local cache of the Xero item catalog. Synced nightly at 2 AM. Used by the Quote Builder for fast item search.

```sql
-- ============================================
-- Xero Items Cache (V2)
-- Nightly sync from Xero. Read-only in CRM.
-- Used by Quote Builder for item search.
-- ============================================

CREATE TABLE xero_items (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    xero_item_id        VARCHAR(255) NOT NULL,
    item_code           VARCHAR(100) NOT NULL,
    item_name           VARCHAR(500) NOT NULL,
    sales_description   TEXT,
    sales_account_code  VARCHAR(50),
    unit_price          NUMERIC(10,2),
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    is_sold             BOOLEAN     NOT NULL DEFAULT TRUE,
    last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    xero_updated_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One item code per tenant
CREATE UNIQUE INDEX idx_xero_items_tenant_code ON xero_items(tenant_id, item_code);
-- One Xero ID per tenant
CREATE UNIQUE INDEX idx_xero_items_tenant_xero_id ON xero_items(tenant_id, xero_item_id);
-- Fast search for active sellable items (Quote Builder)
CREATE INDEX idx_xero_items_active ON xero_items(tenant_id, is_active, is_sold)
    WHERE is_active = TRUE AND is_sold = TRUE;

CREATE TRIGGER xero_items_updated_at
    BEFORE UPDATE ON xero_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Down: `024_xero_items.down.sql`
```sql
DROP TRIGGER IF EXISTS xero_items_updated_at ON xero_items;
DROP TABLE IF EXISTS xero_items;
```

---

## Key Rules
- CRM never modifies Xero items — Xero is the master
- `unit_price` is displayed as reference only, NEVER auto-populated into quotes
- Sync rules: new in Xero → INSERT; changed → UPDATE; missing from Xero → SET is_active = FALSE (never delete)

## Testing

```bash
npm run migrate:up -w api
npm run test -w api
```

## Done When
- [ ] Migration 024 created (up + down)
- [ ] Applied to staging
- [ ] All tests pass
- [ ] Committed to branch
