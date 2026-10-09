const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const defaultPool = require("../config/db");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const migration = fs.readFileSync(path.join(__dirname, "../sql/migrations/038_affiliate_marketing.sql"), "utf8");

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code: "AFFILIATE_ERROR" });
}

function moneyToMinor(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) fail("Enter a valid amount with at most two decimal places.");
  const [whole, cents = ""] = text.split(".");
  const minor = BigInt(whole) * 100n + BigInt(cents.padEnd(2, "0"));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) fail("Amount is too large.");
  return Number(minor);
}

function percentToBps(value) {
  const bps = moneyToMinor(value);
  if (bps > 10000) fail("Commission rate must be between 0% and 100%.");
  return bps;
}

function commissionMinor(eligibleMinor, rateBps) {
  return Number((BigInt(eligibleMinor) * BigInt(rateBps) + 5000n) / 10000n);
}

function textField(value, label, max, min = 1) {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max) fail(`${label} must contain ${min}–${max} characters.`);
  return text;
}

function uuid(value, label = "ID") {
  if (!UUID.test(String(value || ""))) fail(`Invalid ${label}.`);
  return value;
}

function settingsView(row) {
  return {
    enabled: row.enabled,
    commissionPercent: Number(row.default_rate_bps) / 100,
    minimumPayout: Number(row.minimum_payout_minor) / 100,
    attributionDays: row.attribution_days,
    holdDays: row.hold_days,
    currency: "NGN",
  };
}

function accountView(row, settings) {
  if (!row) return null;
  return {
    id: row.id, code: row.code, status: row.status,
    socialUrl: row.social_url, promotionPlan: row.promotion_plan,
    commissionPercent: Number(row.rate_bps ?? settings.default_rate_bps) / 100,
    customCommissionPercent: row.rate_bps == null ? null : Number(row.rate_bps) / 100,
    bankName: row.bank_name || "", accountName: row.account_name || "", accountNumber: row.account_number || "",
    createdAt: row.created_at,
  };
}

function createAffiliateService({ pool = defaultPool } = {}) {
  let schemaPromise;
  function ensureSchema() {
    if (!schemaPromise) schemaPromise = pool.query(migration).catch((error) => { schemaPromise = null; throw error; });
    return schemaPromise;
  }

  async function transaction(fn) {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async function getSettings(client = pool) {
    return (await client.query("SELECT * FROM affiliate_settings WHERE id=1")).rows[0];
  }

  async function audit(client, adminId, action, entityId, details) {
    await client.query(
      "INSERT INTO affiliate_audit_log(admin_id,action,entity_id,details) VALUES($1,$2,$3,$4::jsonb)",
      [adminId, action, entityId, JSON.stringify(details)]
    );
  }

  async function publicSettings() {
    await ensureSchema();
    return settingsView(await getSettings());
  }

  async function apply(customer, body) {
    if (body.acceptTerms !== true) fail("Accept the affiliate terms to apply.");
    const socialUrl = textField(body.socialUrl, "Your website or social profile", 500);
    let url;
    try { url = new URL(socialUrl); } catch { fail("Enter a full website or social profile URL."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) fail("Enter a valid public website URL.");
    const plan = textField(body.promotionPlan, "Promotion plan", 2000, 10);
    return transaction(async (client) => {
      if (!(await getSettings(client)).enabled) fail("Affiliate applications are paused.", 409);
      const result = await client.query(
        `INSERT INTO affiliate_accounts(customer_id,code,social_url,promotion_plan)
         VALUES($1,$2,$3,$4) ON CONFLICT(customer_id) DO NOTHING RETURNING *`,
        [customer.id, `LUMA${crypto.randomBytes(6).toString("hex").toUpperCase()}`, socialUrl, plan]
      );
      if (!result.rows.length) fail("You already have an affiliate application.", 409);
      return accountView(result.rows[0], await getSettings(client));
    });
  }

  async function track(body, customer) {
    const code = textField(body.code, "Referral code", 24).toUpperCase();
    const visitorId = uuid(body.visitorId, "visitor ID");
    const landingPath = String(body.landingPath || "/").slice(0, 500);
    if (!landingPath.startsWith("/") || landingPath.startsWith("//")) fail("Invalid landing path.");
    return transaction(async (client) => {
      const settings = await getSettings(client);
      if (!settings.enabled) fail("The affiliate program is paused.", 409);
      const account = (await client.query("SELECT * FROM affiliate_accounts WHERE code=$1 AND status='approved'", [code])).rows[0];
      if (!account || account.customer_id === customer?.id) fail("This referral link is not available.", 404);
      const visitorHash = crypto.createHash("sha256").update(visitorId).digest("hex");
      const result = await client.query(
        `INSERT INTO affiliate_referrals(affiliate_id,visitor_hash,landing_path,expires_at)
         VALUES($1,$2,$3,NOW()+$4::integer*INTERVAL '1 day')
         ON CONFLICT(affiliate_id,visitor_hash) DO UPDATE
         SET created_at=CASE WHEN affiliate_referrals.expires_at<=NOW() THEN NOW() ELSE affiliate_referrals.created_at END,
             expires_at=CASE WHEN affiliate_referrals.expires_at<=NOW() THEN EXCLUDED.expires_at ELSE affiliate_referrals.expires_at END
         RETURNING id,expires_at`,
        [account.id, visitorHash, landingPath, settings.attribution_days]
      );
      return { token: result.rows[0].id, expiresAt: result.rows[0].expires_at, code: account.code };
    });
  }

  // Called inside the order transaction. Nothing supplied by the browser controls the rate or amount.
  async function attributeOrder({ client, order, token, customer, pricing }) {
    if (!UUID.test(String(token || ""))) return false;
    await ensureSchema();
    const settings = await getSettings(client);
    if (!settings.enabled) return false;
    const referral = (await client.query(
      `SELECT r.id,r.affiliate_id,a.customer_id,a.rate_bps,c.email,c.phone,c.phone_e164
       FROM affiliate_referrals r JOIN affiliate_accounts a ON a.id=r.affiliate_id
       JOIN customer_accounts c ON c.id=a.customer_id
       WHERE r.id=$1 AND r.expires_at>NOW() AND a.status='approved'`, [token]
    )).rows[0];
    const normalizedPhone = (value) => String(value || "").replace(/\D/g, "").replace(/^0/, "234");
    if (!referral || referral.customer_id === customer?.id ||
        String(referral.email).trim().toLowerCase() === String(order.customer_email).trim().toLowerCase() ||
        (normalizedPhone(order.customer_phone) && [referral.phone, referral.phone_e164].some((phone) => normalizedPhone(phone) === normalizedPhone(order.customer_phone)))) return false;
    const eligible = Math.max(0, moneyToMinor(pricing.subtotalAmount) - moneyToMinor(pricing.discountAmount || 0));
    await client.query(
      `INSERT INTO affiliate_order_attributions(order_id,affiliate_id,referral_id,eligible_minor,rate_bps,hold_days)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(order_id) DO NOTHING`,
      [order.id, referral.affiliate_id, referral.id, eligible, referral.rate_bps ?? settings.default_rate_bps, settings.hold_days]
    );
    return true;
  }

  async function syncCommissions(client, affiliateId) {
    // The account lock serializes refunds, payment callbacks and withdrawals for this affiliate.
    const ids = Array.isArray(affiliateId) ? affiliateId : [affiliateId];
    await client.query("SELECT id FROM affiliate_accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE", [ids]);
    await client.query(
      `UPDATE affiliate_commissions c SET status='void',void_reason='Order cancelled or payment reversed'
       FROM orders o WHERE c.order_id=o.id AND c.affiliate_id=ANY($1::uuid[]) AND c.status<>'void'
       AND (o.status IN ('cancelled','canceled','refunded') OR o.payment_status IN ('refunded','failed'))`, [ids]
    );
    await client.query(
      `UPDATE affiliate_commissions c SET status='available'
       FROM orders o WHERE c.order_id=o.id AND c.affiliate_id=ANY($1::uuid[]) AND c.status='pending'
       AND c.available_at<=NOW() AND o.payment_status='paid' AND o.status IN ('delivered','completed')`, [ids]
    );
  }

  // Only the verified payment lifecycle calls this; admin marking an order paid cannot create earnings.
  async function recordPaidOrder({ client, order }) {
    await ensureSchema();
    const attribution = (await client.query("SELECT * FROM affiliate_order_attributions WHERE order_id=$1", [order.id])).rows[0];
    if (!attribution || order.payment_status !== "paid" || ["stock_issue", "cancelled", "canceled", "refunded"].includes(order.status)) return;
    await client.query("SELECT id FROM affiliate_accounts WHERE id=$1 FOR UPDATE", [attribution.affiliate_id]);
    const amount = commissionMinor(attribution.eligible_minor, attribution.rate_bps);
    await client.query(
      `INSERT INTO affiliate_commissions(order_id,affiliate_id,eligible_minor,rate_bps,amount_minor,available_at)
       VALUES($1,$2,$3,$4,$5,NOW()+$6::integer*INTERVAL '1 day') ON CONFLICT(order_id) DO NOTHING`,
      [order.id, attribution.affiliate_id, attribution.eligible_minor, attribution.rate_bps, amount, attribution.hold_days]
    );
    await syncCommissions(client, attribution.affiliate_id);
  }

  async function syncOrder({ client, orderId }) {
    await ensureSchema();
    const attribution = (await client.query("SELECT affiliate_id FROM affiliate_order_attributions WHERE order_id=$1", [orderId])).rows[0];
    if (attribution) await syncCommissions(client, attribution.affiliate_id);
  }

  async function balance(client, affiliateId, excludedPayoutId = null) {
    const result = await client.query(
      `SELECT
       COALESCE((SELECT SUM(amount_minor) FROM affiliate_commissions WHERE affiliate_id=$1 AND status='pending'),0) AS pending,
       COALESCE((SELECT SUM(amount_minor) FROM affiliate_commissions WHERE affiliate_id=$1 AND status<>'void'),0) AS earned,
       COALESCE((SELECT SUM(amount_minor) FROM affiliate_commissions WHERE affiliate_id=$1 AND status='available'),0)
        - COALESCE((SELECT SUM(amount_minor) FROM affiliate_payouts WHERE affiliate_id=$1 AND status IN ('pending','approved','paid') AND ($2::uuid IS NULL OR id<>$2)),0) AS available,
       COALESCE((SELECT SUM(amount_minor) FROM affiliate_payouts WHERE affiliate_id=$1 AND status='paid'),0) AS paid,
       COALESCE((SELECT SUM(amount_minor) FROM affiliate_payouts WHERE affiliate_id=$1 AND status IN ('pending','approved')),0) AS reserved`,
      [affiliateId, excludedPayoutId]
    );
    return Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]));
  }

  async function dashboard(customer) {
    return transaction(async (client) => {
      const settings = await getSettings(client);
      const account = (await client.query("SELECT * FROM affiliate_accounts WHERE customer_id=$1 FOR UPDATE", [customer.id])).rows[0];
      if (!account) return { settings: settingsView(settings), account: null };
      await syncCommissions(client, account.id);
      const balances = await balance(client, account.id);
      const clicks = (await client.query("SELECT COUNT(*)::integer AS count FROM affiliate_referrals WHERE affiliate_id=$1", [account.id])).rows[0].count;
      const count = (await client.query("SELECT COUNT(*)::integer AS count FROM affiliate_commissions WHERE affiliate_id=$1 AND status<>'void'", [account.id])).rows[0].count;
      const commissions = (await client.query(
        `SELECT id,LEFT(order_id::text,8) AS order_reference,eligible_minor,rate_bps,amount_minor,status,available_at,void_reason,created_at
         FROM affiliate_commissions WHERE affiliate_id=$1 ORDER BY created_at DESC LIMIT 100`, [account.id]
      )).rows;
      // Customers never receive a referred shopper's name, email, address, or phone.
      const payouts = (await client.query(
        `SELECT id,amount_minor,status,currency,payment_reference,admin_note,created_at,paid_at
         FROM affiliate_payouts WHERE affiliate_id=$1 ORDER BY created_at DESC LIMIT 100`, [account.id]
      )).rows;
      return { settings: settingsView(settings), account: accountView(account, settings), balances, clicks, conversions: count, commissions, payouts };
    });
  }

  async function saveBank(customer, body) {
    const bank = textField(body.bankName, "Bank name", 120);
    const name = textField(body.accountName, "Account name", 160);
    const number = String(body.accountNumber || "").trim();
    if (!/^\d{10}$/.test(number)) fail("Enter a 10-digit Nigerian bank account number.");
    return transaction(async (client) => {
      const result = await client.query(
        "UPDATE affiliate_accounts SET bank_name=$2,account_name=$3,account_number=$4,updated_at=NOW() WHERE customer_id=$1 RETURNING *",
        [customer.id, bank, name, number]
      );
      if (!result.rows.length) fail("Apply to the affiliate program first.", 404);
      return accountView(result.rows[0], await getSettings(client));
    });
  }

  async function requestPayout(customer, body) {
    const amount = moneyToMinor(body.amount);
    const key = uuid(body.requestKey, "withdrawal request key");
    return transaction(async (client) => {
      const account = (await client.query("SELECT * FROM affiliate_accounts WHERE customer_id=$1 FOR UPDATE", [customer.id])).rows[0];
      if (!account) fail("Affiliate account not found.", 404);
      const existing = (await client.query("SELECT * FROM affiliate_payouts WHERE affiliate_id=$1 AND request_key=$2", [account.id, key])).rows[0];
      if (existing) {
        if (Number(existing.amount_minor) !== amount) fail("This request key was already used for another amount.", 409);
        return { id: existing.id, status: existing.status };
      }
      if (account.status !== "approved") fail("Your affiliate account must be approved to withdraw.", 403);
      const settings = await getSettings(client);
      if (amount < Number(settings.minimum_payout_minor)) fail(`The minimum withdrawal is ₦${Number(settings.minimum_payout_minor) / 100}.`);
      if (!account.bank_name || !account.account_name || !account.account_number) fail("Save your bank details before requesting a withdrawal.");
      await syncCommissions(client, account.id);
      if (amount > (await balance(client, account.id)).available) fail("This amount exceeds your available earnings.", 409);
      const result = await client.query(
        `INSERT INTO affiliate_payouts(affiliate_id,request_key,amount_minor,bank_name,account_name,account_number)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status`,
        [account.id, key, amount, account.bank_name, account.account_name, account.account_number]
      );
      return result.rows[0];
    });
  }

  async function updateSettings(adminId, body) {
    if (typeof body.enabled !== "boolean") fail("Program status is required.");
    const rate = percentToBps(body.commissionPercent);
    const minimum = moneyToMinor(body.minimumPayout);
    if (minimum <= 0) fail("Minimum withdrawal must be greater than zero.");
    const days = Number(body.attributionDays), hold = Number(body.holdDays);
    if (!Number.isInteger(days) || days < 1 || days > 90 || !Number.isInteger(hold) || hold < 0 || hold > 90) fail("Referral window must be 1–90 days; hold period must be 0–90 days.");
    return transaction(async (client) => {
      const result = await client.query(
        `UPDATE affiliate_settings SET enabled=$1,default_rate_bps=$2,minimum_payout_minor=$3,attribution_days=$4,hold_days=$5,updated_by=$6,updated_at=NOW() WHERE id=1 RETURNING *`,
        [body.enabled, rate, minimum, days, hold, adminId]
      );
      await audit(client, adminId, "settings_updated", null, settingsView(result.rows[0]));
      return settingsView(result.rows[0]);
    });
  }

  async function updateAccount(adminId, id, body) {
    uuid(id);
    if (!["approved", "rejected", "suspended", "pending"].includes(body.status)) fail("Invalid affiliate status.");
    const rate = !Object.hasOwn(body, "commissionPercent") ? undefined : body.commissionPercent == null || body.commissionPercent === "" ? null : percentToBps(body.commissionPercent);
    const note = String(body.note || "").trim().slice(0, 1000);
    return transaction(async (client) => {
      const before = (await client.query("SELECT * FROM affiliate_accounts WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (!before) fail("Affiliate not found.", 404);
      const nextRate = rate === undefined ? before.rate_bps : rate;
      const nextNote = Object.hasOwn(body, "note") ? note : before.admin_note;
      const result = await client.query(
        "UPDATE affiliate_accounts SET status=$2,rate_bps=$3,admin_note=$4,reviewed_by=$5,updated_at=NOW() WHERE id=$1 RETURNING *",
        [id, body.status, nextRate, nextNote || null, adminId]
      );
      await audit(client, adminId, "affiliate_updated", id, { previousStatus: before.status, status: body.status, commissionPercent: nextRate == null ? null : nextRate / 100, note: nextNote });
      return accountView(result.rows[0], await getSettings(client));
    });
  }

  async function reviewPayout(adminId, id, body) {
    uuid(id);
    if (!["approved", "paid", "rejected"].includes(body.status)) fail("Invalid withdrawal status.");
    const reference = body.status === "paid" ? textField(body.paymentReference, "Transfer reference", 160) : null;
    const note = body.status === "rejected" ? textField(body.note, "Rejection reason", 1000) : String(body.note || "").trim().slice(0, 1000);
    return transaction(async (client) => {
      const found = (await client.query("SELECT affiliate_id FROM affiliate_payouts WHERE id=$1", [id])).rows[0];
      if (!found) fail("Withdrawal not found.", 404);
      const account = (await client.query("SELECT * FROM affiliate_accounts WHERE id=$1 FOR UPDATE", [found.affiliate_id])).rows[0];
      const payout = (await client.query("SELECT * FROM affiliate_payouts WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (payout.status === body.status) {
        if (body.status === "paid" && payout.payment_reference !== reference) fail("This withdrawal was already paid with another reference.", 409);
        return { id, status: payout.status };
      }
      if (["paid", "rejected"].includes(payout.status)) fail("This withdrawal is already closed.", 409);
      if (body.status === "paid" && payout.status !== "approved") fail("Approve the withdrawal before marking it paid.", 409);
      if (body.status !== "rejected") {
        if (account.status !== "approved") fail("Approve or reactivate the affiliate before processing payment.", 409);
        await syncCommissions(client, account.id);
        if (Number(payout.amount_minor) > (await balance(client, account.id, id)).available) fail("Earnings changed after an order reversal. Reject this withdrawal and request a new amount.", 409);
      }
      await client.query(
        `UPDATE affiliate_payouts SET status=$2::varchar,payment_reference=$3,admin_note=$4,reviewed_by=$5,
         paid_at=CASE WHEN $2::varchar='paid' THEN NOW() ELSE paid_at END,updated_at=NOW() WHERE id=$1`,
        [id, body.status, reference, note || null, adminId]
      );
      await audit(client, adminId, "payout_updated", id, { previousStatus: payout.status, status: body.status, paymentReference: reference, note });
      return { id, status: body.status };
    });
  }

  async function adminDashboard({ search = "", status = "all", page = 1 } = {}) {
    const offset = (Math.max(1, Math.floor(Number(page) || 1)) - 1) * 50;
    return transaction(async (client) => {
      const settings = await getSettings(client);
      const due = (await client.query(
        `SELECT DISTINCT c.affiliate_id FROM affiliate_commissions c JOIN orders o ON o.id=c.order_id
         WHERE (c.status='pending' AND c.available_at<=NOW() AND o.payment_status='paid' AND o.status IN ('delivered','completed'))
         OR (c.status<>'void' AND (o.status IN ('cancelled','canceled','refunded') OR o.payment_status IN ('refunded','failed')))`
      )).rows.map((row) => row.affiliate_id);
      if (due.length) await syncCommissions(client, due);
      const accounts = (await client.query(
        `SELECT a.*,c.full_name,c.email,
         (SELECT COUNT(*)::integer FROM affiliate_referrals r WHERE r.affiliate_id=a.id) AS clicks,
         (SELECT COUNT(*)::integer FROM affiliate_commissions k WHERE k.affiliate_id=a.id AND k.status<>'void') AS conversions
         FROM affiliate_accounts a JOIN customer_accounts c ON c.id=a.customer_id
         WHERE ($1='all' OR a.status=$1) AND (c.email ILIKE $2 OR c.full_name ILIKE $2 OR a.code ILIKE $2)
         ORDER BY a.created_at DESC LIMIT 50 OFFSET $3`, [String(status), `%${String(search).slice(0, 100)}%`, offset]
      )).rows;
      const total = (await client.query(
        `SELECT COUNT(*)::integer AS count FROM affiliate_accounts a JOIN customer_accounts c ON c.id=a.customer_id
         WHERE ($1='all' OR a.status=$1) AND (c.email ILIKE $2 OR c.full_name ILIKE $2 OR a.code ILIKE $2)`,
        [String(status), `%${String(search).slice(0, 100)}%`]
      )).rows[0].count;
      const payouts = (await client.query(
        `SELECT p.*,c.full_name,c.email,a.code FROM affiliate_payouts p JOIN affiliate_accounts a ON a.id=p.affiliate_id
         JOIN customer_accounts c ON c.id=a.customer_id ORDER BY (p.status IN ('pending','approved')) DESC,p.created_at DESC LIMIT 100`
      )).rows;
      const commissions = (await client.query(
        `SELECT k.*,a.code FROM affiliate_commissions k JOIN affiliate_accounts a ON a.id=k.affiliate_id ORDER BY k.created_at DESC LIMIT 100`
      )).rows;
      const summary = (await client.query(
        `SELECT (SELECT COUNT(*)::integer FROM affiliate_accounts WHERE status='approved') AS active,
         (SELECT COUNT(*)::integer FROM affiliate_accounts WHERE status='pending') AS applications,
         COALESCE((SELECT SUM(amount_minor) FROM affiliate_commissions WHERE status<>'void'),0) AS earned,
         COALESCE((SELECT SUM(amount_minor) FROM affiliate_payouts WHERE status='paid'),0) AS paid`
      )).rows[0];
      return { settings: settingsView(settings), accounts: accounts.map((a) => ({ ...accountView(a, settings), fullName: a.full_name, email: a.email, clicks: a.clicks, conversions: a.conversions, adminNote: a.admin_note })), total, page: offset / 50 + 1, payouts, commissions, summary };
    });
  }

  return { ensureSchema, publicSettings, apply, track, attributeOrder, recordPaidOrder, syncOrder, dashboard, saveBank, requestPayout, updateSettings, updateAccount, reviewPayout, adminDashboard };
}

module.exports = { ...createAffiliateService(), createAffiliateService, moneyToMinor, percentToBps, commissionMinor };
