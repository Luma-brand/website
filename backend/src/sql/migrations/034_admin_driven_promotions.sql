-- Adds storefront promotion controls to the existing discount-code system.

ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS first_time_customer_only BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_in_popup BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS popup_headline VARCHAR(140),
  ADD COLUMN IF NOT EXISTS popup_message TEXT,
  ADD COLUMN IF NOT EXISTS popup_cta_label VARCHAR(60),
  ADD COLUMN IF NOT EXISTS popup_cta_path VARCHAR(240) NOT NULL DEFAULT '/products',
  ADD COLUMN IF NOT EXISTS popup_frequency_hours INTEGER NOT NULL DEFAULT 168;

ALTER TABLE discount_codes
  DROP CONSTRAINT IF EXISTS discount_codes_popup_frequency_hours_check;

ALTER TABLE discount_codes
  ADD CONSTRAINT discount_codes_popup_frequency_hours_check
  CHECK (popup_frequency_hours BETWEEN 1 AND 8760);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_single_popup
  ON discount_codes (show_in_popup)
  WHERE show_in_popup = TRUE;

CREATE INDEX IF NOT EXISTS idx_discount_codes_public_promotion
  ON discount_codes (is_active, starts_at, expires_at)
  WHERE show_in_popup = TRUE;
