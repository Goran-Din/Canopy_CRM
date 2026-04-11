DROP TRIGGER IF EXISTS job_badges_updated_at ON job_badges;
DROP TABLE IF EXISTS job_badges;
DROP INDEX IF EXISTS idx_jobs_creation_path;
DROP INDEX IF EXISTS idx_jobs_job_number;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS chk_jobs_creation_path;
ALTER TABLE jobs DROP COLUMN IF EXISTS badge_ids;
ALTER TABLE jobs DROP COLUMN IF EXISTS creation_path;
ALTER TABLE jobs DROP COLUMN IF EXISTS job_number;
