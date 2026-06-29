-- 002_phase_8b_growth_marketing_draft.sql
-- Draft migration for LUMA Phase 8B growth, marketing, automation, SEO,
-- analytics, and admin readiness.
-- Safe to run only after manual review. Do not apply automatically.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Product SEO and merchandising readiness.
ALTER TABLE products
ADD COLUMN IF NOT EXISTS slug VARCHAR(180),
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(180),
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS preorder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS preorder_note TEXT,
ADD COLUMN IF NOT EXISTS reorder_interval_days INTEGER,
ADD COLUMN IF NOT EXISTS seo_updated_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique
ON products(slug)
WHERE slug IS NOT NULL;

-- Customer behavior and conversion tracking.
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(80) NOT NULL,
  session_id VARCHAR(120),
  customer_email VARCHAR(255),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  value NUMERIC(12, 2),
  currency VARCHAR(10) DEFAULT 'NGN',
  utm_source VARCHAR(120),
  utm_medium VARCHAR(120),
  utm_campaign VARCHAR(180),
  utm_content VARCHAR(180),
  utm_term VARCHAR(180),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created_at
ON analytics_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_customer_email
ON analytics_events(LOWER(customer_email));

CREATE TABLE IF NOT EXISTS product_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  session_id VARCHAR(120),
  customer_email VARCHAR(255),
  source VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_views_product_created_at
ON product_views(product_id, created_at);

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(120),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(80),
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_value NUMERIC(12, 2) DEFAULT 0,
  recovery_status VARCHAR(40) NOT NULL DEFAULT 'not_contacted',
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recovered_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status_activity
ON abandoned_carts(recovery_status, last_activity_at);

CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(120),
  customer_email VARCHAR(255),
  customer_name VARCHAR(180),
  customer_phone VARCHAR(80),
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  payment_status VARCHAR(40) DEFAULT 'started',
  recovery_status VARCHAR(40) NOT NULL DEFAULT 'not_contacted',
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  paystack_reference VARCHAR(180),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_status_started
ON abandoned_checkouts(payment_status, started_at);

CREATE TABLE IF NOT EXISTS back_in_stock_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(80),
  status VARCHAR(40) NOT NULL DEFAULT 'waiting',
  ready_to_notify_at TIMESTAMP,
  notified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_back_in_stock_product_status
ON back_in_stock_requests(product_id, status);

-- Automation readiness. Sending remains disabled until providers are configured.
CREATE TABLE IF NOT EXISTS automation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  channel VARCHAR(40),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(80),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_events_type_status
ON automation_events(event_type, status);

-- Customer segmentation and manual tags.
CREATE TABLE IF NOT EXISTS customer_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_tag_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email VARCHAR(255) NOT NULL,
  tag_id UUID REFERENCES customer_tags(id) ON DELETE CASCADE,
  source VARCHAR(40) DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (customer_email, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_tag_assignments_email
ON customer_tag_assignments(LOWER(customer_email));

-- Recommendation and bundle readiness. These are structures only; checkout
-- pricing and promo logic should be implemented in a later reviewed phase.
CREATE TABLE IF NOT EXISTS product_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  recommended_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(40) NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_product_id, recommended_product_id, recommendation_type)
);

CREATE TABLE IF NOT EXISTS product_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(180) NOT NULL,
  description TEXT,
  bundle_price NUMERIC(12, 2),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_bundle_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_id UUID REFERENCES product_bundles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1
);

-- Redirect manager and feed support.
CREATE TABLE IF NOT EXISTS site_redirects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_path VARCHAR(255) NOT NULL UNIQUE,
  to_path VARCHAR(255) NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase order readiness for inventory restock workflow.
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
  quantity_ordered INTEGER NOT NULL,
  unit_cost NUMERIC(12, 2),
  quantity_received INTEGER DEFAULT 0
);
