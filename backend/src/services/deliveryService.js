const pool = require("../config/db");

const DEFAULT_DELIVERY_FEE = 3000;
const ORDER_DELIVERY_COLUMNS = [
  "delivery_fee",
  "delivery_notes",
  "delivery_zone_id",
  "state",
  "delivery_area",
  "delivery_eta_min_days",
  "delivery_eta_max_days",
  "delivery_is_pickup",
];
const ORDER_COLUMN_CACHE_MS = 5 * 60 * 1000;

let cachedOrderDeliveryColumns = null;
let cachedOrderDeliveryColumnsAt = 0;

function isMissingDeliveryTableError(error) {
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.message?.includes("delivery_zones")
  );
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

function parseOptionalDays(value, label) {
  if (value === undefined || value === null || value === "") return null;

  const days = Number(value);
  if (!Number.isInteger(days) || days < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }
  return days;
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
    remote_surcharge: Number(zone.remote_surcharge || 0),
    eta_min_days:
      zone.eta_min_days === null || zone.eta_min_days === undefined
        ? null
        : Number(zone.eta_min_days),
    eta_max_days:
      zone.eta_max_days === null || zone.eta_max_days === undefined
        ? null
        : Number(zone.eta_max_days),
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
        *
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
  { country, state, region, area } = {},
  { client = pool } = {}
) {
  const normalizedCountry = normalizeLocation(country);
  const normalizedState = normalizeLocation(state);
  const normalizedRegion = normalizeLocation(region);
  const normalizedArea = normalizeLocation(area);

  try {
    const result = await client.query(
      `
        SELECT
          *
        FROM delivery_zones
        WHERE is_active = TRUE
          AND (
            (
              LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = LOWER($3)
              AND LOWER(area) = LOWER($4)
            )
            OR (
              LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = LOWER($3)
              AND LOWER(area) = 'default'
            )
            OR (
              LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = 'default'
              AND LOWER(area) = 'default'
            )
            OR (
              LOWER(country) = LOWER($1)
              AND LOWER(state) = 'default'
              AND LOWER(region) = 'default'
              AND LOWER(area) = 'default'
            )
            OR is_default = TRUE
          )
        ORDER BY
          CASE
            WHEN LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = LOWER($3)
              AND LOWER(area) = LOWER($4)
              THEN 1
            WHEN LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = LOWER($3)
              AND LOWER(area) = 'default'
              THEN 2
            WHEN LOWER(country) = LOWER($1)
              AND LOWER(state) = LOWER($2)
              AND LOWER(region) = 'default'
              AND LOWER(area) = 'default'
              THEN 3
            WHEN LOWER(country) = LOWER($1)
              AND LOWER(state) = 'default'
              AND LOWER(region) = 'default'
              AND LOWER(area) = 'default'
              THEN 4
            WHEN is_default = TRUE THEN 5
            ELSE 6
          END ASC,
          updated_at DESC NULLS LAST,
          created_at DESC NULLS LAST
        LIMIT 1
      `,
      [normalizedCountry, normalizedState, normalizedRegion, normalizedArea]
    );

    const zone = result.rows[0];

    if (!zone) {
      throw createNoDeliveryZoneError();
    }

    return {
      defaultDeliveryFee: DEFAULT_DELIVERY_FEE,
      baseDeliveryFee: Number(zone.delivery_fee),
      remoteSurcharge: Number(zone.remote_surcharge || 0),
      deliveryFee:
        Number(zone.delivery_fee) + Number(zone.remote_surcharge || 0),
      etaMinDays: zone.eta_min_days,
      etaMaxDays: zone.eta_max_days,
      isPickup: zone.is_pickup === true,
      pickupLabel: zone.pickup_label || null,
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
    const area = normalizeLocation(payload.area);
    const deliveryFee = parseDeliveryFee(
      payload.deliveryFee ?? payload.delivery_fee
    );
    const remoteSurcharge = parseDeliveryFee(
      payload.remoteSurcharge ?? payload.remote_surcharge ?? 0
    );
    const etaMinDays = parseOptionalDays(
      payload.etaMinDays ?? payload.eta_min_days,
      "Minimum ETA"
    );
    const etaMaxDays = parseOptionalDays(
      payload.etaMaxDays ?? payload.eta_max_days,
      "Maximum ETA"
    );
    if (etaMinDays !== null && etaMaxDays !== null && etaMaxDays < etaMinDays) {
      throw new Error("Maximum ETA cannot be shorter than minimum ETA.");
    }
    const isDefault = parseBoolean(
      payload.isDefault ?? payload.is_default,
      false
    );
    const isActive = parseBoolean(payload.isActive ?? payload.is_active, true);
    const isPickup = parseBoolean(payload.isPickup ?? payload.is_pickup, false);

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
          area,
          delivery_fee,
          remote_surcharge,
          eta_min_days,
          eta_max_days,
          is_pickup,
          pickup_label,
          international_region,
          is_default,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `,
      [
        country,
        state,
        region,
        area,
        deliveryFee,
        remoteSurcharge,
        etaMinDays,
        etaMaxDays,
        isPickup,
        normalizeOptionalText(payload.pickupLabel ?? payload.pickup_label),
        normalizeOptionalText(
          payload.internationalRegion ?? payload.international_region
        ),
        isDefault,
        isActive,
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
      area:
        payload.area === undefined
          ? existingZone.area
          : normalizeLocation(payload.area),
      deliveryFee: hasDeliveryFee
        ? parseDeliveryFee(payload.deliveryFee ?? payload.delivery_fee)
        : Number(existingZone.delivery_fee),
      remoteSurcharge:
        payload.remoteSurcharge === undefined &&
        payload.remote_surcharge === undefined
          ? Number(existingZone.remote_surcharge || 0)
          : parseDeliveryFee(
              payload.remoteSurcharge ?? payload.remote_surcharge
            ),
      etaMinDays:
        payload.etaMinDays === undefined && payload.eta_min_days === undefined
          ? existingZone.eta_min_days
          : parseOptionalDays(
              payload.etaMinDays ?? payload.eta_min_days,
              "Minimum ETA"
            ),
      etaMaxDays:
        payload.etaMaxDays === undefined && payload.eta_max_days === undefined
          ? existingZone.eta_max_days
          : parseOptionalDays(
              payload.etaMaxDays ?? payload.eta_max_days,
              "Maximum ETA"
            ),
      isPickup: parseBoolean(
        payload.isPickup ?? payload.is_pickup,
        existingZone.is_pickup
      ),
      pickupLabel:
        payload.pickupLabel === undefined && payload.pickup_label === undefined
          ? existingZone.pickup_label
          : normalizeOptionalText(payload.pickupLabel ?? payload.pickup_label),
      internationalRegion:
        payload.internationalRegion === undefined &&
        payload.international_region === undefined
          ? existingZone.international_region
          : normalizeOptionalText(
              payload.internationalRegion ?? payload.international_region
            ),
      isDefault: parseBoolean(
        payload.isDefault ?? payload.is_default,
        existingZone.is_default
      ),
      isActive: parseBoolean(
        payload.isActive ?? payload.is_active,
        existingZone.is_active
      ),
    };

    if (
      nextZone.etaMinDays !== null &&
      nextZone.etaMaxDays !== null &&
      nextZone.etaMaxDays < nextZone.etaMinDays
    ) {
      throw new Error("Maximum ETA cannot be shorter than minimum ETA.");
    }

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
          area = $4,
          delivery_fee = $5,
          remote_surcharge = $6,
          eta_min_days = $7,
          eta_max_days = $8,
          is_pickup = $9,
          pickup_label = $10,
          international_region = $11,
          is_default = $12,
          is_active = $13,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $14
        RETURNING *
      `,
      [
        nextZone.country,
        nextZone.state,
        nextZone.region,
        nextZone.area,
        nextZone.deliveryFee,
        nextZone.remoteSurcharge,
        nextZone.etaMinDays,
        nextZone.etaMaxDays,
        nextZone.isPickup,
        nextZone.pickupLabel,
        nextZone.internationalRegion,
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
  area,
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

  if (columns.has("delivery_area")) {
    fields.push({
      column: "delivery_area",
      value: normalizeOptionalText(area),
    });
  }

  if (columns.has("delivery_eta_min_days")) {
    fields.push({
      column: "delivery_eta_min_days",
      value: deliveryQuote?.etaMinDays ?? null,
    });
  }

  if (columns.has("delivery_eta_max_days")) {
    fields.push({
      column: "delivery_eta_max_days",
      value: deliveryQuote?.etaMaxDays ?? null,
    });
  }

  if (columns.has("delivery_is_pickup")) {
    fields.push({
      column: "delivery_is_pickup",
      value: deliveryQuote?.isPickup === true,
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
