const pool = require("../config/db");
const growthService = require("./growthService");
const { emitCheckoutStarted } = require("./automationEventBridge");
const {
  markBrowseAbandonmentsConvertedForCart,
} = require("./browseAbandonmentService");

const DEFAULT_WHATSAPP_MESSAGE =
  "Hi, this is LUMA Skincare. I noticed you left some items in your cart. Would you like help completing your order?";

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;

  return digits;
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "https://shopwithluma.com").replace(
    /\/$/,
    ""
  );
}

function normalizePayload(payload = {}) {
  const cartValue = Number(
    pick(
      payload.cart_value,
      payload.cartValue,
      payload.totalValue,
      payload.total_value,
      payload.total,
      payload.totalAmount,
      payload.total_amount,
      payload.cartTotal,
      payload.cart_total,
      0
    )
  );

  return {
    sessionId: pick(payload.session_id, payload.sessionId, payload.cart_token, payload.cartToken),
    customerId: pick(payload.customer_id, payload.customerId),
    customerName: pick(payload.customer_name, payload.customerName, payload.name),
    customerEmail: pick(payload.customer_email, payload.customerEmail, payload.email),
    customerPhone: pick(payload.customer_phone, payload.customerPhone, payload.phone, payload.whatsapp_number, payload.whatsappNumber),
    whatsappNumber: pick(payload.whatsapp_number, payload.whatsappNumber, payload.whatsapp, payload.whatsapp_e164),
    cartItems: pick(payload.cart_items, payload.cartItems, payload.items, []),
    cartValue,
    totalValue: cartValue,
    currency: pick(payload.currency, "NGN"),
    orderId: pick(payload.order_id, payload.orderId, payload.recovered_order_id, payload.recoveredOrderId),
    utm: payload.utm || {},
  };
}

function buildWhatsAppFollowUpLink(cart = {}) {
  const phone = normalizePhone(
    pick(
      cart.whatsapp_e164,
      cart.whatsapp_number,
      cart.customer_whatsapp,
      cart.customer_phone,
      cart.phone,
      cart.customerPhone
    )
  );

  if (!phone) return "";

  const customer = pick(cart.customer_name, cart.customerName, "there");
  const cartUrl = `${getFrontendUrl()}/cart`;
  const message = `${DEFAULT_WHATSAPP_MESSAGE}\n\n${cartUrl}\n\nCustomer: ${customer}`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function getWhatsAppStatus(cart = {}) {
  if (cart.recovered_at || cart.recovery_status === "recovered" || cart.status === "recovered") {
    return "recovered";
  }

  if (
    cart.whatsapp_followup_contacted_at ||
    cart.whatsapp_contacted_at ||
    cart.recovery_status === "whatsapp_contacted"
  ) {
    return "contacted";
  }

  if (cart.whatsapp_followup_opened_at || cart.whatsapp_followup_status === "opened") {
    return "opened";
  }

  return cart.whatsapp_followup_status || "not_contacted";
}

function formatCart(cart = {}) {
  const email = pick(cart.email, cart.customer_email, cart.customerEmail);
  const phone = pick(cart.phone, cart.customer_phone, cart.customerPhone);
  const totalValue = Number(pick(cart.cart_value, cart.cartValue, cart.total_value, cart.cart_total, cart.cartTotal, 0));
  const status = pick(cart.status, cart.recovery_status, "active");

  return {
    ...cart,
    email,
    phone,
    customer_email: email,
    customer_phone: phone,
    cart_total: totalValue,
    total_value: totalValue,
    status,
    recovery_status: pick(cart.recovery_status, status),
    recovery_email_sent:
      Boolean(cart.recovery_email_sent) ||
      Boolean(cart.recovery_email_sent_at) ||
      cart.recovery_status === "email_sent",
    recovery_email_attempts: Number(
      pick(cart.recovery_email_attempts, cart.recovery_email_count, 0)
    ),
    whatsapp_followup_status: getWhatsAppStatus(cart),
    whatsapp_link: cart.whatsapp_link || buildWhatsAppFollowUpLink({ ...cart, phone }),
  };
}

async function getExistingAbandonedCartColumns() {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'abandoned_carts'
    `
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function syncPhaseSixColumns(cartId, payload = {}) {
  if (!cartId) return null;

  const columns = await getExistingAbandonedCartColumns();
  const setClauses = [];

  if (columns.has("customer_email") && columns.has("email")) {
    setClauses.push("customer_email = COALESCE(NULLIF(customer_email, ''), NULLIF(email, ''))");
    setClauses.push("email = COALESCE(NULLIF(email, ''), NULLIF(customer_email, ''))");
  }

  if (columns.has("customer_phone") && columns.has("phone")) {
    setClauses.push("customer_phone = COALESCE(NULLIF(customer_phone, ''), NULLIF(phone, ''))");
    setClauses.push("phone = COALESCE(NULLIF(phone, ''), NULLIF(customer_phone, ''))");
  }

  if (columns.has("cart_value")) {
    const totalSources = [
      columns.has("total_value") ? "NULLIF(total_value, 0)" : null,
      columns.has("cart_total") ? "NULLIF(cart_total, 0)" : null,
      "0",
    ].filter(Boolean).join(", ");
    setClauses.push(`cart_value = COALESCE(NULLIF(cart_value, 0), ${totalSources})`);
  }

  if (columns.has("total_value")) {
    const valueSources = [
      columns.has("cart_value") ? "NULLIF(cart_value, 0)" : null,
      columns.has("cart_total") ? "NULLIF(cart_total, 0)" : null,
      "0",
    ].filter(Boolean).join(", ");
    setClauses.push(`total_value = COALESCE(NULLIF(total_value, 0), ${valueSources})`);
  }

  if (columns.has("cart_total")) {
    const valueSources = [
      columns.has("cart_value") ? "NULLIF(cart_value, 0)" : null,
      columns.has("total_value") ? "NULLIF(total_value, 0)" : null,
      "0",
    ].filter(Boolean).join(", ");
    setClauses.push(`cart_total = COALESCE(NULLIF(cart_total, 0), ${valueSources})`);
  }

  if (columns.has("currency")) {
    setClauses.push("currency = COALESCE(NULLIF(currency, ''), $2)");
  }

  if (columns.has("status") && columns.has("recovery_status")) {
    setClauses.push("status = COALESCE(NULLIF(status, ''), recovery_status, 'active')");
    setClauses.push("recovery_status = COALESCE(NULLIF(recovery_status, ''), status, 'not_contacted')");
  }

  if (columns.has("recovery_email_sent") && columns.has("recovery_email_sent_at")) {
    setClauses.push("recovery_email_sent = COALESCE(recovery_email_sent, recovery_email_sent_at IS NOT NULL, false)");
  }

  if (columns.has("recovery_email_attempts") && columns.has("recovery_email_count")) {
    setClauses.push("recovery_email_attempts = COALESCE(recovery_email_attempts, recovery_email_count, 0)");
    setClauses.push("recovery_email_count = COALESCE(recovery_email_count, recovery_email_attempts, 0)");
  }

  if (columns.has("whatsapp_followup_status")) {
    if (columns.has("whatsapp_contacted_at")) {
      setClauses.push(`whatsapp_followup_status = CASE
        WHEN whatsapp_contacted_at IS NOT NULL THEN 'contacted'
        ELSE COALESCE(NULLIF(whatsapp_followup_status, ''), 'not_contacted')
      END`);
    } else {
      setClauses.push("whatsapp_followup_status = COALESCE(NULLIF(whatsapp_followup_status, ''), 'not_contacted')");
    }
  }

  if (columns.has("whatsapp_followup_contacted_at") && columns.has("whatsapp_contacted_at")) {
    setClauses.push("whatsapp_followup_contacted_at = COALESCE(whatsapp_followup_contacted_at, whatsapp_contacted_at)");
  }

  if (columns.has("updated_at")) {
    setClauses.push("updated_at = CURRENT_TIMESTAMP");
  }

  if (!setClauses.length) return null;

  const result = await pool.query(
    `
      UPDATE abandoned_carts
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING *
    `,
    [cartId, payload.currency || "NGN"]
  );

  return result.rows[0] || null;
}
async function syncCustomerIdentity(cartId, payload = {}) {
  if (!cartId || !payload.customerId) return null;

  const columns = await getExistingAbandonedCartColumns();
  if (!columns.has("customer_id")) return null;

  await pool.query(
    `
      UPDATE abandoned_carts
      SET customer_id = COALESCE(customer_id, $2)
      WHERE id = $1
    `,
    [cartId, payload.customerId]
  );

  return true;
}

async function markMatchingCartCheckoutStarted(payload) {
  const columns = await getExistingAbandonedCartColumns();
  const setClauses = [];

  if (columns.has("last_activity_at")) {
    setClauses.push("last_activity_at = CURRENT_TIMESTAMP");
  }

  if (columns.has("updated_at")) {
    setClauses.push("updated_at = CURRENT_TIMESTAMP");
  }

  if (columns.has("checkout_started_at")) {
    setClauses.push("checkout_started_at = COALESCE(checkout_started_at, CURRENT_TIMESTAMP)");
  }

  if (columns.has("recovery_status")) {
    setClauses.push(`
      recovery_status = CASE
        WHEN recovery_status = 'recovered' THEN recovery_status
        ELSE 'checkout_started'
      END
    `);
  }

  if (columns.has("status")) {
    setClauses.push(`
      status = CASE
        WHEN status = 'recovered' THEN status
        ELSE 'checkout_started'
      END
    `);
  }

  const whereClauses = [];
  const params = [];

  if (payload.sessionId && columns.has("session_id")) {
    params.push(payload.sessionId);
    whereClauses.push(`session_id = $${params.length}`);
  }

  if (payload.customerEmail) {
    if (columns.has("customer_email")) {
      params.push(payload.customerEmail);
      whereClauses.push(`customer_email = $${params.length}`);
    }

    if (columns.has("email")) {
      params.push(payload.customerEmail);
      whereClauses.push(`email = $${params.length}`);
    }
  }

  if (payload.customerPhone) {
    if (columns.has("customer_phone")) {
      params.push(payload.customerPhone);
      whereClauses.push(`customer_phone = $${params.length}`);
    }

    if (columns.has("phone")) {
      params.push(payload.customerPhone);
      whereClauses.push(`phone = $${params.length}`);
    }
  }

  if (whereClauses.length === 0) return null;
  if (setClauses.length === 0) return null;

  const result = await pool.query(
    `
      UPDATE abandoned_carts
      SET ${setClauses.join(", ")}
      WHERE ${whereClauses.join(" OR ")}
      RETURNING *
    `,
    params
  );

  return result.rows[0] || null;
}

async function trackCart(payload) {
  const normalized = normalizePayload(payload);
  const data = await growthService.saveAbandonedCart(normalized);
  await syncCustomerIdentity(data.data?.id, normalized);
  const synced = await syncPhaseSixColumns(data.data?.id, normalized);
  const stored = Boolean(data.stored && data.data?.id);

  if (process.env.NODE_ENV !== "production") {
    console.log("Cart sync normalized", {
      sessionId: normalized.sessionId,
      customerEmail: normalized.customerEmail,
      customerId: normalized.customerId,
      itemCount: Array.isArray(normalized.cartItems) ? normalized.cartItems.length : 0,
      cartValue: normalized.cartValue,
      stored,
    });
  }

  markBrowseAbandonmentsConvertedForCart({
    ...normalized,
    source: "cart_sync",
  }).catch((error) => {
    console.error("Browse abandonment cart conversion error:", error.message);
  });

  return {
    ...data,
    data: synced ? formatCart(synced) : data.data,
  };
}

async function markCheckoutStarted(payload) {
  const normalized = normalizePayload(payload);
  const data = await growthService.saveCheckoutStart(normalized);
  const startedCart = await markMatchingCartCheckoutStarted(normalized);
  const synced = await syncPhaseSixColumns(startedCart?.id, normalized);
  await emitCheckoutStarted({
    ...normalized,
    cartValue: normalized.cartValue,
    analyticsAlreadyRecorded: true,
    source: "cart_checkout_started",
  });

  markBrowseAbandonmentsConvertedForCart({
    ...normalized,
    source: "checkout_started",
  }).catch((error) => {
    console.error("Browse abandonment checkout conversion error:", error.message);
  });

  return {
    ...data,
    abandonedCart: synced ? formatCart(synced) : null,
  };
}

async function markRecovered(payload) {
  const normalized = normalizePayload(payload);
  const data = await growthService.markAbandonedCartRecovered(normalized);
  const synced = await syncPhaseSixColumns(data.data?.id, normalized);

  return {
    ...data,
    data: synced ? formatCart(synced) : data.data,
  };
}

async function getAdminAbandonedCarts(filters = {}) {
  const data = await growthService.listAbandonedCarts(filters);

  return {
    ...data,
    carts: (data.carts || []).map(formatCart),
  };
}

async function sendRecoveryEmail(cartId) {
  const data = await growthService.sendRecoveryEmailForCart(cartId);

  return {
    ...data,
    data: data.data ? formatCart(data.data) : data.data,
  };
}

async function runRecovery(payload = {}) {
  return growthService.sendDueAbandonedCartRecoveryEmails(payload);
}


async function processAbandonedCarts(payload = {}) {
  const enabled = String(process.env.ABANDONED_CART_EMAIL_ENABLED || "true").toLowerCase() !== "false";

  if (!enabled) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      message: "Abandoned cart email automation is disabled.",
    };
  }

  const result = await runRecovery({ limit: payload.limit || 25 });
  const results = Array.isArray(result?.results) ? result.results : [];
  const sent = results.filter((item) => item.sent || item.status === "email_sent").length;
  const failed = results.filter((item) => item.status === "failed" || item.error).length;

  return {
    processed: Number(result?.processed || results.length || 0),
    sent,
    failed,
    skipped: Math.max(0, results.length - sent - failed),
    results,
  };
}
async function markWhatsAppOpened(cartId) {
  const columns = await getExistingAbandonedCartColumns();

  if (!columns.has("whatsapp_followup_status") || !columns.has("whatsapp_followup_opened_at")) {
    return {
      updated: false,
      status: "migration_needed",
      message: "Run the Phase 6 abandoned cart migration to store WhatsApp opened status.",
    };
  }

  const updatedAtClause = columns.has("updated_at") ? ", updated_at = CURRENT_TIMESTAMP" : "";
  const result = await pool.query(
    `
      UPDATE abandoned_carts
      SET
        whatsapp_followup_status = CASE
          WHEN whatsapp_followup_status = 'contacted' THEN whatsapp_followup_status
          ELSE 'opened'
        END,
        whatsapp_followup_opened_at = COALESCE(whatsapp_followup_opened_at, CURRENT_TIMESTAMP)
        ${updatedAtClause}
      WHERE id = $1
      RETURNING *
    `,
    [cartId]
  );

  return {
    updated: result.rowCount > 0,
    status: result.rowCount > 0 ? "opened" : "not_found",
    data: result.rows[0] ? formatCart(result.rows[0]) : null,
  };
}

async function markWhatsAppContacted(cartId) {
  const data = await growthService.markWhatsappContacted(cartId);
  const synced = await syncPhaseSixColumns(data.data?.id || cartId);

  return {
    ...data,
    data: synced ? formatCart(synced) : data.data ? formatCart(data.data) : data.data,
  };
}

module.exports = {
  buildWhatsAppFollowUpLink,
  formatCart,
  getAdminAbandonedCarts,
  markCheckoutStarted,
  processAbandonedCarts,
  markRecovered,
  markWhatsAppContacted,
  markWhatsAppOpened,
  runRecovery,
  sendRecoveryEmail,
  trackCart,
};






