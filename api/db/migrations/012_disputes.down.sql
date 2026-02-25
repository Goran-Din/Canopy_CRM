-- Reverse 012_disputes.up.sql

DROP TRIGGER IF EXISTS trg_audit_credit_notes ON credit_notes;
DROP TRIGGER IF EXISTS trg_credit_notes_updated_at ON credit_notes;
DROP TABLE IF EXISTS credit_notes;

DROP TRIGGER IF EXISTS trg_audit_disputes ON disputes;
DROP TRIGGER IF EXISTS trg_disputes_updated_at ON disputes;
DROP TABLE IF EXISTS disputes;

DROP TYPE IF EXISTS credit_note_status;
DROP TYPE IF EXISTS dispute_priority;
DROP TYPE IF EXISTS dispute_reason;
DROP TYPE IF EXISTS dispute_status;
