-- 025_email_automation_abandoned_cart_support.sql
-- Safe LUMA email automation, abandoned cart analytics, Resend webhook, and support inbox prep.
-- Safe to paste into Neon. It does not drop tables or delete data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT,
  customer_id UUID NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_value NUMERIC(12,2) DEFAULT 0,
  recovery_status VARCHAR(40) DEFAULT 'not_contacted',
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_token TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_id UUID NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS cart_value NUMERIC(12,2) DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2) DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NGN';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'active';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_status VARCHAR(40) DEFAULT 'not_contacted';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS checkout_started_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_sent BOOLEAN DEFAULT false;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_sent_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_count INTEGER DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_attempts INTEGER DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS abandoned_email_sent_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS last_recovery_error TEXT NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_contacted_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_contact_count INTEGER DEFAULT 0;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_followup_status VARCHAR(40) DEFAULT 'not_contacted';
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_followup_opened_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS whatsapp_followup_contacted_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovered_order_id UUID NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE abandoned_carts
SET
  customer_email = COALESCE(customer_email, email),
  customer_phone = COALESCE(customer_phone, phone),
  email = COALESCE(email, customer_email),
  phone = COALESCE(phone, customer_phone),
  total_value = COALESCE(NULLIF(total_value, 0), NULLIF(cart_value, 0), cart_total, 0),
  cart_value = COALESCE(NULLIF(cart_value, 0), NULLIF(total_value, 0), cart_total, 0),
  cart_total = COALESCE(NULLIF(cart_total, 0), total_value, 0),
  recovery_email_count = COALESCE(recovery_email_count, recovery_email_attempts, 0),
  recovery_email_attempts = COALESCE(recovery_email_attempts, recovery_email_count, 0),
  status = COALESCE(status, recovery_status, 'active'),
  recovery_status = COALESCE(recovery_status, status, 'not_contacted')
WHERE TRUE;

CREATE TABLE IF NOT EXISTS abandoned_cart_email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  abandoned_cart_id UUID NULL REFERENCES abandoned_carts(id) ON DELETE SET NULL,
  email_type VARCHAR(100) NOT NULL DEFAULT 'abandoned_cart_recovery',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  provider VARCHAR(50) DEFAULT 'resend',
  provider_message_id TEXT NULL,
  error_message TEXT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abandoned_cart_email_logs ADD COLUMN IF NOT EXISTS abandoned_cart_id UUID NULL REFERENCES abandoned_carts(id) ON DELETE SET NULL;
ALTER TABLE abandoned_cart_email_logs ADD COLUMN IF NOT EXISTS email_type VARCHAR(100) NOT NULL DEFAULT 'abandoned_cart_recovery';
ALTER TABLE abandoned_cart_email_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE abandoned_cart_email_logs ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'resend';
ALTER TABLE abandoned_cart_email_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT NULL;
ALTER TABLE abandoned_cart_email_logs ADD COLUMN IF NOT EXISTS error_message TEXT NULL;
ALTER TABLE abandoned_cart_email_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE abandoned_cart_email_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ NULL;
ALTER TABLE abandoned_cart_email_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL DEFAULT 'resend',
  provider_event_id TEXT NOT NULL,
  provider_message_id TEXT NULL,
  event_type VARCHAR(120) NOT NULL,
  recipient_email TEXT NULL,
  subject TEXT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
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

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  customer_name TEXT NULL,
  subject TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'open',
  priority VARCHAR(40) NOT NULL DEFAULT 'normal',
  source VARCHAR(60) NOT NULL DEFAULT 'resend_inbound',
  assigned_to UUID NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS customer_name TEXT NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'open';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(40) NOT NULL DEFAULT 'normal';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source VARCHAR(60) NOT NULL DEFAULT 'resend_inbound';
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
  body_text TEXT NULL,
  body_html TEXT NULL,
  provider VARCHAR(50) DEFAULT 'resend',
  provider_message_id TEXT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'inbound';
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS from_email TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS to_email TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS subject TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS body_text TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS body_html TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'resend';
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS provider_message_id TEXT NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_session ON abandoned_carts(session_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery_due ON abandoned_carts(recovery_status, last_activity_at, recovery_email_count);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_customer_email_lower ON abandoned_carts(LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_abandoned_cart_email_logs_cart_id ON abandoned_cart_email_logs(abandoned_cart_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_cart_email_logs_status ON abandoned_cart_email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON email_events(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient_lower ON email_events(LOWER(recipient_email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_open_email_subject ON support_tickets(customer_email, subject) WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_email_lower ON support_tickets(LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);


