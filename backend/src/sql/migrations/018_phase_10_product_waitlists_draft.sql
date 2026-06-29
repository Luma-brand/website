-- Phase 10 product waitlists and back-in-stock alerts.
-- Safe additive migration: no drops, deletes, or destructive rewrites.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS product_waitlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL,
  customer_id UUID NULL,
  full_name TEXT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NULL,
  whatsapp_number VARCHAR(40) NULL,
  requested_size TEXT NULL,
  source VARCHAR(80) DEFAULT 'product_page',
  status VARCHAR(40) DEFAULT 'waiting',
  notification_email_sent BOOLEAN DEFAULT false,
  notification_email_sent_at TIMESTAMP NULL,
  notification_attempts INTEGER DEFAULT 0,
  last_notification_error TEXT NULL,
  notified_by_admin_id UUID NULL,
  converted_order_id UUID NULL,
  converted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE product_waitlists
  ADD COLUMN IF NOT EXISTS customer_id UUID NULL,
  ADD COLUMN IF NOT EXISTS full_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS requested_size TEXT NULL,
  ADD COLUMN IF NOT EXISTS source VARCHAR(80) DEFAULT 'product_page',
  ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS notification_email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_email_sent_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS notification_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_notification_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS notified_by_admin_id UUID NULL,
  ADD COLUMN IF NOT EXISTS converted_order_id UUID NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'products'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_product_waitlists_product'
  ) THEN
    ALTER TABLE product_waitlists
      ADD CONSTRAINT fk_product_waitlists_product
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'customer_accounts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_product_waitlists_customer'
  ) THEN
    ALTER TABLE product_waitlists
      ADD CONSTRAINT fk_product_waitlists_customer
      FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'orders'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_product_waitlists_order'
  ) THEN
    ALTER TABLE product_waitlists
      ADD CONSTRAINT fk_product_waitlists_order
      FOREIGN KEY (converted_order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'admins'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_product_waitlists_notified_admin'
  ) THEN
    ALTER TABLE product_waitlists
      ADD CONSTRAINT fk_product_waitlists_notified_admin
      FOREIGN KEY (notified_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_waitlists_product_id
  ON product_waitlists (product_id);

CREATE INDEX IF NOT EXISTS idx_product_waitlists_customer_id
  ON product_waitlists (customer_id);

CREATE INDEX IF NOT EXISTS idx_product_waitlists_email_lower
  ON product_waitlists (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_product_waitlists_status
  ON product_waitlists (status);

CREATE INDEX IF NOT EXISTS idx_product_waitlists_notification_sent
  ON product_waitlists (notification_email_sent);

CREATE INDEX IF NOT EXISTS idx_product_waitlists_created_at
  ON product_waitlists (created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_waitlists_active_unique
  ON product_waitlists (product_id, LOWER(email))
  WHERE status IN ('waiting', 'notified');
