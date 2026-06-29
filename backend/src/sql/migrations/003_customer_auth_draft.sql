-- Draft migration: Customer account auth for LUMA storefront.
-- Review before applying to production.
-- Non-destructive: no DROP, no DELETE, no data rewrites.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customer_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  phone VARCHAR(40),
  password_hash TEXT,
  auth_provider VARCHAR(30) DEFAULT 'email',
  google_sub VARCHAR(160),
  avatar_url TEXT,
  customer_type VARCHAR(40),
  luma_use_case TEXT,
  referral_source VARCHAR(160),
  profile_completed BOOLEAN DEFAULT FALSE,
  marketing_opt_in BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE customer_accounts
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(30) DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS google_sub VARCHAR(160),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS luma_use_case TEXT,
  ADD COLUMN IF NOT EXISTS referral_source VARCHAR(160),
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS customer_password_reset_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customer_accounts(id) ON DELETE CASCADE,
  email VARCHAR(160) NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_accounts_email_lower
  ON customer_accounts (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_google_sub
  ON customer_accounts (google_sub)
  WHERE google_sub IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_password_reset_codes_email
  ON customer_password_reset_codes (LOWER(email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_password_reset_codes_customer
  ON customer_password_reset_codes (customer_id, used_at, expires_at);
