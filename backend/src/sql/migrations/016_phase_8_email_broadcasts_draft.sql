-- Phase 8 manual email broadcast system for LUMA Skincare.
-- Safe additive migration. Review and run manually in Neon.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS email_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  preheader TEXT NULL,
  image_url TEXT NULL,
  cta_label TEXT NULL,
  cta_url TEXT NULL,
  recipient_group VARCHAR(80) NOT NULL,
  selection_payload JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(40) DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL
);

ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS preheader TEXT NULL;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS image_url TEXT NULL;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS cta_label TEXT NULL;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS cta_url TEXT NULL;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS selection_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS total_recipients INTEGER DEFAULT 0;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS created_by UUID NULL;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS email_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID REFERENCES email_broadcasts(id) ON DELETE CASCADE,
  recipient_email VARCHAR(160) NOT NULL,
  recipient_name TEXT NULL,
  recipient_source VARCHAR(80) NULL,
  customer_id UUID NULL,
  status VARCHAR(40) DEFAULT 'pending',
  provider_message_id TEXT NULL,
  error_message TEXT NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE email_broadcast_recipients ADD COLUMN IF NOT EXISTS recipient_name TEXT NULL;
ALTER TABLE email_broadcast_recipients ADD COLUMN IF NOT EXISTS recipient_source VARCHAR(80) NULL;
ALTER TABLE email_broadcast_recipients ADD COLUMN IF NOT EXISTS customer_id UUID NULL;
ALTER TABLE email_broadcast_recipients ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'pending';
ALTER TABLE email_broadcast_recipients ADD COLUMN IF NOT EXISTS provider_message_id TEXT NULL;
ALTER TABLE email_broadcast_recipients ADD COLUMN IF NOT EXISTS error_message TEXT NULL;
ALTER TABLE email_broadcast_recipients ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_email_broadcasts_status
  ON email_broadcasts(status);

CREATE INDEX IF NOT EXISTS idx_email_broadcasts_created_at
  ON email_broadcasts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_broadcast_recipients_broadcast_id
  ON email_broadcast_recipients(broadcast_id);

CREATE INDEX IF NOT EXISTS idx_email_broadcast_recipients_email
  ON email_broadcast_recipients(LOWER(recipient_email));

CREATE INDEX IF NOT EXISTS idx_email_broadcast_recipients_status
  ON email_broadcast_recipients(status);
