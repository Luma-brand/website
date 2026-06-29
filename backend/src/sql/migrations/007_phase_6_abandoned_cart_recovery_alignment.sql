-- Phase 6 abandoned cart recovery alignment for LUMA Skincare.
-- Safe additive migration draft. Review and run manually in Neon.
-- No Twilio/Meta API is used. WhatsApp follow-up remains manual via wa.me.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NULL,
  customer_name TEXT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  session_id TEXT NULL,
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  cart_total NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  checkout_started_at TIMESTAMP NULL,
  recovery_email_sent BOOLEAN DEFAULT false,
  recovery_email_sent_at TIMESTAMP NULL,
  recovery_email_attempts INTEGER DEFAULT 0,
  last_recovery_error TEXT NULL,
  whatsapp_followup_status TEXT DEFAULT 'not_contacted',
  whatsapp_followup_opened_at TIMESTAMP NULL,
  whatsapp_followup_contacted_at TIMESTAMP NULL,
  recovered_order_id UUID NULL,
  recovered_at TIMESTAMP NULL,
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_id UUID NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_name TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS email TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS phone TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS session_id TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS checkout_started_at TIMESTAMP NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_sent BOOLEAN DEFAULT false;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_sent_at TIMESTAMP NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_attempts INTEGER DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS last_recovery_error TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_followup_status TEXT DEFAULT 'not_contacted';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_followup_opened_at TIMESTAMP NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_followup_contacted_at TIMESTAMP NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovered_order_id UUID NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMP NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Compatibility columns used by the existing growth recovery code.
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(80);
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2) DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_status VARCHAR(40) DEFAULT 'not_contacted';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_count INTEGER DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_contacted_at TIMESTAMP NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_contact_count INTEGER DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS utm_source VARCHAR(120);
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(120);
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(180);
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS utm_content VARCHAR(180);
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS utm_term VARCHAR(180);

UPDATE abandoned_carts
SET
  email = COALESCE(email, customer_email),
  phone = COALESCE(phone, customer_phone),
  cart_total = COALESCE(cart_total, total_value, 0),
  status = COALESCE(status, recovery_status, 'active'),
  recovery_email_sent = COALESCE(recovery_email_sent, recovery_email_sent_at IS NOT NULL, false),
  recovery_email_attempts = COALESCE(recovery_email_attempts, recovery_email_count, 0),
  whatsapp_followup_status = COALESCE(
    whatsapp_followup_status,
    CASE
      WHEN whatsapp_contacted_at IS NOT NULL THEN 'contacted'
      ELSE 'not_contacted'
    END
  ),
  whatsapp_followup_contacted_at = COALESCE(whatsapp_followup_contacted_at, whatsapp_contacted_at),
  updated_at = CURRENT_TIMESTAMP
WHERE
  email IS NULL
  OR phone IS NULL
  OR cart_total IS NULL
  OR status IS NULL
  OR whatsapp_followup_contacted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email ON abandoned_carts(email);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_customer_email ON abandoned_carts(customer_email);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_phone ON abandoned_carts(phone);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_customer_phone ON abandoned_carts(customer_phone);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_session_id ON abandoned_carts(session_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_customer_id ON abandoned_carts(customer_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON abandoned_carts(status);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery_status ON abandoned_carts(recovery_status);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_last_activity_at ON abandoned_carts(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovered_order_id ON abandoned_carts(recovered_order_id);
