-- Phase currency-rate support for LUMA Skincare.
-- Safe to paste into Neon: creates/extends only, does not drop or delete data.

CREATE TABLE IF NOT EXISTS currency_rates (
  code VARCHAR(3) PRIMARY KEY,
  symbol VARCHAR(8) NOT NULL,
  rate_to_ngn NUMERIC(14,4) NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_currency VARCHAR(3) DEFAULT 'NGN';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3) DEFAULT 'NGN';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS base_amount NUMERIC(12,2) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS converted_amount NUMERIC(12,2) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_rate_used NUMERIC(14,4) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(40) DEFAULT 'paystack';

INSERT INTO currency_rates (code, symbol, rate_to_ngn, is_active, is_default)
VALUES
  ('NGN', '?', 1, true, true),
  ('USD', '$', 1500, false, false),
  ('GBP', '£', 1900, false, false),
  ('EUR', '€', 1650, false, false)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_currency_rates_active ON currency_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_order_currency ON orders(order_currency);
