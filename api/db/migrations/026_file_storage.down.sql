ALTER TABLE quote_signatures DROP CONSTRAINT IF EXISTS fk_quote_signatures_file;
ALTER TABLE job_photos DROP CONSTRAINT IF EXISTS fk_job_photos_file;
DROP TABLE IF EXISTS file_access_log;
DROP TRIGGER IF EXISTS client_files_updated_at ON client_files;
DROP TABLE IF EXISTS client_files;
DROP TRIGGER IF EXISTS file_folders_updated_at ON file_folders;
DROP TABLE IF EXISTS file_folders;
