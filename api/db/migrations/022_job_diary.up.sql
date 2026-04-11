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
