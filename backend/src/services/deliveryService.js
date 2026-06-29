const pool = require("../config/db");

const DEFAULT_DELIVERY_FEE = 3000;
const ORDER_DELIVERY_COLUMNS = [
  "delivery_fee",
  "delivery_notes",
  "delivery_zone_id",
  "state",
];

function isMissingDeliveryTableError(error) {
  return error?.code === "42P01" || error?.message?.includes("delivery_zones");
}

function normalizeLocation(value, fallback = "Default") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function parseDeliveryFee(value) {
  const deliveryFee = Number(value);

  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
    throw new Error("Delivery fee must be a valid non-negative amount.");
  }

  return deliveryFee;
}

function parseBoolean(value, fallback) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "active"].includes(normalized)) return true;
    if (["false", "0", "no", "inactive"].includes(normalized)) return false;
  }

  if (typeof value === "number") return value === 1;

  return fallback;
}

function formatZone(zone) {
  if (!zone) return null;

  return {
    ...zone,
    delivery_fee: Number(zone.delivery_fee),
  };
}

function getDefaultDeliveryQuote() {
  return {
    defaultDeliveryFee: DEFAULT_DELIVERY_FEE,
    deliveryFee: DEFAULT_DELIVERY_FEE,
    matchedZone: {
      country: "Default",
      state: "Default",
      region: "Default",
      is_default: true,
    },
    zones: [],
    migrationApplied: false,
  };
}

function createNoDeliveryZoneError() {
  const error = new Error(
    "No active delivery zone matches this address and no default delivery zone is configured."
  );
  error.code = "NO_DELIVERY_ZONE";
  return error;
}

async function getDeliveryOverview() {
  try {
    const zonesResult = await pool.query(`
      SELECT
        id,
        country,
        state,
        region,
        delivery_fee,
        is_default,
        is_active,
        created_at,
        updated_at
      FROM delivery_zones
      ORDER BY is_default DESC, country ASC, state ASC, region ASC
    `);

    const defaultZone =
      zonesResult.rows.find((zone) => zone.is_default) || zonesResult.rows[0];

    return {
      defaultDeliveryFee: defaultZone
        ? Number(defaultZone.delivery_fee)
        : DEFAULT_DELIVERY_FEE,
      zones: zonesResult.rows.map(formatZone),
      migrationApplied: true,
    };
  } catch (error) {
    if (isMissingDeliveryTableError(error)) {
      return getDefaultDeliveryQuote();
    }

    throw error;
  }
}

async function getDeliveryQuote(
  { country, state, region } = {},
  { client = pool } = {}
) {
  const normalizedCountry = normalizeLocation(country);
  const normalizedState = normalizeLocation(state);
  const normalizedRegion = normalizeLocation(region);

  try {
    const result = await client.query(
      `
        SELECT
          id,
          country,
          state,
          region,
          delivery_fee,
          is_default,
          is_active
        FROM delivery_zones
        WHERE is_active = TRUE
          AND (
            (
              LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = LOWER($3)
            )
            OR (
              LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = 'default'
            )
            OR (
              LOWER(country) = LOWER($1)
              AND LOWER(state) = 'default'
              AND LOWER(region) = 'default'
            )
            OR is_default = TRUE
          )
        ORDER BY
          CASE
            WHEN LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = LOWER($3)
              THEN 1
            WHEN LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = 'default'
              THEN 2
            WHEN LOWER(country) = LOWER($1)
              AND LOWER(state) = 'default'
              AND LOWER(region) = 'default'
              THEN 3
            WHEN is_default = TRUE THEN 4
            ELSE 5
          END ASC,
          updated_at DESC NULLS LAST,
          created_at DESC NULLS LAST
        LIMIT 1
      `,
      [normalizedCountry, normalizedState, normalizedRegion]
    );

    const zone = result.rows[0];

    if (!zone) {
      throw createNoDeliveryZoneError();
    }

    return {
      defaultDeliveryFee: DEFAULT_DELIVERY_FEE,
      deliveryFee: Number(zone.delivery_fee),
      matchedZone: formatZone(zone),
      migrationApplied: true,
    };
  } catch (error) {
    if (isMissingDeliveryTableError(error)) {
      return getDefaultDeliveryQuote();
    }

    throw error;
  }
}

async function createDeliveryZone(payload = {}) {
  const client = await pool.connect();

  try {
    const country = normalizeLocation(payload.country);
    const state = normalizeLocation(payload.state);
    const region = normalizeLocation(payload.region);
    const deliveryFee = parseDeliveryFee(
      payload.deliveryFee ?? payload.delivery_fee
    );
    const isDefault = parseBoolean(
      payload.isDefault ?? payload.is_default,
      false
    );
    const isActive = parseBoolean(payload.isActive ?? payload.is_active, true);

    await client.query("BEGIN");

    if (isDefault) {
      await client.query("UPDATE delivery_zones SET is_default = FALSE");
    }

    const result = await client.query(
      `
        INSERT INTO delivery_zones (
          country,
          state,
          region,
          delivery_fee,
          is_default,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          country,
          state,
          region,
          delivery_fee,
          is_default,
          is_active,
          created_at,
          updated_at
      `,
      [country, state, region, deliveryFee, isDefault, isActive]
    );

    await client.query("COMMIT");

    return formatZone(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateDeliveryZone(zoneId, payload = {}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
        SELECT *
        FROM delivery_zones
        WHERE id = $1
        FOR UPDATE
      `,
      [zoneId]
    );

    const existingZone = existingResult.rows[0];

    if (!existingZone) {
      await client.query("ROLLBACK");

      return null;
    }

    const hasDeliveryFee =
      Object.prototype.hasOwnProperty.call(payload, "deliveryFee") ||
      Object.prototype.hasOwnProperty.call(payload, "delivery_fee");

    const nextZone = {
      country:
        payload.country === undefined
          ? existingZone.country
          : normalizeLocation(payload.country),
      state:
        payload.state === undefined
          ? existingZone.state
          : normalizeLocation(payload.state),
      region:
        payload.region === undefined
          ? existingZone.region
          : normalizeLocation(payload.region),
      deliveryFee: hasDeliveryFee
        ? parseDeliveryFee(payload.deliveryFee ?? payload.delivery_fee)
        : Number(existingZone.delivery_fee),
      isDefault: parseBoolean(
        payload.isDefault ?? payload.is_default,
        existingZone.is_default
      ),
      isActive: parseBoolean(
        payload.isActive ?? payload.is_active,
        existingZone.is_active
      ),
    };

    if (nextZone.isDefault) {
      await client.query(
        "UPDATE delivery_zones SET is_default = FALSE WHERE id <> $1",
        [zoneId]
      );
    }

    const result = await client.query(
      `
        UPDATE delivery_zones
        SET
          country = $1,
          state = $2,
          region = $3,
          delivery_fee = $4,
          is_default = $5,
          is_active = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING
          id,
          country,
          state,
          region,
          delivery_fee,
          is_default,
          is_active,
          created_at,
          updated_at
      `,
      [
        nextZone.country,
        nextZone.state,
        nextZone.region,
        nextZone.deliveryFee,
        nextZone.isDefault,
        nextZone.isActive,
        zoneId,
      ]
    );

    await client.query("COMMIT");

    return formatZone(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getExistingOrderDeliveryColumns({ refresh = false } = {}) {
  const now = Date.now();

  if (
    !refresh &&
    cachedOrderDeliveryColumns &&
    now - cachedOrderDeliveryColumnsAt < ORDER_COLUMN_CACHE_MS
  ) {
    return new Set(cachedOrderDeliveryColumns);
  }

  try {
    const result = await pool.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orders'
          AND column_name = ANY($1::text[])
      `,
      [ORDER_DELIVERY_COLUMNS]
    );

    cachedOrderDeliveryColumns = result.rows.map((row) => row.column_name);
    cachedOrderDeliveryColumnsAt = now;

    return new Set(cachedOrderDeliveryColumns);
  } catch (error) {
    console.error("Order delivery column inspection failed:", pool.describeError ? pool.describeError(error) : error.message);
    return new Set();
  }
}

async function buildOrderDeliveryFields({
  deliveryQuote,
  deliveryNotes,
  state,
  existingColumns,
} = {}) {
  const columns = existingColumns instanceof Set
    ? existingColumns
    : await getExistingOrderDeliveryColumns();
  const fields = [];

  if (columns.has("delivery_fee")) {
    fields.push({
      column: "delivery_fee",
      value: Number(deliveryQuote?.deliveryFee || DEFAULT_DELIVERY_FEE),
    });
  }

  if (columns.has("delivery_notes")) {
    fields.push({
      column: "delivery_notes",
      value: normalizeOptionalText(deliveryNotes),
    });
  }

  if (columns.has("delivery_zone_id")) {
    fields.push({
      column: "delivery_zone_id",
      value: deliveryQuote?.matchedZone?.id || null,
    });
  }

  if (columns.has("state")) {
    fields.push({
      column: "state",
      value: normalizeOptionalText(state),
    });
  }

  return fields;
}

module.exports = {
  DEFAULT_DELIVERY_FEE,
  buildOrderDeliveryFields,
  getExistingOrderDeliveryColumns,
  createDeliveryZone,
  getDeliveryOverview,
  getDeliveryQuote,
  updateDeliveryZone,
};
