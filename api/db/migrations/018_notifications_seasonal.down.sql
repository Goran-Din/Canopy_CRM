-- Reverse 018_notifications_seasonal.up.sql

DROP TRIGGER IF EXISTS trg_audit_seasonal_transitions ON seasonal_transitions;
DROP TRIGGER IF EXISTS trg_seasonal_transitions_updated_at ON seasonal_transitions;
DROP TABLE IF EXISTS seasonal_transitions;

DROP TRIGGER IF EXISTS trg_audit_notification_preferences ON notification_preferences;
DROP TRIGGER IF EXISTS trg_notification_prefs_updated_at ON notification_preferences;
DROP TABLE IF EXISTS notification_preferences;

DROP TABLE IF EXISTS notifications;

DROP TYPE IF EXISTS transition_status;
DROP TYPE IF EXISTS transition_type;
DROP TYPE IF EXISTS notification_delivery;
DROP TYPE IF EXISTS notification_priority;
DROP TYPE IF EXISTS notification_type;
