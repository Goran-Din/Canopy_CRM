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
