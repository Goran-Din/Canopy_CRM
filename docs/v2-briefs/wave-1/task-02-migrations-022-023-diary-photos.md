# Wave 1, Task 2: Migrations 022-023 — Job Diary & Job Photos

> **Branch:** `feature/wave1-diary-photos`
> **Source docs:** B-8 (Jobs V2 Schema)
> **Dependencies:** Migration 021 (job V2 fields)

---

## Migration 022: `022_job_diary.up.sql`

Append-only chronological activity log for every job. No UPDATE or DELETE permitted.

```sql
-- ============================================
-- Job Diary Entries (V2)
-- Append-only. No UPDATE or DELETE.
-- ============================================

CREATE TABLE job_diary_entries (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    job_id              UUID        NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    entry_type          VARCHAR(50) NOT NULL,
    title               VARCHAR(500) NOT NULL,
    body                TEXT,
    metadata            JSONB       NOT NULL DEFAULT '{}',
    created_by_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
    is_system_entry     BOOLEAN     NOT NULL DEFAULT FALSE,
    northchat_thread_id VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_diary_entry_type CHECK (entry_type IN (
        'status_change', 'quote_created', 'quote_sent', 'quote_viewed',
        'quote_signed', 'quote_expired', 'quote_version_created',
        'invoice_created', 'invoice_pushed_xero', 'invoice_paid',
        'email_sent', 'sms_sent', 'northchat_thread_linked',
        'automation_fired', 'photo_uploaded', 'crew_assigned',
        'crew_clocked_in', 'crew_clocked_out', 'note_added',
        'job_created', 'job_converted_to_wo'
    ))
);

-- No updated_at column. No trigger. Append-only.

CREATE INDEX idx_job_diary_job ON job_diary_entries(job_id, created_at DESC);
CREATE INDEX idx_job_diary_tenant_type ON job_diary_entries(tenant_id, entry_type, created_at DESC);
CREATE INDEX idx_job_diary_northchat ON job_diary_entries(northchat_thread_id) WHERE northchat_thread_id IS NOT NULL;
```

### Down: `022_job_diary.down.sql`
```sql
DROP TABLE IF EXISTS job_diary_entries;
```

---

## Migration 023: `023_job_photos.up.sql`

Photo records linked to jobs. Each record points to a client_files entry (created in migration 026).

**IMPORTANT:** This migration references `client_files(id)` which is created in migration 026. To avoid circular dependency, use a deferred FK or create without the FK and add it later. Recommended approach: create without the FK constraint for now — the FK will be validated at the application layer. Add a comment noting the intended FK.

```sql
-- ============================================
-- Job Photos (V2)
-- Links jobs to photos stored in client_files (migration 026)
-- ============================================

CREATE TABLE job_photos (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    job_id          UUID        NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    file_id         UUID        NOT NULL,  -- FK to client_files(id) added in migration 026
    property_id     UUID        REFERENCES properties(id) ON DELETE SET NULL,
    photo_tag       VARCHAR(50) NOT NULL,
    caption         VARCHAR(500),
    uploaded_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
    upload_source   VARCHAR(50) NOT NULL DEFAULT 'job_card',
    portal_visible  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT chk_job_photos_tag CHECK (photo_tag IN (
        'before_work', 'during_work', 'after_work',
        'issue_found', 'customer_signoff', 'property_overview', 'other'
    )),
    CONSTRAINT chk_job_photos_source CHECK (upload_source IN (
        'job_card', 'mobile_pwa', 'quote_builder', 'staff_upload'
    ))
);

CREATE INDEX idx_job_photos_job ON job_photos(job_id, photo_tag) WHERE deleted_at IS NULL;
CREATE INDEX idx_job_photos_property ON job_photos(property_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER job_photos_updated_at
    BEFORE UPDATE ON job_photos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Down: `023_job_photos.down.sql`
```sql
DROP TRIGGER IF EXISTS job_photos_updated_at ON job_photos;
DROP TABLE IF EXISTS job_photos;
```

---

## Testing

```bash
npm run migrate:up -w api
npm run test -w api
```

Verify:
- [ ] Both migrations apply without errors
- [ ] All V1 tests still pass
- [ ] `job_diary_entries` table created with correct constraints
- [ ] `job_photos` table created with correct constraints

## Done When
- [ ] Migrations 022 and 023 created (up + down)
- [ ] Applied to staging
- [ ] All tests pass
- [ ] Committed to branch
