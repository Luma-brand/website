-- Phase 13 email automation draft for LUMA Skincare.
-- Review before running in production. Non-destructive; no fake seed data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS automation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  channel VARCHAR(40) DEFAULT 'email',
  customer_email VARCHAR(255),
  customer_phone VARCHAR(80),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE automation_events
  ADD COLUMN IF NOT EXISTS channel VARCHAR(40) DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(80),
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_automation_events_type_status
ON automation_events(event_type, status);

CREATE INDEX IF NOT EXISTS idx_automation_events_order_type_sent
ON automation_events(order_id, event_type, status)
WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_events_customer_type_sent
ON automation_events(LOWER(customer_email), event_type, status)
WHERE customer_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_events_scheduled_pending
ON automation_events(scheduled_for, status)
WHERE status = 'pending';
