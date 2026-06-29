-- 027_shopify_growth_foundation.sql
-- LUMA Shopify-style growth foundation.
-- Safe draft: idempotent only. Review, then run manually in Neon.
-- Does not drop tables, delete data, or seed fake records.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Internal event tracking / pixel-like foundation.
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS customer_id UUID NULL,
  ADD COLUMN IF NOT EXISTS cart_id UUID NULL,
  ADD COLUMN IF NOT EXISTS source VARCHAR(120),
  ADD COLUMN IF NOT EXISTS medium VARCHAR(120),
  ADD COLUMN IF NOT EXISTS campaign VARCHAR(180),
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS page_url TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_desc
  ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created_desc
  ON analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_customer_id
  ON analytics_events(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_product_id_created
  ON analytics_events(product_id, created_at DESC) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_source_created
  ON analytics_events(source, medium, campaign, created_at DESC);

-- Customer data, tags, and segments.
CREATE TABLE IF NOT EXISTS customer_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) UNIQUE NOT NULL,
  color VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_tag_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NULL,
  customer_email VARCHAR(255),
  tag_id UUID REFERENCES customer_tags(id) ON DELETE CASCADE,
  assigned_by UUID NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tag_assignments_unique_email
  ON customer_tag_assignments(LOWER(customer_email), tag_id)
  WHERE customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_tag_assignments_customer_id
  ON customer_tag_assignments(customer_id) WHERE customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(160) UNIQUE NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_segment_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  segment_id UUID REFERENCES customer_segments(id) ON DELETE CASCADE,
  customer_id UUID NULL,
  customer_email VARCHAR(255),
  matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_segment_members_unique_email
  ON customer_segment_members(segment_id, LOWER(customer_email))
  WHERE customer_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_activity_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NULL,
  customer_email VARCHAR(255) UNIQUE,
  first_seen_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  first_utm_source VARCHAR(120),
  first_utm_medium VARCHAR(120),
  first_utm_campaign VARCHAR(180),
  last_utm_source VARCHAR(120),
  last_utm_medium VARCHAR(120),
  last_utm_campaign VARCHAR(180),
  product_view_count INTEGER DEFAULT 0,
  add_to_cart_count INTEGER DEFAULT 0,
  checkout_started_count INTEGER DEFAULT 0,
  abandoned_cart_count INTEGER DEFAULT 0,
  paid_order_count INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  average_order_value NUMERIC(12,2) DEFAULT 0,
  last_order_at TIMESTAMP,
  email_open_count INTEGER DEFAULT 0,
  email_click_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Internal email automation foundation using Resend.
CREATE TABLE IF NOT EXISTS automation_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(180) NOT NULL,
  flow_key VARCHAR(120) UNIQUE NOT NULL,
  trigger_type VARCHAR(120) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  max_enrollments_per_customer INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID REFERENCES automation_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  action_type VARCHAR(80) NOT NULL DEFAULT 'send_email',
  delay_minutes INTEGER DEFAULT 0,
  email_template_id UUID NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automation_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID REFERENCES automation_flows(id) ON DELETE CASCADE,
  customer_id UUID NULL,
  customer_email VARCHAR(255),
  session_id VARCHAR(120),
  status VARCHAR(40) DEFAULT 'active',
  trigger_event_id UUID NULL,
  current_step_id UUID NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_enrollments_active_unique
  ON automation_enrollments(flow_id, LOWER(customer_email), status)
  WHERE customer_email IS NOT NULL AND status = 'active';

CREATE TABLE IF NOT EXISTS automation_email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES automation_enrollments(id) ON DELETE SET NULL,
  flow_id UUID REFERENCES automation_flows(id) ON DELETE SET NULL,
  step_id UUID REFERENCES automation_steps(id) ON DELETE SET NULL,
  customer_email VARCHAR(255),
  subject TEXT,
  status VARCHAR(40) DEFAULT 'pending',
  resend_message_id VARCHAR(180),
  error_message TEXT,
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key VARCHAR(120) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  subject TEXT NOT NULL,
  preheader TEXT,
  html_body TEXT,
  text_body TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_suppression_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  reason TEXT,
  source VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Browse and checkout abandonment.
CREATE TABLE IF NOT EXISTS browse_abandonments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(120),
  customer_id UUID NULL,
  customer_email VARCHAR(255),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  status VARCHAR(40) DEFAULT 'pending',
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  email_sent_at TIMESTAMP,
  converted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_status_viewed
  ON browse_abandonments(status, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_browse_abandonments_session_product
  ON browse_abandonments(session_id, product_id);

ALTER TABLE abandoned_checkouts
  ADD COLUMN IF NOT EXISTS checkout_stage VARCHAR(80),
  ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS status VARCHAR(40),
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS email_count INTEGER DEFAULT 0;

-- Promotions, gift cards, and redemptions.
CREATE TABLE IF NOT EXISTS promotion_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(180) NOT NULL,
  rule_type VARCHAR(80) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discount_code_id UUID NULL REFERENCES discount_codes(id) ON DELETE SET NULL,
  discount_code VARCHAR(80),
  customer_id UUID NULL,
  customer_email VARCHAR(255),
  order_id UUID NULL REFERENCES orders(id) ON DELETE SET NULL,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code_customer
  ON discount_redemptions(LOWER(discount_code), LOWER(customer_email));

CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(120) UNIQUE NOT NULL,
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'NGN',
  customer_email VARCHAR(255),
  issued_by UUID NULL,
  status VARCHAR(40) DEFAULT 'active',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gift_card_id UUID REFERENCES gift_cards(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES orders(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews and review request automation.
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES orders(id) ON DELETE SET NULL,
  customer_id UUID NULL,
  customer_email VARCHAR(255),
  customer_name VARCHAR(180),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(180),
  body TEXT,
  status VARCHAR(40) DEFAULT 'pending',
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status
  ON product_reviews(product_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_email VARCHAR(255),
  status VARCHAR(40) DEFAULT 'pending',
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SEO, page metadata, redirects, and preorders.
CREATE TABLE IF NOT EXISTS page_seo_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_key VARCHAR(120) UNIQUE NOT NULL,
  path VARCHAR(255) UNIQUE NOT NULL,
  meta_title VARCHAR(180),
  meta_description TEXT,
  canonical_url TEXT,
  schema_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_redirects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_path VARCHAR(255) UNIQUE NOT NULL,
  to_path VARCHAR(255) NOT NULL,
  status_code INTEGER DEFAULT 301,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seo_redirects_active_from_path
  ON seo_redirects(is_active, from_path);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS allow_preorder BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preorder_message TEXT,
  ADD COLUMN IF NOT EXISTS preorder_release_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS max_preorder_quantity INTEGER;