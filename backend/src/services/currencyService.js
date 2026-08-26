const pool = require("../config/db");

const DEFAULT_RATES = [
  {
    code: "NGN",
    name: "Nigerian Naira",
    symbol: "\u20a6",
    rateToBase: 1,
    isActive: true,
    isBase: true,
    displayOrder: 1,
  },
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    rateToBase: 1500,
    isActive: true,
    isBase: false,
    displayOrder: 2,
  },
  {
    code: "GBP",
    name: "British Pound",
    symbol: "\u00a3",
    rateToBase: 1900,
    isActive: true,
    isBase: false,
    displayOrder: 3,
  },
  {
    code: "EUR",
    name: "Euro",
    symbol: "\u20ac",
    rateToBase: 1650,
    isActive: true,
    isBase: false,
    displayOrder: 4,
  },
];

let currencyTableReady = false;

function normalizeCurrencyCode(code) {
  return String(code || "").trim().toUpperCase();
}

function toCurrency(row = {}) {
  const rateToBase = Number(row.rate_to_base || row.rate_to_ngn || 1);
  const isBase = Boolean(row.is_base ?? row.is_default);

  return {
    id: row.id || null,
    code: row.code,
    name: row.name || row.code,
    symbol: row.symbol,
    rateToBase,
    rateToNgn: rateToBase,
    isBase,
    isDefault: isBase,
    isActive: Boolean(row.is_active),
    displayOrder: Number(row.display_order || 0),
    updatedBy: row.updated_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureCurrencyTable(client = pool) {
  if (currencyTableReady && client === pool) return;

  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await client.query(`
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
    )
  `);

  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS code VARCHAR(10)`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS name TEXT`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS symbol VARCHAR(10)`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS rate_to_base NUMERIC(14,4)`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS is_base BOOLEAN DEFAULT false`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS updated_by UUID NULL`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'currency_rates'
          AND column_name = 'target_currency'
      ) THEN
        ALTER TABLE currency_rates ALTER COLUMN target_currency SET DEFAULT 'NGN';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'currency_rates'
          AND column_name = 'exchange_rate'
      ) THEN
        ALTER TABLE currency_rates ALTER COLUMN exchange_rate SET DEFAULT 1;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'currency_rates'
          AND column_name = 'base_currency'
      ) THEN
        ALTER TABLE currency_rates ALTER COLUMN base_currency SET DEFAULT 'NGN';
      END IF;
    END $$;
  `);

  for (const rate of DEFAULT_RATES) {
    await client.query(
      `
        INSERT INTO currency_rates (
          code, name, symbol, rate_to_base, is_base, is_active, display_order
        )
        SELECT
          $1::varchar,
          $2::text,
          $3::varchar,
          $4::numeric,
          $5::boolean,
          $6::boolean,
          $7::integer
        WHERE NOT EXISTS (
          SELECT 1
          FROM currency_rates
          WHERE UPPER(code::text) = UPPER($8::text)
        )
      `,
      [
        rate.code,
        rate.name,
        rate.symbol,
        rate.rateToBase,
        rate.isBase,
        rate.isActive,
        rate.displayOrder,
        rate.code,
      ]
    );
  }

  await client.query(`
    UPDATE currency_rates
    SET
      code = UPPER(TRIM(code::text)),
      name = COALESCE(NULLIF(name, ''), CASE UPPER(code::text)
        WHEN 'NGN' THEN 'Nigerian Naira'
        WHEN 'USD' THEN 'US Dollar'
        WHEN 'GBP' THEN 'British Pound'
        WHEN 'EUR' THEN 'Euro'
        ELSE code
      END),
      symbol = COALESCE(NULLIF(symbol, ''), CASE UPPER(code::text)
        WHEN 'NGN' THEN '\u20a6'
        WHEN 'USD' THEN '$'
        WHEN 'GBP' THEN '\u00a3'
        WHEN 'EUR' THEN '\u20ac'
        ELSE code
      END),
      rate_to_base = COALESCE(rate_to_base, CASE UPPER(code::text)
        WHEN 'NGN' THEN 1
        WHEN 'USD' THEN 1500
        WHEN 'GBP' THEN 1900
        WHEN 'EUR' THEN 1650
        ELSE 1
      END),
      display_order = COALESCE(display_order, CASE UPPER(code::text)
        WHEN 'NGN' THEN 1
        WHEN 'USD' THEN 2
        WHEN 'GBP' THEN 3
        WHEN 'EUR' THEN 4
        ELSE 100
      END),
      updated_at = COALESCE(updated_at, NOW())
    WHERE code IS NOT NULL
  `);

  await client.query(`
    UPDATE currency_rates
    SET
      is_base = true,
      is_active = true,
      rate_to_base = 1,
      display_order = 1,
      updated_at = NOW()
    WHERE UPPER(code::text) = 'NGN'
  `);

  await client.query(`
    UPDATE currency_rates
    SET is_base = false
    WHERE UPPER(code::text) <> 'NGN'
      AND is_base = true
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_currency_rates_code ON currency_rates(UPPER(code::text))`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_currency_rates_active ON currency_rates(is_active)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_currency_rates_display_order ON currency_rates(display_order)`);

  if (client === pool) {
    currencyTableReady = true;
  }
}

async function getCurrencyRates({ includeInactive = false } = {}) {
  try {
    await ensureCurrencyTable();
  } catch (error) {
    console.error(
      "Currency schema ensure failed:",
      pool.describeError ? pool.describeError(error) : error.message
    );
    throw new Error("Currency rates are unavailable until the currency schema migration is applied.");
  }

  const result = await pool.query(
    `
      SELECT *
      FROM currency_rates
      WHERE code IS NOT NULL
        ${includeInactive ? "" : "AND (is_active = true OR is_base = true)"}
      ORDER BY COALESCE(display_order, 100) ASC, code ASC
    `
  );

  if (result.rows.length === 0) {
    throw new Error("Currency rates are not configured. Run migration 021_fix_currency_rates_schema.sql.");
  }

  return result.rows.map(toCurrency);
}

function parseOptionalBoolean(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  throw new Error(`${fieldName} must be true or false.`);
}

async function updateCurrencyRate(code, data = {}, adminId = null) {
  await ensureCurrencyTable();

  const normalizedCode = normalizeCurrencyCode(code);
  const supported = DEFAULT_RATES.find((rate) => rate.code === normalizedCode);

  if (!supported) {
    throw new Error("Unsupported currency code.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
        SELECT *
        FROM currency_rates
        WHERE UPPER(code::text) = UPPER($1::text)
        LIMIT 1
      `,
      [normalizedCode]
    );

    if (existingResult.rows.length === 0) {
      throw new Error("Currency code not found. Run the currency migration and try again.");
    }

    const existing = existingResult.rows[0];
    const requestedRate =
      data.rateToBase ?? data.rateToNgn ?? data.rate_to_base ?? data.rate_to_ngn ?? data.rate;
    const rateToBase =
      normalizedCode === "NGN"
        ? 1
        : requestedRate === undefined || requestedRate === null || requestedRate === ""
          ? Number(existing.rate_to_base || supported.rateToBase)
          : Number(requestedRate);

    if (!Number.isFinite(rateToBase) || rateToBase <= 0) {
      throw new Error("Exchange rate must be greater than zero.");
    }

    const isActive = parseOptionalBoolean(
      data.isActive ?? data.is_active,
      Boolean(existing.is_active),
      "is_active"
    );
    const isBase = parseOptionalBoolean(
      data.isBase ?? data.isDefault ?? data.is_base ?? data.is_default,
      Boolean(existing.is_base),
      "is_base"
    );
    const requestedDisplayOrder = data.displayOrder ?? data.display_order;
    const displayOrder =
      requestedDisplayOrder === undefined || requestedDisplayOrder === null || requestedDisplayOrder === ""
        ? Number(existing.display_order ?? supported.displayOrder)
        : Number(requestedDisplayOrder);

    if (!Number.isFinite(displayOrder)) {
      throw new Error("Display order must be a valid number.");
    }

    const nextIsBase = normalizedCode === "NGN" ? true : isBase;
    const nextIsActive = normalizedCode === "NGN" ? true : isActive;

    if (nextIsBase === true || normalizedCode === "NGN") {
      await client.query("UPDATE currency_rates SET is_base = false WHERE code IS NOT NULL");
    }

    const result = await client.query(
      `
        UPDATE currency_rates
        SET
          name = $2::text,
          symbol = $3::varchar,
          rate_to_base = $4::numeric,
          is_active = $5::boolean,
          is_base = $6::boolean,
          display_order = $7::integer,
          updated_by = $8::uuid,
          updated_at = NOW()
        WHERE UPPER(code::text) = UPPER($1::text)
        RETURNING *
      `,
      [
        normalizedCode,
        String(data.name || existing.name || supported.name).trim(),
        String(data.symbol || existing.symbol || supported.symbol).trim(),
        normalizedCode === "NGN" ? 1 : rateToBase,
        nextIsActive,
        nextIsBase,
        displayOrder,
        adminId || null,
      ]
    );

    if (result.rows.length === 0) {
      throw new Error("Currency code not found. Run the currency migration and try again.");
    }

    if (normalizedCode === "NGN") {
      await client.query(
        "UPDATE currency_rates SET is_active = true, is_base = true, rate_to_base = 1, updated_at = NOW() WHERE UPPER(code::text) = 'NGN'"
      );
    }

    await client.query("COMMIT");

    return toCurrency(result.rows[0]);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Currency update rollback failed:",
        pool.describeError ? pool.describeError(rollbackError) : rollbackError.message
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

function convertFromNgn(amount, rateToNgn) {
  const rate = Number(rateToNgn || 1);
  if (!Number.isFinite(rate) || rate <= 0) return Number(amount || 0);
  return Number(amount || 0) / rate;
}

module.exports = {
  convertFromNgn,
  ensureCurrencyTable,
  getCurrencyRates,
  updateCurrencyRate,
};


