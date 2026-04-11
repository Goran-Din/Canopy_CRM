# Wave 1, Task 12: Migration 033 — Automation Engine Tables

> **Branch:** `feature/wave1-automation-engine`
> **Source docs:** D-31 (Automation Engine Module)
> **Dependencies:** V1 complete

---

## Migration 033: `033_automation_engine.up.sql`

Creates two tables: `automation_configs` (settings per automation type per tenant) and `automation_log` (append-only record of every automated message sent).

```sql
-- ============================================
-- Automation Engine (V2)
-- automation_configs: one row per tenant per type
-- automation_log: append-only send history
-- ============================================

-- Automation configuration per tenant
CREATE TABLE automation_configs (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    automation_type         VARCHAR(50) NOT NULL,
    is_enabled              BOOLEAN     NOT NULL DEFAULT FALSE,
    template_id             UUID,
    delay_minutes           INTEGER     NOT NULL DEFAULT 0,
    send_via                VARCHAR(20) NOT NULL DEFAULT 'both',
    max_repeats             SMALLINT    NOT NULL DEFAULT 1,
    repeat_interval_days    SMALLINT    NOT NULL DEFAULT 7,
    conditions              JSONB       NOT NULL DEFAULT '{}',
    updated_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_automation_type CHECK (automation_type IN (
        'booking_confirmation', 'appointment_reminder', 'quote_followup',
        'payment_reminder', 'feedback_request'
    )),
    CONSTRAINT chk_automation_send_via CHECK (send_via IN ('email', 'sms', 'both'))
);

-- One config per automation type per tenant
CREATE UNIQUE INDEX idx_automation_configs_tenant_type ON automation_configs(tenant_id, automation_type);

CREATE TRIGGER automation_configs_updated_at
    BEFORE UPDATE ON automation_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Automation send log (append-only — no UPDATE, no DELETE)
CREATE TABLE automation_log (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    automation_type     VARCHAR(50) NOT NULL,
    job_id              UUID        REFERENCES jobs(id) ON DELETE SET NULL,
    customer_id         UUID        REFERENCES customers(id) ON DELETE SET NULL,
    invoice_id          UUID,
    quote_id            UUID,
    channel             VARCHAR(20) NOT NULL,
    recipient_email     VARCHAR(255),
    recipient_phone     VARCHAR(30),
    message_subject     VARCHAR(500),
    message_preview     TEXT,
    status              VARCHAR(20) NOT NULL,
    failure_reason      TEXT,
    attempt_number      SMALLINT    NOT NULL DEFAULT 1,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_autolog_channel CHECK (channel IN ('email', 'sms')),
    CONSTRAINT chk_autolog_status CHECK (status IN (
        'sent', 'failed', 'skipped', 'cancelled'
    ))
);

-- No updated_at column. No trigger. Append-only.

CREATE INDEX idx_automation_log_tenant_type ON automation_log(tenant_id, automation_type, sent_at DESC);
CREATE INDEX idx_automation_log_customer ON automation_log(customer_id, sent_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_automation_log_job ON automation_log(job_id, sent_at DESC) WHERE job_id IS NOT NULL;
CREATE INDEX idx_automation_log_status ON automation_log(tenant_id, status, sent_at DESC) WHERE status = 'failed';
```

### Down: `033_automation_engine.down.sql`
```sql
DROP TABLE IF EXISTS automation_log;
DROP TRIGGER IF EXISTS automation_configs_updated_at ON automation_configs;
DROP TABLE IF EXISTS automation_configs;
```

---

## Key Rules
- `automation_configs` has exactly one row per automation_type per tenant (UNIQUE index)
- All automations are **disabled by default** (`is_enabled = FALSE`) — tenant owner must enable each one
- `template_id` references the templates table (created in Wave 3) — for now, can be NULL
- `delay_minutes` = how long to wait after trigger event before sending (e.g., 30 min after booking)
- `automation_log` is append-only — no UPDATE, no DELETE, no updated_at
- Failed sends are logged with `failure_reason` and can be retried up to `max_repeats`
- `conditions` JSONB stores type-specific logic (e.g., "only send feedback if rating not received within 48h")

## Testing

```bash
npm run migrate:up -w api
npm run test -w api
```

## Done When
- [ ] Migration 033 created (up + down)
- [ ] Applied to staging
- [ ] All tests pass
- [ ] Committed to branch
