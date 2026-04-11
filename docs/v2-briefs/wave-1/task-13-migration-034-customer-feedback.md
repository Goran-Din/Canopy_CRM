# Wave 1, Task 13: Migration 034 — Customer Feedback

> **Branch:** `feature/wave1-customer-feedback`
> **Source docs:** D-32 (Customer Feedback Module)
> **Dependencies:** V1 complete

---

## Migration 034: `034_customer_feedback.up.sql`

Creates the customer feedback table. After service completion, customers receive a link (via SMS/email) to rate their experience 1–5 stars. High ratings prompt a Google Review redirect.

```sql
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
```

### Down: `034_customer_feedback.down.sql`
```sql
DROP TABLE IF EXISTS customer_feedback;
```

---

## Key Rules
- `feedback_token` is a 64-char random string used in the public feedback URL — no auth required
- Token links expire after 14 days (enforced in application layer by checking `sent_at`)
- Rating 4–5 → `google_review_prompted = TRUE`, show Google Review button
- Rating 1–3 → show comment box, no Google Review prompt
- `google_review_clicked` tracks if they actually clicked through to Google
- `staff_note` allows internal team to annotate negative feedback
- One feedback request per job (enforced in application layer — not DB constraint, because re-sends are allowed)
- Expired = sent_at + 14 days with no response (status updated by scheduled job)

## Testing

```bash
npm run migrate:up -w api
npm run test -w api
```

## Done When
- [ ] Migration 034 created (up + down)
- [ ] Applied to staging
- [ ] All tests pass
- [ ] Committed to branch
