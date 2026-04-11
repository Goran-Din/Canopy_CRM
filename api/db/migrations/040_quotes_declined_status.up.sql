-- Add 'declined' status to quotes_v2 and decline_reason column
ALTER TABLE quotes_v2 DROP CONSTRAINT IF EXISTS quotes_v2_status_check;
ALTER TABLE quotes_v2 ADD CONSTRAINT quotes_v2_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'expired', 'superseded', 'converted', 'declined'));

ALTER TABLE quotes_v2 ADD COLUMN decline_reason TEXT;
ALTER TABLE quotes_v2 ADD COLUMN declined_at TIMESTAMPTZ;
ALTER TABLE quotes_v2 ADD COLUMN declined_by UUID REFERENCES users(id) ON DELETE SET NULL;
