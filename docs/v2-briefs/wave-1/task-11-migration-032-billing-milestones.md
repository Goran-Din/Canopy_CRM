# Wave 1, Task 11: Migration 032 — Hardscape Billing Milestones

> **Branch:** `feature/wave1-billing-milestones`
> **Source docs:** D-30 (Hardscape Milestone Billing)
> **Dependencies:** Migration 031 (billing schedule)

---

## Migration 032: `032_billing_milestones.up.sql`

Creates the billing milestones table for hardscape projects. Each milestone represents a payment trigger point (e.g., "50% deposit", "Completion balance"). Milestones can be fixed amounts or percentages of the project total.

```sql
-- ============================================
-- Billing Milestones (V2)
-- Hardscape project payment milestones
-- Each milestone triggers an invoice when reached
-- ============================================

CREATE TABLE billing_milestones (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    job_id                  UUID        NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    contract_id             UUID        REFERENCES service_contracts(id) ON DELETE SET NULL,
    milestone_name          VARCHAR(255) NOT NULL,
    milestone_description   TEXT,
    amount_type             VARCHAR(20) NOT NULL,
    amount_value            NUMERIC(10,4) NOT NULL,
    computed_amount         NUMERIC(10,2),
    project_total           NUMERIC(10,2),
    status                  VARCHAR(30) NOT NULL DEFAULT 'pending',
    invoice_id              UUID        REFERENCES invoices(id) ON DELETE SET NULL,
    xero_invoice_id         VARCHAR(255),
    sort_order              SMALLINT    NOT NULL DEFAULT 0,
    due_date                DATE,
    triggered_at            TIMESTAMPTZ,
    paid_at                 TIMESTAMPTZ,
    notes                   TEXT,
    created_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_milestone_amount_type CHECK (amount_type IN ('fixed', 'percentage')),
    CONSTRAINT chk_milestone_status CHECK (status IN (
        'pending', 'invoiced', 'approved', 'paid', 'cancelled'
    ))
);

CREATE INDEX idx_billing_milestones_job ON billing_milestones(job_id, sort_order);
CREATE INDEX idx_billing_milestones_status ON billing_milestones(tenant_id, status)
    WHERE status IN ('pending', 'invoiced', 'approved');

CREATE TRIGGER billing_milestones_updated_at
    BEFORE UPDATE ON billing_milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Down: `032_billing_milestones.down.sql`
```sql
DROP TRIGGER IF EXISTS billing_milestones_updated_at ON billing_milestones;
DROP TABLE IF EXISTS billing_milestones;
```

---

## Key Rules
- `amount_type = 'percentage'`: `amount_value` is the percentage (e.g., 50.0000 = 50%), `computed_amount` = project_total × (amount_value / 100)
- `amount_type = 'fixed'`: `amount_value` is the dollar amount, `computed_amount` = `amount_value`
- All milestone percentages for a job must sum to 100% (enforced in application layer)
- Milestone flow: `pending` → `invoiced` (draft created) → `approved` (human approved) → `paid` (payment received from Xero)
- Invoice is NOT pushed to Xero until the milestone is manually triggered — human approval required
- `triggered_at` is set when staff clicks "Invoice this milestone"
- Typical hardscape pattern: 50% deposit → 40% on completion → 10% retention

## Testing

```bash
npm run migrate:up -w api
npm run test -w api
```

## Done When
- [ ] Migration 032 created (up + down)
- [ ] Applied to staging
- [ ] All tests pass
- [ ] Committed to branch
