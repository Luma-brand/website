-- 031_multi_inbox_mail_support.sql
-- Safe multi-inbox metadata for the admin Mail inbox.
-- Review and run manually in Neon after migration 026.

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS inbox_email TEXT,
  ADD COLUMN IF NOT EXISTS inbox_name TEXT,
  ADD COLUMN IF NOT EXISTS source_recipient TEXT,
  ADD COLUMN IF NOT EXISTS reply_from_email TEXT,
  ADD COLUMN IF NOT EXISTS reply_from_name TEXT;

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS inbox_email TEXT,
  ADD COLUMN IF NOT EXISTS from_email TEXT,
  ADD COLUMN IF NOT EXISTS to_email TEXT,
  ADD COLUMN IF NOT EXISTS cc TEXT NULL,
  ADD COLUMN IF NOT EXISTS bcc TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_inbox_email
  ON support_tickets(LOWER(inbox_email))
  WHERE inbox_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status);

CREATE INDEX IF NOT EXISTS idx_support_messages_to_email
  ON support_messages(LOWER(to_email))
  WHERE to_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_messages_from_email
  ON support_messages(LOWER(from_email))
  WHERE from_email IS NOT NULL;
