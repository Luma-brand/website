-- 033_flutterwave_payment_gateway.sql
-- Adds provider-neutral payment metadata for new Flutterwave transactions.
-- Historical Paystack columns and values are intentionally preserved.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_transaction_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(10),
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS payment_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference_unique
  ON orders(payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_transaction_id
  ON orders(payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_gateway
  ON orders(payment_gateway);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders(payment_status);
