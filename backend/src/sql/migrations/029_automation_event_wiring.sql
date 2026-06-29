-- 029_automation_event_wiring.sql
-- Durable trigger history and event-scoped enrollment deduplication.
-- Safe/idempotent. Review and run manually in Neon after migration 028.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS automation_trigger_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_event VARCHAR(120) NOT NULL,
  dedupe_key VARCHAR(255),
  customer_id UUID NULL,
  customer_email VARCHAR(255),
  session_id VARCHAR(160),
  order_id UUID NULL,
  product_id UUID NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'emitted',
  enrollment_count INTEGER NOT NULL DEFAULT 0,
  flow_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE automation_trigger_events
  ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(120),
  ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_id UUID NULL,
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS session_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS order_id UUID NULL,
  ADD COLUMN IF NOT EXISTS product_id UUID NULL,
  ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'emitted',
  ADD COLUMN IF NOT EXISTS enrollment_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flow_ids UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE automation_enrollments
  ADD COLUMN IF NOT EXISTS event_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS session_id VARCHAR(160);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_trigger_events_dedupe
  ON automation_trigger_events(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_trigger_created
  ON automation_trigger_events(trigger_event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_customer
  ON automation_trigger_events(LOWER(customer_email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_order
  ON automation_trigger_events(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_product
  ON automation_trigger_events(product_id, created_at DESC)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_enrollments_flow_event
  ON automation_enrollments(flow_id, event_key)
  WHERE event_key IS NOT NULL;

