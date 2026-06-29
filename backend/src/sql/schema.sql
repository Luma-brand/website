CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40),
  subject VARCHAR(200),
  message TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40),
  service VARCHAR(120) NOT NULL,
  preferred_date DATE,
  preferred_time VARCHAR(50),
  budget VARCHAR(80),
  message TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(160) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
