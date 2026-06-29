-- Phase 9 admin settings, sessions, and security management.
-- Safe to paste into Neon: additive only. No drops, deletes, or destructive rewrites.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device_label TEXT NULL,
  user_agent TEXT NULL,
  browser TEXT NULL,
  os TEXT NULL,
  ip_address TEXT NULL,
  location_hint TEXT NULL,
  is_current BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP NULL,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS admin_password_verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  email VARCHAR(160) NOT NULL,
  code_hash TEXT NOT NULL,
  purpose VARCHAR(80) DEFAULT 'password_change',
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id
  ON admin_sessions (admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash
  ON admin_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_revoked_at
  ON admin_sessions (revoked_at);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_last_active_at
  ON admin_sessions (last_active_at);

CREATE INDEX IF NOT EXISTS idx_admin_password_codes_admin_id
  ON admin_password_verification_codes (admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_password_codes_email
  ON admin_password_verification_codes (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_admin_password_codes_lookup
  ON admin_password_verification_codes (
    admin_id,
    purpose,
    used_at,
    expires_at,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_admin_security_events_admin_id
  ON admin_security_events (admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_security_events_event_type
  ON admin_security_events (event_type);

CREATE INDEX IF NOT EXISTS idx_admin_security_events_created_at
  ON admin_security_events (created_at);
