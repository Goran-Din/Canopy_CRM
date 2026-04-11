# Wave 1, Task 1: Migrations 020-021 — Job Numbers & Job V2 Fields

> **Branch:** `feature/wave1-job-numbers`
> **Source docs:** D-22 (Job Number Sequence), B-8 (Jobs V2 Schema)
> **Dependencies:** V1 complete (migration 019 applied)

---

## Overview

These two migrations establish the job numbering system and add V2 fields to the existing jobs table. Job numbers are the most visible V2 feature — they appear on every screen, invoice, and SMS.

---

## Migration 020: `020_job_number_seq.up.sql`

Create the job number sequence table and the atomic PostgreSQL function.

```sql
-- ============================================
-- Job Number Sequence (V2)
-- Format: NNNN-YY (e.g., 0047-26)
-- One row per tenant per year. Resets Jan 1.
-- ============================================

CREATE TABLE job_number_seq (
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    seq_year    SMALLINT    NOT NULL,
    next_val    INTEGER     NOT NULL DEFAULT 1,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, seq_year)
);

-- Atomic function: returns next job number as text 'NNNN-YY'
-- Uses INSERT ... ON CONFLICT for thread-safe increment
CREATE OR REPLACE FUNCTION next_job_number(p_tenant_id UUID, p_year SMALLINT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_next INTEGER;
BEGIN
    INSERT INTO job_number_seq (tenant_id, seq_year, next_val, updated_at)
    VALUES (p_tenant_id, p_year, 2, NOW())
    ON CONFLICT (tenant_id, seq_year)
    DO UPDATE SET
        next_val = job_number_seq.next_val + 1,
        updated_at = NOW()
    RETURNING next_val - 1 INTO v_next;

    RETURN LPAD(v_next::TEXT, 4, '0') || '-' || RIGHT(p_year::TEXT, 2);
END;
$$;
```

### Down migration: `020_job_number_seq.down.sql`
```sql
DROP FUNCTION IF EXISTS next_job_number(UUID, SMALLINT);
DROP TABLE IF EXISTS job_number_seq;
```

---

## Migration 021: `021_job_v2_fields.up.sql`

Add V2 columns to the existing jobs table and create the job_badges lookup table.

```sql
-- ============================================
-- Jobs V2 Fields + Job Badges
-- Adds job_number, creation_path, badge_ids to jobs
-- Creates job_badges lookup table
-- ============================================

-- V2 columns on existing jobs table
ALTER TABLE jobs ADD COLUMN job_number VARCHAR(10);
ALTER TABLE jobs ADD COLUMN creation_path VARCHAR(20);
ALTER TABLE jobs ADD COLUMN badge_ids UUID[] NOT NULL DEFAULT '{}';

-- Constraints
ALTER TABLE jobs ADD CONSTRAINT chk_jobs_creation_path
    CHECK (creation_path IN ('quote', 'instant_work_order', 'assessment'));

-- Indexes
CREATE UNIQUE INDEX idx_jobs_job_number
    ON jobs(tenant_id, job_number) WHERE job_number IS NOT NULL;
CREATE INDEX idx_jobs_creation_path
    ON jobs(tenant_id, creation_path) WHERE creation_path IS NOT NULL;

-- Job Badges lookup table
CREATE TABLE job_badges (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    badge_name  VARCHAR(100) NOT NULL,
    badge_color VARCHAR(7)  NOT NULL,
    badge_icon  VARCHAR(50),
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_badges_tenant ON job_badges(tenant_id) WHERE is_active = TRUE;

CREATE TRIGGER job_badges_updated_at
    BEFORE UPDATE ON job_badges
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Down migration: `021_job_v2_fields.down.sql`
```sql
DROP TRIGGER IF EXISTS job_badges_updated_at ON job_badges;
DROP TABLE IF EXISTS job_badges;
DROP INDEX IF EXISTS idx_jobs_creation_path;
DROP INDEX IF EXISTS idx_jobs_job_number;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS chk_jobs_creation_path;
ALTER TABLE jobs DROP COLUMN IF EXISTS badge_ids;
ALTER TABLE jobs DROP COLUMN IF EXISTS creation_path;
ALTER TABLE jobs DROP COLUMN IF EXISTS job_number;
```

---

## Testing

After running both migrations:
```bash
npm run migrate:up -w api
npm run test -w api
```

Verify:
- [ ] Both migrations apply without errors
- [ ] All existing V1 tests still pass (legacy jobs have job_number = NULL, which is allowed)
- [ ] `SELECT next_job_number('<tenant-uuid>', 2026)` returns '0001-26'
- [ ] Calling it again returns '0002-26'

## Done When
- [ ] Migrations 020 and 021 created (up + down)
- [ ] Applied to staging database
- [ ] All V1 tests pass
- [ ] Job number function tested manually
- [ ] Committed to branch
