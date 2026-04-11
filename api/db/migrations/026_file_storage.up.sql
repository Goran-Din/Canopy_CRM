-- ============================================
-- File Storage System (V2)
-- file_folders, client_files, file_access_log
-- R2 key format: {tenant_id}/clients/{customer_id}/{folder_type}/{year}/{uuid}_{filename}
-- ============================================

-- Folder structure per customer
CREATE TABLE file_folders (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    customer_id     UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    folder_name     VARCHAR(255) NOT NULL,
    folder_type     VARCHAR(50) NOT NULL,
    description     TEXT,
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    portal_visible  BOOLEAN     NOT NULL DEFAULT FALSE,
    internal_only   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT chk_folder_type CHECK (folder_type IN (
        'agreements', 'quotes', 'invoices', 'photos', 'renders', 'internal', 'custom'
    )),
    CONSTRAINT chk_internal_not_portal CHECK (NOT (internal_only = TRUE AND portal_visible = TRUE))
);

CREATE INDEX idx_file_folders_tenant_customer ON file_folders(tenant_id, customer_id) WHERE deleted_at IS NULL;

CREATE TRIGGER file_folders_updated_at
    BEFORE UPDATE ON file_folders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Client files (all files stored in R2)
CREATE TABLE client_files (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    customer_id         UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    folder_id           UUID        REFERENCES file_folders(id) ON DELETE SET NULL,
    job_id              UUID        REFERENCES jobs(id) ON DELETE SET NULL,
    property_id         UUID        REFERENCES properties(id) ON DELETE SET NULL,
    r2_key              VARCHAR(1000) NOT NULL UNIQUE,
    r2_bucket           VARCHAR(255) NOT NULL DEFAULT 'canopy-crm',
    file_name           VARCHAR(500) NOT NULL,
    file_size_bytes     INTEGER     NOT NULL,
    mime_type           VARCHAR(255) NOT NULL,
    file_category       VARCHAR(50) NOT NULL DEFAULT 'document',
    photo_tag           VARCHAR(50),
    portal_visible      BOOLEAN     NOT NULL DEFAULT FALSE,
    is_signed_document  BOOLEAN     NOT NULL DEFAULT FALSE,
    related_quote_id    UUID,
    version             INTEGER     NOT NULL DEFAULT 1,
    superseded_by       UUID        REFERENCES client_files(id) ON DELETE SET NULL,
    uploaded_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
    uploaded_by_client  BOOLEAN     NOT NULL DEFAULT FALSE,
    upload_source       VARCHAR(50) NOT NULL DEFAULT 'staff_crm',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT chk_file_category CHECK (file_category IN (
        'document', 'photo', 'signature', 'invoice_pdf', 'quote_pdf',
        'render', 'contract_pdf', 'other'
    )),
    CONSTRAINT chk_photo_tag CHECK (photo_tag IN (
        'before_work', 'during_work', 'after_work', 'issue_found',
        'customer_signoff', 'property_overview', 'other'
    )),
    CONSTRAINT chk_upload_source CHECK (upload_source IN (
        'staff_crm', 'client_portal', 'job_card', 'quote_builder',
        'system_generated', 'xero_sync'
    ))
);

CREATE INDEX idx_client_files_tenant_customer ON client_files(tenant_id, customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_client_files_folder ON client_files(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_client_files_job ON client_files(job_id) WHERE deleted_at IS NULL AND job_id IS NOT NULL;
CREATE INDEX idx_client_files_property ON client_files(property_id) WHERE deleted_at IS NULL AND property_id IS NOT NULL;
CREATE INDEX idx_client_files_portal ON client_files(tenant_id, customer_id, portal_visible) WHERE deleted_at IS NULL AND portal_visible = TRUE;

CREATE TRIGGER client_files_updated_at
    BEFORE UPDATE ON client_files
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- File access audit log (append-only — no UPDATE, no DELETE)
CREATE TABLE file_access_log (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    file_id                 UUID        NOT NULL REFERENCES client_files(id) ON DELETE RESTRICT,
    accessed_by_user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    accessed_by_client      BOOLEAN     NOT NULL DEFAULT FALSE,
    client_ip_address       INET,
    access_type             VARCHAR(50) NOT NULL,
    source_context          VARCHAR(100),
    signed_url_expiry       TIMESTAMPTZ,
    accessed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_access_type CHECK (access_type IN (
        'upload', 'download', 'preview', 'delete', 'restore', 'share_link_generated'
    ))
);

CREATE INDEX idx_file_access_log_file ON file_access_log(file_id, accessed_at DESC);
CREATE INDEX idx_file_access_log_tenant ON file_access_log(tenant_id, accessed_at DESC);
CREATE INDEX idx_file_access_log_client ON file_access_log(tenant_id, accessed_by_client, accessed_at DESC) WHERE accessed_by_client = TRUE;

-- Now add deferred FK constraints from earlier migrations
ALTER TABLE job_photos ADD CONSTRAINT fk_job_photos_file FOREIGN KEY (file_id) REFERENCES client_files(id) ON DELETE RESTRICT;
ALTER TABLE quote_signatures ADD CONSTRAINT fk_quote_signatures_file FOREIGN KEY (signature_file_id) REFERENCES client_files(id) ON DELETE RESTRICT;
