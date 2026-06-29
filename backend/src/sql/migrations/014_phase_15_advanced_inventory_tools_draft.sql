-- Phase 15 advanced inventory tools draft for LUMA Skincare.
-- Review before running in production. Non-destructive; no fake seed data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name VARCHAR(180) NOT NULL,
  expected_arrival_date DATE,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  unit_cost NUMERIC(12, 2),
  quantity_received INTEGER DEFAULT 0 CHECK (quantity_received >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS expected_arrival_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS quantity_received INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_created
ON purchase_orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order
ON purchase_order_items(purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product
ON purchase_order_items(product_id);
