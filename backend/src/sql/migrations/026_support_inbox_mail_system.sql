-- 026_support_inbox_mail_system.sql
-- Safe LUMA admin Mail inbox support for Resend Receiving.
-- Paste into Neon after reviewing. This does not drop tables or delete data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  customer_name TEXT NULL,
  subject TEXT NOT NULL DEFAULT 'Customer message',
  status VARCHAR(40) NOT NULL DEFAULT 'open',
  priority VARCHAR(40) DEFAULT 'normal',
  source VARCHAR(60) DEFAULT 'resend_inbound',
  assigned_to UUID NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS customer_name TEXT NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'Customer message';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'open';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(40) DEFAULT 'normal';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source VARCHAR(60) DEFAULT 'resend_inbound';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL DEFAULT 'inbound',
  from_email TEXT NULL,
  to_email TEXT NULL,
  subject TEXT NULL,
  text_body TEXT NULL,
  html_body TEXT NULL,
  body_text TEXT NULL,
  body_html TEXT NULL,
  provider VARCHAR(50) DEFAULT 'resend',
  resend_email_id TEXT NULL,
  provider_message_id TEXT NULL,
  provider_received_email_id TEXT NULL,
  provider_thread_id TEXT NULL,
  message_id_header TEXT NULL,
  in_reply_to_header TEXT NULL,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'inbound';
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS from_email TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS to_email TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS subject TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS text_body TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS html_body TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS body_text TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS body_html TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'resend';
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS resend_email_id TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS provider_message_id TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS provider_received_email_id TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS provider_thread_id TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS message_id_header TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS in_reply_to_header TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE support_messages
SET text_body = COALESCE(text_body, body_text),
    html_body = COALESCE(html_body, body_html),
    raw_payload = COALESCE(raw_payload, payload, '{}'::jsonb)
WHERE text_body IS NULL
   OR html_body IS NULL
   OR raw_payload IS NULL;

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL DEFAULT 'resend',
  provider_event_id TEXT,
  provider_message_id TEXT NULL,
  event_type VARCHAR(120) NOT NULL DEFAULT 'unknown',
  recipient_email TEXT NULL,
  subject TEXT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_events ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'resend';
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS provider_event_id TEXT;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS provider_message_id TEXT NULL;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS event_type VARCHAR(120) NOT NULL DEFAULT 'unknown';
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS recipient_email TEXT NULL;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS subject TEXT NULL;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_last_message
  ON support_tickets(status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_email_lower
  ON support_tickets(LOWER(customer_email));

CREATE INDEX IF NOT EXISTS idx_support_tickets_subject_lower
  ON support_tickets(LOWER(subject));

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created
  ON support_messages(ticket_id, created_at);

CREATE INDEX IF NOT EXISTS idx_support_messages_direction
  ON support_messages(direction);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_messages_received_email_unique
  ON support_messages(provider_received_email_id)
  WHERE provider_received_email_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_messages_message_id_header_unique
  ON support_messages(message_id_header)
  WHERE message_id_header IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_messages_resend_email_unique
  ON support_messages(resend_email_id)
  WHERE resend_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_messages_thread_id
  ON support_messages(provider_thread_id)
  WHERE provider_thread_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_provider_event
  ON email_events(provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_type
  ON email_events(event_type);

CREATE INDEX IF NOT EXISTS idx_email_events_message_id
  ON email_events(provider_message_id);
