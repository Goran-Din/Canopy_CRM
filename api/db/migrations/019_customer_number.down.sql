DROP INDEX IF EXISTS idx_customers_customer_number;
ALTER TABLE customers DROP COLUMN IF EXISTS customer_number;
DROP TABLE IF EXISTS customer_number_seq;
