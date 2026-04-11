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
