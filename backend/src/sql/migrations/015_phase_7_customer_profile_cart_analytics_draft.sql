-- Phase 7 customer profile, cart sync, and analytics draft for LUMA Skincare.
-- Safe additive migration. Review and run manually in Neon.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS phone_country_name TEXT;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS phone_country_iso2 VARCHAR(5);
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(10);
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS phone_e164 VARCHAR(40);
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(40);
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS whatsapp_e164 VARCHAR(40);
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS whatsapp_country_name TEXT;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS whatsapp_country_iso2 VARCHAR(5);
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS whatsapp_country_code VARCHAR(10);
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS whatsapp_is_account_phone BOOLEAN DEFAULT false;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS why_luma TEXT;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS first_time_luma VARCHAR(40);
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS brow_goal TEXT;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS referral_source_other TEXT;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS customer_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customer_accounts(id) ON DELETE CASCADE,
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  cart_total NUMERIC(12,2) DEFAULT 0,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id)
);

CREATE TABLE IF NOT EXISTS customer_activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NULL,
  session_id TEXT NULL,
  event_type VARCHAR(80) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_accounts_phone_country_iso2
  ON customer_accounts(phone_country_iso2);

CREATE INDEX IF NOT EXISTS idx_customer_accounts_referral_source
  ON customer_accounts(referral_source);

CREATE INDEX IF NOT EXISTS idx_customer_accounts_why_luma
  ON customer_accounts(why_luma);

CREATE INDEX IF NOT EXISTS idx_customer_accounts_brow_goal
  ON customer_accounts(brow_goal);

CREATE INDEX IF NOT EXISTS idx_customer_carts_customer_id
  ON customer_carts(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_activity_events_type_date
  ON customer_activity_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_activity_events_customer_date
  ON customer_activity_events(customer_id, created_at DESC);
