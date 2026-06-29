-- Phase 9 draft: discount codes and free shipping threshold.
-- Review before running in production.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'fixed_amount')),
  discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
  minimum_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (minimum_order_amount >= 0),
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_discount_codes_code_lower ON discount_codes (LOWER(code));
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes (is_active);
CREATE INDEX IF NOT EXISTS idx_discount_codes_expires_at ON discount_codes (expires_at);

CREATE TABLE IF NOT EXISTS commerce_settings (
  key VARCHAR(80) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO commerce_settings (key, value)
VALUES ('free_shipping_threshold', '')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(12, 2);
