-- 004_phase_3_stock_safety_draft.sql
-- Draft migration for Phase 3 inventory stock safety.
-- Review before running in production. This is additive and non-destructive.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS stock_reduced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stock_reduced_at TIMESTAMP;

UPDATE orders
SET stock_reduced = FALSE
WHERE stock_reduced IS NULL;

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
