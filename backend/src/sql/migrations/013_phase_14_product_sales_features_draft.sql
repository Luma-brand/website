-- Phase 14 product sales features draft for LUMA Skincare.
-- Review before running in production. Non-destructive; no fake seed data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS product_sales_pairings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relationship_type VARCHAR(40) NOT NULL CHECK (
    relationship_type IN (
      'related',
      'cross_sell',
      'frequently_bought',
      'bundle',
      'upsell'
    )
  ),
  label VARCHAR(160),
  priority INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_product_id, target_product_id, relationship_type),
  CHECK (source_product_id <> target_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_sales_pairings_source_type
ON product_sales_pairings(source_product_id, relationship_type, is_active);

CREATE INDEX IF NOT EXISTS idx_product_sales_pairings_target
ON product_sales_pairings(target_product_id);
