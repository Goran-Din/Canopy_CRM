DROP INDEX IF EXISTS idx_jobs_source_quote;
ALTER TABLE jobs DROP COLUMN IF EXISTS source_system;
ALTER TABLE jobs DROP COLUMN IF EXISTS source_quote_number;
