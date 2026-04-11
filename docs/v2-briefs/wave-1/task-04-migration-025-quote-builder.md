# Wave 1, Task 4: Migration 025 — Quote Builder Tables

> **Branch:** `feature/wave1-quote-builder-schema`
> **Source docs:** B-8 (Jobs V2 Schema)
> **Dependencies:** Migration 021 (jobs V2 fields), Migration 024 (xero_items)

---

## Migration 025: `025_quote_builder.up.sql`

Creates the full quote system: quotes, sections, line items, and signatures.

```sql
-- ============================================
-- Quote Builder Tables (V2)
-- quotes_v2, quote_sections, quote_line_items, quote_signatures
-- ============================================

-- Main quote record
CREATE TABLE quotes_v2 (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    job_id              UUID        NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    quote_number        VARCHAR(20) NOT NULL,
    version             INTEGER     NOT NULL DEFAULT 1,
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    subtotal            NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_rate            NUMERIC(5,4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
    client_notes        TEXT,
    payment_terms       TEXT,
    internal_notes      TEXT,
    template_id         UUID,
    sent_via            VARCHAR(20),
    sent_to_email       VARCHAR(255),
    sent_to_phone       VARCHAR(30),
    sent_at             TIMESTAMPTZ,
    signing_token       VARCHAR(100),
    valid_until         DATE,
    pdf_file_id         UUID,
    signed_pdf_file_id  UUID,
    created_by          UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_quotes_v2_status CHECK (status IN (
        'draft', 'sent', 'viewed', 'signed', 'expired', 'superseded', 'converted'
    )),
    CONSTRAINT chk_quotes_v2_sent_via CHECK (sent_via IN ('email', 'sms', 'both'))
);

CREATE INDEX idx_quotes_v2_job ON quotes_v2(job_id, version DESC);
CREATE UNIQUE INDEX idx_quotes_v2_signing_token ON quotes_v2(signing_token) WHERE signing_token IS NOT NULL;
CREATE INDEX idx_quotes_v2_status ON quotes_v2(tenant_id, status, valid_until);

CREATE TRIGGER quotes_v2_updated_at
    BEFORE UPDATE ON quotes_v2
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Quote sections (organizational groups within a quote)
CREATE TABLE quote_sections (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    quote_id        UUID        NOT NULL REFERENCES quotes_v2(id) ON DELETE CASCADE,
    section_title   VARCHAR(255) NOT NULL,
    section_body    TEXT,
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_sections_quote ON quote_sections(quote_id, sort_order);

CREATE TRIGGER quote_sections_updated_at
    BEFORE UPDATE ON quote_sections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Quote line items (individual priced items within sections)
CREATE TABLE quote_line_items (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    quote_id        UUID        NOT NULL REFERENCES quotes_v2(id) ON DELETE CASCADE,
    section_id      UUID        NOT NULL REFERENCES quote_sections(id) ON DELETE CASCADE,
    xero_item_id    UUID        REFERENCES xero_items(id) ON DELETE SET NULL,
    xero_item_code  VARCHAR(100),
    item_name       VARCHAR(500) NOT NULL,
    description     TEXT,
    quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit            VARCHAR(50),
    unit_price      NUMERIC(10,2) NOT NULL,
    line_total      NUMERIC(10,2) NOT NULL,
    is_taxable      BOOLEAN     NOT NULL DEFAULT TRUE,
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    is_locked       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_line_items_quote ON quote_line_items(quote_id, section_id, sort_order);

CREATE TRIGGER quote_line_items_updated_at
    BEFORE UPDATE ON quote_line_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Quote signatures (immutable legal evidence — NO UPDATE, NO DELETE)
CREATE TABLE quote_signatures (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    quote_id            UUID        NOT NULL REFERENCES quotes_v2(id) ON DELETE RESTRICT,
    signer_name         VARCHAR(255) NOT NULL,
    signature_file_id   UUID        NOT NULL,  -- FK to client_files added in migration 026
    signed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signer_ip_address   INET        NOT NULL,
    user_agent          TEXT,
    signing_token_used  VARCHAR(100) NOT NULL,
    agreement_checked   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- No updated_at. Immutable.
);

CREATE UNIQUE INDEX idx_quote_signatures_quote ON quote_signatures(quote_id);
CREATE INDEX idx_quote_signatures_token ON quote_signatures(signing_token_used);
```

### Down: `025_quote_builder.down.sql`
```sql
DROP TABLE IF EXISTS quote_signatures;
DROP TRIGGER IF EXISTS quote_line_items_updated_at ON quote_line_items;
DROP TABLE IF EXISTS quote_line_items;
DROP TRIGGER IF EXISTS quote_sections_updated_at ON quote_sections;
DROP TABLE IF EXISTS quote_sections;
DROP TRIGGER IF EXISTS quotes_v2_updated_at ON quotes_v2;
DROP TABLE IF EXISTS quotes_v2;
```

---

## Key Rules
- `unit_price` is ALWAYS entered manually — never auto-populated from Xero
- `quote_signatures` is append-only and immutable — legal evidence of acceptance
- One signature per quote (UNIQUE index on quote_id)
- Signed quotes are permanently locked

## Testing

```bash
npm run migrate:up -w api
npm run test -w api
```

## Done When
- [ ] Migration 025 created (up + down)
- [ ] Applied to staging
- [ ] All tests pass
- [ ] Committed to branch
