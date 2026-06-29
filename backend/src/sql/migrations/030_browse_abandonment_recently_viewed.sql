-- 030_browse_abandonment_recently_viewed.sql
-- Internal browse abandonment records and recently-viewed support foundation.
-- Safe/idempotent. Review and run manually in Neon after migration 029.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS browse_abandonments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(160),
  customer_id UUID NULL,
  customer_email VARCHAR(255),
  product_id UUID,
  product_name TEXT,
  product_image TEXT,
  product_url TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eligible_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
  email_sent_at TIMESTAMPTZ NULL,
  converted_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  email_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE browse_abandonments
  ADD COLUMN IF NOT EXISTS session_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS customer_id UUID NULL,
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS product_image TEXT,
  ADD COLUMN IF NOT EXISTS product_url TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS eligible_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 hours'),
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS email_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE browse_abandonments
  ALTER COLUMN product_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_open_session_product
  ON browse_abandonments(session_id, product_id)
  WHERE session_id IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_open_email_product
  ON browse_abandonments(LOWER(customer_email), product_id)
  WHERE customer_email IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_due
  ON browse_abandonments(status, eligible_at, email_count);

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_status
  ON browse_abandonments(status);

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_customer_email
  ON browse_abandonments(LOWER(customer_email))
  WHERE customer_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_eligible_at
  ON browse_abandonments(eligible_at);

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_created_at
  ON browse_abandonments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_customer
  ON browse_abandonments(LOWER(customer_email), last_activity_at DESC)
  WHERE customer_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_session
  ON browse_abandonments(session_id, last_activity_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_browse_abandonments_product
  ON browse_abandonments(product_id, last_activity_at DESC)
  WHERE product_id IS NOT NULL;
