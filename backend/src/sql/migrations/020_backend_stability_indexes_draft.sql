-- Backend stability and route-contract support for LUMA Skincare.
-- Safe draft for Neon: creates/extends only, does not drop tables or delete data.
-- Optional indexes are guarded so missing later-phase tables/columns do not abort the migration.

DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_zone_id UUID NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code_id UUID NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code VARCHAR(80) NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12,2) NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS final_amount NUMERIC(12,2) NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_reduced BOOLEAN DEFAULT false;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_reduced_at TIMESTAMP NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS currency_rates (
  code VARCHAR(3) PRIMARY KEY,
  symbol VARCHAR(8) NOT NULL,
  rate_to_ngn NUMERIC(14,4) NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO currency_rates (code, symbol, rate_to_ngn, is_active, is_default)
VALUES
  ('NGN', U&'\20A6', 1, true, true),
  ('USD', '$', 1500, false, false),
  ('GBP', U&'\00A3', 1900, false, false),
  ('EUR', U&'\20AC', 1650, false, false)
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.currency_rates') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_currency_rates_active ON public.currency_rates(is_active);
    CREATE INDEX IF NOT EXISTS idx_currency_rates_default ON public.currency_rates(is_default);
  END IF;

  IF to_regclass('public.orders') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created_at ON public.orders(payment_status, created_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders(status, created_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'paystack_reference') THEN
      CREATE INDEX IF NOT EXISTS idx_orders_paystack_reference ON public.orders(paystack_reference);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_orders_customer_id_created_at ON public.orders(customer_id, created_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount_code') THEN
      CREATE INDEX IF NOT EXISTS idx_orders_discount_code ON public.orders(LOWER(discount_code));
    END IF;
  END IF;

  IF to_regclass('public.order_items') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'order_id') THEN
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_id') THEN
      CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
    END IF;
  END IF;

  IF to_regclass('public.products') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'status') THEN
      CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock_quantity') THEN
      CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON public.products(stock_quantity);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
    END IF;
  END IF;

  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'event_type')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type_created ON public.analytics_events(event_type, created_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'session_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_analytics_events_session_created ON public.analytics_events(session_id, created_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'utm_source')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'utm_medium')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'utm_campaign')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_analytics_events_utm_created ON public.analytics_events(utm_source, utm_medium, utm_campaign, created_at DESC);
    END IF;
  END IF;

  IF to_regclass('public.abandoned_carts') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_carts' AND column_name = 'recovery_status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_carts' AND column_name = 'last_activity_at') THEN
      CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery_lookup ON public.abandoned_carts(recovery_status, last_activity_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_carts' AND column_name = 'session_id') THEN
      CREATE INDEX IF NOT EXISTS idx_abandoned_carts_session ON public.abandoned_carts(session_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_carts' AND column_name = 'customer_email') THEN
      CREATE INDEX IF NOT EXISTS idx_abandoned_carts_customer_email_lower ON public.abandoned_carts(LOWER(customer_email));
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_carts' AND column_name = 'email') THEN
      CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email_lower ON public.abandoned_carts(LOWER(email));
    END IF;
  END IF;

  IF to_regclass('public.abandoned_checkouts') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_checkouts' AND column_name = 'payment_status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_checkouts' AND column_name = 'recovery_status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_checkouts' AND column_name = 'started_at') THEN
      CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_recovery_lookup ON public.abandoned_checkouts(payment_status, recovery_status, started_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_checkouts' AND column_name = 'session_id') THEN
      CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_session ON public.abandoned_checkouts(session_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_checkouts' AND column_name = 'customer_email') THEN
      CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_customer_email_lower ON public.abandoned_checkouts(LOWER(customer_email));
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'abandoned_checkouts' AND column_name = 'email') THEN
      CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_email_lower ON public.abandoned_checkouts(LOWER(email));
    END IF;
  END IF;

  IF to_regclass('public.email_broadcasts') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_broadcasts' AND column_name = 'status')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_broadcasts' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_email_broadcasts_status_created ON public.email_broadcasts(status, created_at DESC);
    END IF;
  END IF;

  IF to_regclass('public.email_broadcast_recipients') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_broadcast_recipients' AND column_name = 'broadcast_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_broadcast_recipients' AND column_name = 'status') THEN
      CREATE INDEX IF NOT EXISTS idx_email_broadcast_recipients_broadcast_status ON public.email_broadcast_recipients(broadcast_id, status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_broadcast_recipients' AND column_name = 'recipient_email') THEN
      CREATE INDEX IF NOT EXISTS idx_email_broadcast_recipients_email_lower ON public.email_broadcast_recipients(LOWER(recipient_email));
    END IF;
  END IF;

  IF to_regclass('public.inventory_movements') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_movements' AND column_name = 'product_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_movements' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_created ON public.inventory_movements(product_id, created_at DESC);
    END IF;
  END IF;

  IF to_regclass('public.discount_codes') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discount_codes' AND column_name = 'code') THEN
      CREATE INDEX IF NOT EXISTS idx_discount_codes_code_lower ON public.discount_codes(LOWER(code));
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discount_codes' AND column_name = 'is_active')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discount_codes' AND column_name = 'expires_at') THEN
      CREATE INDEX IF NOT EXISTS idx_discount_codes_active_expiry ON public.discount_codes(is_active, expires_at);
    END IF;
  END IF;
END $$;