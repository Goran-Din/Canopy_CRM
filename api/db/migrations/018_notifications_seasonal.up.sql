-- ============================================
-- Phase 7: Notifications & Seasonal Transitions
-- ============================================

-- ============================================
-- Enum types
-- ============================================

CREATE TYPE notification_type AS ENUM (
    'job_assigned', 'job_completed', 'invoice_overdue', 'payment_received',
    'dispute_opened', 'contract_expiring', 'snow_run_started',
    'equipment_maintenance_due', 'low_stock_alert', 'prospect_follow_up',
    'schedule_change', 'system_alert'
);

CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TYPE notification_delivery AS ENUM ('in_app', 'email', 'sms', 'push');

CREATE TYPE transition_type AS ENUM (
    'spring_startup', 'fall_cleanup', 'winter_prep', 'spring_to_summer', 'summer_to_fall'
);

CREATE TYPE transition_status AS ENUM ('planned', 'in_progress', 'completed');

-- ============================================
-- Notifications
-- ============================================

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID NOT NULL REFERENCES users(id),

    type                notification_type NOT NULL,
    title               VARCHAR(255) NOT NULL,
    message             TEXT NOT NULL,
    entity_type         VARCHAR(50),
    entity_id           UUID,

    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    read_at             TIMESTAMPTZ,
    priority            notification_priority NOT NULL DEFAULT 'normal',
    delivery_method     notification_delivery NOT NULL DEFAULT 'in_app',
    delivered_at        TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_user ON notifications(tenant_id, user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(tenant_id, user_id) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(tenant_id, type);
CREATE INDEX idx_notifications_entity ON notifications(tenant_id, entity_type, entity_id);
CREATE INDEX idx_notifications_created ON notifications(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_notifications_priority ON notifications(tenant_id, user_id, priority);

-- ============================================
-- Notification Preferences
-- ============================================

CREATE TABLE notification_preferences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID NOT NULL REFERENCES users(id),

    notification_type   VARCHAR(50) NOT NULL,
    in_app              BOOLEAN NOT NULL DEFAULT TRUE,
    email               BOOLEAN NOT NULL DEFAULT FALSE,
    sms                 BOOLEAN NOT NULL DEFAULT FALSE,
    push                BOOLEAN NOT NULL DEFAULT FALSE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_notification_prefs_unique ON notification_preferences(user_id, notification_type);
CREATE INDEX idx_notification_prefs_tenant ON notification_preferences(tenant_id);
CREATE INDEX idx_notification_prefs_user ON notification_preferences(tenant_id, user_id);

CREATE TRIGGER trg_notification_prefs_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_notification_preferences
    AFTER INSERT OR UPDATE OR DELETE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================
-- Seasonal Transitions
-- ============================================

CREATE TABLE seasonal_transitions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),

    transition_type     transition_type NOT NULL,
    season_year         INTEGER NOT NULL,
    status              transition_status NOT NULL DEFAULT 'planned',
    scheduled_date      DATE NOT NULL,
    completed_date      DATE,
    checklist           JSONB NOT NULL DEFAULT '[]',
    notes               TEXT,

    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_seasonal_tenant ON seasonal_transitions(tenant_id);
CREATE INDEX idx_seasonal_type ON seasonal_transitions(tenant_id, transition_type);
CREATE INDEX idx_seasonal_year ON seasonal_transitions(tenant_id, season_year);
CREATE INDEX idx_seasonal_status ON seasonal_transitions(tenant_id, status);
CREATE INDEX idx_seasonal_scheduled ON seasonal_transitions(tenant_id, scheduled_date);

CREATE TRIGGER trg_seasonal_transitions_updated_at
    BEFORE UPDATE ON seasonal_transitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_seasonal_transitions
    AFTER INSERT OR UPDATE OR DELETE ON seasonal_transitions
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
