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
  const providerRateToBase = Number(
    row.provider_rate_to_base || row.rate_to_base || row.rate_to_ngn || 1
  );
  const effectiveRateToBase = Number(
    row.effective_rate_to_base || row.manual_override_rate || row.rate_to_base || providerRateToBase
  );
  const rateToBase = effectiveRateToBase;
  const isBase = Boolean(row.is_base ?? row.is_default);

  return {
    id: row.id || null,
    code: row.code,
    name: row.name || row.code,
    symbol: row.symbol,
    rateToBase,
    rateToNgn: rateToBase,
    providerRateToBase,
    effectiveRateToBase,
    markupBps: Number(row.markup_bps || 0),
    markupPercent: Number(row.markup_bps || 0) / 100,
    manualOverrideRate:
      row.manual_override_rate === null || row.manual_override_rate === undefined
        ? null
        : Number(row.manual_override_rate),
    mode: row.rate_mode || (row.manual_override_rate ? "MANUAL" : "PROVIDER"),
    provider: row.provider_name || row.source || null,
    providerUpdatedAt: row.provider_updated_at || null,
    lastSyncStatus: row.last_sync_status || "PENDING",
    lastSyncError: row.last_sync_error || null,
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
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS provider_rate_to_base NUMERIC(18,8)`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS effective_rate_to_base NUMERIC(18,8)`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS markup_bps INTEGER NOT NULL DEFAULT 0`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS manual_override_rate NUMERIC(18,8)`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS rate_mode VARCHAR(20) NOT NULL DEFAULT 'PROVIDER'`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS provider_name VARCHAR(80)`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'`);
  await client.query(`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS last_sync_error TEXT`);
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
    const requestedMarkupPercent = data.markupPercent ?? data.markup_percent;
    const markupBps = requestedMarkupPercent === undefined
      ? Number(existing.markup_bps || 0)
      : Math.round(Number(requestedMarkupPercent) * 100);
    if (!Number.isFinite(markupBps) || markupBps < -9000 || markupBps > 50000) {
      throw new Error("Currency markup must be between -90% and 500%.");
    }
    const resetManualOverride = data.resetManualOverride === true || data.reset_manual_override === true;
    const manualInput = data.manualOverrideRate ?? data.manual_override_rate ?? requestedRate;
    const manualOverrideRate = normalizedCode === "NGN" || resetManualOverride
      ? null
      : manualInput === undefined || manualInput === null || manualInput === ""
        ? existing.manual_override_rate
        : Number(manualInput);
    if (manualOverrideRate !== null && (!Number.isFinite(Number(manualOverrideRate)) || Number(manualOverrideRate) <= 0)) {
      throw new Error("Manual override rate must be greater than zero.");
    }
    const providerRate = normalizedCode === "NGN"
      ? 1
      : Number(existing.provider_rate_to_base || existing.rate_to_base || supported.rateToBase);
    const effectiveRate = normalizedCode === "NGN"
      ? 1
      : manualOverrideRate !== null && manualOverrideRate !== undefined
        ? Number(manualOverrideRate)
        : providerRate * (10000 + markupBps) / 10000;

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
          provider_rate_to_base = $9::numeric,
          effective_rate_to_base = $10::numeric,
          markup_bps = $11::integer,
          manual_override_rate = $12::numeric,
          rate_mode = $13::varchar,
          updated_at = NOW()
        WHERE UPPER(code::text) = UPPER($1::text)
        RETURNING *
      `,
      [
        normalizedCode,
        String(data.name || existing.name || supported.name).trim(),
        String(data.symbol || existing.symbol || supported.symbol).trim(),
        effectiveRate,
        nextIsActive,
        nextIsBase,
        displayOrder,
        adminId || null,
        providerRate,
        effectiveRate,
        markupBps,
        manualOverrideRate,
        manualOverrideRate === null || manualOverrideRate === undefined ? "PROVIDER" : "MANUAL",
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

async function getCurrencyRateSnapshot(code = "NGN", { client = pool } = {}) {
  await ensureCurrencyTable(client);
  const normalizedCode = normalizeCurrencyCode(code) || "NGN";
  const result = await client.query(
    `SELECT * FROM currency_rates WHERE UPPER(code::text) = $1 AND (is_active = TRUE OR is_base = TRUE) LIMIT 1`,
    [normalizedCode]
  );
  const row = result.rows[0];
  if (!row) {
    const error = new Error("Selected display currency is unavailable.");
    error.statusCode = 400;
    error.code = "CURRENCY_UNAVAILABLE";
    throw error;
  }
  const rate = toCurrency(row);
  return {
    code: rate.code,
    rateToBase: rate.rateToBase,
    providerRateToBase: rate.providerRateToBase,
    mode: rate.mode,
    updatedAt: rate.providerUpdatedAt || rate.updatedAt || new Date().toISOString(),
  };
}

async function fetchProviderRates() {
  const providerUrl = String(
    process.env.FX_API_URL || "https://open.er-api.com/v6/latest/NGN"
  ).trim();
  const timeoutMs = Number(process.env.FX_API_TIMEOUT_MS || 10000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(providerUrl, {
      headers: { Accept: "application/json", "User-Agent": "LUMA-FX-Sync/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`FX provider returned HTTP ${response.status}.`);
    const data = await response.json();
    if (data.result && data.result !== "success") {
      throw new Error(data["error-type"] || "FX provider returned an unsuccessful response.");
    }
    if (!data.rates || typeof data.rates !== "object") {
      throw new Error("FX provider response did not include rates.");
    }

    const rates = { NGN: 1 };
    for (const code of ["USD", "GBP", "EUR"]) {
      const unitsPerNgn = Number(data.rates[code]);
      const rateToBase = 1 / unitsPerNgn;
      if (!Number.isFinite(rateToBase) || rateToBase <= 0) {
        throw new Error(`FX provider returned an invalid ${code} rate.`);
      }
      rates[code] = rateToBase;
    }

    return {
      provider: "open.er-api.com",
      providerUpdatedAt: data.time_last_update_utc || new Date().toISOString(),
      rates,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function syncCurrencyRates({ trigger = "scheduler", retryCount = 0 } = {}) {
  await ensureCurrencyTable();
  const client = await pool.connect();
  const jobResult = await client.query(
    `INSERT INTO scheduled_job_runs (job_name,status,provider,retry_count,details)
     VALUES ('currency_sync','RUNNING','open.er-api.com',$1,$2::jsonb) RETURNING id`,
    [retryCount, JSON.stringify({ trigger })]
  );
  const jobId = jobResult.rows[0].id;

  try {
    const providerData = await fetchProviderRates();
    await client.query("BEGIN");
    const currentResult = await client.query(
      "SELECT * FROM currency_rates WHERE code = ANY($1::text[]) FOR UPDATE",
      [["NGN", "USD", "GBP", "EUR"]]
    );
    const currentByCode = new Map(currentResult.rows.map((row) => [row.code, row]));
    const maxMovementPercent = Number(process.env.FX_MAX_MOVEMENT_PERCENT || 20);

    for (const code of ["NGN", "USD", "GBP", "EUR"]) {
      const current = currentByCode.get(code);
      if (!current) throw new Error(`Currency ${code} is not configured.`);
      const providerRate = Number(providerData.rates[code]);
      const previousProviderRate = Number(current.provider_rate_to_base || current.rate_to_base || providerRate);
      const movementPercent = previousProviderRate > 0
        ? Math.abs(providerRate - previousProviderRate) / previousProviderRate * 100
        : 0;

      if (code !== "NGN" && movementPercent > maxMovementPercent) {
        throw new Error(
          `${code} moved ${movementPercent.toFixed(2)}%, above the ${maxMovementPercent}% safety threshold.`
        );
      }

      const markupBps = Number(current.markup_bps || 0);
      const manualRate = current.manual_override_rate === null ? null : Number(current.manual_override_rate);
      const effectiveRate = code === "NGN"
        ? 1
        : manualRate || providerRate * (10000 + markupBps) / 10000;
      const mode = manualRate ? "MANUAL" : "PROVIDER";

      await client.query(
        `UPDATE currency_rates SET
          provider_rate_to_base=$2, effective_rate_to_base=$3, rate_to_base=$3,
          rate_mode=$4, provider_name=$5, provider_updated_at=$6,
          last_sync_status='SUCCESS', last_sync_error=NULL, updated_at=NOW()
         WHERE UPPER(code::text)=$1`,
        [code, providerRate, effectiveRate, mode, providerData.provider, providerData.providerUpdatedAt]
      );
      await client.query(
        `INSERT INTO currency_rate_history
          (currency_code,provider,raw_rate_to_base,markup_bps,effective_rate_to_base,source_mode,success)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
        [code, providerData.provider, providerRate, markupBps, effectiveRate, mode]
      );
    }

    await client.query(
      `UPDATE scheduled_job_runs SET status='SUCCESS',completed_at=NOW(),details=$2::jsonb WHERE id=$1`,
      [jobId, JSON.stringify({ trigger, currencies: ["NGN", "USD", "GBP", "EUR"] })]
    );
    await client.query("COMMIT");
    return { success: true, provider: providerData.provider, rates: providerData.rates };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    await client.query(
      `UPDATE currency_rates SET last_sync_status='FAILED',last_sync_error=$1 WHERE code IS NOT NULL`,
      [String(error.message || error).slice(0, 1000)]
    ).catch(() => {});
    await client.query(
      `UPDATE scheduled_job_runs SET status='FAILED',error_message=$2,completed_at=NOW() WHERE id=$1`,
      [jobId, String(error.message || error).slice(0, 1000)]
    ).catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getCurrencyAdminOverview() {
  const [rates, history, jobs] = await Promise.all([
    getCurrencyRates({ includeInactive: true }),
    pool.query("SELECT * FROM currency_rate_history ORDER BY created_at DESC LIMIT 100"),
    pool.query("SELECT * FROM scheduled_job_runs WHERE job_name='currency_sync' ORDER BY started_at DESC LIMIT 20"),
  ]);
  return { rates, history: history.rows, jobs: jobs.rows };
}

let currencyWorkerTimer = null;

function millisecondsUntilNextLagosMidnight(now = new Date()) {
  const lagosOffsetMs = 60 * 60 * 1000;
  const lagosNow = new Date(now.getTime() + lagosOffsetMs);
  const nextMidnightUtc = Date.UTC(
    lagosNow.getUTCFullYear(),
    lagosNow.getUTCMonth(),
    lagosNow.getUTCDate() + 1,
    0, 0, 0, 0
  );
  return Math.max(1000, nextMidnightUtc - lagosNow.getTime());
}

function startCurrencyRateWorker() {
  if (currencyWorkerTimer || process.env.DISABLE_INTERNAL_WORKERS === "true") return;
  const schedule = () => {
    currencyWorkerTimer = setTimeout(async () => {
      try {
        await syncCurrencyRates({ trigger: "internal_midnight_worker" });
      } catch (error) {
        console.error("Currency midnight sync failed; last known valid rates remain active:", error.message);
      } finally {
        currencyWorkerTimer = null;
        schedule();
      }
    }, millisecondsUntilNextLagosMidnight());
    currencyWorkerTimer.unref?.();
  };
  schedule();
}

module.exports = {
  convertFromNgn,
  ensureCurrencyTable,
  getCurrencyAdminOverview,
  getCurrencyRateSnapshot,
  getCurrencyRates,
  millisecondsUntilNextLagosMidnight,
  startCurrencyRateWorker,
  syncCurrencyRates,
  updateCurrencyRate,
};
