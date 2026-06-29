-- 024_email_logs_legacy_schema_compat.sql
-- Safely aligns legacy email_logs columns with the newer central email service.
-- Non-destructive: no DROP, no DELETE, no data removal.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_type VARCHAR(100) NOT NULL DEFAULT 'general',
  recipient_email VARCHAR(255),
  subject TEXT,
  provider VARCHAR(50) DEFAULT 'resend',
  provider_message_id TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  type VARCHAR(100) NOT NULL DEFAULT 'general',
  recipient TEXT NOT NULL DEFAULT 'unknown',
  related_order_id UUID NULL,
  related_user_id UUID NULL
);

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS email_type VARCHAR(100) NOT NULL DEFAULT 'general';
ALTER TABLE email_logs ALTER COLUMN email_type SET DEFAULT 'general';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS type VARCHAR(100) NOT NULL DEFAULT 'general';
ALTER TABLE email_logs ALTER COLUMN type SET DEFAULT 'general';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE email_logs ALTER COLUMN recipient SET DEFAULT 'unknown';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'resend';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS related_order_id UUID NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS related_user_id UUID NULL;

UPDATE email_logs
SET
  email_type = COALESCE(NULLIF(email_type, ''), NULLIF(type, ''), 'general'),
  recipient_email = COALESCE(NULLIF(recipient_email, ''), NULLIF(recipient, ''), 'unknown@example.com'),
  type = COALESCE(NULLIF(type, ''), NULLIF(email_type, ''), 'general'),
  recipient = COALESCE(NULLIF(recipient, ''), NULLIF(recipient_email, ''), 'unknown')
WHERE email_type IS NULL
   OR recipient_email IS NULL
   OR type IS NULL
   OR recipient IS NULL
   OR email_type = ''
   OR recipient_email = ''
   OR type = ''
   OR recipient = '';

CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(LOWER(recipient_email));
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(LOWER(recipient));
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_related_order_id ON email_logs(related_order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);