const pool = require("../config/db");

let cartTableReady = false;

async function ensureCustomerCartTable() {
  if (cartTableReady) return;

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS customer_carts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      customer_id UUID REFERENCES customer_accounts(id) ON DELETE CASCADE,
      cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      cart_total NUMERIC(12,2) DEFAULT 0,
      last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id)
    );

    CREATE INDEX IF NOT EXISTS idx_customer_carts_customer_id
      ON customer_carts(customer_id);
  `);

  cartTableReady = true;
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item && item.id)
    .map((item) => ({
      ...item,
      id: String(item.id),
      size: item.size || "",
      quantity: Math.max(Number(item.quantity || 1), 1),
      price: Number(item.price || 0),
    }));
}

function getCartKey(item) {
  return `${item.id}::${item.size || ""}`;
}

async function getStockByProductId(productIds = []) {
  if (!productIds.length) return new Map();

  try {
    const result = await pool.query(
      `
        SELECT id::text, stock_quantity
        FROM products
        WHERE id = ANY($1::uuid[])
      `,
      [productIds]
    );

    return new Map(
      result.rows.map((row) => [row.id, Number(row.stock_quantity || 0)])
    );
  } catch (error) {
    if (["42P01", "42703", "22P02"].includes(error.code)) {
      return new Map();
    }

    throw error;
  }
}

function calculateCartTotal(items = []) {
  return items.reduce(
    (total, item) => total + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
}

async function getCustomerCart(customerId) {
  await ensureCustomerCartTable();

  const result = await pool.query(
    `
      SELECT *
      FROM customer_carts
      WHERE customer_id = $1
    `,
    [customerId]
  );

  const cart = result.rows[0];

  return {
    cartItems: cart?.cart_items || [],
    cartTotal: Number(cart?.cart_total || 0),
    lastSyncedAt: cart?.last_synced_at || null,
  };
}

async function syncCustomerCart(customerId, incomingItems = []) {
  await ensureCustomerCartTable();

  const existingCart = await getCustomerCart(customerId);
  const mergedByKey = new Map();

  [...normalizeItems(existingCart.cartItems), ...normalizeItems(incomingItems)].forEach(
    (item) => {
      const key = getCartKey(item);
      const existing = mergedByKey.get(key);

      if (!existing) {
        mergedByKey.set(key, { ...item });
        return;
      }

      mergedByKey.set(key, {
        ...existing,
        ...item,
        quantity: Number(existing.quantity || 0) + Number(item.quantity || 0),
      });
    }
  );

  const mergedItems = Array.from(mergedByKey.values());
  const stockMap = await getStockByProductId(mergedItems.map((item) => item.id));
  const safeItems = mergedItems
    .map((item) => {
      const knownStock = stockMap.get(item.id);

      if (knownStock === undefined) return item;

      return {
        ...item,
        stockQuantity: knownStock,
        stock_quantity: knownStock,
        quantity: Math.min(Number(item.quantity || 1), Math.max(knownStock, 0)),
      };
    })
    .filter((item) => Number(item.quantity || 0) > 0);
  const cartTotal = calculateCartTotal(safeItems);

  const result = await pool.query(
    `
      INSERT INTO customer_carts (customer_id, cart_items, cart_total)
      VALUES ($1, $2, $3)
      ON CONFLICT (customer_id)
      DO UPDATE SET
        cart_items = EXCLUDED.cart_items,
        cart_total = EXCLUDED.cart_total,
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [customerId, JSON.stringify(safeItems), cartTotal]
  );

  return {
    cartItems: result.rows[0].cart_items || [],
    cartTotal: Number(result.rows[0].cart_total || 0),
    lastSyncedAt: result.rows[0].last_synced_at,
  };
}

async function clearCustomerCart(customerId) {
  await ensureCustomerCartTable();

  await pool.query(
    `
      UPDATE customer_carts
      SET
        cart_items = '[]'::jsonb,
        cart_total = 0,
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = $1
    `,
    [customerId]
  );

  return {
    cartItems: [],
    cartTotal: 0,
  };
}

module.exports = {
  clearCustomerCart,
  getCustomerCart,
  syncCustomerCart,
};
