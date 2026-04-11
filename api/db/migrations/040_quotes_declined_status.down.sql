ALTER TABLE quotes_v2 DROP COLUMN IF EXISTS declined_by;
ALTER TABLE quotes_v2 DROP COLUMN IF EXISTS declined_at;
ALTER TABLE quotes_v2 DROP COLUMN IF EXISTS decline_reason;

ALTER TABLE quotes_v2 DROP CONSTRAINT IF EXISTS quotes_v2_status_check;
ALTER TABLE quotes_v2 ADD CONSTRAINT quotes_v2_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'expired', 'superseded', 'converted'));
