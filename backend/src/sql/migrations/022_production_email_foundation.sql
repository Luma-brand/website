-- 022_production_email_foundation.sql
-- Production email, logging, and abandoned cart recovery foundation for LUMA.
-- Safe to run more than once. Does not drop tables or delete data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(100) NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  status VARCHAR(50) NOT NULL,
  provider VARCHAR(50) DEFAULT 'resend',
  provider_message_id TEXT,
  error_message TEXT,
  related_order_id UUID NULL,
  related_user_id UUID NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS type VARCHAR(100) NOT NULL DEFAULT 'general';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'unknown';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'resend';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS related_order_id UUID NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS related_user_id UUID NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(LOWER(recipient));
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_related_order_id ON email_logs(related_order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NULL,
  email TEXT NULL,
  cart_token TEXT UNIQUE,
  status VARCHAR(40) DEFAULT 'active',
  subtotal NUMERIC(12,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'NGN',
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  abandoned_email_sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS user_id UUID NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_id UUID NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_name TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS email TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255) NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS phone TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(80) NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_token TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS session_id TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2) DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NGN';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'active';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_status VARCHAR(40) DEFAULT 'not_contacted';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS abandoned_email_sent_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_sent_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_count INTEGER DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS checkout_started_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovered_order_id UUID NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_followup_opened_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_followup_contacted_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE abandoned_carts
SET
  email = COALESCE(email, customer_email),
  customer_email = COALESCE(customer_email, email),
  cart_token = COALESCE(cart_token, session_id),
  session_id = COALESCE(session_id, cart_token),
  subtotal = COALESCE(subtotal, cart_total, total_value, 0),
  cart_total = COALESCE(cart_total, subtotal, total_value, 0),
  total_value = COALESCE(total_value, subtotal, cart_total, 0),
  status = COALESCE(status, recovery_status, 'active'),
  recovery_status = COALESCE(recovery_status, status, 'not_contacted'),
  abandoned_email_sent_at = COALESCE(abandoned_email_sent_at, recovery_email_sent_at),
  updated_at = COALESCE(updated_at, NOW());

CREATE TABLE IF NOT EXISTS abandoned_cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  abandoned_cart_id UUID REFERENCES abandoned_carts(id) ON DELETE CASCADE,
  product_id UUID NULL,
  product_name TEXT,
  product_image TEXT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abandoned_cart_items ADD COLUMN IF NOT EXISTS abandoned_cart_id UUID REFERENCES abandoned_carts(id) ON DELETE CASCADE;
ALTER TABLE abandoned_cart_items ADD COLUMN IF NOT EXISTS product_id UUID NULL;
ALTER TABLE abandoned_cart_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE abandoned_cart_items ADD COLUMN IF NOT EXISTS product_image TEXT NULL;
ALTER TABLE abandoned_cart_items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE abandoned_cart_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE abandoned_cart_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_abandoned_carts_cart_token_unique
  ON abandoned_carts(cart_token)
  WHERE cart_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status_activity ON abandoned_carts(status, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery_status_activity ON abandoned_carts(recovery_status, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email_lower ON abandoned_carts(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_customer_email_lower ON abandoned_carts(LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_abandoned_cart_items_cart_id ON abandoned_cart_items(abandoned_cart_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_cart_items_product_id ON abandoned_cart_items(product_id);
