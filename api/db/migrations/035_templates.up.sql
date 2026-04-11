-- 035_templates.up.sql
-- Templates module: unified template library for quotes, contracts, emails, automations

CREATE TABLE templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  template_category VARCHAR(30) NOT NULL CHECK (template_category IN ('quote', 'contract', 'email', 'automation')),
  template_name     VARCHAR(255) NOT NULL,
  description       TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_system         BOOLEAN NOT NULL DEFAULT FALSE,
  content           JSONB NOT NULL,
  channel           VARCHAR(10) CHECK (channel IN ('email', 'sms', 'both')),
  automation_type   VARCHAR(50) CHECK (automation_type IN (
    'booking_confirmation', 'appointment_reminder', 'quote_followup',
    'payment_reminder', 'feedback_request'
  )),
  tags              TEXT[] DEFAULT '{}',
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_templates_tenant_category ON templates (tenant_id, template_category, is_active);

-- Only one active automation template per type per tenant
CREATE UNIQUE INDEX idx_templates_automation_unique
  ON templates (tenant_id, automation_type)
  WHERE is_active = TRUE AND automation_type IS NOT NULL AND deleted_at IS NULL;

-- updated_at trigger (same pattern as all other tables)
CREATE TRIGGER set_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE template_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  content        JSONB NOT NULL,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_versions_template ON template_versions (template_id, version_number DESC);
