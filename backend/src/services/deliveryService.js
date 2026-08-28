const pool = require("../config/db");
const { GIGL_LOCATIONS } = require("../data/giglLocations");

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
  "delivery_method",
  "origin_state",
  "destination_state",
  "pickup_location_id",
  "pickup_branch_name_snapshot",
  "pickup_address_snapshot",
  "delivery_fee_ngn",
  "display_currency",
  "exchange_rate_used",
  "converted_delivery_fee",
  "exchange_rate_timestamp",
  "shipping_formula_version",
  "shipment_weight_grams",
];
const ORDER_COLUMN_CACHE_MS = 5 * 60 * 1000;

const RECALCULATE_DELIVERY_RATES_SQL = `
  WITH rate_upserts AS (
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
      calculated_at = NOW()
    RETURNING 1
  ), route_updates AS (
    UPDATE shipping_routes
    SET last_calculated_at = NOW(),
        formula_version = (SELECT formula_version FROM shipping_settings WHERE id = TRUE)
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM rate_upserts) AS affected,
    (SELECT COUNT(*)::INTEGER FROM route_updates) AS routes_updated
`;

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
  input = {},
  { client = pool } = {}
) {
  if (
    input.deliveryMethod ||
    input.method ||
    input.pickupLocationId ||
    input.pickup_location_id
  ) {
    return getAutomatedDeliveryQuote(input, { client });
  }

  const { country, state, region, area } = input;
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

const DELIVERY_METHODS = Object.freeze({
  DELIVERY: "DELIVERY",
  PICKUP: "PICKUP",
});

function normalizeDeliveryMethod(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (["DELIVERY", "HOME", "HOME_DELIVERY"].includes(normalized)) {
    return DELIVERY_METHODS.DELIVERY;
  }
  if (["PICKUP", "PICK_UP", "PICKUP_LOCATION"].includes(normalized)) {
    return DELIVERY_METHODS.PICKUP;
  }

  const error = new Error("Choose Pickup or Delivery.");
  error.code = "INVALID_DELIVERY_METHOD";
  error.statusCode = 400;
  throw error;
}

function normalizeNigerianState(value) {
  const normalized = String(value || "").trim();
  if (/^(abuja|fct|federal capital territory)$/i.test(normalized)) return "FCT";
  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toKobo(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be a valid non-negative number.");
  }
  return Math.round(amount * 100);
}

function fromKobo(value) {
  return Number(value || 0) / 100;
}

async function ensurePickupLocationsSeeded(client = pool) {
  const countResult = await client.query(
    "SELECT COUNT(*)::integer AS count FROM logistics_locations WHERE provider = 'GIG_LOGISTICS'"
  );

  if (Number(countResult.rows[0]?.count || 0) >= GIGL_LOCATIONS.length) return;

  for (let index = 0; index < GIGL_LOCATIONS.length; index += 1) {
    const location = GIGL_LOCATIONS[index];
    await client.query(
      `
        INSERT INTO logistics_locations (
          provider, state, city, area, branch_name, full_address,
          active, sort_order, last_verified_at
        ) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8)
        ON CONFLICT (provider, state, branch_name) DO NOTHING
      `,
      [
        location.provider,
        location.state,
        location.city,
        location.area,
        location.branchName,
        location.fullAddress,
        index,
        location.lastVerifiedAt,
      ]
    );
  }
}

async function getShippingStates({ client = pool } = {}) {
  const result = await client.query(
    `SELECT state_name AS state, region
     FROM shipping_areas
     WHERE active = TRUE
     ORDER BY state_name ASC`
  );
  return result.rows;
}

async function getPickupLocations(
  { provider = "GIG_LOGISTICS", state, city, search, includeInactive = false } = {},
  { client = pool } = {}
) {
  await ensurePickupLocationsSeeded(client);

  const values = [String(provider || "GIG_LOGISTICS").trim().toUpperCase()];
  const conditions = ["provider = $1"];

  if (!includeInactive) conditions.push("active = TRUE");
  if (state) {
    values.push(normalizeNigerianState(state));
    conditions.push(`LOWER(state) = LOWER($${values.length})`);
  }
  if (city) {
    values.push(String(city).trim());
    conditions.push(`LOWER(city) = LOWER($${values.length})`);
  }
  if (search) {
    values.push(`%${String(search).trim()}%`);
    conditions.push(`(
      branch_name ILIKE $${values.length} OR city ILIKE $${values.length} OR
      area ILIKE $${values.length} OR full_address ILIKE $${values.length}
    )`);
  }

  const result = await client.query(
    `SELECT * FROM logistics_locations
     WHERE ${conditions.join(" AND ")}
     ORDER BY state ASC, city ASC, sort_order ASC, branch_name ASC`,
    values
  );

  return result.rows.map((row) => ({
    ...row,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
  }));
}

async function getShipmentWeight(items = [], { client = pool } = {}) {
  const normalizedItems = (items || [])
    .map((item) => ({
      productId: String(item.productId || item.product_id || item.id || "").trim(),
      quantity: Number(item.quantity || 0),
    }))
    .filter((item) => /^[0-9a-fA-F-]{36}$/.test(item.productId) && item.quantity > 0);

  const settingsResult = await client.query(
    "SELECT default_weight_grams FROM shipping_settings WHERE id = TRUE"
  );
  const defaultWeight = Number(settingsResult.rows[0]?.default_weight_grams || 500);
  if (!normalizedItems.length) return defaultWeight;

  const ids = normalizedItems.map((item) => item.productId);
  const productResult = await client.query(
    `SELECT id, shipping_weight_grams FROM products WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const weights = new Map(
    productResult.rows.map((row) => [String(row.id), Number(row.shipping_weight_grams || defaultWeight)])
  );

  return normalizedItems.reduce(
    (total, item) => total + (weights.get(item.productId) || defaultWeight) * item.quantity,
    0
  );
}

async function getAutomatedDeliveryQuote(input = {}, { client = pool } = {}) {
  const deliveryMethod = normalizeDeliveryMethod(
    input.deliveryMethod || input.delivery_method || input.method
  );
  let pickupLocation = null;
  let destinationState = normalizeNigerianState(
    input.destinationState || input.destination_state || input.state
  );

  if (deliveryMethod === DELIVERY_METHODS.PICKUP) {
    const pickupLocationId = String(
      input.pickupLocationId || input.pickup_location_id || ""
    ).trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(pickupLocationId)) {
      const error = new Error("Select a valid pickup location.");
      error.code = "PICKUP_LOCATION_REQUIRED";
      error.statusCode = 400;
      throw error;
    }

    await ensurePickupLocationsSeeded(client);
    const locationResult = await client.query(
      "SELECT * FROM logistics_locations WHERE id = $1 AND active = TRUE LIMIT 1",
      [pickupLocationId]
    );
    pickupLocation = locationResult.rows[0];
    if (!pickupLocation) {
      const error = new Error("That pickup location is no longer available.");
      error.code = "PICKUP_LOCATION_UNAVAILABLE";
      error.statusCode = 409;
      throw error;
    }
    destinationState = pickupLocation.state;
  }

  if (!destinationState) {
    const error = new Error("Destination state is required.");
    error.code = "DESTINATION_STATE_REQUIRED";
    error.statusCode = 400;
    throw error;
  }

  const shipmentWeightGrams = await getShipmentWeight(input.items, { client });
  const result = await client.query(
    `
      SELECT
        settings.origin_state,
        settings.formula_version,
        route.id AS route_id,
        route.destination_state,
        route.approximate_road_distance_km,
        route.delivery_zone,
        weight.id AS weight_band_id,
        weight.label AS weight_band_label,
        rate.effective_pickup_kobo,
        rate.effective_home_kobo,
        rate.calculated_pickup_kobo,
        rate.calculated_home_kobo,
        rate.pricing_mode,
        rate.calculation_breakdown,
        rate.calculated_at
      FROM shipping_settings settings
      JOIN shipping_routes route
        ON route.origin_state = settings.origin_state
       AND LOWER(route.destination_state) = LOWER($1)
      JOIN shipping_weight_bands weight
        ON $2::integer >= weight.min_grams
       AND (weight.max_grams IS NULL OR $2::integer <= weight.max_grams)
       AND weight.active = TRUE
      JOIN shipping_route_rates rate
        ON rate.route_id = route.id AND rate.weight_band_id = weight.id
      WHERE settings.id = TRUE
      LIMIT 1
    `,
    [destinationState, shipmentWeightGrams]
  );

  const row = result.rows[0];
  if (!row) {
    const error = new Error("Delivery is not configured for that destination yet.");
    error.code = "NO_DELIVERY_ROUTE";
    error.statusCode = 404;
    throw error;
  }

  const deliveryFeeKobo = deliveryMethod === DELIVERY_METHODS.PICKUP
    ? Number(row.effective_pickup_kobo)
    : Number(row.effective_home_kobo);

  return {
    deliveryMethod,
    deliveryFee: fromKobo(deliveryFeeKobo),
    deliveryFeeKobo,
    originState: row.origin_state,
    destinationState: row.destination_state,
    shipmentWeightGrams,
    weightBand: { id: row.weight_band_id, label: row.weight_band_label },
    route: {
      id: row.route_id,
      distanceKm: Number(row.approximate_road_distance_km),
      zone: row.delivery_zone,
    },
    pricingMode: row.pricing_mode,
    formulaVersion: Number(row.formula_version),
    calculationBreakdown: row.calculation_breakdown,
    calculatedAt: row.calculated_at,
    isPickup: deliveryMethod === DELIVERY_METHODS.PICKUP,
    pickupLocation: pickupLocation
      ? {
          id: pickupLocation.id,
          provider: pickupLocation.provider,
          state: pickupLocation.state,
          city: pickupLocation.city,
          area: pickupLocation.area,
          branchName: pickupLocation.branch_name,
          fullAddress: pickupLocation.full_address,
        }
      : null,
    etaMinDays: row.origin_state === row.destination_state ? 1 : 2,
    etaMaxDays: row.origin_state === row.destination_state ? 3 : 7,
    migrationApplied: true,
  };
}

async function recalculateDeliveryRates({ adminId = null, reason = "manual" } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const beforeResult = await client.query(
      "SELECT row_to_json(shipping_settings) AS value FROM shipping_settings WHERE id = TRUE"
    );
    await client.query(
      "UPDATE shipping_settings SET formula_version = formula_version + 1, updated_by = $1, updated_at = NOW() WHERE id = TRUE",
      [adminId]
    );
    const result = await client.query(RECALCULATE_DELIVERY_RATES_SQL);
    const afterResult = await client.query(
      "SELECT row_to_json(shipping_settings) AS value FROM shipping_settings WHERE id = TRUE"
    );
    await client.query(
      `INSERT INTO delivery_audit_log (action, entity_type, entity_id, previous_value, new_value, admin_id)
       VALUES ('RECALCULATE', 'shipping_settings', $1, $2, $3, $4)`,
      [reason, beforeResult.rows[0]?.value || null, afterResult.rows[0]?.value || null, adminId]
    );
    await client.query("COMMIT");
    return { affected: Number(result.rows[0]?.affected || 0) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function getDeliveryEngineOverview() {
  await ensurePickupLocationsSeeded();
  const [settings, distanceBands, weightBands, regionRules, routes, status] = await Promise.all([
    pool.query("SELECT * FROM shipping_settings WHERE id = TRUE"),
    pool.query("SELECT * FROM shipping_distance_bands ORDER BY sort_order, min_km"),
    pool.query("SELECT * FROM shipping_weight_bands ORDER BY sort_order, min_grams"),
    pool.query("SELECT * FROM shipping_region_rules ORDER BY region"),
    pool.query(`
      SELECT route.*, rate.effective_pickup_kobo, rate.effective_home_kobo,
             rate.calculated_pickup_kobo, rate.calculated_home_kobo,
             rate.pricing_mode, rate.calculation_breakdown, rate.calculated_at
      FROM shipping_routes route
      JOIN shipping_settings settings ON settings.id = TRUE AND route.origin_state = settings.origin_state
      JOIN shipping_weight_bands weight ON weight.active = TRUE AND weight.sort_order = 1
      JOIN shipping_route_rates rate ON rate.route_id = route.id AND rate.weight_band_id = weight.id
      ORDER BY route.destination_state
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM shipping_routes)::integer AS route_count,
        (SELECT COUNT(*) FROM shipping_route_overrides WHERE enabled = TRUE)::integer AS override_count,
        (SELECT COUNT(*) FROM logistics_locations WHERE active = TRUE)::integer AS active_pickup_count,
        (SELECT MAX(calculated_at) FROM shipping_route_rates) AS last_recalculation
    `),
  ]);

  const mapBand = (row) => ({ ...row, price_component: fromKobo(row.price_component_kobo), surcharge: fromKobo(row.surcharge_kobo) });
  return {
    settings: settings.rows[0],
    distanceBands: distanceBands.rows.map(mapBand),
    weightBands: weightBands.rows.map(mapBand),
    regionRules: regionRules.rows,
    routes: routes.rows.map((row) => ({
      ...row,
      pickupPrice: fromKobo(row.effective_pickup_kobo),
      homePrice: fromKobo(row.effective_home_kobo),
      calculatedPickupPrice: fromKobo(row.calculated_pickup_kobo),
      calculatedHomePrice: fromKobo(row.calculated_home_kobo),
    })),
    status: status.rows[0],
  };
}

async function updateDeliverySettings(payload = {}, adminId = null) {
  const currentResult = await pool.query("SELECT * FROM shipping_settings WHERE id = TRUE");
  const current = currentResult.rows[0];
  const originState = payload.originState
    ? normalizeNigerianState(payload.originState)
    : current.origin_state;
  const stateResult = await pool.query(
    "SELECT 1 FROM shipping_areas WHERE state_name = $1 AND active = TRUE",
    [originState]
  );
  if (!stateResult.rows.length) throw new Error("Choose a valid Nigerian origin state.");

  const numeric = (value, fallback, field) => {
    if (value === undefined || value === null || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid number.`);
    return parsed;
  };

  const values = {
    originState,
    baseFeeKobo: payload.baseFee === undefined ? current.base_fee_kobo : toKobo(payload.baseFee),
    defaultWeightGrams: Math.round(numeric(payload.defaultWeightGrams, current.default_weight_grams, "Default weight")),
    pickupMultiplierBps: Math.round(numeric(payload.pickupMultiplier, current.pickup_multiplier_bps / 10000, "Pickup multiplier") * 10000),
    homeMultiplierBps: Math.round(numeric(payload.homeMultiplier, current.home_multiplier_bps / 10000, "Home multiplier") * 10000),
    homeLastMileKobo: payload.homeLastMile === undefined ? current.home_last_mile_kobo : toKobo(payload.homeLastMile),
    globalPickupBps: Math.round(numeric(payload.globalPickupAdjustmentPercent, current.global_pickup_adjustment_bps / 100, "Pickup adjustment") * 100),
    globalHomeBps: Math.round(numeric(payload.globalHomeAdjustmentPercent, current.global_home_adjustment_bps / 100, "Home adjustment") * 100),
  };

  await pool.query(
    `UPDATE shipping_settings SET
      origin_state=$1, base_fee_kobo=$2, default_weight_grams=$3,
      pickup_multiplier_bps=$4, home_multiplier_bps=$5, home_last_mile_kobo=$6,
      global_pickup_adjustment_bps=$7, global_home_adjustment_bps=$8,
      updated_by=$9, updated_at=NOW()
     WHERE id=TRUE`,
    [
      values.originState, values.baseFeeKobo, values.defaultWeightGrams,
      values.pickupMultiplierBps, values.homeMultiplierBps, values.homeLastMileKobo,
      values.globalPickupBps, values.globalHomeBps, adminId,
    ]
  );
  await recalculateDeliveryRates({ adminId, reason: "settings_update" });
  return getDeliveryEngineOverview();
}

async function updatePricingBand(type, bandId, payload = {}, adminId = null) {
  if (!/^[0-9a-fA-F-]{36}$/.test(String(bandId || ""))) throw new Error("Invalid pricing band.");
  if (type === "distance") {
    const price = Number(payload.priceComponent ?? payload.price_component);
    if (!Number.isFinite(price) || price < 0) throw new Error("Distance price must be a non-negative amount.");
    const result = await pool.query(
      `UPDATE shipping_distance_bands SET price_component_kobo=$2,label=COALESCE(NULLIF($3,''),label),
       active=COALESCE($4,active),updated_at=NOW() WHERE id=$1 RETURNING *`,
      [bandId, toKobo(price), payload.label || "", payload.active]
    );
    if (!result.rows[0]) throw new Error("Distance band not found.");
  } else if (type === "weight") {
    const surcharge = Number(payload.surcharge);
    if (!Number.isFinite(surcharge) || surcharge < 0) throw new Error("Weight surcharge must be a non-negative amount.");
    const result = await pool.query(
      `UPDATE shipping_weight_bands SET surcharge_kobo=$2,label=COALESCE(NULLIF($3,''),label),
       active=COALESCE($4,active),updated_at=NOW() WHERE id=$1 RETURNING *`,
      [bandId, toKobo(surcharge), payload.label || "", payload.active]
    );
    if (!result.rows[0]) throw new Error("Weight band not found.");
  } else {
    throw new Error("Unknown pricing band type.");
  }
  await recalculateDeliveryRates({ adminId, reason: `${type}_band_update:${bandId}` });
}

async function updateRegionRule(region, payload = {}, adminId = null) {
  const adjustmentPercent = Number(payload.adjustmentPercent ?? payload.adjustment_percent);
  if (!Number.isFinite(adjustmentPercent) || adjustmentPercent < -90 || adjustmentPercent > 500) {
    throw new Error("Regional adjustment must be between -90% and 500%.");
  }
  const result = await pool.query(
    `UPDATE shipping_region_rules SET adjustment_bps=$2,active=COALESCE($3,active),
     updated_by=$4,updated_at=NOW() WHERE region=$1 RETURNING *`,
    [region, Math.round(adjustmentPercent * 100), payload.active, adminId]
  );
  if (!result.rows[0]) throw new Error("Shipping region not found.");
  await recalculateDeliveryRates({ adminId, reason: `region_update:${region}` });
}

async function setRouteOverride(routeId, payload = {}, adminId = null) {
  if (!/^[0-9a-fA-F-]{36}$/.test(String(routeId || ""))) {
    throw new Error("Invalid delivery route.");
  }
  const pickupKobo = payload.pickupPrice === undefined || payload.pickupPrice === ""
    ? null : toKobo(payload.pickupPrice);
  const homeKobo = payload.homePrice === undefined || payload.homePrice === ""
    ? null : toKobo(payload.homePrice);
  if (pickupKobo === null && homeKobo === null) {
    throw new Error("Enter a pickup or home delivery override price.");
  }
  await pool.query(
    `INSERT INTO shipping_route_overrides
      (route_id, pickup_price_kobo, home_price_kobo, enabled, reason, updated_by)
     VALUES ($1,$2,$3,TRUE,$4,$5)
     ON CONFLICT (route_id) DO UPDATE SET
      pickup_price_kobo=EXCLUDED.pickup_price_kobo,
      home_price_kobo=EXCLUDED.home_price_kobo,
      enabled=TRUE, reason=EXCLUDED.reason, updated_by=EXCLUDED.updated_by, updated_at=NOW()`,
    [routeId, pickupKobo, homeKobo, normalizeOptionalText(payload.reason), adminId]
  );
  await recalculateDeliveryRates({ adminId, reason: `route_override:${routeId}` });
}

async function resetRouteOverride(routeId, adminId = null) {
  await pool.query(
    "UPDATE shipping_route_overrides SET enabled=FALSE, updated_by=$2, updated_at=NOW() WHERE route_id=$1",
    [routeId, adminId]
  );
  await recalculateDeliveryRates({ adminId, reason: `route_reset:${routeId}` });
}

async function savePickupLocation(payload = {}, adminId = null, locationId = null) {
  const values = {
    provider: String(payload.provider || "GIG_LOGISTICS").trim().toUpperCase(),
    state: normalizeNigerianState(payload.state),
    city: String(payload.city || "").trim(),
    area: normalizeOptionalText(payload.area),
    branchName: String(payload.branchName || payload.branch_name || "").trim(),
    fullAddress: String(payload.fullAddress || payload.full_address || "").trim(),
    latitude: payload.latitude === "" || payload.latitude === undefined ? null : Number(payload.latitude),
    longitude: payload.longitude === "" || payload.longitude === undefined ? null : Number(payload.longitude),
    active: parseBoolean(payload.active, true),
    lastVerifiedAt: payload.lastVerifiedAt || payload.last_verified_at || null,
  };
  if (!values.state || !values.city || !values.branchName || !values.fullAddress) {
    throw new Error("State, city, branch name, and full address are required.");
  }
  if (locationId) {
    const result = await pool.query(
      `UPDATE logistics_locations SET provider=$2,state=$3,city=$4,area=$5,branch_name=$6,
       full_address=$7,latitude=$8,longitude=$9,active=$10,last_verified_at=$11,updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [locationId, values.provider, values.state, values.city, values.area, values.branchName,
        values.fullAddress, values.latitude, values.longitude, values.active, values.lastVerifiedAt]
    );
    if (!result.rows[0]) throw new Error("Pickup location not found.");
    return result.rows[0];
  }
  const result = await pool.query(
    `INSERT INTO logistics_locations
      (provider,state,city,area,branch_name,full_address,latitude,longitude,active,last_verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [values.provider, values.state, values.city, values.area, values.branchName,
      values.fullAddress, values.latitude, values.longitude, values.active, values.lastVerifiedAt]
  );
  await pool.query(
    `INSERT INTO delivery_audit_log (action,entity_type,entity_id,new_value,admin_id)
     VALUES ('CREATE','logistics_location',$1,$2,$3)`,
    [result.rows[0].id, result.rows[0], adminId]
  );
  return result.rows[0];
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
  displayCurrency = "NGN",
  exchangeRate = 1,
  exchangeRateTimestamp = null,
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

  const snapshotFields = [
    ["delivery_method", deliveryQuote?.deliveryMethod || null],
    ["origin_state", deliveryQuote?.originState || null],
    ["destination_state", deliveryQuote?.destinationState || normalizeOptionalText(state)],
    ["pickup_location_id", deliveryQuote?.pickupLocation?.id || null],
    ["pickup_branch_name_snapshot", deliveryQuote?.pickupLocation?.branchName || null],
    ["pickup_address_snapshot", deliveryQuote?.pickupLocation?.fullAddress || null],
    ["delivery_fee_ngn", Number(deliveryQuote?.deliveryFee || 0)],
    ["display_currency", String(displayCurrency || "NGN").toUpperCase()],
    ["exchange_rate_used", Number(exchangeRate || 1)],
    [
      "converted_delivery_fee",
      Number(deliveryQuote?.deliveryFee || 0) / Number(exchangeRate || 1),
    ],
    ["exchange_rate_timestamp", exchangeRateTimestamp],
    ["shipping_formula_version", deliveryQuote?.formulaVersion || null],
    ["shipment_weight_grams", deliveryQuote?.shipmentWeightGrams || null],
  ];

  for (const [column, value] of snapshotFields) {
    if (columns.has(column)) fields.push({ column, value });
  }

  return fields;
}

module.exports = {
  DEFAULT_DELIVERY_FEE,
  buildOrderDeliveryFields,
  getExistingOrderDeliveryColumns,
  createDeliveryZone,
  DELIVERY_METHODS,
  ensurePickupLocationsSeeded,
  getAutomatedDeliveryQuote,
  getDeliveryEngineOverview,
  getDeliveryOverview,
  getDeliveryQuote,
  getPickupLocations,
  getShippingStates,
  recalculateDeliveryRates,
  resetRouteOverride,
  savePickupLocation,
  setRouteOverride,
  updateDeliverySettings,
  updatePricingBand,
  updateRegionRule,
  updateDeliveryZone,
};
