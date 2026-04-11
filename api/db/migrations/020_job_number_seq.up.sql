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
