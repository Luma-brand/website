-- 001_inventory_delivery_draft.sql
-- Draft migration for LUMA Phase 1 inventory and delivery preparation.
-- Safe to run after manual review.
-- Product and order references use UUID to match the current backend schema.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS stock_reduced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stock_reduced_at TIMESTAMP;

UPDATE products
SET stock_quantity = 0
WHERE stock_quantity IS NULL;

UPDATE products
SET low_stock_threshold = 20
WHERE low_stock_threshold IS NULL;

UPDATE products
SET is_active = TRUE
WHERE is_active IS NULL;

UPDATE products
SET is_featured = FALSE
WHERE is_featured IS NULL;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  movement_type VARCHAR(50) NOT NULL,
  quantity_changed INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id
ON inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_order_id
ON inventory_movements(order_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at
ON inventory_movements(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_order_product_purchase_once
ON inventory_movements(order_id, product_id, movement_type)
WHERE order_id IS NOT NULL
  AND product_id IS NOT NULL
  AND movement_type = 'order_purchase';

CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country VARCHAR(120) NOT NULL DEFAULT 'Default',
  state VARCHAR(120) NOT NULL DEFAULT 'Default',
  region VARCHAR(120) NOT NULL DEFAULT 'Default',
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 3000,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_location
ON delivery_zones(country, state, region);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_default
ON delivery_zones(is_default);

INSERT INTO delivery_zones (country, state, region, delivery_fee, is_default, is_active)
SELECT 'Default', 'Default', 'Default', 3000, TRUE, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_zones WHERE is_default = TRUE
);
