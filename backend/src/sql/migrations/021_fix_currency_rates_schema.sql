-- 021_fix_currency_rates_schema.sql
-- Repairs older/incomplete currency_rates tables without dropping data.
-- Safe to run more than once in Neon.
-- rate_to_base means: 1 selected currency equals this many NGN.
-- Example: USD rate_to_base 1500 means 1 USD = NGN 1500.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS currency_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  rate_to_base NUMERIC(14,4) NOT NULL,
  is_base BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS code VARCHAR(10);
ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS symbol VARCHAR(10);
ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS rate_to_base NUMERIC(14,4);
ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS is_base BOOLEAN DEFAULT false;
ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS updated_by UUID NULL;
ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'currency_rates'
      AND column_name = 'base_currency'
  ) THEN
    ALTER TABLE currency_rates ALTER COLUMN base_currency SET DEFAULT 'NGN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'currency_rates'
      AND column_name = 'target_currency'
  ) THEN
    UPDATE currency_rates
    SET code = UPPER(TRIM(target_currency::text))::VARCHAR(10)
    WHERE code IS NULL
      AND target_currency IS NOT NULL;

    ALTER TABLE currency_rates ALTER COLUMN target_currency SET DEFAULT 'NGN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'currency_rates'
      AND column_name = 'exchange_rate'
  ) THEN
    UPDATE currency_rates
    SET rate_to_base = CASE
      WHEN NULLIF(TRIM(exchange_rate::text), '') IS NULL THEN NULL
      WHEN TRIM(exchange_rate::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN exchange_rate::numeric
      ELSE NULL
    END
    WHERE rate_to_base IS NULL
      AND exchange_rate IS NOT NULL;

    ALTER TABLE currency_rates ALTER COLUMN exchange_rate SET DEFAULT 1;
  END IF;
END $$;


DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'currency_rates'
      AND column_name = 'currency_code'
  ) THEN
    UPDATE currency_rates
    SET code = UPPER(TRIM(currency_code::text))::VARCHAR(10)
    WHERE code IS NULL
      AND currency_code IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'currency_rates'
      AND column_name = 'rate_to_ngn'
  ) THEN
    UPDATE currency_rates
    SET rate_to_base = CASE
      WHEN NULLIF(TRIM(rate_to_ngn::text), '') IS NULL THEN NULL
      WHEN TRIM(rate_to_ngn::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN rate_to_ngn::numeric
      ELSE NULL
    END
    WHERE rate_to_base IS NULL
      AND rate_to_ngn IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'currency_rates'
      AND column_name = 'is_default'
  ) THEN
    UPDATE currency_rates
    SET is_base = CASE LOWER(TRIM(is_default::text))
      WHEN 'true' THEN true
      WHEN 't' THEN true
      WHEN '1' THEN true
      WHEN 'yes' THEN true
      WHEN 'false' THEN false
      WHEN 'f' THEN false
      WHEN '0' THEN false
      WHEN 'no' THEN false
      ELSE is_base
    END
    WHERE is_default IS NOT NULL;
  END IF;
END $$;

ALTER TABLE currency_rates
  ALTER COLUMN code TYPE VARCHAR(10) USING UPPER(TRIM(code::text))::VARCHAR(10),
  ALTER COLUMN name TYPE TEXT USING name::text,
  ALTER COLUMN symbol TYPE VARCHAR(10) USING symbol::VARCHAR(10),
  ALTER COLUMN rate_to_base TYPE NUMERIC(14,4) USING CASE
    WHEN NULLIF(TRIM(rate_to_base::text), '') IS NULL THEN NULL
    WHEN TRIM(rate_to_base::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN rate_to_base::numeric
    ELSE NULL
  END,
  ALTER COLUMN display_order TYPE INTEGER USING CASE
    WHEN NULLIF(TRIM(display_order::text), '') IS NULL THEN NULL
    WHEN TRIM(display_order::text) ~ '^-?[0-9]+$' THEN display_order::integer
    ELSE NULL
  END,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE currency_rates ALTER COLUMN is_base SET DEFAULT false;
ALTER TABLE currency_rates ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE currency_rates ALTER COLUMN display_order SET DEFAULT 0;
ALTER TABLE currency_rates ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE currency_rates ALTER COLUMN updated_at SET DEFAULT NOW();

INSERT INTO currency_rates (code, name, symbol, rate_to_base, is_base, is_active, display_order)
SELECT 'NGN'::VARCHAR(10), 'Nigerian Naira'::TEXT, U&'\20A6'::VARCHAR(10), 1::NUMERIC, true, true, 1
WHERE NOT EXISTS (SELECT 1 FROM currency_rates WHERE UPPER(code::text) = 'NGN');

INSERT INTO currency_rates (code, name, symbol, rate_to_base, is_base, is_active, display_order)
SELECT 'USD'::VARCHAR(10), 'US Dollar'::TEXT, '$'::VARCHAR(10), 1500::NUMERIC, false, true, 2
WHERE NOT EXISTS (SELECT 1 FROM currency_rates WHERE UPPER(code::text) = 'USD');

INSERT INTO currency_rates (code, name, symbol, rate_to_base, is_base, is_active, display_order)
SELECT 'GBP'::VARCHAR(10), 'British Pound'::TEXT, U&'\00A3'::VARCHAR(10), 1900::NUMERIC, false, true, 3
WHERE NOT EXISTS (SELECT 1 FROM currency_rates WHERE UPPER(code::text) = 'GBP');

INSERT INTO currency_rates (code, name, symbol, rate_to_base, is_base, is_active, display_order)
SELECT 'EUR'::VARCHAR(10), 'Euro'::TEXT, U&'\20AC'::VARCHAR(10), 1650::NUMERIC, false, true, 4
WHERE NOT EXISTS (SELECT 1 FROM currency_rates WHERE UPPER(code::text) = 'EUR');

UPDATE currency_rates
SET
  code = UPPER(TRIM(code::text))::VARCHAR(10),
  name = COALESCE(NULLIF(name, ''), CASE UPPER(code::text)
    WHEN 'NGN' THEN 'Nigerian Naira'
    WHEN 'USD' THEN 'US Dollar'
    WHEN 'GBP' THEN 'British Pound'
    WHEN 'EUR' THEN 'Euro'
    ELSE code::text
  END),
  symbol = COALESCE(NULLIF(symbol, ''), CASE UPPER(code::text)
    WHEN 'NGN' THEN U&'\20A6'
    WHEN 'USD' THEN '$'
    WHEN 'GBP' THEN U&'\00A3'
    WHEN 'EUR' THEN U&'\20AC'
    ELSE code::text
  END)::VARCHAR(10),
  rate_to_base = COALESCE(rate_to_base, CASE UPPER(code::text)
    WHEN 'NGN' THEN 1
    WHEN 'USD' THEN 1500
    WHEN 'GBP' THEN 1900
    WHEN 'EUR' THEN 1650
    ELSE 1
  END),
  is_base = COALESCE(is_base, false),
  is_active = COALESCE(is_active, true),
  display_order = COALESCE(display_order, CASE UPPER(code::text)
    WHEN 'NGN' THEN 1
    WHEN 'USD' THEN 2
    WHEN 'GBP' THEN 3
    WHEN 'EUR' THEN 4
    ELSE 100
  END),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE code IS NOT NULL;

UPDATE currency_rates
SET
  is_base = true,
  is_active = true,
  rate_to_base = 1,
  display_order = 1,
  updated_at = NOW()
WHERE UPPER(code::text) = 'NGN';

UPDATE currency_rates
SET is_base = false,
    updated_at = NOW()
WHERE UPPER(code::text) <> 'NGN'
  AND is_base = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM currency_rates
    WHERE code IS NULL
      OR NULLIF(TRIM(name), '') IS NULL
      OR NULLIF(TRIM(symbol), '') IS NULL
      OR rate_to_base IS NULL
  ) THEN
    ALTER TABLE currency_rates ALTER COLUMN code SET NOT NULL;
    ALTER TABLE currency_rates ALTER COLUMN name SET NOT NULL;
    ALTER TABLE currency_rates ALTER COLUMN symbol SET NOT NULL;
    ALTER TABLE currency_rates ALTER COLUMN rate_to_base SET NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped currency_rates NOT NULL constraints because incomplete rows still exist. Fill or remove incomplete rows manually, then rerun this migration.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_currency_rates_code ON currency_rates(UPPER(code::text));
CREATE INDEX IF NOT EXISTS idx_currency_rates_active ON currency_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_currency_rates_display_order ON currency_rates(display_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT UPPER(code::text) AS normalized_code, COUNT(*) AS duplicate_count
      FROM currency_rates
      WHERE code IS NOT NULL
      GROUP BY UPPER(code::text)
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_currency_rates_code_unique
      ON currency_rates(UPPER(code::text))
      WHERE code IS NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped unique currency code index because duplicate currency codes exist. Resolve duplicates manually, then rerun this migration.';
  END IF;
END $$;



