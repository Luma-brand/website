-- Phase 6 abandoned cart recovery draft for LUMA Skincare.
-- Review and run manually after approval. This migration is additive.
-- WhatsApp follow-up is manual via wa.me links. No Twilio/Meta API is used.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(120),
  customer_name VARCHAR(180),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(80),
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_value NUMERIC(12, 2) DEFAULT 0,
  recovery_status VARCHAR(40) NOT NULL DEFAULT 'not_contacted',
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recovery_email_sent_at TIMESTAMP,
  recovery_email_count INTEGER NOT NULL DEFAULT 0,
  whatsapp_contacted_at TIMESTAMP,
  whatsapp_contact_count INTEGER NOT NULL DEFAULT 0,
  checkout_started_at TIMESTAMP,
  recovered_at TIMESTAMP,
  recovered_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(180),
  ADD COLUMN IF NOT EXISTS recovery_email_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS recovery_email_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_contacted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS whatsapp_contact_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkout_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status_activity
  ON abandoned_carts(recovery_status, last_activity_at);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_session_active
  ON abandoned_carts(session_id, recovery_status)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email_status
  ON abandoned_carts(LOWER(customer_email), recovery_status)
  WHERE customer_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(120),
  customer_email VARCHAR(255),
  customer_name VARCHAR(180),
  customer_phone VARCHAR(80),
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  payment_status VARCHAR(40) DEFAULT 'started',
  recovery_status VARCHAR(40) NOT NULL DEFAULT 'not_contacted',
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  paystack_reference VARCHAR(180),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_status_started
  ON abandoned_checkouts(payment_status, started_at);
