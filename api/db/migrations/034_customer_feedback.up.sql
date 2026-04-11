-- ============================================
-- Customer Feedback (V2)
-- Post-service ratings collected via unique token links
-- 4-5 stars → prompt Google Review
-- ============================================

CREATE TABLE customer_feedback (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    customer_id             UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    invoice_id              UUID        REFERENCES invoices(id) ON DELETE SET NULL,
    job_id                  UUID        REFERENCES jobs(id) ON DELETE SET NULL,
    feedback_token          VARCHAR(64) NOT NULL UNIQUE,
    sent_via                VARCHAR(20) NOT NULL,
    sent_at                 TIMESTAMPTZ NOT NULL,
    rating                  SMALLINT,
    comment                 TEXT,
    responded_at            TIMESTAMPTZ,
    respondent_ip           INET,
    google_review_prompted  BOOLEAN     NOT NULL DEFAULT FALSE,
    google_review_clicked   BOOLEAN     NOT NULL DEFAULT FALSE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'sent',
    staff_note              TEXT,
    staff_note_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
    staff_noted_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_feedback_sent_via CHECK (sent_via IN ('sms', 'email', 'both')),
    CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_feedback_status CHECK (status IN ('sent', 'responded', 'expired'))
);

-- No updated_at — feedback responses are a one-time write (staff_note is the only edit)

CREATE INDEX idx_feedback_tenant_status ON customer_feedback(tenant_id, status, responded_at DESC) WHERE status = 'responded';
CREATE INDEX idx_feedback_customer ON customer_feedback(customer_id, responded_at DESC);
CREATE INDEX idx_feedback_token ON customer_feedback(feedback_token);
CREATE INDEX idx_feedback_job ON customer_feedback(job_id) WHERE job_id IS NOT NULL;
