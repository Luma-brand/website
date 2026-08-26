-- Extends delivery zones without assigning new production shipping prices.

ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS area VARCHAR(160) NOT NULL DEFAULT 'Default',
  ADD COLUMN IF NOT EXISTS remote_surcharge NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eta_min_days INTEGER,
  ADD COLUMN IF NOT EXISTS eta_max_days INTEGER,
  ADD COLUMN IF NOT EXISTS is_pickup BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pickup_label VARCHAR(160),
  ADD COLUMN IF NOT EXISTS international_region VARCHAR(100);

ALTER TABLE delivery_zones
  DROP CONSTRAINT IF EXISTS delivery_zones_remote_surcharge_check,
  DROP CONSTRAINT IF EXISTS delivery_zones_eta_min_days_check,
  DROP CONSTRAINT IF EXISTS delivery_zones_eta_max_days_check,
  DROP CONSTRAINT IF EXISTS delivery_zones_eta_range_check;

ALTER TABLE delivery_zones
  ADD CONSTRAINT delivery_zones_remote_surcharge_check
    CHECK (remote_surcharge >= 0),
  ADD CONSTRAINT delivery_zones_eta_min_days_check
    CHECK (eta_min_days IS NULL OR eta_min_days >= 0),
  ADD CONSTRAINT delivery_zones_eta_max_days_check
    CHECK (eta_max_days IS NULL OR eta_max_days >= 0),
  ADD CONSTRAINT delivery_zones_eta_range_check
    CHECK (
      eta_min_days IS NULL OR
      eta_max_days IS NULL OR
      eta_max_days >= eta_min_days
    );

CREATE INDEX IF NOT EXISTS idx_delivery_zones_hierarchical_lookup
  ON delivery_zones (
    LOWER(country),
    LOWER(state),
    LOWER(region),
    LOWER(area),
    is_active
  );

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_area VARCHAR(160),
  ADD COLUMN IF NOT EXISTS delivery_eta_min_days INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_eta_max_days INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_is_pickup BOOLEAN NOT NULL DEFAULT FALSE;
