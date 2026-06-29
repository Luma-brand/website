const pool = require("../config/db");
const { buildCartPricingSnapshot } = require("./inventoryService");

const DISCOUNT_ORDER_COLUMNS = [
  "discount_code_id",
  "discount_code",
  "discount_amount",
  "subtotal_amount",
  "final_amount",
];

function normalizeDiscountCode(code) {
  return String(code || "").trim().toUpperCase();
}

function normalizeDiscountType(type) {
  if (type === "fixed_amount") return "fixed";
  return type;
}

function normalizeMoney(value, fallback = 0) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return fallback;
  }

  return Math.round(amount * 100) / 100;
}

function isMissingSchemaError(error) {
  return error?.code === "42P01" || error?.code === "42703";
}

function buildServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getExistingOrderDiscountColumns({ refresh = false } = {}) {
  const now = Date.now();

  if (
    !refresh &&
    cachedOrderDiscountColumns &&
    now - cachedOrderDiscountColumnsAt < ORDER_DISCOUNT_COLUMN_CACHE_MS
  ) {
    return new Set(cachedOrderDiscountColumns);
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
      [DISCOUNT_ORDER_COLUMNS]
    );

    cachedOrderDiscountColumns = result.rows.map((row) => row.column_name);
    cachedOrderDiscountColumnsAt = now;

    return new Set(cachedOrderDiscountColumns);
  } catch (error) {
    console.error("Order discount column inspection failed:", pool.describeError ? pool.describeError(error) : error.message);
    return new Set();
  }
}

async function getFreeShippingThreshold({ client = pool } = {}) {
  try {
    const result = await client.query(
      `
        SELECT value
        FROM commerce_settings
        WHERE key = 'free_shipping_threshold'
        LIMIT 1
      `
    );

    const configuredValue = result.rows[0]?.value;
    const threshold = normalizeMoney(
      configuredValue,
      normalizeMoney(process.env.FREE_SHIPPING_THRESHOLD, 0)
    );

    return threshold > 0 ? threshold : null;
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const threshold = normalizeMoney(process.env.FREE_SHIPPING_THRESHOLD, 0);
      return threshold > 0 ? threshold : null;
    }

    throw error;
  }
}

async function setFreeShippingThreshold(value, { client = pool } = {}) {
  const threshold = normalizeMoney(value, 0);

  await client.query(
    `
      INSERT INTO commerce_settings (key, value, updated_at)
      VALUES ('free_shipping_threshold', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `,
    [threshold > 0 ? String(threshold) : ""]
  );

  return getFreeShippingThreshold({ client });
}

function formatDiscountCode(row) {
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: normalizeDiscountType(row.discount_type),
    discountValue: Number(row.discount_value || 0),
    minimumOrderAmount: Number(row.minimum_order_amount || 0),
    usageLimit: row.usage_limit,
    usedCount: Number(row.used_count || 0),
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDiscountCodes({ client = pool } = {}) {
  try {
    const result = await client.query(
      `
        SELECT *
        FROM discount_codes
        ORDER BY created_at DESC
      `
    );

    return result.rows.map(formatDiscountCode);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return [];
    }

    throw error;
  }
}

function validateDiscountPayload(payload = {}, { isUpdate = false } = {}) {
  const code = normalizeDiscountCode(payload.code);
  const discountType = normalizeDiscountType(
    payload.discountType || payload.discount_type
  );
  const discountValue = normalizeMoney(
    payload.discountValue ?? payload.discount_value,
    -1
  );
  const minimumOrderAmount = normalizeMoney(
    payload.minimumOrderAmount ?? payload.minimum_order_amount,
    0
  );
  const rawUsageLimit = payload.usageLimit ?? payload.usage_limit;
  const usageLimit =
    rawUsageLimit === "" || rawUsageLimit === null || rawUsageLimit === undefined
      ? null
      : Number(rawUsageLimit);
  const rawExpiresAt = payload.expiresAt ?? payload.expires_at;
  const rawStartsAt = payload.startsAt ?? payload.starts_at;
  const startsAt = rawStartsAt ? new Date(rawStartsAt) : null;
  const expiresAt = rawExpiresAt ? new Date(rawExpiresAt) : null;

  if (!isUpdate && !code) {
    throw buildServiceError("Discount code is required.");
  }

  if (!isUpdate && !["percentage", "fixed"].includes(discountType)) {
    throw buildServiceError("Discount type must be percentage or fixed.");
  }

  if (discountType && !["percentage", "fixed"].includes(discountType)) {
    throw buildServiceError("Discount type must be percentage or fixed.");
  }

  if (payload.discountValue !== undefined || payload.discount_value !== undefined || !isUpdate) {
    if (discountValue <= 0) {
      throw buildServiceError("Discount value must be greater than 0.");
    }

    if (discountType === "percentage" && discountValue > 100) {
      throw buildServiceError("Percentage discount cannot be more than 100%.");
    }
  }

  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
    throw buildServiceError("Usage limit must be a positive whole number.");
  }

  if (startsAt && Number.isNaN(startsAt.getTime())) {
    throw buildServiceError("Start date is invalid.");
  }

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw buildServiceError("Expiry date is invalid.");
  }

  return {
    code,
    description:
      payload.description === undefined ? undefined : String(payload.description || "").trim(),
    discountType,
    discountValue,
    minimumOrderAmount,
    usageLimit,
    startsAt,
    expiresAt,
    isActive:
      payload.isActive === undefined && payload.is_active === undefined
        ? undefined
        : Boolean(payload.isActive ?? payload.is_active),
  };
}

async function createDiscountCode(payload, { client = pool } = {}) {
  const data = validateDiscountPayload(payload);

  try {
    const result = await client.query(
      `
        INSERT INTO discount_codes (
          code,
          description,
          discount_type,
          discount_value,
          minimum_order_amount,
          usage_limit,
          starts_at,
          expires_at,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        data.code,
        data.description || null,
        data.discountType,
        data.discountValue,
        data.minimumOrderAmount,
        data.usageLimit,
        data.startsAt,
        data.expiresAt,
        data.isActive !== false,
      ]
    );

    return formatDiscountCode(result.rows[0]);
  } catch (error) {
    if (error?.code === "23505") {
      throw buildServiceError("A discount code with this code already exists.");
    }

    if (isMissingSchemaError(error)) {
      throw buildServiceError("Discount tables are not configured. Apply the Phase 9 migration first.", 500);
    }

    throw error;
  }
}

async function updateDiscountCode(discountId, payload, { client = pool } = {}) {
  const data = validateDiscountPayload(payload, { isUpdate: true });
  const updates = [];
  const values = [];

  function addUpdate(column, value) {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  }

  if (data.code) addUpdate("code", data.code);
  if (data.description !== undefined) addUpdate("description", data.description || null);
  if (data.discountType) addUpdate("discount_type", data.discountType);
  if (payload.discountValue !== undefined || payload.discount_value !== undefined) {
    addUpdate("discount_value", data.discountValue);
  }
  if (
    payload.minimumOrderAmount !== undefined ||
    payload.minimum_order_amount !== undefined
  ) {
    addUpdate("minimum_order_amount", data.minimumOrderAmount);
  }
  if (payload.usageLimit !== undefined || payload.usage_limit !== undefined) {
    addUpdate("usage_limit", data.usageLimit);
  }
  if (payload.startsAt !== undefined || payload.starts_at !== undefined) {
    addUpdate("starts_at", data.startsAt);
  }
  if (payload.expiresAt !== undefined || payload.expires_at !== undefined) {
    addUpdate("expires_at", data.expiresAt);
  }
  if (data.isActive !== undefined) addUpdate("is_active", data.isActive);

  if (updates.length === 0) {
    throw buildServiceError("No discount fields were provided.");
  }

  values.push(discountId);

  try {
    const result = await client.query(
      `
        UPDATE discount_codes
        SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${values.length}
        RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      throw buildServiceError("Discount code not found.", 404);
    }

    return formatDiscountCode(result.rows[0]);
  } catch (error) {
    if (error?.code === "23505") {
      throw buildServiceError("A discount code with this code already exists.");
    }

    if (isMissingSchemaError(error)) {
      throw buildServiceError("Discount tables are not configured. Apply the Phase 9 migration first.", 500);
    }

    throw error;
  }
}

async function disableDiscountCode(discountId, { client = pool } = {}) {
  return updateDiscountCode(discountId, { isActive: false }, { client });
}

async function enableDiscountCode(discountId, { client = pool } = {}) {
  return updateDiscountCode(discountId, { isActive: true }, { client });
}

async function getDiscountCodeById(discountId, { client = pool } = {}) {
  const result = await client.query(
    `
      SELECT *
      FROM discount_codes
      WHERE id = $1
      LIMIT 1
    `,
    [discountId]
  );

  return formatDiscountCode(result.rows[0]);
}

async function deleteDiscountCode(discountId, { client = pool } = {}) {
  const discount = await getDiscountCodeById(discountId, { client });

  if (!discount) {
    throw buildServiceError("Discount code not found.", 404);
  }

  if (Number(discount.usedCount || 0) > 0) {
    return disableDiscountCode(discountId, { client });
  }

  const result = await client.query(
    `
      DELETE FROM discount_codes
      WHERE id = $1
      RETURNING *
    `,
    [discountId]
  );

  return formatDiscountCode(result.rows[0]);
}

function calculateDiscountAmount(discount, subtotalAmount) {
  if (!discount) return 0;

  if (discount.discount_type === "percentage") {
    return normalizeMoney(subtotalAmount * (Number(discount.discount_value) / 100));
  }

  return normalizeMoney(Math.min(subtotalAmount, Number(discount.discount_value)));
}

async function validateDiscountCode({
  code,
  subtotal,
  subtotalAmount,
  customerId,
  client = pool,
} = {}) {
  const normalizedCode = normalizeDiscountCode(code);

  if (!normalizedCode) {
    throw buildServiceError("Discount code is required.");
  }

  let result;

  try {
    result = await client.query(
      `
        SELECT *
        FROM discount_codes
        WHERE LOWER(code) = LOWER($1)
        LIMIT 1
      `,
      [normalizedCode]
    );
  } catch (error) {
    if (isMissingSchemaError(error)) {
      throw buildServiceError("Discount codes are not configured yet.");
    }

    throw error;
  }

  const discount = result.rows[0];

  if (!discount) {
    throw buildServiceError("Discount code was not found.");
  }

  if (!discount.is_active) {
    throw buildServiceError("This discount code is inactive.");
  }

  if (discount.starts_at && new Date(discount.starts_at) > new Date()) {
    throw buildServiceError("This discount code is not active yet.");
  }

  if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
    throw buildServiceError("This discount code has expired.");
  }

  const discountType = normalizeDiscountType(discount.discount_type);
  const discountValue = Number(discount.discount_value || 0);

  if (discountType === "percentage" && (discountValue <= 0 || discountValue > 100)) {
    throw buildServiceError("This percentage discount is misconfigured.");
  }

  if (discountType === "fixed" && discountValue <= 0) {
    throw buildServiceError("This fixed discount is misconfigured.");
  }

  if (
    discount.usage_limit !== null &&
    Number(discount.used_count || 0) >= Number(discount.usage_limit)
  ) {
    throw buildServiceError("This discount code has reached its usage limit.");
  }

  const minimumOrderAmount = Number(discount.minimum_order_amount || 0);
  const productSubtotal = Number(subtotal ?? subtotalAmount ?? 0);

  if (productSubtotal < minimumOrderAmount) {
    throw buildServiceError(
      `This discount requires a minimum order of ₦${minimumOrderAmount.toLocaleString()}.`
    );
  }

  return {
    discount,
    discountCode: discount.code,
    discountAmount: calculateDiscountAmount(discount, productSubtotal),
    customerId: customerId || null,
  };
}

async function calculateOrderPricing({
  items = [],
  deliveryFee = 0,
  discountCode = "",
  client = pool,
} = {}) {
  const initialSnapshot = await buildCartPricingSnapshot(items, {
    client,
    deliveryFee,
  });

  if (!initialSnapshot.isValid) {
    return {
      ...initialSnapshot,
      discountCode: null,
      discountAmount: 0,
      freeShipping: false,
      freeShippingThreshold: await getFreeShippingThreshold({ client }),
    };
  }

  const freeShippingThreshold = await getFreeShippingThreshold({ client });
  const freeShipping =
    Boolean(freeShippingThreshold) &&
    initialSnapshot.subtotalAmount >= freeShippingThreshold;
  const effectiveDeliveryFee = freeShipping
    ? 0
    : normalizeMoney(initialSnapshot.deliveryFee, 0);
  const normalizedDiscountCode = normalizeDiscountCode(discountCode);
  const discount = normalizedDiscountCode
    ? await validateDiscountCode({
        code: normalizedDiscountCode,
        subtotalAmount: initialSnapshot.subtotalAmount,
        client,
      })
    : {
        discount: null,
        discountCode: null,
        discountAmount: 0,
      };
  const totalAmount = normalizeMoney(
    Math.max(0, initialSnapshot.subtotalAmount - discount.discountAmount) +
      effectiveDeliveryFee
  );

  return {
    ...initialSnapshot,
    deliveryFee: effectiveDeliveryFee,
    totalAmount,
    discountCode: discount.discountCode,
    discountCodeId: discount.discount?.id || null,
    discountAmount: discount.discountAmount,
    freeShipping,
    freeShippingThreshold,
  };
}

async function buildOrderDiscountFields({ pricing, existingColumns } = {}) {
  const existing = existingColumns instanceof Set
    ? existingColumns
    : await getExistingOrderDiscountColumns();
  const hasDiscount = Boolean(pricing?.discountCodeId);

  if (hasDiscount) {
    const missingColumns = DISCOUNT_ORDER_COLUMNS.filter(
      (column) => !existing.has(column)
    );

    if (missingColumns.length > 0) {
      throw buildServiceError(
        "Discount order columns are not configured. Apply the Phase 9 migration before accepting discount payments.",
        500
      );
    }
  }

  const fields = [];

  if (existing.has("subtotal_amount")) {
    fields.push({
      column: "subtotal_amount",
      value: normalizeMoney(pricing?.subtotalAmount, 0),
    });
  }

  if (existing.has("discount_code_id")) {
    fields.push({
      column: "discount_code_id",
      value: pricing?.discountCodeId || null,
    });
  }

  if (existing.has("discount_code")) {
    fields.push({
      column: "discount_code",
      value: pricing?.discountCode || null,
    });
  }

  if (existing.has("discount_amount")) {
    fields.push({
      column: "discount_amount",
      value: normalizeMoney(pricing?.discountAmount, 0),
    });
  }

  if (existing.has("final_amount")) {
    fields.push({
      column: "final_amount",
      value: normalizeMoney(pricing?.totalAmount, 0),
    });
  }

  return fields;
}

async function incrementDiscountUsage({ client = pool, discountCodeId } = {}) {
  if (!discountCodeId) return;

  try {
    await client.query(
      `
        UPDATE discount_codes
        SET used_count = used_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [discountCodeId]
    );
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }
  }
}

module.exports = {
  buildOrderDiscountFields,
  calculateDiscountAmount,
  calculateOrderPricing,
  createDiscountCode,
  deleteDiscountCode,
  disableDiscountCode,
  enableDiscountCode,
  getDiscountCodeById,
  getDiscountCodes,
  getExistingOrderDiscountColumns,
  getFreeShippingThreshold,
  incrementDiscountUsage,
  listDiscountCodes: getDiscountCodes,
  normalizeCode: normalizeDiscountCode,
  normalizeDiscountCode,
  setFreeShippingThreshold,
  updateDiscountCode,
  validateDiscountCode,
};
