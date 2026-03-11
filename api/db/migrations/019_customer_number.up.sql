-- ============================================
-- Add customer_number to customers table
-- Format: SS-XXXX (tenant-scoped auto-increment)
-- ============================================

-- Table to track per-tenant customer number sequences
CREATE TABLE customer_number_seq (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
    next_val  INTEGER NOT NULL DEFAULT 1
);

-- Add customer_number column (nullable first for backfill)
ALTER TABLE customers ADD COLUMN customer_number VARCHAR(20);

-- Backfill existing customers with generated numbers
-- Orders by created_at so earlier customers get lower numbers
WITH numbered AS (
    SELECT id, tenant_id,
           ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) AS rn
    FROM customers
    WHERE deleted_at IS NULL
)
UPDATE customers c
SET customer_number = 'SS-' || LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE c.id = n.id;

-- Also backfill soft-deleted customers so the column is fully populated
WITH numbered AS (
    SELECT id, tenant_id,
           ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) AS rn
    FROM customers
    WHERE deleted_at IS NOT NULL
      AND customer_number IS NULL
)
UPDATE customers c
SET customer_number = 'SS-' || LPAD((n.rn + (
    SELECT COUNT(*) FROM customers c2
    WHERE c2.tenant_id = n.tenant_id AND c2.deleted_at IS NULL
))::text, 4, '0')
FROM numbered n
WHERE c.id = n.id;

-- Seed sequence counters from existing data
INSERT INTO customer_number_seq (tenant_id, next_val)
SELECT tenant_id, COUNT(*) + 1
FROM customers
GROUP BY tenant_id
ON CONFLICT (tenant_id) DO UPDATE SET next_val = EXCLUDED.next_val;

-- Now make the column NOT NULL and add unique constraint
ALTER TABLE customers ALTER COLUMN customer_number SET NOT NULL;
CREATE UNIQUE INDEX idx_customers_customer_number
    ON customers(tenant_id, customer_number) WHERE deleted_at IS NULL;
