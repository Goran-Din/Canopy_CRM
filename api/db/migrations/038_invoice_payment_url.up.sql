-- Add Xero OnlineInvoiceUrl storage to invoices table
ALTER TABLE invoices ADD COLUMN xero_payment_url VARCHAR(500);
ALTER TABLE invoices ADD COLUMN xero_payment_url_retrieved_at TIMESTAMPTZ;

-- Index for retry job: find invoices pushed to Xero but missing payment URL
CREATE INDEX idx_invoices_payment_url
  ON invoices (tenant_id)
  WHERE xero_payment_url IS NULL
    AND xero_invoice_id IS NOT NULL
    AND status = 'awaiting_payment';
