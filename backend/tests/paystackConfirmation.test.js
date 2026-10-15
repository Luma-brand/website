const { test, before, beforeEach, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const pool = require("../src/config/db");

let db, verifyPaystackPayment, handlePaystackWebhook, getPublicOrder;
let transactionOverrides, followUpFailure, notifications, activeClients, forceCommitRollback;
const orderId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const reference = "LUMA-PAY-confirmation-regression";
const secret = "sk_test_local-regression-only";
const originalSecret = process.env.PAYSTACK_SECRET_KEY;

function responseRecorder() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
    set(key, value) { this.headers[key] = value; return this; }, json(body) { this.body = body; return this; } };
}

async function verify(customer) {
  const response = responseRecorder();
  await verifyPaystackPayment({ body: { reference }, customer }, response);
  return response;
}

async function webhook({ signature = true, buffer = false } = {}) {
  const payload = { event: "charge.success", data: { reference, status: "success", currency: "NGN", amount: 500000, id: 123, ...transactionOverrides } };
  const rawBody = JSON.stringify(payload);
  const response = responseRecorder();
  await handlePaystackWebhook({ body: payload, rawBody: buffer ? Buffer.from(rawBody) : rawBody,
    headers: { "x-paystack-signature": signature ? crypto.createHmac("sha512", secret).update(rawBody).digest("hex") : "invalid" } }, response);
  return response;
}

before(async () => {
  process.env.PAYSTACK_SECRET_KEY = secret;
  db = new PGlite();
  await db.exec(`
    CREATE TABLE orders(id UUID PRIMARY KEY, customer_id UUID, customer_name TEXT, customer_email VARCHAR(160), customer_phone TEXT,
      total_amount NUMERIC(12,2), status TEXT DEFAULT 'pending', payment_status TEXT DEFAULT 'pending',
      payment_reference TEXT, paystack_reference VARCHAR(180), provider_reference TEXT, payment_provider TEXT,
      payment_verified_at TIMESTAMP, paid_at TIMESTAMPTZ, metadata JSONB DEFAULT '{}',
      stock_reduced BOOLEAN DEFAULT FALSE, stock_reduced_at TIMESTAMP, discount_code_id UUID,
      delivery_method TEXT, delivery_fee NUMERIC, pickup_branch_name_snapshot TEXT, pickup_address_snapshot TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE products(id UUID PRIMARY KEY,name TEXT,stock_quantity INTEGER,is_active BOOLEAN,status TEXT,updated_at TIMESTAMPTZ);
    CREATE TABLE order_items(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),order_id UUID,product_id UUID,product_name TEXT,
      product_image TEXT,price NUMERIC,quantity INTEGER,size TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE inventory_movements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),product_id UUID,order_id UUID,movement_type TEXT,
      quantity_changed INTEGER,previous_stock INTEGER,new_stock INTEGER,reason TEXT,created_by TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE abandoned_carts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),session_id TEXT,customer_email TEXT,customer_phone TEXT,
      recovery_status TEXT,recovered_order_id UUID,recovered_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
    CREATE TABLE abandoned_checkouts(session_id TEXT,customer_email TEXT,customer_phone TEXT,payment_status TEXT,recovery_status TEXT,
      order_id UUID,completed_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
    CREATE TABLE product_waitlists(product_id UUID,customer_id UUID,email TEXT,status TEXT,converted_order_id UUID,
      converted_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
  `);

  let queue = Promise.resolve();
  mock.method(pool, "query", (sql, params) => db.query(sql, params));
  mock.method(pool, "connect", async () => {
    let unlock;
    const previous = queue;
    queue = new Promise((resolve) => { unlock = resolve; });
    await previous;
    activeClients += 1;
    return { query: async (sql, params) => {
      if (sql === "COMMIT" && forceCommitRollback) {
        await db.query("ROLLBACK");
        return { command: "ROLLBACK", rows: [] };
      }
      return db.query(sql, params);
    }, release: () => { activeClients -= 1; unlock(); } };
  });
  // Keep the real payment SQL, stock reconciliation and recovery queries. Stub external notifications only.
  mock.method(require("../src/services/affiliateService"), "recordPaidOrder", async () => {});
  mock.method(require("../src/services/growthService"), "recordAnalyticsEvent", async () => { if (followUpFailure) throw new Error("analytics unavailable"); });
  mock.method(require("../src/services/paymentLifecycleService"), "emitPaidOrderEvents", async () => {
    assert.equal(activeClients, 0, "release the transaction connection before notifications");
    if (followUpFailure) throw new Error("automation unavailable");
  });
  mock.method(require("../src/services/emailService"), "sendOrderConfirmationEmails", async () => {
    notifications += 1;
    if (followUpFailure) throw new Error("email unavailable");
    return { sent: true, status: "sent" };
  });
  mock.method(require("../src/services/automationService"), "recordAutomationAttempt", async () => {});
  mock.method(global, "fetch", async (url, options) => {
    assert.equal(url, `https://api.paystack.co/transaction/verify/${reference}`);
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
    return new Response(JSON.stringify({ status: true, data: { reference, status: "success", amount: 500000, currency: "NGN", id: 123, ...transactionOverrides } }), { status: 200 });
  });
  ({ verifyPaystackPayment, handlePaystackWebhook } = require("../src/controllers/paystackController"));
  ({ getPublicOrder } = require("../src/controllers/orderController"));
});

beforeEach(async () => {
  transactionOverrides = {};
  followUpFailure = false;
  notifications = 0;
  activeClients = 0;
  forceCommitRollback = false;
  await db.exec("TRUNCATE orders,products,order_items,inventory_movements,abandoned_carts,abandoned_checkouts,product_waitlists;");
  await db.query("INSERT INTO orders(id,customer_name,customer_email,total_amount,payment_reference,delivery_method,delivery_fee,pickup_branch_name_snapshot,pickup_address_snapshot) VALUES($1,'Test customer','shopper@example.com',5000,$2,'STUDIO_PICKUP',0,'LUMA studio','Test collection address')", [orderId, reference]);
  await db.query("INSERT INTO products(id,name,stock_quantity,is_active,status) VALUES($1,'Brow pencil',10,TRUE,'active')", [productId]);
  await db.query("INSERT INTO order_items(order_id,product_id,product_name,price,quantity) VALUES($1,$2,'Brow pencil',5000,1)", [orderId, productId]);
});

after(async () => {
  mock.restoreAll();
  if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = originalSecret;
  await db.close();
});

test("successful guest callback commits paid order with mixed varchar/text reference columns (42P08 regression)", async () => {
  const response = await verify();
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.id, orderId);
  assert.equal(response.body.data.payment_status, "paid");
  assert.equal(response.body.data.status, "processing");
  assert.equal(response.body.data.provider_reference, reference);
  assert.equal((await db.query("SELECT stock_quantity FROM products")).rows[0].stock_quantity, 9);
  assert.equal(notifications, 1);
});

test("callback followed by signed webhook and callback retry reduces stock and sends confirmation once", async () => {
  assert.equal((await verify()).body.success, true);
  assert.equal((await webhook({ buffer: true })).body.success, true);
  assert.equal((await verify()).body.success, true);
  assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM inventory_movements")).rows[0].count, 1);
  assert.equal((await db.query("SELECT stock_quantity FROM products")).rows[0].stock_quantity, 9);
  assert.equal(notifications, 1);
});

test("signed webhook arriving first confirms payment before the browser returns", async () => {
  assert.equal((await webhook()).statusCode, 200);
  assert.equal((await verify()).body.data.payment_status, "paid");
  assert.equal(notifications, 1);
});

test("pending, failed, wrong-amount, wrong-currency and wrong-reference responses never mark the order paid", async () => {
  for (const overrides of [{ status: "pending" }, { status: "failed" }, { amount: 499999 }, { currency: "USD" }, { reference: "another-payment" }]) {
    transactionOverrides = overrides;
    const response = await verify();
    assert.equal(response.body.success, false);
    assert.ok([400, 409].includes(response.statusCode));
    assert.equal((await db.query("SELECT payment_status FROM orders")).rows[0].payment_status, "pending");
    assert.equal((await db.query("SELECT stock_quantity FROM products")).rows[0].stock_quantity, 10);
  }
});

test("signed-in ownership mismatch and unsigned webhook cannot change an order", async () => {
  assert.equal((await verify({ email: "other@example.com" })).statusCode, 403);
  assert.equal((await webhook({ signature: false })).statusCode, 401);
  assert.equal((await db.query("SELECT payment_status FROM orders")).rows[0].payment_status, "pending");
});

test("post-commit analytics, automation or email failures do not report a successful payment as failed", async () => {
  followUpFailure = true;
  const response = await verify();
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.payment_status, "paid");
  assert.equal((await verify()).body.success, true);
});

test("unavailable stock still records the received payment and exposes the stock review status", async () => {
  await db.query("UPDATE products SET stock_quantity=0");
  const response = await verify();
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.payment_status, "paid");
  assert.equal(response.body.data.status, "stock_issue");
});

test("public tracking returns current fulfilment data and no-store cache header", async () => {
  await verify();
  await db.query("UPDATE orders SET status='ready_for_pickup' WHERE id=$1", [orderId]);
  const response = responseRecorder();
  await getPublicOrder({ params: { id: orderId } }, response);
  assert.equal(response.body.data.status, "ready_for_pickup");
  assert.equal(response.body.data.payment_status, "paid");
  assert.equal(response.body.data.delivery_method, "STUDIO_PICKUP");
  assert.equal(response.body.data.pickup_branch_name_snapshot, "LUMA studio");
  assert.equal(response.body.data.items.length, 1);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.body.data.customer_phone, undefined);
});

test("missing optional checkout recovery table cannot silently roll back a confirmed payment", async () => {
  await db.exec("ALTER TABLE abandoned_checkouts RENAME TO unavailable_abandoned_checkouts");
  try {
    const response = await verify();
    assert.equal(response.body.success, true);
    assert.equal((await db.query("SELECT payment_status FROM orders")).rows[0].payment_status, "paid");
    assert.equal((await db.query("SELECT stock_quantity FROM products")).rows[0].stock_quantity, 9);
  } finally {
    await db.exec("ALTER TABLE unavailable_abandoned_checkouts RENAME TO abandoned_checkouts");
  }
});

test("missing optional waitlist table cannot abort the payment transaction", async () => {
  await db.exec("ALTER TABLE product_waitlists RENAME TO unavailable_product_waitlists");
  try {
    const response = await verify();
    assert.equal(response.body.success, true);
    assert.equal((await db.query("SELECT payment_status FROM orders")).rows[0].payment_status, "paid");
  } finally {
    await db.exec("ALTER TABLE unavailable_product_waitlists RENAME TO product_waitlists");
  }
});

test("legacy cart recovery columns use the fallback without aborting payment confirmation", async () => {
  await db.exec("ALTER TABLE abandoned_carts RENAME COLUMN recovered_at TO legacy_recovered_at");
  try {
    const response = await verify();
    assert.equal(response.body.success, true);
    assert.equal((await db.query("SELECT payment_status FROM orders")).rows[0].payment_status, "paid");
  } finally {
    await db.exec("ALTER TABLE abandoned_carts RENAME COLUMN legacy_recovered_at TO recovered_at");
  }
});

test("missing optional discount usage table cannot silently roll back a payment", async () => {
  await db.query("UPDATE orders SET discount_code_id=gen_random_uuid()");
  const response = await verify();
  assert.equal(response.body.success, true);
  assert.equal((await db.query("SELECT payment_status FROM orders")).rows[0].payment_status, "paid");
});

test("a PostgreSQL COMMIT response of ROLLBACK never reports payment success", async () => {
  forceCommitRollback = true;
  const response = await verify();
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, "PAYMENT_COMMIT_FAILED");
  assert.equal((await db.query("SELECT payment_status FROM orders")).rows[0].payment_status, "pending");
  assert.equal(notifications, 0);
});
