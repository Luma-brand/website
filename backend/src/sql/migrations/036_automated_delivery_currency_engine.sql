-- LUMA automated delivery, pickup-location, and FX foundation.
-- Additive and idempotent: existing zones, orders, payments, and currency rows are preserved.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shipping_weight_grams INTEGER NOT NULL DEFAULT 500;

CREATE TABLE IF NOT EXISTS shipping_areas (
  code VARCHAR(8) PRIMARY KEY,
  state_name VARCHAR(80) UNIQUE NOT NULL,
  region VARCHAR(40) NOT NULL,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shipping_areas (code, state_name, region, latitude, longitude) VALUES
  ('AB', 'Abia', 'South East', 5.5320, 7.4860),
  ('AD', 'Adamawa', 'North East', 9.3265, 12.3984),
  ('AK', 'Akwa Ibom', 'South South', 5.0377, 7.9128),
  ('AN', 'Anambra', 'South East', 6.2100, 7.0700),
  ('BA', 'Bauchi', 'North East', 10.3158, 9.8442),
  ('BY', 'Bayelsa', 'South South', 4.9267, 6.2676),
  ('BE', 'Benue', 'North Central', 7.7322, 8.5391),
  ('BO', 'Borno', 'North East', 11.8333, 13.1500),
  ('CR', 'Cross River', 'South South', 4.9757, 8.3417),
  ('DE', 'Delta', 'South South', 6.2059, 6.6959),
  ('EB', 'Ebonyi', 'South East', 6.3249, 8.1137),
  ('ED', 'Edo', 'South South', 6.3350, 5.6037),
  ('EK', 'Ekiti', 'South West', 7.6233, 5.2209),
  ('EN', 'Enugu', 'South East', 6.4584, 7.5464),
  ('FC', 'FCT', 'North Central', 9.0765, 7.3986),
  ('GO', 'Gombe', 'North East', 10.2897, 11.1673),
  ('IM', 'Imo', 'South East', 5.4840, 7.0351),
  ('JI', 'Jigawa', 'North West', 11.7594, 9.3392),
  ('KD', 'Kaduna', 'North West', 10.5105, 7.4165),
  ('KN', 'Kano', 'North West', 12.0022, 8.5920),
  ('KT', 'Katsina', 'North West', 12.9889, 7.6006),
  ('KE', 'Kebbi', 'North West', 12.4539, 4.1975),
  ('KO', 'Kogi', 'North Central', 7.8023, 6.7333),
  ('KW', 'Kwara', 'North Central', 8.4966, 4.5421),
  ('LA', 'Lagos', 'South West', 6.5244, 3.3792),
  ('NA', 'Nasarawa', 'North Central', 8.4966, 8.5153),
  ('NI', 'Niger', 'North Central', 9.6139, 6.5569),
  ('OG', 'Ogun', 'South West', 7.1475, 3.3619),
  ('ON', 'Ondo', 'South West', 7.2571, 5.2058),
  ('OS', 'Osun', 'South West', 7.7827, 4.5418),
  ('OY', 'Oyo', 'South West', 7.3775, 3.9470),
  ('PL', 'Plateau', 'North Central', 9.8965, 8.8583),
  ('RI', 'Rivers', 'South South', 4.8156, 7.0498),
  ('SO', 'Sokoto', 'North West', 13.0059, 5.2476),
  ('TA', 'Taraba', 'North East', 8.8937, 11.3590),
  ('YO', 'Yobe', 'North East', 11.7460, 11.9660),
  ('ZA', 'Zamfara', 'North West', 12.1700, 6.6600)
ON CONFLICT (code) DO UPDATE SET
  state_name = EXCLUDED.state_name,
  region = EXCLUDED.region,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS shipping_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  origin_state VARCHAR(80) NOT NULL DEFAULT 'Lagos',
  base_fee_kobo INTEGER NOT NULL DEFAULT 150000 CHECK (base_fee_kobo >= 0),
  default_weight_grams INTEGER NOT NULL DEFAULT 500 CHECK (default_weight_grams > 0),
  pickup_multiplier_bps INTEGER NOT NULL DEFAULT 10000 CHECK (pickup_multiplier_bps > 0),
  home_multiplier_bps INTEGER NOT NULL DEFAULT 11000 CHECK (home_multiplier_bps > 0),
  home_last_mile_kobo INTEGER NOT NULL DEFAULT 80000 CHECK (home_last_mile_kobo >= 0),
  global_pickup_adjustment_bps INTEGER NOT NULL DEFAULT 0,
  global_home_adjustment_bps INTEGER NOT NULL DEFAULT 0,
  round_to_kobo INTEGER NOT NULL DEFAULT 10000 CHECK (round_to_kobo > 0),
  formula_version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shipping_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS shipping_distance_bands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label VARCHAR(80) NOT NULL UNIQUE,
  min_km INTEGER NOT NULL CHECK (min_km >= 0),
  max_km INTEGER CHECK (max_km IS NULL OR max_km >= min_km),
  price_component_kobo INTEGER NOT NULL CHECK (price_component_kobo >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (min_km, max_km)
);

INSERT INTO shipping_distance_bands (label, min_km, max_km, price_component_kobo, sort_order) VALUES
  ('0-100 km', 0, 100, 50000, 1),
  ('101-250 km', 101, 250, 120000, 2),
  ('251-400 km', 251, 400, 200000, 3),
  ('401-600 km', 401, 600, 280000, 4),
  ('601-800 km', 601, 800, 360000, 5),
  ('801-1000 km', 801, 1000, 450000, 6),
  ('1001+ km', 1001, NULL, 550000, 7)
ON CONFLICT (label) DO NOTHING;

CREATE TABLE IF NOT EXISTS shipping_weight_bands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label VARCHAR(80) NOT NULL UNIQUE,
  min_grams INTEGER NOT NULL CHECK (min_grams >= 0),
  max_grams INTEGER CHECK (max_grams IS NULL OR max_grams >= min_grams),
  surcharge_kobo INTEGER NOT NULL CHECK (surcharge_kobo >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (min_grams, max_grams)
);

INSERT INTO shipping_weight_bands (label, min_grams, max_grams, surcharge_kobo, sort_order) VALUES
  ('0-2 kg', 0, 2000, 0, 1),
  ('2-5 kg', 2001, 5000, 150000, 2),
  ('5 kg+', 5001, NULL, 350000, 3)
ON CONFLICT (label) DO NOTHING;

CREATE TABLE IF NOT EXISTS shipping_region_rules (
  region VARCHAR(40) PRIMARY KEY,
  adjustment_bps INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shipping_region_rules (region) VALUES
  ('South West'), ('South South'), ('South East'),
  ('North Central'), ('North West'), ('North East')
ON CONFLICT (region) DO NOTHING;

CREATE TABLE IF NOT EXISTS shipping_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origin_state VARCHAR(80) NOT NULL REFERENCES shipping_areas(state_name),
  destination_state VARCHAR(80) NOT NULL REFERENCES shipping_areas(state_name),
  approximate_road_distance_km INTEGER NOT NULL CHECK (approximate_road_distance_km >= 0),
  origin_region VARCHAR(40) NOT NULL,
  destination_region VARCHAR(40) NOT NULL,
  delivery_zone VARCHAR(80) NOT NULL,
  formula_version INTEGER NOT NULL DEFAULT 1,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (origin_state, destination_state)
);

INSERT INTO shipping_routes (
  origin_state, destination_state, approximate_road_distance_km,
  origin_region, destination_region, delivery_zone
)
SELECT
  origin.state_name,
  destination.state_name,
  CASE
    WHEN origin.code = destination.code THEN 25
    ELSE GREATEST(50, ROUND(
      6371 * ACOS(LEAST(1, GREATEST(-1,
        COS(RADIANS(origin.latitude)) * COS(RADIANS(destination.latitude)) *
        COS(RADIANS(destination.longitude) - RADIANS(origin.longitude)) +
        SIN(RADIANS(origin.latitude)) * SIN(RADIANS(destination.latitude))
      ))) * 1.28
    ))::INTEGER
  END,
  origin.region,
  destination.region,
  CASE
    WHEN origin.code = destination.code THEN 'Same state'
    WHEN origin.region = destination.region THEN 'Same region'
    ELSE 'Inter-region'
  END
FROM shipping_areas origin
CROSS JOIN shipping_areas destination
WHERE origin.active = TRUE AND destination.active = TRUE
ON CONFLICT (origin_state, destination_state) DO UPDATE SET
  origin_region = EXCLUDED.origin_region,
  destination_region = EXCLUDED.destination_region,
  delivery_zone = EXCLUDED.delivery_zone,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS shipping_route_overrides (
  route_id UUID PRIMARY KEY REFERENCES shipping_routes(id) ON DELETE CASCADE,
  pickup_price_kobo INTEGER CHECK (pickup_price_kobo IS NULL OR pickup_price_kobo >= 0),
  home_price_kobo INTEGER CHECK (home_price_kobo IS NULL OR home_price_kobo >= 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_route_rates (
  route_id UUID NOT NULL REFERENCES shipping_routes(id) ON DELETE CASCADE,
  weight_band_id UUID NOT NULL REFERENCES shipping_weight_bands(id) ON DELETE CASCADE,
  calculated_pickup_kobo INTEGER NOT NULL CHECK (calculated_pickup_kobo >= 0),
  calculated_home_kobo INTEGER NOT NULL CHECK (calculated_home_kobo >= 0),
  effective_pickup_kobo INTEGER NOT NULL CHECK (effective_pickup_kobo >= 0),
  effective_home_kobo INTEGER NOT NULL CHECK (effective_home_kobo >= 0),
  pricing_mode VARCHAR(20) NOT NULL DEFAULT 'AUTO',
  calculation_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  formula_version INTEGER NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (route_id, weight_band_id)
);

INSERT INTO shipping_route_rates (
    route_id, weight_band_id, calculated_pickup_kobo, calculated_home_kobo,
    effective_pickup_kobo, effective_home_kobo, pricing_mode,
    calculation_breakdown, formula_version, calculated_at
  )
  SELECT
    route.id,
    weight.id,
    calculated.pickup_kobo,
    calculated.home_kobo,
    COALESCE(CASE WHEN override.enabled THEN override.pickup_price_kobo END, calculated.pickup_kobo),
    COALESCE(CASE WHEN override.enabled THEN override.home_price_kobo END, calculated.home_kobo),
    CASE WHEN override.enabled AND (override.pickup_price_kobo IS NOT NULL OR override.home_price_kobo IS NOT NULL)
      THEN 'MANUAL' ELSE 'AUTO' END,
    jsonb_build_object(
      'baseFeeKobo', settings.base_fee_kobo,
      'distanceBand', distance.label,
      'distanceComponentKobo', distance.price_component_kobo,
      'weightBand', weight.label,
      'weightSurchargeKobo', weight.surcharge_kobo,
      'destinationRegion', route.destination_region,
      'regionalAdjustmentBps', COALESCE(region.adjustment_bps, 0),
      'pickupMultiplierBps', settings.pickup_multiplier_bps,
      'homeMultiplierBps', settings.home_multiplier_bps,
      'homeLastMileKobo', settings.home_last_mile_kobo,
      'globalPickupAdjustmentBps', settings.global_pickup_adjustment_bps,
      'globalHomeAdjustmentBps', settings.global_home_adjustment_bps
    ),
    settings.formula_version,
    NOW()
  FROM shipping_routes route
  CROSS JOIN shipping_settings settings
  CROSS JOIN shipping_weight_bands weight
  JOIN shipping_distance_bands distance
    ON route.approximate_road_distance_km >= distance.min_km
   AND (distance.max_km IS NULL OR route.approximate_road_distance_km <= distance.max_km)
   AND distance.active = TRUE
  LEFT JOIN shipping_region_rules region
    ON region.region = route.destination_region AND region.active = TRUE
  LEFT JOIN shipping_route_overrides override ON override.route_id = route.id
  CROSS JOIN LATERAL (
    SELECT
      CEIL((
        (settings.base_fee_kobo + distance.price_component_kobo + weight.surcharge_kobo)::NUMERIC
        * settings.pickup_multiplier_bps / 10000
        * (10000 + COALESCE(region.adjustment_bps, 0)) / 10000
        * (10000 + settings.global_pickup_adjustment_bps) / 10000
      ) / settings.round_to_kobo) * settings.round_to_kobo AS pickup_kobo,
      CEIL((
        ((settings.base_fee_kobo + distance.price_component_kobo + weight.surcharge_kobo)::NUMERIC
        * settings.home_multiplier_bps / 10000 + settings.home_last_mile_kobo)
        * (10000 + COALESCE(region.adjustment_bps, 0)) / 10000
        * (10000 + settings.global_home_adjustment_bps) / 10000
      ) / settings.round_to_kobo) * settings.round_to_kobo AS home_kobo
  ) calculated
  WHERE weight.active = TRUE
ON CONFLICT (route_id, weight_band_id) DO UPDATE SET
  calculated_pickup_kobo = EXCLUDED.calculated_pickup_kobo,
  calculated_home_kobo = EXCLUDED.calculated_home_kobo,
  effective_pickup_kobo = EXCLUDED.effective_pickup_kobo,
  effective_home_kobo = EXCLUDED.effective_home_kobo,
  pricing_mode = EXCLUDED.pricing_mode,
  calculation_breakdown = EXCLUDED.calculation_breakdown,
  formula_version = EXCLUDED.formula_version,
  calculated_at = NOW();

UPDATE shipping_routes
SET last_calculated_at = NOW(),
    formula_version = (SELECT formula_version FROM shipping_settings WHERE id = TRUE);

CREATE TABLE IF NOT EXISTS logistics_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL DEFAULT 'GIG_LOGISTICS',
  state VARCHAR(80) NOT NULL,
  city VARCHAR(120) NOT NULL,
  area VARCHAR(160),
  branch_name VARCHAR(180) NOT NULL,
  full_address TEXT NOT NULL,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, state, branch_name)
);

CREATE TABLE IF NOT EXISTS delivery_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id TEXT,
  previous_value JSONB,
  new_value JSONB,
  admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE currency_rates
  ADD COLUMN IF NOT EXISTS provider_rate_to_base NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS effective_rate_to_base NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS markup_bps INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_override_rate NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS rate_mode VARCHAR(20) NOT NULL DEFAULT 'PROVIDER',
  ADD COLUMN IF NOT EXISTS provider_name VARCHAR(80),
  ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

UPDATE currency_rates SET
  provider_rate_to_base = COALESCE(provider_rate_to_base, rate_to_base, 1),
  effective_rate_to_base = COALESCE(effective_rate_to_base, rate_to_base, 1),
  rate_mode = CASE WHEN manual_override_rate IS NOT NULL THEN 'MANUAL' ELSE 'PROVIDER' END
WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS currency_rate_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  currency_code VARCHAR(10) NOT NULL,
  provider VARCHAR(80) NOT NULL,
  raw_rate_to_base NUMERIC(18, 8),
  markup_bps INTEGER NOT NULL DEFAULT 0,
  effective_rate_to_base NUMERIC(18, 8),
  source_mode VARCHAR(20) NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL,
  provider VARCHAR(80),
  retry_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS origin_state VARCHAR(80),
  ADD COLUMN IF NOT EXISTS destination_state VARCHAR(80),
  ADD COLUMN IF NOT EXISTS pickup_location_id UUID REFERENCES logistics_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_branch_name_snapshot VARCHAR(180),
  ADD COLUMN IF NOT EXISTS pickup_address_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee_ngn NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS display_currency VARCHAR(10) DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS exchange_rate_used NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS converted_delivery_fee NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_formula_version INTEGER,
  ADD COLUMN IF NOT EXISTS shipment_weight_grams INTEGER;

CREATE INDEX IF NOT EXISTS idx_shipping_routes_lookup ON shipping_routes(origin_state, destination_state);
CREATE INDEX IF NOT EXISTS idx_shipping_route_rates_lookup ON shipping_route_rates(route_id, weight_band_id);
CREATE INDEX IF NOT EXISTS idx_logistics_locations_checkout ON logistics_locations(provider, state, city, active);
CREATE INDEX IF NOT EXISTS idx_currency_rate_history_code_created ON currency_rate_history(currency_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_name_started ON scheduled_job_runs(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_location ON orders(pickup_location_id);
