-- 028_internal_automation_flows.sql
-- LUMA internal customer journey automation extensions.
-- Safe/idempotent. Review and run manually in Neon.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS automation_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(180) NOT NULL,
  flow_key VARCHAR(120) UNIQUE NOT NULL,
  trigger_type VARCHAR(120) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  max_enrollments_per_customer INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE automation_flows
  ADD COLUMN IF NOT EXISTS type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(120),
  ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS audience_segment_id UUID NULL,
  ADD COLUMN IF NOT EXISTS delay_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_unit VARCHAR(20) DEFAULT 'minutes',
  ADD COLUMN IF NOT EXISTS max_sends INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP;

UPDATE automation_flows
SET trigger_event = COALESCE(trigger_event, trigger_type),
    type = COALESCE(type, flow_key),
    status = CASE WHEN is_active THEN 'active' ELSE COALESCE(status, 'draft') END
WHERE trigger_event IS NULL OR type IS NULL OR status IS NULL;

CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID REFERENCES automation_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  action_type VARCHAR(80) NOT NULL DEFAULT 'send_email',
  delay_minutes INTEGER DEFAULT 0,
  email_template_id UUID NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE automation_steps
  ADD COLUMN IF NOT EXISTS step_type VARCHAR(80) DEFAULT 'send_email',
  ADD COLUMN IF NOT EXISTS delay_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_unit VARCHAR(20) DEFAULT 'minutes',
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS html_body TEXT,
  ADD COLUMN IF NOT EXISTS text_body TEXT,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 1;

UPDATE automation_steps
SET step_type = COALESCE(step_type, action_type),
    delay_amount = COALESCE(delay_amount, delay_minutes, 0),
    order_index = COALESCE(order_index, step_order),
    enabled = COALESCE(enabled, is_active, true)
WHERE step_type IS NULL OR order_index IS NULL;

CREATE TABLE IF NOT EXISTS automation_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID REFERENCES automation_flows(id) ON DELETE CASCADE,
  customer_id UUID NULL,
  customer_email VARCHAR(255),
  session_id VARCHAR(120),
  status VARCHAR(40) DEFAULT 'active',
  trigger_event_id UUID NULL,
  current_step_id UUID NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE automation_enrollments
  ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(120),
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS send_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_enrollments_active_unique
  ON automation_enrollments(flow_id, LOWER(customer_email), status)
  WHERE customer_email IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_automation_enrollments_due
  ON automation_enrollments(status, next_run_at);

CREATE TABLE IF NOT EXISTS automation_email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES automation_enrollments(id) ON DELETE SET NULL,
  flow_id UUID REFERENCES automation_flows(id) ON DELETE SET NULL,
  step_id UUID REFERENCES automation_steps(id) ON DELETE SET NULL,
  customer_email VARCHAR(255),
  subject TEXT,
  status VARCHAR(40) DEFAULT 'pending',
  resend_message_id VARCHAR(180),
  error_message TEXT,
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE automation_email_logs
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_automation_email_logs_created
  ON automation_email_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key VARCHAR(120) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  subject TEXT NOT NULL,
  preheader TEXT,
  html_body TEXT,
  text_body TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS template_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS design_notes TEXT;

CREATE TABLE IF NOT EXISTS email_suppression_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  reason TEXT,
  source VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compatibility columns used by the internal automation runner.
ALTER TABLE automation_enrollments
  ADD COLUMN IF NOT EXISTS related_order_id UUID NULL,
  ADD COLUMN IF NOT EXISTS related_product_id UUID NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE automation_email_logs
  ADD COLUMN IF NOT EXISTS email_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(180);

ALTER TABLE email_suppression_list
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
