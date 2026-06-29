-- Phase 12 draft: SEO system safety.
-- Review before running in production. No destructive changes.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slug VARCHAR(180),
  ADD COLUMN IF NOT EXISTS meta_title VARCHAR(180),
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_updated_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique
ON products(slug)
WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS seo_redirects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_path VARCHAR(300) NOT NULL UNIQUE,
  to_path VARCHAR(300) NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seo_redirects_active_from_path
ON seo_redirects(is_active, from_path);
