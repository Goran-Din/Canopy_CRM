DROP INDEX IF EXISTS idx_invoices_payment_url;
ALTER TABLE invoices DROP COLUMN IF EXISTS xero_payment_url_retrieved_at;
ALTER TABLE invoices DROP COLUMN IF EXISTS xero_payment_url;
