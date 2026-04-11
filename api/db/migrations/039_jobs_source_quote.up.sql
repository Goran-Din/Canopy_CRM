-- Track which Canopy Quotes quote originated this job
ALTER TABLE jobs ADD COLUMN source_quote_number VARCHAR(50);
ALTER TABLE jobs ADD COLUMN source_system VARCHAR(30) DEFAULT 'crm';

-- Index for webhook lookups
CREATE INDEX idx_jobs_source_quote
  ON jobs (tenant_id, source_quote_number)
  WHERE source_quote_number IS NOT NULL;
