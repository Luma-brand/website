-- Phase 5 delivery setup draft for LUMA Skincare.
-- Review and run manually after approval. This migration is additive.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(120) NOT NULL DEFAULT 'Default',
  state VARCHAR(120) NOT NULL DEFAULT 'Default',
  region VARCHAR(120) NOT NULL DEFAULT 'Default',
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 3000,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_lookup
  ON delivery_zones (LOWER(country), LOWER(state), LOWER(region), is_active);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_default
  ON delivery_zones (is_default)
  WHERE is_default = TRUE;

INSERT INTO delivery_zones (
  country,
  state,
  region,
  delivery_fee,
  is_default,
  is_active
)
SELECT
  'Default',
  'Default',
  'Default',
  3000,
  TRUE,
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM delivery_zones
  WHERE is_default = TRUE
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
  ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS state VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_zone_id
  ON orders (delivery_zone_id);
