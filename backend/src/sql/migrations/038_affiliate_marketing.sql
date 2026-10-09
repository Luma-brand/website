-- Additive affiliate schema. Applied idempotently by affiliateService at startup.
CREATE TABLE IF NOT EXISTS affiliate_settings (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_rate_bps INTEGER NOT NULL DEFAULT 500 CHECK (default_rate_bps BETWEEN 0 AND 10000),
  minimum_payout_minor BIGINT NOT NULL DEFAULT 500000 CHECK (minimum_payout_minor > 0),
  attribution_days INTEGER NOT NULL DEFAULT 30 CHECK (attribution_days BETWEEN 1 AND 90),
  hold_days INTEGER NOT NULL DEFAULT 7 CHECK (hold_days BETWEEN 0 AND 90),
  updated_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO affiliate_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS affiliate_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES customer_accounts(id) ON DELETE RESTRICT,
  code VARCHAR(24) NOT NULL UNIQUE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  social_url VARCHAR(500) NOT NULL,
  promotion_plan VARCHAR(2000) NOT NULL,
  rate_bps INTEGER CHECK (rate_bps BETWEEN 0 AND 10000),
  bank_name VARCHAR(120),
  account_name VARCHAR(160),
  account_number VARCHAR(10),
  admin_note VARCHAR(1000),
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliate_accounts(id) ON DELETE RESTRICT,
  visitor_hash CHAR(64) NOT NULL,
  landing_path VARCHAR(500) NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(affiliate_id, visitor_hash)
);

CREATE TABLE IF NOT EXISTS affiliate_order_attributions (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
  affiliate_id UUID NOT NULL REFERENCES affiliate_accounts(id) ON DELETE RESTRICT,
  referral_id UUID NOT NULL REFERENCES affiliate_referrals(id) ON DELETE RESTRICT,
  eligible_minor BIGINT NOT NULL CHECK (eligible_minor >= 0),
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  hold_days INTEGER NOT NULL CHECK (hold_days BETWEEN 0 AND 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES affiliate_order_attributions(order_id) ON DELETE RESTRICT,
  affiliate_id UUID NOT NULL REFERENCES affiliate_accounts(id) ON DELETE RESTRICT,
  eligible_minor BIGINT NOT NULL CHECK (eligible_minor >= 0),
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','void')),
  available_at TIMESTAMPTZ NOT NULL,
  void_reason VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliate_accounts(id) ON DELETE RESTRICT,
  request_key UUID NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  bank_name VARCHAR(120) NOT NULL,
  account_name VARCHAR(160) NOT NULL,
  account_number VARCHAR(10) NOT NULL,
  payment_reference VARCHAR(160),
  admin_note VARCHAR(1000),
  reviewed_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(affiliate_id, request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_payout_reference_unique
  ON affiliate_payouts(payment_reference) WHERE payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS affiliate_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS affiliate_commissions_account_status ON affiliate_commissions(affiliate_id,status,available_at);
CREATE INDEX IF NOT EXISTS affiliate_payouts_account_status ON affiliate_payouts(affiliate_id,status);
CREATE INDEX IF NOT EXISTS affiliate_attributions_account ON affiliate_order_attributions(affiliate_id);
CREATE INDEX IF NOT EXISTS affiliate_referrals_account_created ON affiliate_referrals(affiliate_id,created_at);
