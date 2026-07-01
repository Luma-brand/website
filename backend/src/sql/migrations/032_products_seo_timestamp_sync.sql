-- 032_products_seo_timestamp_sync.sql
-- Production-safe reconciliation for product SEO timestamps.
-- This migration is intentionally idempotent and does not modify product data.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Older draft migrations declared this column as TIMESTAMP (without timezone).
-- Normalize that legacy shape to the timezone-aware type used by production.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'seo_updated_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE products
      ALTER COLUMN seo_updated_at TYPE TIMESTAMPTZ
      USING seo_updated_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

ALTER TABLE products
  ALTER COLUMN seo_updated_at SET DEFAULT NOW();
