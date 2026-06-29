const pool = require("../config/db");

const RELATIONSHIP_TYPES = [
  "related",
  "cross_sell",
  "frequently_bought",
  "bundle",
  "upsell",
];

function isMissingSchemaError(error) {
  return ["42P01", "42703"].includes(error.code);
}

async function runOptionalQuery(query, params = [], fallback = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return fallback;
    }

    throw error;
  }
}

function normalizeProduct(product) {
  if (!product) return null;

  const stockQuantity = Number(product.stock_quantity || 0);
  const isActive = product.is_active !== false;
  const isPublished = product.status === "active";
  const isAvailable = isActive && isPublished && stockQuantity > 0;

  return {
    ...product,
    price: Number(product.price || 0),
    stock_quantity: stockQuantity,
    stockStatus:
      stockQuantity <= 0
        ? "out_of_stock"
        : stockQuantity <= Number(product.low_stock_threshold || 20)
          ? "low_stock"
          : "in_stock",
    stock_status:
      stockQuantity <= 0
        ? "out_of_stock"
        : stockQuantity <= Number(product.low_stock_threshold || 20)
          ? "low_stock"
          : "in_stock",
    is_available: isAvailable,
    can_purchase: isAvailable,
  };
}

function uniqueByProductId(products = []) {
  const seen = new Set();
  const unique = [];

  for (const product of products) {
    if (!product?.id || seen.has(product.id)) continue;
    seen.add(product.id);
    unique.push(product);
  }

  return unique;
}

function parseProductIds(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getActiveProductsByIds(productIds = []) {
  if (!productIds.length) return [];

  const rows = await pool.query(
    `
      SELECT *
      FROM products
      WHERE id = ANY($1::uuid[])
        AND COALESCE(is_active, TRUE) = TRUE
        AND status = 'active'
        AND COALESCE(stock_quantity, 0) > 0
    `,
    [productIds]
  );

  return rows.rows.map(normalizeProduct);
}

async function getFallbackProducts({ excludeIds = [], limit = 4 } = {}) {
  const rows = await pool.query(
    `
      SELECT *
      FROM products
      WHERE COALESCE(is_active, TRUE) = TRUE
        AND status = 'active'
        AND COALESCE(stock_quantity, 0) > 0
        AND NOT (id = ANY($1::uuid[]))
      ORDER BY is_featured DESC NULLS LAST, created_at DESC
      LIMIT $2
    `,
    [excludeIds, limit]
  );

  return rows.rows.map(normalizeProduct);
}

async function getManualPairingProducts({
  sourceProductIds = [],
  relationshipTypes = [],
  excludeIds = [],
  limit = 8,
} = {}) {
  if (!sourceProductIds.length || !relationshipTypes.length) return [];

  const rows = await runOptionalQuery(
    `
      SELECT
        target.*,
        pairing.relationship_type,
        pairing.label AS pairing_label,
        pairing.priority AS pairing_priority
      FROM product_sales_pairings pairing
      JOIN products target ON target.id = pairing.target_product_id
      WHERE pairing.source_product_id = ANY($1::uuid[])
        AND pairing.relationship_type = ANY($2::text[])
        AND COALESCE(pairing.is_active, TRUE) = TRUE
        AND COALESCE(target.is_active, TRUE) = TRUE
        AND target.status = 'active'
        AND COALESCE(target.stock_quantity, 0) > 0
        AND NOT (target.id = ANY($3::uuid[]))
      ORDER BY pairing.priority ASC, pairing.created_at DESC
      LIMIT $4
    `,
    [sourceProductIds, relationshipTypes, excludeIds, limit],
    []
  );

  return rows.map(normalizeProduct);
}

async function getOrderBasedProducts({
  sourceProductIds = [],
  excludeIds = [],
  limit = 8,
} = {}) {
  if (!sourceProductIds.length) return [];

  const rows = await runOptionalQuery(
    `
      WITH source_orders AS (
        SELECT DISTINCT order_id
        FROM order_items
        WHERE product_id = ANY($1::uuid[])
      ),
      pair_scores AS (
        SELECT
          item.product_id,
          COUNT(*)::int AS score
        FROM order_items item
        JOIN source_orders source_order ON source_order.order_id = item.order_id
        WHERE item.product_id IS NOT NULL
          AND NOT (item.product_id = ANY($2::uuid[]))
        GROUP BY item.product_id
      )
      SELECT product.*, pair_scores.score
      FROM pair_scores
      JOIN products product ON product.id = pair_scores.product_id
      WHERE COALESCE(product.is_active, TRUE) = TRUE
        AND product.status = 'active'
        AND COALESCE(product.stock_quantity, 0) > 0
      ORDER BY pair_scores.score DESC, product.created_at DESC
      LIMIT $3
    `,
    [sourceProductIds, excludeIds, limit],
    []
  );

  return rows.map(normalizeProduct);
}

async function getFrequentlyBoughtTogether(productId, limit = 3) {
  const sourceIds = productId ? [productId] : [];
  const products = await getOrderBasedProducts({
    sourceProductIds: sourceIds,
    excludeIds: sourceIds,
    limit,
  });

  if (products.length) return products;

  const manualProducts = await getManualPairingProducts({
    sourceProductIds: sourceIds,
    relationshipTypes: ["frequently_bought", "bundle"],
    excludeIds: sourceIds,
    limit,
  });

  return manualProducts.length
    ? manualProducts
    : getFallbackProducts({ excludeIds: sourceIds, limit });
}

async function getProductRecommendations(productId, { limit = 4 } = {}) {
  const sourceIds = productId ? [productId] : [];
  const excludeIds = [...sourceIds];

  const manualRelated = await getManualPairingProducts({
    sourceProductIds: sourceIds,
    relationshipTypes: ["related"],
    excludeIds,
    limit,
  });

  const orderRelated = await getOrderBasedProducts({
    sourceProductIds: sourceIds,
    excludeIds: [...excludeIds, ...manualRelated.map((item) => item.id)],
    limit,
  });

  const relatedProducts = uniqueByProductId([
    ...manualRelated,
    ...orderRelated,
    ...(await getFallbackProducts({
      excludeIds: [
        ...excludeIds,
        ...manualRelated.map((item) => item.id),
        ...orderRelated.map((item) => item.id),
      ],
      limit,
    })),
  ]).slice(0, limit);

  const frequentlyBoughtTogether = (
    await getFrequentlyBoughtTogether(productId, 3)
  ).slice(0, 3);

  const upsells = uniqueByProductId([
    ...(await getManualPairingProducts({
      sourceProductIds: sourceIds,
      relationshipTypes: ["upsell"],
      excludeIds,
      limit,
    })),
    ...relatedProducts,
  ]).slice(0, limit);

  const bundles = uniqueByProductId([
    ...(await getManualPairingProducts({
      sourceProductIds: sourceIds,
      relationshipTypes: ["bundle"],
      excludeIds,
      limit: 3,
    })),
    ...frequentlyBoughtTogether,
  ]).slice(0, 3);

  return {
    relatedProducts,
    frequentlyBoughtTogether,
    upsells,
    bundles,
  };
}

async function getCartRecommendations({ cartProductIds = [], limit = 4 } = {}) {
  const sourceIds = parseProductIds(cartProductIds);
  const manualCrossSells = await getManualPairingProducts({
    sourceProductIds: sourceIds,
    relationshipTypes: ["cross_sell", "upsell"],
    excludeIds: sourceIds,
    limit,
  });
  const orderProducts = await getOrderBasedProducts({
    sourceProductIds: sourceIds,
    excludeIds: [...sourceIds, ...manualCrossSells.map((item) => item.id)],
    limit,
  });
  const crossSells = uniqueByProductId([
    ...manualCrossSells,
    ...orderProducts,
    ...(await getFallbackProducts({
      excludeIds: [
        ...sourceIds,
        ...manualCrossSells.map((item) => item.id),
        ...orderProducts.map((item) => item.id),
      ],
      limit,
    })),
  ]).slice(0, limit);

  return {
    crossSells,
    upsells: crossSells.slice(0, 2),
  };
}

async function listAdminPairings() {
  const rows = await runOptionalQuery(
    `
      SELECT
        pairing.*,
        source.name AS source_product_name,
        source.image_url AS source_product_image,
        target.name AS target_product_name,
        target.image_url AS target_product_image,
        target.price AS target_product_price,
        target.stock_quantity AS target_product_stock_quantity
      FROM product_sales_pairings pairing
      JOIN products source ON source.id = pairing.source_product_id
      JOIN products target ON target.id = pairing.target_product_id
      ORDER BY pairing.relationship_type ASC, pairing.priority ASC, pairing.created_at DESC
    `,
    [],
    []
  );

  return rows;
}

async function createAdminPairing({
  sourceProductId,
  targetProductId,
  relationshipType,
  label,
  priority,
  isActive = true,
} = {}) {
  if (!sourceProductId || !targetProductId) {
    const error = new Error("Source and target products are required.");
    error.statusCode = 400;
    throw error;
  }

  if (sourceProductId === targetProductId) {
    const error = new Error("Choose two different products.");
    error.statusCode = 400;
    throw error;
  }

  if (!RELATIONSHIP_TYPES.includes(relationshipType)) {
    const error = new Error("Unsupported product sales relationship type.");
    error.statusCode = 400;
    throw error;
  }

  const rows = await runOptionalQuery(
    `
      INSERT INTO product_sales_pairings (
        source_product_id,
        target_product_id,
        relationship_type,
        label,
        priority,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (source_product_id, target_product_id, relationship_type)
      DO UPDATE SET
        label = EXCLUDED.label,
        priority = EXCLUDED.priority,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [
      sourceProductId,
      targetProductId,
      relationshipType,
      label || null,
      Number(priority || 20),
      isActive !== false,
    ],
    []
  );

  if (!rows.length) {
    const error = new Error(
      "Product sales pairings table is not configured. Apply the Phase 14 migration draft."
    );
    error.statusCode = 503;
    throw error;
  }

  return rows[0];
}

async function deleteAdminPairing(pairingId) {
  const rows = await runOptionalQuery(
    `
      DELETE FROM product_sales_pairings
      WHERE id = $1
      RETURNING id
    `,
    [pairingId],
    []
  );

  return rows[0] || null;
}

module.exports = {
  RELATIONSHIP_TYPES,
  createAdminPairing,
  deleteAdminPairing,
  getActiveProductsByIds,
  getCartRecommendations,
  getProductRecommendations,
  listAdminPairings,
};
