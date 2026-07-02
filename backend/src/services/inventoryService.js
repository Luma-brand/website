const pool = require("../config/db");
const {
  sendBackInStockNotificationsForProduct,
} = require("./growthService");
const { emitStockTransition } = require("./automationEventBridge");

const DEFAULT_LOW_STOCK_THRESHOLD = 20;
const DEFAULT_DELIVERY_FEE = 3000;
const UUID_PATTERN = /^[0-9a-fA-F-]{36}$/;
const OPTIONAL_SCHEMA_ERROR_CODES = ["42P01", "42703"];

function isOptionalSchemaError(error) {
  return OPTIONAL_SCHEMA_ERROR_CODES.includes(error.code);
}

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;

  return ["true", "1", "yes", "active", "visible"].includes(
    String(value).trim().toLowerCase()
  );
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(csvText = "") {
  const lines = String(csvText || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase().replace(/\s+/g, "_")
  );

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const row = { rowNumber: index + 2 };

    headers.forEach((header, cellIndex) => {
      row[header] = cells[cellIndex] || "";
    });

    return row;
  });
}

async function runOptionalQuery(query, params = [], fallback = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    if (isOptionalSchemaError(error)) {
      return fallback;
    }

    throw error;
  }
}

async function getInventoryOverview() {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total_products,
      COALESCE(SUM(stock_quantity), 0)::int AS total_stock_quantity,
      COUNT(*) FILTER (
        WHERE stock_quantity > 0
        AND stock_quantity <= COALESCE(low_stock_threshold, $1)
      )::int AS low_stock_products,
      COUNT(*) FILTER (
        WHERE stock_quantity <= 0
      )::int AS out_of_stock_products,
      COUNT(*) FILTER (
        WHERE is_active = TRUE
      )::int AS active_products,
      COUNT(*) FILTER (
        WHERE is_active = FALSE
      )::int AS inactive_products
    FROM products
  `, [DEFAULT_LOW_STOCK_THRESHOLD]);

  let recentMovements = { rows: [] };

  try {
    recentMovements = await pool.query(`
      SELECT
        im.id,
        im.product_id,
        p.name AS product_name,
        im.order_id,
        im.movement_type,
        im.quantity_changed,
        im.previous_stock,
        im.new_stock,
        im.reason,
        im.created_by,
        im.created_at
      FROM inventory_movements im
      LEFT JOIN products p ON p.id = im.product_id
      ORDER BY im.created_at DESC
      LIMIT 10
    `);
  } catch (error) {
    if (!isOptionalSchemaError(error)) {
      throw error;
    }
  }

  return {
    lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
    totalProducts: result.rows[0]?.total_products || 0,
    totalStockQuantity: result.rows[0]?.total_stock_quantity || 0,
    lowStockProducts: result.rows[0]?.low_stock_products || 0,
    outOfStockProducts: result.rows[0]?.out_of_stock_products || 0,
    activeProducts: result.rows[0]?.active_products || 0,
    inactiveProducts: result.rows[0]?.inactive_products || 0,
    recentMovements: recentMovements.rows,
  };
}

async function getInventorySummary() {
  return getInventoryOverview();
}

async function getInventoryProducts({ search = "", status = "all" } = {}) {
  const values = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`p.name ILIKE $${values.length}`);
  }

  if (status === "low-stock") {
    values.push(DEFAULT_LOW_STOCK_THRESHOLD);
    conditions.push(
      `p.stock_quantity > 0 AND p.stock_quantity <= COALESCE(p.low_stock_threshold, $${values.length})`
    );
  }

  if (status === "out-of-stock") {
    conditions.push("p.stock_quantity <= 0");
  }

  if (status === "in-stock") {
    conditions.push("p.stock_quantity > 0");
  }

  if (status === "inactive") {
    conditions.push("p.is_active = FALSE");
  }

  if (status === "active") {
    conditions.push("p.is_active = TRUE");
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.size,
        p.image_url,
        p.stock_quantity,
        p.low_stock_threshold,
        p.is_active,
        p.is_featured,
        p.created_at,
        p.updated_at,
        CASE
          WHEN p.stock_quantity <= 0 THEN 'out_of_stock'
          WHEN p.stock_quantity <= COALESCE(p.low_stock_threshold, $${values.length + 1}) THEN 'low_stock'
          ELSE 'in_stock'
        END AS stock_status
      FROM products p
      ${whereClause}
      ORDER BY p.created_at DESC
    `,
    [...values, DEFAULT_LOW_STOCK_THRESHOLD]
  );

  return result.rows;
}

async function getLowStockProducts() {
  return getInventoryProducts({ status: "low-stock" });
}

async function getOutOfStockProducts() {
  return getInventoryProducts({ status: "out-of-stock" });
}

async function getStockMovementHistory({ productId, limit = 50 } = {}) {
  const values = [];
  const conditions = [];

  if (productId) {
    values.push(productId);
    conditions.push(`im.product_id = $${values.length}`);
  }

  values.push(Number(limit) || 50);
  const limitPlaceholder = `$${values.length}`;

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
      SELECT
        im.id,
        im.product_id,
        p.name AS product_name,
        im.order_id,
        im.movement_type,
        im.quantity_changed,
        im.previous_stock,
        im.new_stock,
        im.reason,
        im.created_by,
        im.created_at
      FROM inventory_movements im
      LEFT JOIN products p ON p.id = im.product_id
      ${whereClause}
      ORDER BY im.created_at DESC
      LIMIT ${limitPlaceholder}
    `,
    values
  );

  return result.rows;
}

async function createStockMovement({
  client = pool,
  productId,
  orderId = null,
  movementType,
  quantityChanged,
  previousStock,
  newStock,
  reason = null,
  createdBy = null,
  allowOptionalSchema = true,
}) {
  try {
    const result = await client.query(
      `
        INSERT INTO inventory_movements (
          product_id,
          order_id,
          movement_type,
          quantity_changed,
          previous_stock,
          new_stock,
          reason,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        productId,
        orderId,
        movementType,
        quantityChanged,
        previousStock,
        newStock,
        reason,
        createdBy,
      ]
    );

    return result.rows[0];
  } catch (error) {
    if (allowOptionalSchema && isOptionalSchemaError(error)) {
      return null;
    }

    throw error;
  }
}

const logInventoryMovement = createStockMovement;

async function adjustProductStock(productIdOrOptions, adjustmentData = {}) {
  const options =
    typeof productIdOrOptions === "object"
      ? productIdOrOptions
      : {
          productId: productIdOrOptions,
          ...adjustmentData,
        };
  const {
    productId,
    quantity,
    movementType,
    reason,
    createdBy = "admin",
  } = options;
  const parsedQuantity = Number(quantity);
  const resolvedMovementType =
    movementType || (parsedQuantity > 0 ? "stock_added" : "stock_reduced");

  if (!productId) {
    throw new Error("Product ID is required.");
  }

  if (!Number.isInteger(parsedQuantity) || parsedQuantity === 0) {
    throw new Error("Quantity must be a non-zero whole number.");
  }

  if (!resolvedMovementType) {
    throw new Error("Movement type is required.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      `
        SELECT id, name, stock_quantity
        FROM products
        WHERE id = $1
        FOR UPDATE
      `,
      [productId]
    );

    const product = productResult.rows[0];

    if (!product) {
      throw new Error("Product not found.");
    }

    const previousStock = Number(product.stock_quantity || 0);
    const newStock = previousStock + parsedQuantity;

    if (newStock < 0) {
      throw new Error("Stock cannot be reduced below zero.");
    }

    const updatedProductResult = await client.query(
      `
        UPDATE products
        SET stock_quantity = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `,
      [newStock, productId]
    );

    const movement = await createStockMovement({
      client,
      productId,
      movementType: resolvedMovementType,
      quantityChanged: parsedQuantity,
      previousStock,
      newStock,
      reason,
      createdBy,
    });

    await client.query("COMMIT");

    let backInStockNotifications = null;

    if (previousStock <= 0 && newStock > 0) {
      try {
        backInStockNotifications = await sendBackInStockNotificationsForProduct({
          product: updatedProductResult.rows[0],
          previousStock,
          newStock,
        });
      } catch (error) {
        console.error("Back-in-stock notification error:", error.message);
      }
    }

    await emitStockTransition(updatedProductResult.rows[0], previousStock, newStock, {
      source: "inventory_adjustment",
    });


    return {
      product: updatedProductResult.rows[0],
      movement,
      backInStockNotifications,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setProductStock(productId, stockQuantity, options = {}) {
  const parsedStockQuantity = Number(stockQuantity);
  const createdBy = options.createdBy || "admin";
  const reason = options.reason || "Manual stock set";

  if (!productId) {
    throw new Error("Product ID is required.");
  }

  if (!Number.isInteger(parsedStockQuantity) || parsedStockQuantity < 0) {
    throw new Error("Stock quantity must be a whole number and cannot be negative.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      `
        SELECT id, name, stock_quantity
        FROM products
        WHERE id = $1
        FOR UPDATE
      `,
      [productId]
    );

    const product = productResult.rows[0];

    if (!product) {
      throw new Error("Product not found.");
    }

    const previousStock = Number(product.stock_quantity || 0);
    const quantityChanged = parsedStockQuantity - previousStock;

    const updatedProductResult = await client.query(
      `
        UPDATE products
        SET stock_quantity = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `,
      [parsedStockQuantity, productId]
    );

    const movement =
      quantityChanged === 0
        ? null
        : await createStockMovement({
            client,
            productId,
            movementType:
              quantityChanged > 0 ? "stock_added" : "stock_reduced",
            quantityChanged,
            previousStock,
            newStock: parsedStockQuantity,
            reason,
            createdBy,
          });

    await client.query("COMMIT");

    let backInStockNotifications = null;

    if (previousStock <= 0 && parsedStockQuantity > 0) {
      try {
        backInStockNotifications = await sendBackInStockNotificationsForProduct({
          product: updatedProductResult.rows[0],
          previousStock,
          newStock: parsedStockQuantity,
        });
      } catch (error) {
        console.error("Back-in-stock notification error:", error.message);
      }
    }

    await emitStockTransition(updatedProductResult.rows[0], previousStock, parsedStockQuantity, {
      source: "inventory_set",
    });

    return {
      product: updatedProductResult.rows[0],
      movement,
      backInStockNotifications,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function hasOrderAlreadyReducedStock({
  client = pool,
  orderId,
  paymentReference,
  allowOptionalSchema = true,
} = {}) {
  if (!orderId && !paymentReference) {
    return false;
  }

  try {
    const result = await client.query(
      `
        SELECT id
        FROM inventory_movements
        WHERE movement_type = 'order_purchase'
          AND (
            ($1::uuid IS NOT NULL AND order_id = $1::uuid)
            OR (
              $2::text IS NOT NULL
              AND order_id IN (
                SELECT id
                FROM orders
                WHERE COALESCE(payment_reference, paystack_reference) = $2
              )
            )
          )
        LIMIT 1
      `,
      [orderId || null, paymentReference || null]
    );

    return result.rows.length > 0;
  } catch (error) {
    if (allowOptionalSchema && isOptionalSchemaError(error)) {
      return false;
    }

    throw error;
  }
}

async function hasInventoryMovementsTable({ client = pool } = {}) {
  const result = await client.query(
    "SELECT to_regclass('public.inventory_movements') AS table_name"
  );

  return Boolean(result.rows[0]?.table_name);
}

async function reduceStockAfterPaidOrder({
  client = pool,
  orderId,
  paymentReference,
  createdBy = "payment_verification",
} = {}) {
  if (!orderId && !paymentReference) {
    throw new Error("Order ID or payment reference is required.");
  }

  const values = [];
  const conditions = [];

  if (orderId) {
    values.push(orderId);
    conditions.push(`id = $${values.length}`);
  }

  if (paymentReference) {
    values.push(paymentReference);
    conditions.push(`COALESCE(payment_reference, paystack_reference) = $${values.length}`);
  }

  const orderResult = await client.query(
    `
      SELECT *
      FROM orders
      WHERE ${conditions.join(" OR ")}
      FOR UPDATE
    `,
    values
  );

  const order = orderResult.rows[0];

  if (!order) {
    throw new Error("Order not found for stock reduction.");
  }

  const orderHasStockReducedFlag = Object.prototype.hasOwnProperty.call(
    order,
    "stock_reduced"
  );
  const inventoryMovementsTableExists = await hasInventoryMovementsTable({
    client,
  });

  if (!orderHasStockReducedFlag && !inventoryMovementsTableExists) {
    throw new Error(
      "Inventory stock safety migration is required before reducing paid order stock."
    );
  }

  if (order.stock_reduced === true) {
    return {
      success: true,
      alreadyReduced: true,
      issues: [],
      movements: [],
    };
  }

  const alreadyReduced = await hasOrderAlreadyReducedStock({
    client,
    orderId: order.id,
    paymentReference: paymentReference || order.payment_reference || order.paystack_reference,
    allowOptionalSchema: !inventoryMovementsTableExists,
  });

  if (alreadyReduced) {
    if (orderHasStockReducedFlag) {
      await client.query(
        `
          UPDATE orders
          SET stock_reduced = TRUE,
              stock_reduced_at = COALESCE(stock_reduced_at, CURRENT_TIMESTAMP)
          WHERE id = $1
        `,
        [order.id]
      );
    }

    return {
      success: true,
      alreadyReduced: true,
      issues: [],
      movements: [],
    };
  }

  const itemsResult = await client.query(
    `
      SELECT
        product_id,
        MAX(product_name) AS product_name,
        COALESCE(SUM(quantity), 0)::int AS requested_quantity
      FROM order_items
      WHERE order_id = $1
        AND product_id IS NOT NULL
      GROUP BY product_id
    `,
    [order.id]
  );

  const stockIssues = [];
  const lockedProducts = new Map();

  for (const item of itemsResult.rows) {
    const productResult = await client.query(
      `
        SELECT id, name, stock_quantity, is_active, status
        FROM products
        WHERE id = $1
        FOR UPDATE
      `,
      [item.product_id]
    );

    const product = productResult.rows[0];

    if (!product) {
      stockIssues.push({
        productId: item.product_id,
        productName: item.product_name,
        message: "Product no longer exists.",
      });
      continue;
    }

    const previousStock = Number(product.stock_quantity || 0);
    const requestedQuantity = Number(item.requested_quantity || 0);

    if (product.is_active === false || product.status !== "active") {
      stockIssues.push({
        productId: product.id,
        productName: product.name,
        message: `${product.name} is currently unavailable.`,
      });
      continue;
    }

    if (requestedQuantity > previousStock) {
      stockIssues.push({
        productId: product.id,
        productName: product.name,
        requestedQuantity,
        availableStock: previousStock,
        message: `${product.name} has only ${previousStock} item(s) left.`,
      });
      continue;
    }

    lockedProducts.set(product.id, {
      product,
      requestedQuantity,
    });
  }

  if (stockIssues.length > 0) {
    return {
      success: false,
      alreadyReduced: false,
      issues: stockIssues,
      movements: [],
    };
  }

  const movements = [];

  for (const { product, requestedQuantity } of lockedProducts.values()) {
    const previousStock = Number(product.stock_quantity || 0);
    const newStock = previousStock - requestedQuantity;

    if (newStock < 0) {
      return {
        success: false,
        alreadyReduced: false,
        issues: [
          {
            productId: product.id,
            productName: product.name,
            requestedQuantity,
            availableStock: previousStock,
            message: `${product.name} has only ${previousStock} item(s) left.`,
          },
        ],
        movements: [],
      };
    }

    await client.query(
      `
        UPDATE products
        SET stock_quantity = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [newStock, product.id]
    );

    const movement = await createStockMovement({
      client,
      productId: product.id,
      orderId: order.id,
      movementType: "order_purchase",
      quantityChanged: -requestedQuantity,
      previousStock,
      newStock,
      reason: "Stock reduced after successful verified payment",
      createdBy,
      allowOptionalSchema: !inventoryMovementsTableExists,
    });

    movements.push(movement);
  }

  if (Object.prototype.hasOwnProperty.call(order, "stock_reduced")) {
    await client.query(
      `
        UPDATE orders
        SET stock_reduced = TRUE,
            stock_reduced_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [order.id]
    );
  }

  return {
    success: true,
    alreadyReduced: false,
    issues: [],
    movements,
  };
}

function collectRequestedCartItems(items = []) {
  const issues = [];
  const requestedByProduct = new Map();

  if (!Array.isArray(items) || items.length === 0) {
    return {
      issues: [
        {
          productId: null,
          productName: null,
          message: "Cart items are required.",
        },
      ],
      requestedByProduct,
    };
  }

  for (const item of items) {
    const productId = item.productId || item.id;
    const requestedQuantity = Number(item.quantity || 0);

    if (!productId || !UUID_PATTERN.test(productId)) {
      issues.push({
        productId: productId || null,
        productName: item.name,
        message: `${item.name || "A cart item"} is missing a valid product ID.`,
      });
      continue;
    }

    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      issues.push({
        productId,
        productName: item.name,
        requestedQuantity,
        message: `${item.name || "A cart item"} has an invalid quantity.`,
      });
      continue;
    }

    const current = requestedByProduct.get(productId) || {
      productId,
      productName: item.name,
      requestedQuantity: 0,
    };

    current.requestedQuantity += requestedQuantity;
    requestedByProduct.set(productId, current);
  }

  return {
    issues,
    requestedByProduct,
  };
}

async function buildCartPricingSnapshot(
  items = [],
  { client = pool, deliveryFee = DEFAULT_DELIVERY_FEE } = {}
) {
  const { issues, requestedByProduct } = collectRequestedCartItems(items);
  const productIds = [...requestedByProduct.keys()];
  const snapshotItems = [];

  if (productIds.length === 0) {
    return {
      isValid: issues.length === 0,
      issues,
      items: snapshotItems,
      subtotalAmount: 0,
      deliveryFee: 0,
      totalAmount: 0,
    };
  }

  const result = await client.query(
    `
      SELECT
        id,
        name,
        price,
        size,
        image_url,
        stock_quantity,
        is_active,
        status
      FROM products
      WHERE id = ANY($1::uuid[])
    `,
    [productIds]
  );

  const productMap = new Map(result.rows.map((product) => [product.id, product]));

  for (const request of requestedByProduct.values()) {
    const { productId, requestedQuantity } = request;
    const product = productMap.get(productId);

    if (!product) {
      issues.push({
        productId,
        productName: request.productName,
        message: "Product was not found.",
      });
      continue;
    }

    if (product.is_active === false || product.status !== "active") {
      issues.push({
        productId,
        productName: product.name,
        message: "Product is currently unavailable.",
      });
      continue;
    }

    const availableStock = Number(product.stock_quantity || 0);

    if (requestedQuantity > availableStock) {
      issues.push({
        productId,
        productName: product.name,
        availableStock,
        requestedQuantity,
        message: `${product.name} has only ${availableStock} item(s) left.`,
      });
      continue;
    }

    const price = Number(product.price || 0);

    snapshotItems.push({
      productId: product.id,
      name: product.name,
      image: product.image_url || null,
      price,
      quantity: requestedQuantity,
      size: product.size || null,
      subtotal: price * requestedQuantity,
      stockQuantity: availableStock,
    });
  }

  const subtotalAmount = snapshotItems.reduce(
    (total, item) => total + item.subtotal,
    0
  );
  const normalizedDeliveryFee = snapshotItems.length > 0 ? Number(deliveryFee) : 0;

  return {
    isValid: issues.length === 0,
    issues,
    items: snapshotItems,
    subtotalAmount,
    deliveryFee: normalizedDeliveryFee,
    totalAmount: subtotalAmount + normalizedDeliveryFee,
  };
}

async function validateCartStock(items = []) {
  const stockSnapshot = await buildCartPricingSnapshot(items);

  return {
    isValid: stockSnapshot.isValid,
    issues: stockSnapshot.issues,
  };
}

async function getUniqueProductSlug(client, baseSlug, productName) {
  const fallbackSlug = slugify(productName || "luma-product");
  const rootSlug = slugify(baseSlug || fallbackSlug) || fallbackSlug;
  let nextSlug = rootSlug;
  let suffix = 2;

  while (true) {
    const result = await client.query(
      "SELECT id FROM products WHERE slug = $1 LIMIT 1",
      [nextSlug]
    );

    if (result.rows.length === 0) {
      return nextSlug;
    }

    nextSlug = `${rootSlug}-${suffix}`;
    suffix += 1;
  }
}

async function bulkImportProductsFromCsv({ csvText, createdBy = "admin" } = {}) {
  const rows = parseCsv(csvText);
  const client = await pool.connect();
  const results = [];

  if (!rows.length) {
    return {
      imported: 0,
      failed: 0,
      results: [
        {
          rowNumber: null,
          success: false,
          message: "CSV must include a header row and at least one product row.",
        },
      ],
    };
  }

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      try {
        const name = row.name || row.product_name;
        const price = Number(row.price || 0);
        const stockQuantity = Number(
          row.stock_quantity || row.stock || row.quantity || 0
        );
        const lowStockThreshold = Number(
          row.low_stock_threshold || row.threshold || DEFAULT_LOW_STOCK_THRESHOLD
        );

        if (!name) {
          throw new Error("Product name is required.");
        }

        if (!Number.isFinite(price) || price < 0) {
          throw new Error("Price must be a valid number.");
        }

        if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
          throw new Error("Stock quantity must be a whole number of 0 or more.");
        }

        const nextSlug = await getUniqueProductSlug(client, row.slug, name);
        const insertResult = await client.query(
          `
            INSERT INTO products (
              name,
              description,
              price,
              size,
              stock_quantity,
              low_stock_threshold,
              image_url,
              status,
              is_active,
              is_featured,
              slug,
              meta_title,
              meta_description,
              seo_updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
            RETURNING id, name
          `,
          [
            name,
            row.description || null,
            price,
            row.size || null,
            stockQuantity,
            Number.isFinite(lowStockThreshold)
              ? lowStockThreshold
              : DEFAULT_LOW_STOCK_THRESHOLD,
            row.image_url || row.image || null,
            row.status || "draft",
            parseBoolean(row.is_active ?? row.active, true),
            parseBoolean(row.is_featured ?? row.featured, false),
            nextSlug,
            row.meta_title || name,
            row.meta_description || row.description || name,
          ]
        );

        const product = insertResult.rows[0];

        if (stockQuantity > 0) {
          await createStockMovement({
            client,
            productId: product.id,
            movementType: "stock_added",
            quantityChanged: stockQuantity,
            previousStock: 0,
            newStock: stockQuantity,
            reason: "Bulk CSV product import",
            createdBy,
          });
        }

        results.push({
          rowNumber: row.rowNumber,
          success: true,
          productId: product.id,
          productName: product.name,
          message: "Imported",
        });
      } catch (error) {
        results.push({
          rowNumber: row.rowNumber,
          success: false,
          message: error.message,
        });
      }
    }

    await client.query("COMMIT");

    return {
      imported: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function bulkUpdateProductPrices({ updates = [], createdBy = "admin" } = {}) {
  const client = await pool.connect();
  const results = [];

  try {
    await client.query("BEGIN");

    for (const update of updates) {
      try {
        const productId = update.productId || update.id;
        const price = Number(update.price);

        if (!productId) throw new Error("Product ID is required.");
        if (!Number.isFinite(price) || price < 0) {
          throw new Error("Price must be a valid number of 0 or more.");
        }

        const result = await client.query(
          `
            UPDATE products
            SET price = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, name, price
          `,
          [price, productId]
        );

        if (!result.rows.length) {
          throw new Error("Product not found.");
        }

        await createStockMovement({
          client,
          productId,
          movementType: "price_updated",
          quantityChanged: 0,
          previousStock: 0,
          newStock: 0,
          reason: `Bulk price update by ${createdBy}`,
          createdBy,
        });

        results.push({ success: true, product: result.rows[0] });
      } catch (error) {
        results.push({
          success: false,
          productId: update.productId || update.id || null,
          message: error.message,
        });
      }
    }

    await client.query("COMMIT");

    return {
      updated: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function bulkUpdateInventory({ updates = [], createdBy = "admin" } = {}) {
  const results = [];

  for (const update of updates) {
    try {
      const productId = update.productId || update.id;

      if (update.stockQuantity !== undefined || update.stock_quantity !== undefined) {
        const data = await setProductStock(
          productId,
          update.stockQuantity ?? update.stock_quantity,
          {
            reason: "Bulk inventory stock update",
            createdBy,
          }
        );

        results.push({ success: true, product: data.product });
        continue;
      }

      const quantity = Number(update.quantity || update.adjustment || 0);
      const data = await adjustProductStock({
        productId,
        quantity,
        movementType: quantity > 0 ? "stock_added" : "stock_reduced",
        reason: "Bulk inventory adjustment",
        createdBy,
      });

      results.push({ success: true, product: data.product });
    } catch (error) {
      results.push({
        success: false,
        productId: update.productId || update.id || null,
        message: error.message,
      });
    }
  }

  return {
    updated: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    results,
  };
}

async function listPurchaseOrders() {
  return runOptionalQuery(
    `
      SELECT
        po.*,
        COALESCE(SUM(poi.quantity_ordered), 0)::int AS total_quantity_ordered,
        COALESCE(SUM(poi.quantity_received), 0)::int AS total_quantity_received,
        COALESCE(SUM(poi.quantity_ordered * COALESCE(poi.unit_cost, 0)), 0)::numeric AS total_cost
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      GROUP BY po.id
      ORDER BY po.created_at DESC
    `,
    [],
    []
  );
}

async function getPurchaseOrderItems(purchaseOrderId) {
  return runOptionalQuery(
    `
      SELECT
        poi.*,
        p.name AS product_name,
        p.image_url AS product_image,
        p.stock_quantity AS current_stock
      FROM purchase_order_items poi
      LEFT JOIN products p ON p.id = poi.product_id
      WHERE poi.purchase_order_id = $1
      ORDER BY poi.id ASC
    `,
    [purchaseOrderId],
    []
  );
}

async function createPurchaseOrder({
  supplierName,
  expectedArrivalDate,
  notes,
  items = [],
  createdBy = "admin",
} = {}) {
  if (!supplierName) {
    throw new Error("Supplier name is required.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one purchase order item is required.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const purchaseOrderResult = await client.query(
      `
        INSERT INTO purchase_orders (
          supplier_name,
          expected_arrival_date,
          status,
          notes
        )
        VALUES ($1, $2, 'ordered', $3)
        RETURNING *
      `,
      [supplierName, expectedArrivalDate || null, notes || null]
    );
    const purchaseOrder = purchaseOrderResult.rows[0];

    for (const item of items) {
      const quantityOrdered = Number(item.quantityOrdered || item.quantity || 0);
      const unitCost = item.unitCost === "" || item.unitCost === undefined
        ? null
        : Number(item.unitCost);

      if (!item.productId) {
        throw new Error("Purchase order item product is required.");
      }

      if (!Number.isInteger(quantityOrdered) || quantityOrdered <= 0) {
        throw new Error("Purchase order quantity must be greater than 0.");
      }

      await client.query(
        `
          INSERT INTO purchase_order_items (
            purchase_order_id,
            product_id,
            quantity_ordered,
            unit_cost,
            quantity_received
          )
          VALUES ($1, $2, $3, $4, 0)
        `,
        [purchaseOrder.id, item.productId, quantityOrdered, unitCost]
      );
    }

    await createStockMovement({
      client,
      productId: items[0].productId,
      movementType: "purchase_order_created",
      quantityChanged: 0,
      previousStock: 0,
      newStock: 0,
      reason: `Purchase order created by ${createdBy}`,
      createdBy,
    });

    await client.query("COMMIT");

    return {
      ...purchaseOrder,
      items: await getPurchaseOrderItems(purchaseOrder.id),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function receivePurchaseOrder(purchaseOrderId, { createdBy = "admin" } = {}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const stockTransitions = [];

    const orderResult = await client.query(
      "SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE",
      [purchaseOrderId]
    );
    const purchaseOrder = orderResult.rows[0];

    if (!purchaseOrder) {
      throw new Error("Purchase order not found.");
    }

    if (purchaseOrder.status === "received") {
      throw new Error("Purchase order has already been received.");
    }

    const itemsResult = await client.query(
      `
        SELECT *
        FROM purchase_order_items
        WHERE purchase_order_id = $1
      `,
      [purchaseOrderId]
    );

    for (const item of itemsResult.rows) {
      const remainingQuantity =
        Number(item.quantity_ordered || 0) - Number(item.quantity_received || 0);

      if (remainingQuantity <= 0) continue;

      const productResult = await client.query(
        "SELECT id, name, stock_quantity FROM products WHERE id = $1 FOR UPDATE",
        [item.product_id]
      );
      const product = productResult.rows[0];

      if (!product) continue;

      const previousStock = Number(product.stock_quantity || 0);
      const newStock = previousStock + remainingQuantity;

      await client.query(
        `
          UPDATE products
          SET stock_quantity = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `,
        [newStock, product.id]
      );

      await client.query(
        `
          UPDATE purchase_order_items
          SET quantity_received = quantity_ordered
          WHERE id = $1
        `,
        [item.id]
      );

      await createStockMovement({
        client,
        productId: product.id,
        movementType: "purchase_order_received",
        quantityChanged: remainingQuantity,
        previousStock,
        newStock,
        reason: `Purchase order ${String(purchaseOrderId).slice(0, 8)} received`,
        createdBy,
      });
      stockTransitions.push({ product, previousStock, newStock });
    }

    const updatedOrderResult = await client.query(
      `
        UPDATE purchase_orders
        SET status = 'received',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [purchaseOrderId]
    );

    await client.query("COMMIT");

    for (const transition of stockTransitions) {
      await emitStockTransition(
        transition.product,
        transition.previousStock,
        transition.newStock,
        { source: "purchase_order_received" }
      );
    }

    return {
      ...updatedOrderResult.rows[0],
      items: await getPurchaseOrderItems(purchaseOrderId),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getInventoryForecast({ days = 30 } = {}) {
  const salesWindowDays = Math.min(Math.max(Number(days) || 30, 7), 180);
  const rows = await runOptionalQuery(
    `
      WITH paid_sales AS (
        SELECT
          item.product_id,
          COALESCE(SUM(item.quantity), 0)::numeric AS units_sold,
          COUNT(DISTINCT orders.id)::int AS paid_order_count
        FROM order_items item
        JOIN orders ON orders.id = item.order_id
        WHERE orders.payment_status = 'paid'
          AND orders.created_at >= CURRENT_TIMESTAMP - ($1 || ' days')::interval
          AND item.product_id IS NOT NULL
        GROUP BY item.product_id
      )
      SELECT
        product.id,
        product.name,
        product.image_url,
        product.stock_quantity,
        product.low_stock_threshold,
        COALESCE(paid_sales.units_sold, 0)::numeric AS units_sold,
        COALESCE(paid_sales.paid_order_count, 0)::int AS paid_order_count
      FROM products product
      LEFT JOIN paid_sales ON paid_sales.product_id = product.id
      ORDER BY product.name ASC
    `,
    [salesWindowDays],
    []
  );

  return rows.map((row) => {
    const unitsSold = Number(row.units_sold || 0);
    const averageDailySales = unitsSold / salesWindowDays;
    const currentStock = Number(row.stock_quantity || 0);
    const hasEnoughSalesData = unitsSold > 0;
    const estimatedDaysUntilOutOfStock =
      hasEnoughSalesData && averageDailySales > 0
        ? Math.floor(currentStock / averageDailySales)
        : null;

    return {
      productId: row.id,
      productName: row.name,
      imageUrl: row.image_url,
      currentStock,
      lowStockThreshold: Number(
        row.low_stock_threshold || DEFAULT_LOW_STOCK_THRESHOLD
      ),
      salesWindowDays,
      unitsSold,
      averageDailySales: Number(averageDailySales.toFixed(2)),
      estimatedDaysUntilOutOfStock,
      hasEnoughSalesData,
      message: hasEnoughSalesData ? null : "Not enough sales data yet.",
    };
  });
}

module.exports = {
  DEFAULT_LOW_STOCK_THRESHOLD,
  DEFAULT_DELIVERY_FEE,
  getInventorySummary,
  getInventoryOverview,
  getInventoryProducts,
  getLowStockProducts,
  getOutOfStockProducts,
  getStockMovementHistory,
  bulkImportProductsFromCsv,
  bulkUpdateProductPrices,
  bulkUpdateInventory,
  listPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  getInventoryForecast,
  logInventoryMovement,
  createStockMovement,
  adjustProductStock,
  setProductStock,
  hasOrderAlreadyReducedStock,
  reduceStockAfterPaidOrder,
  buildCartPricingSnapshot,
  validateCartStock,
};




