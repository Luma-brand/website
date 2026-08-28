-- LUMA studio pickup, fulfilment overrides, enquiry replies, and editable waitlist support.
-- Additive migration: existing orders, GIG branches, enquiries, and subscribers are preserved.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE logistics_locations
  ADD COLUMN IF NOT EXISTS pickup_fee_override_kobo INTEGER
    CHECK (pickup_fee_override_kobo IS NULL OR pickup_fee_override_kobo >= 0);

INSERT INTO logistics_locations (
  provider,
  state,
  city,
  area,
  branch_name,
  full_address,
  active,
  sort_order,
  last_verified_at,
  pickup_fee_override_kobo
) VALUES (
  'LUMA_STUDIO',
  'Lagos',
  'Lekki',
  'Lekki Phase 1',
  'LUMA Studio — Lekki Phase 1',
  '19A, Babatunde Kubuoye Street, Lekki Phase 1, Lagos',
  TRUE,
  1,
  NOW(),
  0
)
ON CONFLICT (provider, state, branch_name) DO UPDATE SET
  city = EXCLUDED.city,
  area = EXCLUDED.area,
  full_address = EXCLUDED.full_address,
  active = TRUE,
  pickup_fee_override_kobo = 0,
  updated_at = NOW();

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_notification_email_id TEXT,
  ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS contact_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  admin_id UUID,
  message TEXT NOT NULL,
  recipient_email VARCHAR(160) NOT NULL,
  provider_message_id TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_replies_contact_created
  ON contact_replies(contact_id, created_at ASC);

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS interest VARCHAR(160),
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status
  ON newsletter_subscribers(status);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfilment_type VARCHAR(30);

UPDATE orders
SET fulfilment_type = COALESCE(
  fulfilment_type,
  CASE
    WHEN delivery_method = 'PICKUP' THEN 'GIG_PICKUP'
    WHEN delivery_method = 'DELIVERY' THEN 'DOORSTEP'
    ELSE delivery_method
  END
)
WHERE fulfilment_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_fulfilment_type
  ON orders(fulfilment_type);
