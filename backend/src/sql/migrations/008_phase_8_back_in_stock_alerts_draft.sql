-- Phase 8 back-in-stock alerts and product waitlists draft for LUMA Skincare.
-- Review and run manually after approval. This migration is additive.
-- Email notifications use Resend. WhatsApp follow-up is manual via wa.me links.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS back_in_stock_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(80),
  status VARCHAR(40) NOT NULL DEFAULT 'waiting',
  ready_to_notify_at TIMESTAMP,
  notified_at TIMESTAMP,
  notification_channel VARCHAR(40),
  whatsapp_contacted_at TIMESTAMP,
  whatsapp_contact_count INTEGER NOT NULL DEFAULT 0,
  last_notification_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE back_in_stock_requests
  ADD COLUMN IF NOT EXISTS notification_channel VARCHAR(40),
  ADD COLUMN IF NOT EXISTS whatsapp_contacted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS whatsapp_contact_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_notification_error TEXT;

CREATE INDEX IF NOT EXISTS idx_back_in_stock_product_status
  ON back_in_stock_requests(product_id, status);

CREATE INDEX IF NOT EXISTS idx_back_in_stock_created_at
  ON back_in_stock_requests(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_back_in_stock_unique_active_email
  ON back_in_stock_requests(product_id, LOWER(customer_email))
  WHERE customer_email IS NOT NULL
    AND status IN ('waiting', 'ready_to_notify');

CREATE UNIQUE INDEX IF NOT EXISTS idx_back_in_stock_unique_active_phone
  ON back_in_stock_requests(product_id, customer_phone)
  WHERE customer_phone IS NOT NULL
    AND status IN ('waiting', 'ready_to_notify');
