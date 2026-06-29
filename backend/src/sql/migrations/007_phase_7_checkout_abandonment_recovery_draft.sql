-- Phase 7 checkout abandonment recovery draft for LUMA Skincare.
-- Review and run manually after approval. This migration is additive.
-- No Twilio/Meta API is used; WhatsApp follow-up is manual via wa.me links.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  recovery_email_sent_at TIMESTAMP,
  recovery_email_count INTEGER NOT NULL DEFAULT 0,
  whatsapp_contacted_at TIMESTAMP,
  whatsapp_contact_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE abandoned_checkouts
  ADD COLUMN IF NOT EXISTS recovery_email_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS recovery_email_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_contacted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS whatsapp_contact_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_status_started
  ON abandoned_checkouts(payment_status, recovery_status, started_at);

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_session_active
  ON abandoned_checkouts(session_id, payment_status, recovery_status)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_email_status
  ON abandoned_checkouts(LOWER(customer_email), payment_status, recovery_status)
  WHERE customer_email IS NOT NULL;
