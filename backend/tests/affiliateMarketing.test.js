const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { createAffiliateService, moneyToMinor, percentToBps, commissionMinor } = require("../src/services/affiliateService");

let db, pool, service;
const owner = { id: "11111111-1111-4111-8111-111111111111", email: "partner@example.com", phone: "08012345678" };
const shopper = { id: "22222222-2222-4222-8222-222222222222", email: "shopper@example.com", phone: "08087654321" };
const adminId = "33333333-3333-4333-8333-333333333333";
const application = { socialUrl: "https://instagram.com/lumapartner", promotionPlan: "I will share LUMA product demos with my audience.", acceptTerms: true };

before(async () => {
  // Real PostgreSQL engine, isolated in memory. No production credentials or external payments.
  db = new PGlite();
  await db.exec(`
    CREATE TABLE admins(id UUID PRIMARY KEY,full_name TEXT,email TEXT,role TEXT DEFAULT 'admin',created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE customer_accounts(id UUID PRIMARY KEY,email TEXT,full_name TEXT,phone TEXT,phone_e164 TEXT,
      phone_country_name TEXT,phone_country_iso2 TEXT,phone_country_code TEXT,whatsapp_number TEXT,whatsapp_e164 TEXT,
      whatsapp_country_name TEXT,whatsapp_country_iso2 TEXT,whatsapp_country_code TEXT,whatsapp_is_account_phone BOOLEAN,
      auth_provider TEXT,google_sub TEXT,avatar_url TEXT,customer_type TEXT,luma_use_case TEXT,referral_source TEXT,
      referral_source_other TEXT,onboarding_completed BOOLEAN,why_luma TEXT,first_time_luma TEXT,brow_goal TEXT,
      onboarding_completed_at TIMESTAMPTZ,profile_completed BOOLEAN,marketing_opt_in BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW(),last_login_at TIMESTAMPTZ);
    CREATE TABLE orders(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),customer_email TEXT,customer_phone TEXT,
      total_amount NUMERIC(12,2),payment_status TEXT DEFAULT 'pending',status TEXT DEFAULT 'pending',updated_at TIMESTAMPTZ DEFAULT NOW());
  `);
  // PGlite has a single connection. Hold a queue lease for each explicit transaction,
  // so interleaved requests test ledger invariants without mixing transaction scopes.
  let queue = Promise.resolve();
  pool = {
    query: async (sql, params) => !params && sql.includes("CREATE TABLE") ? (await db.exec(sql)).at(-1) : db.query(sql, params),
    connect: async () => {
      let unlock;
      const previous = queue;
      queue = new Promise((resolve) => { unlock = resolve; });
      await previous;
      return { query: (sql, params) => db.query(sql, params), release: unlock };
    },
  };
  service = createAffiliateService({ pool });
  await service.ensureSchema();
});

beforeEach(async () => {
  await db.exec(`TRUNCATE affiliate_audit_log,affiliate_payouts,affiliate_commissions,affiliate_order_attributions,
    affiliate_referrals,affiliate_accounts,orders,customer_accounts,admins CASCADE;
    DELETE FROM affiliate_settings; INSERT INTO affiliate_settings(id) VALUES(1);`);
  for (const customer of [owner, shopper]) await db.query("INSERT INTO customer_accounts(id,email,full_name,phone,phone_e164) VALUES($1,$2,$3,$4,$4)", [customer.id, customer.email, customer === owner ? "LUMA Partner" : "Shopper", customer.phone]);
  await db.query("INSERT INTO admins(id,full_name,email) VALUES($1,'LUMA Admin','admin@example.com')", [adminId]);
});
after(async () => { await db.close(); });

async function approvedAffiliate() {
  const account = await service.apply(owner, application);
  await service.updateAccount(adminId, account.id, { status: "approved", commissionPercent: null });
  return account;
}
async function settings(overrides = {}) {
  return service.updateSettings(adminId, { enabled: true, commissionPercent: 5, minimumPayout: 100, attributionDays: 30, holdDays: 0, ...overrides });
}
async function referral(account, visitorId = crypto.randomUUID()) {
  return service.track({ code: account.code, visitorId, landingPath: "/products/brow-pencil" });
}
async function order(overrides = {}) {
  return (await db.query("INSERT INTO orders(customer_email,customer_phone,total_amount,payment_status,status) VALUES($1,$2,$3,$4,$5) RETURNING *", [overrides.email || shopper.email, overrides.phone || shopper.phone, overrides.total || 12000, overrides.payment || "pending", overrides.status || "pending"])).rows[0];
}
async function attribute(account, nextOrder, pricing = { subtotalAmount: 10000, discountAmount: 2000 }, token) {
  const tracked = token ? { token } : await referral(account);
  const client = await pool.connect();
  try { return await service.attributeOrder({ client, order: nextOrder, token: tracked.token, customer: shopper, pricing }); }
  finally { client.release(); }
}
async function pay(nextOrder) {
  const row = (await db.query("UPDATE orders SET payment_status='paid',status=CASE WHEN status='pending' THEN 'processing' ELSE status END WHERE id=$1 RETURNING *", [nextOrder.id])).rows[0];
  const client = await pool.connect();
  try { await client.query("BEGIN"); await service.recordPaidOrder({ client, order: row }); await client.query("COMMIT"); }
  catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }
  return row;
}
async function availableEarnings(account, subtotal = 20000) {
  const row = await order({ status: "delivered", total: subtotal });
  await attribute(account, row, { subtotalAmount: subtotal, discountAmount: 0 });
  await pay(row);
  await service.saveBank(owner, { bankName: "Test Bank", accountName: "LUMA Partner", accountNumber: "0123456789" });
  return row;
}

test("commission arithmetic uses kobo, rounds half-up and validates monetary boundaries", () => {
  assert.equal(moneyToMinor("1099.99"), 109999);
  assert.equal(percentToBps("7.25"), 725);
  assert.equal(commissionMinor(109999, 725), 7975);
  assert.equal(commissionMinor(10, 500), 1);
  for (const invalid of ["-1", "NaN", "Infinity", "1e5", "1.005", "", "9007199254740992"]) assert.throws(() => moneyToMinor(invalid));
  assert.throws(() => percentToBps("100.01"));
});

test("the additive migration is repeatable and preserves edited settings", async () => {
  await settings({ commissionPercent: 7.25 });
  await db.exec(fs.readFileSync(path.join(__dirname, "../src/sql/migrations/038_affiliate_marketing.sql"), "utf8"));
  assert.equal((await service.publicSettings()).commissionPercent, 7.25);
  assert.equal((await db.query("SELECT COUNT(*)::integer AS count FROM affiliate_settings")).rows[0].count, 1);
});

test("applications require accepted terms and a public URL, and cannot be duplicated", async () => {
  await assert.rejects(service.apply(owner, { ...application, acceptTerms: false }), /Accept/);
  await assert.rejects(service.apply(owner, { ...application, socialUrl: "javascript:alert(1)" }), /valid public/);
  const account = await service.apply(owner, application);
  assert.equal(account.status, "pending");
  await assert.rejects(service.apply(owner, application), /already/);
  await assert.rejects(referral(account), /not available/);
});

test("approved links track once per visitor without extending an unexpired referral", async () => {
  const account = await approvedAffiliate();
  const visitor = crypto.randomUUID();
  const first = await referral(account, visitor);
  const repeated = await referral(account, visitor);
  assert.equal(first.token, repeated.token);
  assert.equal(String(first.expiresAt), String(repeated.expiresAt));
  assert.equal((await service.dashboard(owner)).clicks, 1);
  await assert.rejects(service.track({ code: account.code, visitorId: visitor }, owner), /not available/);
});

test("expired tokens, paused programs, and suspended accounts do not attribute orders", async () => {
  const account = await approvedAffiliate(), tracked = await referral(account);
  const nextOrder = await order();
  await db.query("UPDATE affiliate_referrals SET expires_at=NOW()-INTERVAL '1 day' WHERE id=$1", [tracked.token]);
  assert.equal(await attribute(account, nextOrder, undefined, tracked.token), false);
  const fresh = await referral(account);
  await settings({ enabled: false });
  assert.equal(await attribute(account, nextOrder, undefined, fresh.token), false);
  await assert.rejects(referral(account), /paused/);
  await settings();
  await service.updateAccount(adminId, account.id, { status: "suspended" });
  assert.equal(await attribute(account, nextOrder, undefined, fresh.token), false);
});

test("guest self-referrals are rejected by email and Nigerian phone number", async () => {
  const account = await approvedAffiliate();
  const ownEmail = await order({ email: "PARTNER@EXAMPLE.COM" });
  assert.equal(await attribute(account, ownEmail), false);
  const ownPhone = await order({ phone: "+2348012345678" });
  assert.equal(await attribute(account, ownPhone), false);
});

test("paid commissions exclude discounts and delivery, preserve checkout rates and deduplicate callbacks", async () => {
  const account = await approvedAffiliate(), nextOrder = await order();
  await attribute(account, nextOrder);
  assert.equal((await service.dashboard(owner)).commissions.length, 0);
  await settings({ commissionPercent: 12.5 });
  await pay(nextOrder); await pay(nextOrder);
  const dashboard = await service.dashboard(owner);
  assert.equal(dashboard.commissions.length, 1);
  assert.equal(Number(dashboard.commissions[0].eligible_minor), 800000);
  assert.equal(Number(dashboard.commissions[0].rate_bps), 500);
  assert.equal(dashboard.balances.pending, 40000);
  assert.equal(dashboard.balances.available, 0);
  assert.equal(dashboard.account.commissionPercent, 12.5);
  const serialized = JSON.stringify(dashboard);
  assert.ok(!serialized.includes(shopper.email));
  assert.ok(!serialized.includes(shopper.phone));
  assert.ok(!serialized.includes(nextOrder.id));
});

test("fulfilment and the recorded hold must both finish before withdrawal", async () => {
  const account = await approvedAffiliate(), nextOrder = await order();
  await attribute(account, nextOrder); await pay(nextOrder);
  await db.query("UPDATE orders SET status='delivered' WHERE id=$1", [nextOrder.id]);
  assert.equal((await service.dashboard(owner)).balances.available, 0);
  await db.query("UPDATE affiliate_commissions SET available_at=NOW()-INTERVAL '1 day' WHERE order_id=$1", [nextOrder.id]);
  assert.equal((await service.dashboard(owner)).balances.available, 40000);
});

test("stock-issue orders accrue only after successful payment stock reconciliation", async () => {
  await settings(); const account = await approvedAffiliate(), nextOrder = await order({ status: "stock_issue" });
  await attribute(account, nextOrder); await pay(nextOrder);
  assert.equal((await service.dashboard(owner)).commissions.length, 0);
  await db.query("UPDATE orders SET status='processing' WHERE id=$1", [nextOrder.id]);
  await pay(nextOrder);
  assert.equal((await service.dashboard(owner)).commissions.length, 1);
});

test("admin activity reconciles matured and reversed commissions without a customer refresh", async () => {
  await settings(); const account = await approvedAffiliate(); const nextOrder = await availableEarnings(account);
  await db.query("UPDATE affiliate_commissions SET status='pending' WHERE order_id=$1", [nextOrder.id]);
  assert.equal((await service.adminDashboard()).commissions[0].status, "available");
  await db.query("UPDATE orders SET payment_status='refunded' WHERE id=$1", [nextOrder.id]);
  const admin = await service.adminDashboard();
  assert.equal(admin.commissions[0].status, "void");
  assert.equal(Number(admin.summary.earned), 0);
});

test("zero commission rates still track a verified conversion without generating withdrawable earnings", async () => {
  await settings({ commissionPercent: 0 }); const account = await approvedAffiliate();
  await availableEarnings(account);
  const dashboard = await service.dashboard(owner);
  assert.equal(dashboard.conversions, 1);
  assert.equal(dashboard.commissions[0].status, "available");
  assert.equal(dashboard.balances.available, 0);
});

test("bank validation, withdrawal minimum, ownership and available balance are enforced", async () => {
  await settings(); const account = await approvedAffiliate();
  await assert.rejects(service.saveBank(owner, { bankName: "Bank", accountName: "Partner", accountNumber: "123" }), /10-digit/);
  await assert.rejects(service.saveBank(shopper, { bankName: "Bank", accountName: "Shopper", accountNumber: "1234567890" }), /Apply/);
  await assert.rejects(service.requestPayout(owner, { amount: 500, requestKey: crypto.randomUUID() }), /bank details/);
  await availableEarnings(account);
  await assert.rejects(service.requestPayout(owner, { amount: 50, requestKey: crypto.randomUUID() }), /minimum/);
  await assert.rejects(service.requestPayout(owner, { amount: 1000.01, requestKey: crypto.randomUUID() }), /exceeds/);
});

test("withdrawal retries return one request and multiple requests cannot overspend", async () => {
  await settings(); const account = await approvedAffiliate(); await availableEarnings(account);
  const key = crypto.randomUUID();
  const request = await service.requestPayout(owner, { amount: 700, requestKey: key });
  const retry = await service.requestPayout(owner, { amount: 700, requestKey: key });
  assert.equal(request.id, retry.id);
  await assert.rejects(service.requestPayout(owner, { amount: 600, requestKey: key }), /another amount/);
  const results = await Promise.allSettled([
    service.requestPayout(owner, { amount: 200, requestKey: crypto.randomUUID() }),
    service.requestPayout(owner, { amount: 200, requestKey: crypto.randomUUID() }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const dashboard = await service.dashboard(owner);
  assert.equal(dashboard.balances.available, 10000);
  assert.equal(dashboard.balances.reserved, 90000);
});

test("requests snapshot bank details and rejection releases the reserved amount", async () => {
  await settings(); const account = await approvedAffiliate(); await availableEarnings(account);
  const payout = await service.requestPayout(owner, { amount: 500, requestKey: crypto.randomUUID() });
  await service.saveBank(owner, { bankName: "Another Bank", accountName: "New Name", accountNumber: "9876543210" });
  const stored = (await db.query("SELECT * FROM affiliate_payouts WHERE id=$1", [payout.id])).rows[0];
  assert.equal(stored.account_number, "0123456789");
  await assert.rejects(service.reviewPayout(adminId, payout.id, { status: "rejected" }), /Rejection reason/);
  await service.reviewPayout(adminId, payout.id, { status: "rejected", note: "Please confirm your bank details." });
  assert.equal((await service.dashboard(owner)).balances.available, 100000);
});

test("payment review requires approval and a unique transfer reference, and cannot reopen paid requests", async () => {
  await settings(); const account = await approvedAffiliate(); await availableEarnings(account);
  const payout = await service.requestPayout(owner, { amount: 400, requestKey: crypto.randomUUID() });
  await assert.rejects(service.reviewPayout(adminId, payout.id, { status: "paid", paymentReference: "TRANSFER-1" }), /Approve/);
  await service.reviewPayout(adminId, payout.id, { status: "approved" });
  await assert.rejects(service.reviewPayout(adminId, payout.id, { status: "paid" }), /Transfer reference/);
  await service.reviewPayout(adminId, payout.id, { status: "paid", paymentReference: "TRANSFER-1" });
  await service.reviewPayout(adminId, payout.id, { status: "paid", paymentReference: "TRANSFER-1" });
  await assert.rejects(service.reviewPayout(adminId, payout.id, { status: "rejected", note: "Retry" }), /closed/);
  const second = await service.requestPayout(owner, { amount: 400, requestKey: crypto.randomUUID() });
  await service.reviewPayout(adminId, second.id, { status: "approved" });
  await assert.rejects(service.reviewPayout(adminId, second.id, { status: "paid", paymentReference: "TRANSFER-1" }), (err) => err.code === "23505");
  assert.equal((await service.dashboard(owner)).balances.paid, 40000);
});

test("refunds void commissions and block an outstanding payout after its balance changes", async () => {
  await settings(); const account = await approvedAffiliate(); const nextOrder = await availableEarnings(account);
  const payout = await service.requestPayout(owner, { amount: 500, requestKey: crypto.randomUUID() });
  await service.reviewPayout(adminId, payout.id, { status: "approved" });
  await db.query("UPDATE orders SET payment_status='refunded' WHERE id=$1", [nextOrder.id]);
  await assert.rejects(service.reviewPayout(adminId, payout.id, { status: "paid", paymentReference: "TRANSFER-REFUND" }), /Earnings changed/);
  await service.reviewPayout(adminId, payout.id, { status: "rejected", note: "Your referred order was refunded." });
  const dashboard = await service.dashboard(owner);
  assert.equal(dashboard.commissions[0].status, "void");
  assert.equal(dashboard.balances.available, 0);
});

test("a refund after payout creates a recoverable negative balance without erasing the payment", async () => {
  await settings(); const account = await approvedAffiliate(); const nextOrder = await availableEarnings(account);
  const payout = await service.requestPayout(owner, { amount: 500, requestKey: crypto.randomUUID() });
  await service.reviewPayout(adminId, payout.id, { status: "approved" });
  await service.reviewPayout(adminId, payout.id, { status: "paid", paymentReference: "TRANSFER-PAID" });
  await db.query("UPDATE orders SET status='cancelled' WHERE id=$1", [nextOrder.id]);
  const dashboard = await service.dashboard(owner);
  assert.equal(dashboard.balances.available, -50000);
  assert.equal(dashboard.balances.paid, 50000);
  assert.equal(dashboard.commissions[0].status, "void");
  await assert.rejects(db.query("DELETE FROM orders WHERE id=$1", [nextOrder.id]), /foreign key constraint/);
});

test("custom rates and status changes are audited and normal checkout remains unaffiliated", async () => {
  const account = await approvedAffiliate();
  await service.updateAccount(adminId, account.id, { status: "approved", commissionPercent: 8.25, note: "Creator campaign" });
  assert.equal((await service.dashboard(owner)).account.commissionPercent, 8.25);
  const ordinaryOrder = await order();
  const client = await pool.connect();
  try { assert.equal(await service.attributeOrder({ client, order: ordinaryOrder, token: null, customer: shopper, pricing: {} }), false); }
  finally { client.release(); }
  await pay(ordinaryOrder);
  assert.equal((await service.dashboard(owner)).commissions.length, 0);
  const admin = await service.adminDashboard({ search: "PARTNER", status: "approved", page: 1 });
  assert.equal(admin.total, 1);
  assert.equal(admin.accounts[0].commissionPercent, 8.25);
  assert.equal((await db.query("SELECT COUNT(*)::integer AS count FROM affiliate_audit_log")).rows[0].count, 2);
});

test("status-only edits preserve a custom rate and clearing it restores the program default", async () => {
  const account = await approvedAffiliate();
  await service.updateAccount(adminId, account.id, { status: "approved", commissionPercent: 8.25 });
  await service.updateAccount(adminId, account.id, { status: "suspended" });
  assert.equal((await service.dashboard(owner)).account.commissionPercent, 8.25);
  await service.updateAccount(adminId, account.id, { status: "approved", commissionPercent: null });
  assert.equal((await service.dashboard(owner)).account.commissionPercent, 5);
});

test("HTTP routes enforce customer and admin permissions and ignore forged ownership fields", async () => {
  const express = require("express"), jwt = require("jsonwebtoken");
  const defaultPool = require("../src/config/db");
  const originalQuery = defaultPool.query, originalConnect = defaultPool.connect;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "affiliate-integration-test-only-secret";
  defaultPool.query = pool.query; defaultPool.connect = pool.connect;
  const app = express(); app.use(express.json()); app.use("/affiliates", require("../src/routes/affiliateRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/affiliates`;
  const ownerToken = jwt.sign({ id: owner.id, type: "customer" }, process.env.JWT_SECRET);
  const shopperToken = jwt.sign({ id: shopper.id, type: "customer" }, process.env.JWT_SECRET);
  try {
    assert.equal((await fetch(`${base}/me`)).status, 401);
    assert.equal((await fetch(`${base}/admin`)).status, 401);
    assert.equal((await fetch(`${base}/admin`, { headers: { Authorization: `Bearer ${ownerToken}` } })).status, 403);
    assert.equal((await fetch(`${base}/program`)).status, 200);
    await approvedAffiliate();
    const own = await fetch(`${base}/me`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(own.status, 200); assert.equal((await own.json()).data.account.status, "approved");
    const other = await fetch(`${base}/me/bank`, {
      method: "PATCH", headers: { Authorization: `Bearer ${shopperToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: owner.id, bankName: "Forged", accountName: "Forged", accountNumber: "1234567890" }),
    });
    assert.equal(other.status, 404);
    assert.equal((await service.dashboard(owner)).account.bankName, "");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    defaultPool.query = originalQuery; defaultPool.connect = originalConnect;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  }
});
