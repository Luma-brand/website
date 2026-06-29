const pool = require("../config/db");
const { getIntegrationStatus } = require("./integrationService");
const {
  getOrderWithItems,
  sendEmail,
  sendLifecycleEmail,
  sendOrderConfirmationEmails,
  sendWelcomeEmail,
} = require("./emailService");

const FLOW_DEFINITIONS = [
  {
    eventType: "welcome_email",
    label: "Welcome email",
    channel: "email",
    triggerMode: "customer_or_manual",
    aliases: [],
  },
  {
    eventType: "order_confirmation",
    label: "Order confirmation",
    channel: "email",
    triggerMode: "paid_order",
    aliases: [],
  },
  {
    eventType: "post_purchase_followup",
    label: "Post-purchase follow-up",
    channel: "email",
    triggerMode: "manual_due_batch",
    delayDays: 7,
    aliases: [],
  },
  {
    eventType: "review_request",
    label: "Review request",
    channel: "email",
    triggerMode: "manual_due_batch",
    delayDays: 14,
    aliases: [],
  },
  {
    eventType: "reorder_reminder",
    label: "Reorder reminder",
    channel: "email",
    triggerMode: "manual_due_batch",
    delayDays: 45,
    aliases: [],
  },
  {
    eventType: "winback_email",
    label: "Win-back email",
    channel: "email",
    triggerMode: "manual_due_batch",
    delayDays: 90,
    aliases: ["winback_campaign"],
  },
  {
    eventType: "abandoned_cart_recovery",
    label: "Abandoned cart recovery",
    channel: "email",
    triggerMode: "manual_due_batch",
    aliases: ["abandoned_cart_recovery_email"],
  },
  {
    eventType: "checkout_recovery",
    label: "Checkout recovery",
    channel: "email",
    triggerMode: "manual_due_batch",
    aliases: ["abandoned_checkout_recovery", "checkout_recovery_email"],
  },
  {
    eventType: "back_in_stock_alert",
    label: "Back-in-stock alert",
    channel: "email",
    triggerMode: "stock_change_or_manual",
    aliases: ["back_in_stock"],
  },
];

const FLOW_BY_TYPE = new Map();

for (const definition of FLOW_DEFINITIONS) {
  FLOW_BY_TYPE.set(definition.eventType, definition);
  for (const alias of definition.aliases) {
    FLOW_BY_TYPE.set(alias, definition);
  }
}

const AUTOMATION_TYPES = Array.from(FLOW_BY_TYPE.keys());

function isOptionalTableError(error) {
  return ["42P01", "42703"].includes(error.code);
}

async function runOptionalQuery(query, params = [], fallback) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    if (isOptionalTableError(error)) {
      return fallback;
    }

    throw error;
  }
}

function normalizeFlowType(eventType) {
  const definition = FLOW_BY_TYPE.get(String(eventType || "").trim());
  return definition?.eventType || null;
}

function getEmailConfigured() {
  const integrationStatus = getIntegrationStatus();
  return integrationStatus.integrations.some(
    (item) => item.key === "email" && item.status === "configured"
  );
}

function getFlowDefinition(eventType) {
  const normalizedEventType = normalizeFlowType(eventType);

  if (!normalizedEventType) {
    const error = new Error("Unsupported automation flow.");
    error.statusCode = 400;
    throw error;
  }

  return FLOW_DEFINITIONS.find(
    (definition) => definition.eventType === normalizedEventType
  );
}

function buildEventTypesForQuery(definition) {
  return [definition.eventType, ...definition.aliases];
}

async function getAutomationStatus() {
  const emailConfigured = getEmailConfigured();

  const eventRows = await runOptionalQuery(
    `
      SELECT
        event_type,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM automation_events
      GROUP BY event_type
    `,
    [],
    []
  );

  const eventMap = new Map(eventRows.map((row) => [row.event_type, row]));

  const automations = FLOW_DEFINITIONS.map((definition) => {
    const stats = buildEventTypesForQuery(definition).reduce(
      (totals, eventType) => {
        const row = eventMap.get(eventType) || {};
        return {
          total: totals.total + Number(row.total || 0),
          pending: totals.pending + Number(row.pending || 0),
          sent: totals.sent + Number(row.sent || 0),
          failed: totals.failed + Number(row.failed || 0),
        };
      },
      { total: 0, pending: 0, sent: 0, failed: 0 }
    );

    const configurationStatus = emailConfigured ? "configured" : "not_configured";
    const status = !emailConfigured
      ? "not_configured"
      : stats.pending > 0
        ? "pending"
        : stats.failed > 0
          ? "failed"
          : stats.sent > 0
            ? "sent"
            : "configured";

    return {
      ...definition,
      requiredIntegration: "email",
      configurationStatus,
      status,
      configured: emailConfigured,
      ...stats,
    };
  });

  return {
    summary: {
      total: automations.length,
      configured: automations.filter(
        (item) => item.configurationStatus === "configured"
      ).length,
      notConfigured: automations.filter(
        (item) => item.configurationStatus === "not_configured"
      ).length,
      pending: automations.reduce((total, item) => total + item.pending, 0),
      sent: automations.reduce((total, item) => total + item.sent, 0),
      failed: automations.reduce((total, item) => total + item.failed, 0),
    },
    scheduler: {
      type: "manual_admin_trigger",
      message:
        "No dedicated cron runner is configured here. Use admin trigger endpoints now, then wire a cron job to call them later.",
    },
    automations,
  };
}

async function queueAutomationEvent({
  eventType,
  status = "pending",
  channel = "email",
  customerEmail,
  customerPhone,
  productId,
  orderId,
  payload = {},
  scheduledFor,
} = {}) {
  if (!FLOW_BY_TYPE.has(eventType)) {
    return {
      queued: false,
      status: "invalid_event_type",
    };
  }

  const rows = await runOptionalQuery(
    `
      INSERT INTO automation_events (
        event_type,
        status,
        channel,
        customer_email,
        customer_phone,
        product_id,
        order_id,
        payload,
        scheduled_for
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      RETURNING id, event_type, status, created_at
    `,
    [
      eventType,
      status,
      channel,
      customerEmail || null,
      customerPhone || null,
      productId || null,
      orderId || null,
      JSON.stringify(payload || {}),
      scheduledFor || null,
    ],
    []
  );

  if (!rows.length) {
    return {
      queued: false,
      status: "not_configured",
      message: "Automation event table is not available yet.",
    };
  }

  return {
    queued: true,
    status: rows[0].status,
    data: rows[0],
  };
}

async function updateAutomationEvent(id, status, errorMessage = null) {
  if (!id) return null;

  const rows = await runOptionalQuery(
    `
      UPDATE automation_events
      SET
        status = $2,
        error_message = $3,
        sent_at = CASE WHEN $2 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, event_type, status, sent_at, error_message
    `,
    [id, status, errorMessage],
    []
  );

  return rows[0] || null;
}

async function recordAutomationAttempt({
  eventType,
  status = "pending",
  channel = "email",
  customerEmail,
  customerPhone,
  productId,
  orderId,
  payload = {},
  errorMessage,
} = {}) {
  const normalizedEventType = normalizeFlowType(eventType) || eventType;

  const rows = await runOptionalQuery(
    `
      INSERT INTO automation_events (
        event_type,
        status,
        channel,
        customer_email,
        customer_phone,
        product_id,
        order_id,
        payload,
        error_message,
        sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, CASE WHEN $2 = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END)
      RETURNING id, event_type, status, created_at
    `,
    [
      normalizedEventType,
      status,
      channel,
      customerEmail || null,
      customerPhone || null,
      productId || null,
      orderId || null,
      JSON.stringify(payload || {}),
      errorMessage || null,
    ],
    []
  );

  return rows[0] || null;
}

async function runTrackedEmail(eventType, context, sendFn) {
  const pending = await recordAutomationAttempt({
    ...context,
    eventType,
    status: "pending",
  });

  try {
    const result = await sendFn();

    if (result && result.sent === false) {
      throw new Error(result.message || "Email was not sent.");
    }

    const event = await updateAutomationEvent(pending?.id, "sent");

    return {
      sent: true,
      status: "sent",
      event,
      result,
    };
  } catch (error) {
    const event = await updateAutomationEvent(
      pending?.id,
      "failed",
      error.message
    );

    if (!pending?.id) {
      await recordAutomationAttempt({
        ...context,
        eventType,
        status: "failed",
        errorMessage: error.message,
      });
    }

    return {
      sent: false,
      status: "failed",
      message: error.message,
      event,
    };
  }
}

async function sendWelcomeEmailForCustomer(customer) {
  if (!customer?.email) {
    return {
      sent: false,
      status: "missing_email",
      message: "Customer email is required.",
    };
  }

  return runTrackedEmail(
    "welcome_email",
    {
      customerEmail: customer.email,
      payload: {
        customerId: customer.id || null,
        source: "customer_registration",
      },
    },
    () => sendWelcomeEmail(customer)
  );
}

async function sendOrderConfirmationAutomation(orderId) {
  const order = await getOrderWithItems(orderId);

  if (!order) {
    return {
      sent: false,
      status: "not_found",
      message: "Order not found.",
    };
  }

  return runTrackedEmail(
    "order_confirmation",
    {
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      orderId: order.id,
      payload: { source: "paid_order" },
    },
    () => sendOrderConfirmationEmails(order.id)
  );
}

async function getDuePaidOrdersForFlow(definition, limit = 25) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);

  return runOptionalQuery(
    `
      SELECT orders.id
      FROM orders
      WHERE orders.payment_status = 'paid'
        AND orders.customer_email IS NOT NULL
        AND orders.created_at <= CURRENT_TIMESTAMP - ($1 || ' days')::interval
        AND NOT EXISTS (
          SELECT 1
          FROM automation_events event
          WHERE event.order_id = orders.id
            AND event.event_type = ANY($2::text[])
            AND event.status = 'sent'
        )
      ORDER BY orders.created_at ASC
      LIMIT $3
    `,
    [definition.delayDays || 7, buildEventTypesForQuery(definition), safeLimit],
    []
  );
}

async function sendDueOrderLifecycleEmails(eventType, limit = 25) {
  const definition = getFlowDefinition(eventType);
  const rows = await getDuePaidOrdersForFlow(definition, limit);
  const results = [];

  for (const row of rows) {
    const order = await getOrderWithItems(row.id);

    if (!order) {
      results.push({
        orderId: row.id,
        sent: false,
        status: "not_found",
      });
      continue;
    }

    const result = await runTrackedEmail(
      definition.eventType,
      {
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        orderId: order.id,
        payload: {
          source: "manual_due_batch",
          delayDays: definition.delayDays,
        },
      },
      () =>
        sendLifecycleEmail({
          eventType: definition.eventType,
          order,
        })
    );

    results.push({
      orderId: order.id,
      ...result,
    });
  }

  return {
    processed: results.length,
    sent: results.filter((result) => result.sent).length,
    results,
  };
}

async function sendLifecycleEmailForOrder(eventType, orderId) {
  const definition = getFlowDefinition(eventType);
  const order = await getOrderWithItems(orderId);

  if (!order) {
    return {
      sent: false,
      status: "not_found",
      message: "Order not found.",
    };
  }

  return runTrackedEmail(
    definition.eventType,
    {
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      orderId: order.id,
      payload: { source: "manual_order_trigger" },
    },
    () =>
      sendLifecycleEmail({
        eventType: definition.eventType,
        order,
      })
  );
}

async function getDueWinbackCustomers(limit = 25) {
  const definition = getFlowDefinition("winback_email");
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);

  return runOptionalQuery(
    `
      WITH paid_customers AS (
        SELECT
          LOWER(customer_email) AS email,
          MAX(customer_name) AS name,
          MAX(customer_phone) AS phone,
          MAX(created_at) AS last_order_at
        FROM orders
        WHERE payment_status = 'paid'
          AND customer_email IS NOT NULL
        GROUP BY LOWER(customer_email)
      )
      SELECT *
      FROM paid_customers
      WHERE last_order_at <= CURRENT_TIMESTAMP - ($1 || ' days')::interval
        AND NOT EXISTS (
          SELECT 1
          FROM automation_events event
          WHERE LOWER(event.customer_email) = paid_customers.email
            AND event.event_type = ANY($2::text[])
            AND event.status = 'sent'
        )
      ORDER BY last_order_at ASC
      LIMIT $3
    `,
    [definition.delayDays, buildEventTypesForQuery(definition), safeLimit],
    []
  );
}

async function sendDueWinbackEmails(limit = 25) {
  const rows = await getDueWinbackCustomers(limit);
  const results = [];

  for (const customer of rows) {
    const result = await runTrackedEmail(
      "winback_email",
      {
        customerEmail: customer.email,
        customerPhone: customer.phone,
        payload: {
          source: "manual_due_batch",
          lastOrderAt: customer.last_order_at,
        },
      },
      () =>
        sendLifecycleEmail({
          eventType: "winback_email",
          customer,
        })
    );

    results.push({
      customerEmail: customer.email,
      ...result,
    });
  }

  return {
    processed: results.length,
    sent: results.filter((result) => result.sent).length,
    results,
  };
}

async function sendWinbackEmailForCustomer(customerEmail) {
  const email = String(customerEmail || "").trim().toLowerCase();

  if (!email) {
    return {
      sent: false,
      status: "missing_email",
      message: "Customer email is required.",
    };
  }

  const rows = await runOptionalQuery(
    `
      SELECT
        LOWER(customer_email) AS email,
        MAX(customer_name) AS name,
        MAX(customer_phone) AS phone,
        MAX(created_at) AS last_order_at
      FROM orders
      WHERE LOWER(customer_email) = LOWER($1)
      GROUP BY LOWER(customer_email)
      LIMIT 1
    `,
    [email],
    []
  );

  const customer = rows[0] || { email };

  return runTrackedEmail(
    "winback_email",
    {
      customerEmail: email,
      customerPhone: customer.phone,
      payload: {
        source: "manual_customer_trigger",
        lastOrderAt: customer.last_order_at || null,
      },
    },
    () =>
      sendLifecycleEmail({
        eventType: "winback_email",
        customer,
      })
  );
}

async function sendBackInStockDueAlerts({ productId, limit = 25 } = {}) {
  const { sendBackInStockNotificationsForProduct } = require("./growthService");

  if (productId) {
    const result = await sendBackInStockNotificationsForProduct(productId);

    await recordAutomationAttempt({
      eventType: "back_in_stock_alert",
      status: result.sent > 0 ? "sent" : "pending",
      productId,
      payload: {
        source: "manual_product_trigger",
        result,
      },
    });

    return result;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const products = await runOptionalQuery(
    `
      SELECT DISTINCT product.id
      FROM back_in_stock_requests request
      JOIN products product ON product.id = request.product_id
      WHERE request.status IN ('waiting', 'ready_to_notify')
        AND request.notified_at IS NULL
        AND COALESCE(product.stock_quantity, 0) > 0
      ORDER BY product.id
      LIMIT $1
    `,
    [safeLimit],
    []
  );

  const results = [];

  for (const product of products) {
    results.push({
      productId: product.id,
      ...(await sendBackInStockDueAlerts({ productId: product.id })),
    });
  }

  return {
    processed: results.length,
    sent: results.reduce((total, result) => total + Number(result.sent || 0), 0),
    results,
  };
}

async function triggerAutomationFlow(eventType, payload = {}) {
  const definition = getFlowDefinition(eventType);

  if (!getEmailConfigured()) {
    return {
      success: false,
      status: "not_configured",
      message: "Resend email is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  const limit = payload.limit;

  if (definition.eventType === "welcome_email") {
    return sendWelcomeEmailForCustomer({
      id: payload.customerId || null,
      email: payload.customerEmail || payload.email,
      full_name: payload.customerName || payload.name || "there",
    });
  }

  if (definition.eventType === "order_confirmation") {
    return sendOrderConfirmationAutomation(payload.orderId);
  }

  if (
    ["post_purchase_followup", "review_request", "reorder_reminder"].includes(
      definition.eventType
    )
  ) {
    if (payload.orderId) {
      return sendLifecycleEmailForOrder(definition.eventType, payload.orderId);
    }

    return sendDueOrderLifecycleEmails(definition.eventType, limit);
  }

  if (definition.eventType === "winback_email") {
    if (payload.customerEmail || payload.email) {
      return sendWinbackEmailForCustomer(payload.customerEmail || payload.email);
    }

    return sendDueWinbackEmails(limit);
  }

  if (definition.eventType === "abandoned_cart_recovery") {
    const {
      sendDueAbandonedCartRecoveryEmails,
      sendRecoveryEmailForCart,
    } = require("./growthService");

    const result = payload.cartId
      ? sendRecoveryEmailForCart(payload.cartId)
      : sendDueAbandonedCartRecoveryEmails({ limit });
    const resolvedResult = await result;
    const sentCount =
      resolvedResult.sent === true ? 1 : Number(resolvedResult.sent || 0);
    const failedCount = Array.isArray(resolvedResult.results)
      ? resolvedResult.results.filter((item) => item.status === "failed").length
      : resolvedResult.status === "failed"
        ? 1
        : 0;

    await recordAutomationAttempt({
      eventType: "abandoned_cart_recovery",
      status: sentCount > 0 ? "sent" : failedCount > 0 ? "failed" : "pending",
      payload: {
        source: payload.cartId ? "manual_cart_trigger" : "manual_due_batch",
        cartId: payload.cartId || null,
        result: resolvedResult,
      },
      errorMessage: failedCount > 0 ? "One or more recovery emails failed." : null,
    });

    return resolvedResult;
  }

  if (definition.eventType === "checkout_recovery") {
    const {
      sendDueCheckoutRecoveryEmails,
      sendRecoveryEmailForCheckout,
    } = require("./growthService");

    const result = payload.checkoutId
      ? sendRecoveryEmailForCheckout(payload.checkoutId)
      : sendDueCheckoutRecoveryEmails({ limit });
    const resolvedResult = await result;
    const sentCount =
      resolvedResult.sent === true ? 1 : Number(resolvedResult.sent || 0);
    const failedCount = Array.isArray(resolvedResult.results)
      ? resolvedResult.results.filter((item) => item.status === "failed").length
      : resolvedResult.status === "failed"
        ? 1
        : 0;

    await recordAutomationAttempt({
      eventType: "checkout_recovery",
      status: sentCount > 0 ? "sent" : failedCount > 0 ? "failed" : "pending",
      payload: {
        source: payload.checkoutId
          ? "manual_checkout_trigger"
          : "manual_due_batch",
        checkoutId: payload.checkoutId || null,
        result: resolvedResult,
      },
      errorMessage: failedCount > 0 ? "One or more recovery emails failed." : null,
    });

    return resolvedResult;
  }

  if (definition.eventType === "back_in_stock_alert") {
    return sendBackInStockDueAlerts({
      productId: payload.productId,
      limit,
    });
  }

  return {
    success: false,
    status: "unsupported",
    message: "Unsupported automation flow.",
  };
}

function getAutomationCronPlan() {
  const frontendUrl =
    process.env.FRONTEND_URL || "https://shopwithluma.com";

  return {
    scheduler: "manual_admin_trigger_until_cron_is_configured",
    productionFrontendUrl: frontendUrl,
    endpointPattern: "POST /api/automation/trigger/:flow",
    recommendedCron: [
      {
        flow: "abandoned_cart_recovery",
        cadence: "Every 15 minutes",
        payload: { limit: 25 },
      },
      {
        flow: "checkout_recovery",
        cadence: "Every 15 minutes",
        payload: { limit: 25 },
      },
      {
        flow: "post_purchase_followup",
        cadence: "Daily",
        payload: { limit: 50 },
      },
      {
        flow: "review_request",
        cadence: "Daily",
        payload: { limit: 50 },
      },
      {
        flow: "reorder_reminder",
        cadence: "Daily",
        payload: { limit: 50 },
      },
      {
        flow: "winback_email",
        cadence: "Weekly",
        payload: { limit: 50 },
      },
      {
        flow: "back_in_stock_alert",
        cadence: "After stock update or every 30 minutes",
        payload: { limit: 25 },
      },
    ],
  };
}

module.exports = {
  AUTOMATION_TYPES,
  FLOW_DEFINITIONS,
  getAutomationCronPlan,
  getAutomationStatus,
  queueAutomationEvent,
  recordAutomationAttempt,
  sendOrderConfirmationAutomation,
  sendWelcomeEmailForCustomer,
  triggerAutomationFlow,
};

// Internal customer journey automation flow extensions.
const legacyAutomationExports = module.exports;

const JOURNEY_TRIGGER_EVENTS = [
  "customer_signup",
  "order_completed",
  "product_viewed",
  "cart_abandoned",
  "checkout_started",
  "checkout_abandoned",
  "product_back_in_stock",
  "customer_inactive",
  "low_stock_product",
];

const DEFAULT_JOURNEY_FLOWS = [
  {
    name: "Welcome Series",
    flowKey: "welcome_series",
    type: "welcome_series",
    triggerEvent: "customer_signup",
    description: "A soft welcome journey for new LUMA customers.",
    subject: "Welcome to LUMA",
    delayAmount: 0,
    delayUnit: "minutes",
  },
  {
    name: "Post Purchase Thank You",
    flowKey: "post_purchase_thank_you",
    type: "post_purchase_thank_you",
    triggerEvent: "order_completed",
    description: "A thank-you note after successful paid orders.",
    subject: "Thank you for your LUMA order",
    delayAmount: 0,
    delayUnit: "minutes",
  },
  {
    name: "Review Request",
    flowKey: "review_request_journey",
    type: "review_request",
    triggerEvent: "order_completed",
    description: "Ask customers for a review after they have had time with their order.",
    subject: "Share your LUMA skincare experience",
    delayAmount: 14,
    delayUnit: "days",
  },
  {
    name: "Win Back",
    flowKey: "win_back_journey",
    type: "winback_email",
    triggerEvent: "customer_inactive",
    description: "Invite inactive customers back to LUMA.",
    subject: "Your LUMA routine is still here",
    delayAmount: 0,
    delayUnit: "minutes",
  },
  {
    name: "Reorder Reminder",
    flowKey: "reorder_reminder_journey",
    type: "reorder_reminder",
    triggerEvent: "order_completed",
    description: "A gentle restock reminder for consumable products.",
    subject: "Time to restock your LUMA essentials?",
    delayAmount: 45,
    delayUnit: "days",
  },
  {
    name: "Browse Abandonment",
    flowKey: "browse_abandonment",
    type: "browse_abandonment",
    triggerEvent: "product_viewed",
    description: "Foundation flow for product views without cart activity.",
    subject: "Still thinking about your LUMA pick?",
    delayAmount: 2,
    delayUnit: "hours",
  },
  {
    name: "Checkout Abandonment",
    flowKey: "checkout_abandonment_journey",
    type: "checkout_abandonment",
    triggerEvent: "checkout_abandoned",
    description: "Foundation flow for started checkouts that do not complete payment.",
    subject: "Your LUMA checkout is waiting",
    delayAmount: 2,
    delayUnit: "hours",
  },
  {
    name: "Back In Stock",
    flowKey: "back_in_stock_journey",
    type: "back_in_stock_alert",
    triggerEvent: "product_back_in_stock",
    description: "Foundation flow for product waitlist notifications.",
    subject: "Your LUMA product is back",
    delayAmount: 0,
    delayUnit: "minutes",
  },
  {
    name: "Low Stock Urgency",
    flowKey: "low_stock_urgency",
    type: "low_stock_urgency",
    triggerEvent: "low_stock_product",
    description: "Foundation flow for low-stock interest signals.",
    subject: "A LUMA favorite is almost gone",
    delayAmount: 0,
    delayUnit: "minutes",
  },
];

function normalizeJourneyKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function delayToMinutes(amount = 0, unit = "minutes") {
  const safeAmount = Math.max(0, Number(amount || 0));
  if (unit === "days") return safeAmount * 24 * 60;
  if (unit === "hours") return safeAmount * 60;
  return safeAmount;
}

function addDelay(date, amount = 0, unit = "minutes") {
  const next = new Date(date || Date.now());
  next.setMinutes(next.getMinutes() + delayToMinutes(amount, unit));
  return next;
}

function buildDefaultJourneyHtml({ title, body, buttonText = "Visit LUMA", buttonUrl = `${process.env.FRONTEND_URL || "https://shopwithluma.com"}/products` } = {}) {
  return `
    <div style="background:#f8f1e8;padding:28px;font-family:Arial,sans-serif;color:#2a1d16;">
      <div style="max-width:620px;margin:0 auto;background:#fffaf4;border:1px solid #eadfce;border-radius:22px;padding:30px;">
        <p style="letter-spacing:.18em;text-transform:uppercase;color:#8b6a4f;font-size:12px;margin:0 0 18px;">LUMA Skincare</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px;color:#24170f;">${title}</h1>
        <p style="font-size:15px;line-height:1.7;margin:0 0 24px;color:#5e5046;">${body}</p>
        <a href="${buttonUrl}" style="display:inline-block;background:#2a1d16;color:#fff;text-decoration:none;padding:13px 20px;border-radius:999px;font-weight:700;">${buttonText}</a>
      </div>
    </div>`;
}

function getDefaultFlowCopy(flowType) {
  const copy = {
    welcome_series: ["Welcome to LUMA", "We are glad you are here. Your LUMA routine can stay simple, soft, and intentional."],
    post_purchase_thank_you: ["Thank you for your LUMA order", "Your order means a lot to us. We hope your new LUMA essentials feel beautiful in your routine."],
    review_request: ["Share your LUMA skincare experience", "If your order has settled into your routine, we would love to hear how it worked for you."],
    reorder_reminder: ["Time to restock your LUMA essentials?", "A gentle reminder to check your shelf before your favorite product runs low."],
    winback_email: ["Your LUMA routine is still here", "Whenever you are ready to return to your routine, LUMA is here with soft essentials."],
    browse_abandonment: ["Still thinking about your LUMA pick?", "You viewed something beautiful. Here is a quick path back when you are ready."],
    checkout_abandonment: ["Your LUMA checkout is waiting", "Your selected LUMA items are still waiting for you."],
    back_in_stock_alert: ["Your LUMA product is back", "The product you asked about is available again."],
    low_stock_urgency: ["A LUMA favorite is almost gone", "A product you may care about is running low."],
  };
  return copy[flowType] || ["A note from LUMA", "A short update from LUMA Skincare."];
}

async function ensureDefaultAutomationFlows() {
  const countRows = await runOptionalQuery("SELECT COUNT(*)::int AS count FROM automation_flows", [], [{ count: 0 }]);
  if (Number(countRows[0]?.count || 0) > 0) return { seeded: false };

  for (const flow of DEFAULT_JOURNEY_FLOWS) {
    const [subject, body] = getDefaultFlowCopy(flow.type);
    const flowRows = await runOptionalQuery(
      `INSERT INTO automation_flows (name, flow_key, type, trigger_type, trigger_event, description, status, is_active, delay_amount, delay_unit, max_sends)
       VALUES ($1, $2, $3, $4, $4, $5, 'draft', false, $6, $7, 1)
       ON CONFLICT (flow_key) DO NOTHING
       RETURNING id`,
      [flow.name, flow.flowKey, flow.type, flow.triggerEvent, flow.description, flow.delayAmount, flow.delayUnit],
      []
    );
    const flowId = flowRows[0]?.id;
    if (flowId) {
      await runOptionalQuery(
        `INSERT INTO automation_steps (flow_id, step_order, order_index, action_type, step_type, delay_minutes, delay_amount, delay_unit, subject, html_body, text_body, enabled, is_active)
         VALUES ($1, 1, 1, 'send_email', 'send_email', $2, $3, $4, $5, $6, $7, true, true)`,
        [
          flowId,
          delayToMinutes(flow.delayAmount, flow.delayUnit),
          flow.delayAmount,
          flow.delayUnit,
          flow.subject || subject,
          buildDefaultJourneyHtml({ title: subject, body }),
          body,
        ],
        []
      );
    }
  }

  return { seeded: true };
}

function formatFlow(row = {}) {
  return {
    id: row.id,
    name: row.name,
    flowKey: row.flow_key,
    flow_key: row.flow_key,
    type: row.type || row.flow_key,
    triggerEvent: row.trigger_event || row.trigger_type,
    trigger_event: row.trigger_event || row.trigger_type,
    status: row.status || (row.is_active ? "active" : "draft"),
    isActive: Boolean(row.is_active),
    is_active: Boolean(row.is_active),
    description: row.description || "",
    delayAmount: Number(row.delay_amount || 0),
    delay_amount: Number(row.delay_amount || 0),
    delayUnit: row.delay_unit || "minutes",
    delay_unit: row.delay_unit || "minutes",
    maxSends: Number(row.max_sends || row.max_enrollments_per_customer || 1),
    max_sends: Number(row.max_sends || row.max_enrollments_per_customer || 1),
    sent: Number(row.sent || 0),
    failed: Number(row.failed || 0),
    enrollments: Number(row.enrollments || 0),
    lastRunAt: row.last_run_at || row.last_sent_at || null,
    last_run_at: row.last_run_at || row.last_sent_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listAutomationFlows() {
  await ensureDefaultAutomationFlows();
  const rows = await runOptionalQuery(
    `SELECT flow.*,
      COUNT(DISTINCT enrollment.id)::int AS enrollments,
      COUNT(log.id) FILTER (WHERE log.status = 'sent')::int AS sent,
      COUNT(log.id) FILTER (WHERE log.status = 'failed')::int AS failed,
      MAX(log.sent_at) AS last_sent_at
     FROM automation_flows flow
     LEFT JOIN automation_enrollments enrollment ON enrollment.flow_id = flow.id
     LEFT JOIN automation_email_logs log ON log.flow_id = flow.id
     GROUP BY flow.id
     ORDER BY flow.created_at DESC`,
    [],
    []
  );
  return rows.map(formatFlow);
}

async function getAutomationFlow(flowId) {
  await ensureDefaultAutomationFlows();
  const flowRows = await runOptionalQuery("SELECT * FROM automation_flows WHERE id = $1 OR flow_key = $1 LIMIT 1", [flowId], []);
  const flow = flowRows[0];
  if (!flow) return null;
  const steps = await runOptionalQuery(
    `SELECT * FROM automation_steps WHERE flow_id = $1 ORDER BY COALESCE(order_index, step_order, 1) ASC, created_at ASC`,
    [flow.id],
    []
  );
  return { ...formatFlow(flow), steps };
}

async function createAutomationFlow(payload = {}) {
  const flowKey = normalizeJourneyKey(payload.flowKey || payload.flow_key || payload.name);
  const triggerEvent = payload.triggerEvent || payload.trigger_event || payload.triggerType || payload.trigger_type;
  if (!payload.name || !flowKey || !JOURNEY_TRIGGER_EVENTS.includes(triggerEvent)) {
    const error = new Error("Flow name and a supported trigger event are required.");
    error.statusCode = 400;
    throw error;
  }
  const type = payload.type || flowKey;
  const status = payload.status || "draft";
  const isActive = status === "active" || payload.isActive === true || payload.is_active === true;
  const result = await pool.query(
    `INSERT INTO automation_flows (name, flow_key, type, trigger_type, trigger_event, description, status, is_active, delay_amount, delay_unit, max_sends)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      payload.name,
      flowKey,
      type,
      triggerEvent,
      payload.description || "",
      isActive ? "active" : status,
      isActive,
      Number(payload.delayAmount ?? payload.delay_amount ?? 0),
      payload.delayUnit || payload.delay_unit || "minutes",
      Number(payload.maxSends ?? payload.max_sends ?? 1),
    ]
  );
  const flow = result.rows[0];
  const [subject, body] = getDefaultFlowCopy(type);
  await pool.query(
    `INSERT INTO automation_steps (flow_id, step_order, order_index, action_type, step_type, delay_minutes, delay_amount, delay_unit, subject, html_body, text_body, enabled, is_active)
     VALUES ($1, 1, 1, 'send_email', 'send_email', $2, $3, $4, $5, $6, $7, true, true)`,
    [
      flow.id,
      delayToMinutes(payload.delayAmount ?? 0, payload.delayUnit || "minutes"),
      Number(payload.delayAmount ?? 0),
      payload.delayUnit || "minutes",
      payload.subject || subject,
      payload.htmlBody || payload.html_body || buildDefaultJourneyHtml({ title: payload.subject || subject, body }),
      payload.textBody || payload.text_body || body,
    ]
  );
  return getAutomationFlow(flow.id);
}

async function updateAutomationFlow(flowId, payload = {}) {
  const current = await getAutomationFlow(flowId);
  if (!current) return null;
  const status = payload.status || current.status;
  const isActive = status === "active" || payload.isActive === true || payload.is_active === true;
  const result = await pool.query(
    `UPDATE automation_flows
     SET name = COALESCE($2, name),
         type = COALESCE($3, type),
         trigger_type = COALESCE($4, trigger_type),
         trigger_event = COALESCE($4, trigger_event),
         description = COALESCE($5, description),
         status = $6,
         is_active = $7,
         delay_amount = COALESCE($8, delay_amount),
         delay_unit = COALESCE($9, delay_unit),
         max_sends = COALESCE($10, max_sends),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [
      current.id,
      payload.name || null,
      payload.type || null,
      payload.triggerEvent || payload.trigger_event || null,
      payload.description || null,
      isActive ? "active" : status,
      isActive,
      payload.delayAmount ?? payload.delay_amount ?? null,
      payload.delayUnit || payload.delay_unit || null,
      payload.maxSends ?? payload.max_sends ?? null,
    ]
  );
  return getAutomationFlow(result.rows[0].id);
}

async function deleteAutomationFlow(flowId) {
  const current = await getAutomationFlow(flowId);
  if (!current) return null;
  const result = await pool.query("DELETE FROM automation_flows WHERE id = $1 RETURNING id, name", [current.id]);
  return result.rows[0] || null;
}

async function setAutomationFlowStatus(flowId, status) {
  const current = await getAutomationFlow(flowId);
  if (!current) return null;
  const nextStatus = status === "active" ? "active" : "paused";
  const result = await pool.query(
    "UPDATE automation_flows SET status = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
    [current.id, nextStatus, nextStatus === "active"]
  );
  return formatFlow(result.rows[0]);
}

function normalizeAutomationRecipient(input = {}) {
  const customer = input.customer || input.user || input;
  return {
    id: customer.customerId || customer.customer_id || customer.id || input.customerId || input.customer_id || null,
    email: String(customer.email || customer.customerEmail || customer.customer_email || input.email || "").trim().toLowerCase(),
    name: customer.name || customer.customerName || customer.customer_name || input.name || "LUMA customer",
    phone: customer.phone || customer.customerPhone || customer.customer_phone || input.phone || null,
  };
}

async function isEmailSuppressed(email) {
  if (!email) return true;
  const rows = await runOptionalQuery(
    "SELECT id FROM email_suppression_list WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [email],
    []
  );
  return rows.length > 0;
}

async function preventDuplicateEnrollment({ flowId, customerEmail, relatedOrderId, relatedProductId, eventKey }) {
  if (eventKey) {
    const eventRows = await runOptionalQuery(
      `SELECT id, status
       FROM automation_enrollments
       WHERE flow_id = $1
         AND event_key = $2
         AND status IN ('pending', 'active', 'scheduled', 'completed')
       LIMIT 1`,
      [flowId, eventKey],
      []
    );
    return eventRows[0] || null;
  }
  const rows = await runOptionalQuery(
    `SELECT id, status
     FROM automation_enrollments
     WHERE flow_id = $1
       AND LOWER(COALESCE(customer_email, '')) = LOWER($2)
       AND COALESCE(related_order_id::text, '') = COALESCE($3, '')
       AND COALESCE(related_product_id::text, '') = COALESCE($4, '')
       AND status IN ('pending', 'active', 'scheduled', 'completed')
     LIMIT 1`,
    [flowId, customerEmail, relatedOrderId || "", relatedProductId || ""],
    []
  );
  return rows[0] || null;
}

async function enrollCustomerInFlow(triggerEvent, input = {}) {
  await ensureDefaultAutomationFlows();
  const recipient = normalizeAutomationRecipient(input);
  if (!JOURNEY_TRIGGER_EVENTS.includes(triggerEvent)) {
    return { success: false, status: "unsupported_trigger", message: "Unsupported automation trigger." };
  }
  if (!recipient.email) {
    return { success: false, status: "missing_email", message: "Customer email is required for automation enrollment." };
  }
  if (await isEmailSuppressed(recipient.email)) {
    return { success: false, status: "suppressed", message: "Customer email is suppressed." };
  }

  const flows = await runOptionalQuery(
    `SELECT * FROM automation_flows
     WHERE COALESCE(trigger_event, trigger_type) = $1
       AND is_active = true
       AND COALESCE(status, 'draft') = 'active'`,
    [triggerEvent],
    []
  );

  const enrollments = [];
  for (const flow of flows) {
    const relatedOrderId = input.orderId || input.order_id || input.order?.id || null;
    const relatedProductId = input.productId || input.product_id || input.product?.id || null;
    const eventKey = input.eventKey || input.event_key || null;
    const duplicate = await preventDuplicateEnrollment({
      flowId: flow.id,
      customerEmail: recipient.email,
      relatedOrderId,
      relatedProductId,
      eventKey,
    });
    if (duplicate) {
      enrollments.push({ flowId: flow.id, status: "duplicate", enrollmentId: duplicate.id });
      continue;
    }

    const nextRunAt = addDelay(new Date(), flow.delay_amount || 0, flow.delay_unit || "minutes");
    const metadata = {
      triggerEvent,
      customer: recipient,
      order: input.order || null,
      product: input.product || null,
      sessionId: input.sessionId || input.session_id || null,
      cartItems: input.cartItems || input.cart_items || null,
      cartValue: input.cartValue ?? input.cart_value ?? input.totalAmount ?? null,
      eventKey,
      source: input.source || "internal",
    };

    let result;
    try {
      result = await pool.query(
        `INSERT INTO automation_enrollments (
          flow_id, customer_id, customer_email, session_id, status, trigger_event,
          related_order_id, related_product_id, event_key, metadata, enrolled_at, next_run_at, send_count
         ) VALUES ($1, $2::uuid, $3, $4, 'pending', $5, $6::uuid, $7::uuid, $8, $9::jsonb, NOW(), $10, 0)
         ON CONFLICT (flow_id, event_key) WHERE event_key IS NOT NULL DO NOTHING
         RETURNING *`,
        [
          flow.id,
          recipient.id,
          recipient.email,
          input.sessionId || input.session_id || null,
          triggerEvent,
          relatedOrderId,
          relatedProductId,
          eventKey,
          JSON.stringify(metadata),
          nextRunAt,
        ]
      );
    } catch (error) {
      if (!['42703', '42P10'].includes(error.code)) throw error;
      result = await pool.query(
        `INSERT INTO automation_enrollments (
          flow_id, customer_id, customer_email, status, trigger_event, related_order_id, related_product_id,
          metadata, enrolled_at, next_run_at, send_count
         ) VALUES ($1, $2::uuid, $3, 'pending', $4, $5::uuid, $6::uuid, $7::jsonb, NOW(), $8, 0)
         RETURNING *`,
        [flow.id, recipient.id, recipient.email, triggerEvent, relatedOrderId, relatedProductId, JSON.stringify(metadata), nextRunAt]
      );
    }
    if (!result.rows.length) {
      enrollments.push({ flowId: flow.id, status: "duplicate" });
      continue;
    }
    enrollments.push({ flowId: flow.id, status: "enrolled", enrollmentId: result.rows[0].id, nextRunAt });
  }

  return { success: true, triggerEvent, enrolled: enrollments.filter((item) => item.status === "enrolled").length, enrollments };
}

async function markEnrollmentCompleted(enrollmentId) {
  const result = await pool.query(
    `UPDATE automation_enrollments
     SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), last_processed_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [enrollmentId]
  );
  return result.rows[0] || null;
}

async function getNextEnabledStep(flowId) {
  const rows = await runOptionalQuery(
    `SELECT * FROM automation_steps
     WHERE flow_id = $1
       AND COALESCE(enabled, is_active, true) = true
     ORDER BY COALESCE(order_index, step_order, 1) ASC, created_at ASC
     LIMIT 1`,
    [flowId],
    []
  );
  return rows[0] || null;
}

async function writeAutomationEmailLog({ flow, enrollment, step, status, subject, errorMessage, providerResult }) {
  await runOptionalQuery(
    `INSERT INTO automation_email_logs (
      flow_id, enrollment_id, customer_email, event_type, email_type, subject, status,
      provider_message_id, error_message, metadata, sent_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, CASE WHEN $7 = 'sent' THEN NOW() ELSE NULL END, NOW())`,
    [
      flow.id,
      enrollment.id,
      enrollment.customer_email,
      flow.trigger_event || flow.trigger_type || flow.type,
      flow.type || flow.flow_key,
      subject,
      status,
      providerResult?.providerMessageId || providerResult?.provider_message_id || providerResult?.id || null,
      errorMessage || providerResult?.message || null,
      JSON.stringify({ stepId: step?.id || null, providerStatus: providerResult?.status || null }),
    ],
    []
  );
}

async function processDueAutomationSteps({ limit = 25 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const rows = await runOptionalQuery(
    `SELECT enrollment.*, flow.name AS flow_name, flow.flow_key, flow.type, flow.trigger_event, flow.trigger_type,
            flow.max_sends, flow.delay_amount, flow.delay_unit, flow.is_active, flow.status AS flow_status
     FROM automation_enrollments enrollment
     JOIN automation_flows flow ON flow.id = enrollment.flow_id
     WHERE enrollment.status IN ('pending', 'active', 'scheduled')
       AND COALESCE(enrollment.next_run_at, NOW()) <= NOW()
       AND flow.is_active = true
       AND COALESCE(flow.status, 'draft') = 'active'
     ORDER BY COALESCE(enrollment.next_run_at, enrollment.enrolled_at, enrollment.created_at) ASC
     LIMIT $1`,
    [safeLimit],
    []
  );

  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  for (const enrollment of rows) {
    summary.processed += 1;
    const flow = {
      id: enrollment.flow_id,
      name: enrollment.flow_name,
      flow_key: enrollment.flow_key,
      type: enrollment.type,
      trigger_event: enrollment.trigger_event,
      trigger_type: enrollment.trigger_type,
    };

    try {
      if (await isEmailSuppressed(enrollment.customer_email)) {
        await pool.query(
          "UPDATE automation_enrollments SET status = 'cancelled', error_message = 'Email is suppressed', last_processed_at = NOW(), updated_at = NOW() WHERE id = $1",
          [enrollment.id]
        );
        summary.skipped += 1;
        continue;
      }

      const step = await getNextEnabledStep(enrollment.flow_id);
      if (!step) {
        await markEnrollmentCompleted(enrollment.id);
        summary.skipped += 1;
        continue;
      }

      const [fallbackSubject, fallbackBody] = getDefaultFlowCopy(enrollment.type || enrollment.flow_key);
      const subject = step.subject || fallbackSubject;
      const text = step.text_body || fallbackBody;
      const html = step.html_body || buildDefaultJourneyHtml({ title: subject, body: text });
      const providerResult = await sendEmail({
        to: enrollment.customer_email,
        subject,
        html,
        text,
        type: `automation_${enrollment.type || enrollment.flow_key}`,
        metadata: { enrollmentId: enrollment.id, flowId: enrollment.flow_id, stepId: step.id },
      });

      if (providerResult?.success || providerResult?.sent || providerResult?.status === "sent") {
        await writeAutomationEmailLog({ flow, enrollment, step, status: "sent", subject, providerResult });
        const nextCount = Number(enrollment.send_count || 0) + 1;
        const maxSends = Number(enrollment.max_sends || 1);
        if (nextCount >= maxSends) {
          await pool.query(
            "UPDATE automation_enrollments SET send_count = $2, current_step_id = $3, last_processed_at = NOW(), updated_at = NOW() WHERE id = $1",
            [enrollment.id, nextCount, step.id]
          );
          await markEnrollmentCompleted(enrollment.id);
        } else {
          await pool.query(
            `UPDATE automation_enrollments
             SET status = 'pending', send_count = $2, current_step_id = $3, last_processed_at = NOW(),
                 next_run_at = $4, updated_at = NOW()
             WHERE id = $1`,
            [enrollment.id, nextCount, step.id, addDelay(new Date(), enrollment.delay_amount || 0, enrollment.delay_unit || "minutes")]
          );
        }
        await pool.query("UPDATE automation_flows SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1", [enrollment.flow_id]);
        summary.sent += 1;
      } else {
        await writeAutomationEmailLog({ flow, enrollment, step, status: "failed", subject, providerResult, errorMessage: providerResult?.message });
        await pool.query(
          "UPDATE automation_enrollments SET status = 'failed', error_message = $2, last_processed_at = NOW(), updated_at = NOW() WHERE id = $1",
          [enrollment.id, providerResult?.message || "Email provider did not send the message."]
        );
        summary.failed += 1;
      }
    } catch (error) {
      console.error("Process automation enrollment failed:", error.message);
      await pool.query(
        "UPDATE automation_enrollments SET status = 'failed', error_message = $2, last_processed_at = NOW(), updated_at = NOW() WHERE id = $1",
        [enrollment.id, error.message]
      );
      summary.failed += 1;
    }
  }

  return summary;
}

async function listAutomationLogs({ limit = 50, status, flowId } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const params = [];
  const where = [];
  if (status) {
    params.push(status);
    where.push(`log.status = $${params.length}`);
  }
  if (flowId) {
    params.push(flowId);
    where.push(`log.flow_id = $${params.length}`);
  }
  params.push(safeLimit);
  const rows = await runOptionalQuery(
    `SELECT log.*, flow.name AS flow_name, flow.flow_key
     FROM automation_email_logs log
     LEFT JOIN automation_flows flow ON flow.id = log.flow_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY COALESCE(log.sent_at, log.created_at) DESC
     LIMIT $${params.length}`,
    params,
    []
  );
  return rows;
}

async function listEmailTemplates() {
  return runOptionalQuery(
    `SELECT * FROM email_templates ORDER BY updated_at DESC, created_at DESC`,
    [],
    []
  );
}

async function createEmailTemplate(payload = {}) {
  if (!payload.name || !payload.subject) {
    const error = new Error("Template name and subject are required.");
    error.statusCode = 400;
    throw error;
  }
  const key = normalizeJourneyKey(payload.templateKey || payload.template_key || payload.name);
  const result = await pool.query(
    `INSERT INTO email_templates (name, template_key, template_type, subject, html_body, text_body, design_notes, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      payload.name,
      key,
      payload.templateType || payload.template_type || "automation",
      payload.subject,
      payload.htmlBody || payload.html_body || "",
      payload.textBody || payload.text_body || "",
      payload.designNotes || payload.design_notes || "",
      payload.isActive ?? payload.is_active ?? true,
    ]
  );
  return result.rows[0];
}

async function updateEmailTemplate(templateId, payload = {}) {
  const result = await pool.query(
    `UPDATE email_templates
     SET name = COALESCE($2, name),
         template_type = COALESCE($3, template_type),
         subject = COALESCE($4, subject),
         html_body = COALESCE($5, html_body),
         text_body = COALESCE($6, text_body),
         design_notes = COALESCE($7, design_notes),
         is_active = COALESCE($8, is_active),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      templateId,
      payload.name || null,
      payload.templateType || payload.template_type || null,
      payload.subject || null,
      payload.htmlBody ?? payload.html_body ?? null,
      payload.textBody ?? payload.text_body ?? null,
      payload.designNotes ?? payload.design_notes ?? null,
      payload.isActive ?? payload.is_active ?? null,
    ]
  );
  return result.rows[0] || null;
}

async function listSuppressionList({ limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return runOptionalQuery(
    `SELECT * FROM email_suppression_list ORDER BY created_at DESC LIMIT $1`,
    [safeLimit],
    []
  );
}

async function addSuppression(payload = {}) {
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email) {
    const error = new Error("Email is required.");
    error.statusCode = 400;
    throw error;
  }
  const result = await pool.query(
    `INSERT INTO email_suppression_list (email, reason, source)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET reason = EXCLUDED.reason,
           source = EXCLUDED.source,
           updated_at = NOW()
     RETURNING *`,
    [email, payload.reason || "manual_admin", payload.source || "admin"]
  );
  return result.rows[0];
}

function getAutomationWorkerHealth() {
  const intervalSeconds = Number(process.env.LOCAL_AUTOMATION_WORKER_INTERVAL_SECONDS || 60);
  return {
    enabled: String(process.env.ENABLE_LOCAL_AUTOMATION_WORKER || "false").toLowerCase() === "true",
    intervalSeconds: Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds : 60,
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    supportedTriggers: JOURNEY_TRIGGER_EVENTS,
  };
}

let automationWorkerInterval = null;
function startAutomationWorker() {
  const health = getAutomationWorkerHealth();
  if (!health.enabled || automationWorkerInterval) return automationWorkerInterval;
  automationWorkerInterval = setInterval(async () => {
    try {
      const result = await processDueAutomationSteps({ limit: 25 });
      if (result.processed > 0) {
        console.log("Automation worker processed due steps", result);
      }
    } catch (error) {
      console.error("Automation worker failed:", error.message);
    }
  }, health.intervalSeconds * 1000);
  console.log(`Internal automation worker enabled (${health.intervalSeconds}s).`);
  return automationWorkerInterval;
}

module.exports = {
  ...legacyAutomationExports,
  JOURNEY_TRIGGER_EVENTS,
  addSuppression,
  createAutomationFlow,
  createEmailTemplate,
  deleteAutomationFlow,
  enrollCustomerInFlow,
  ensureDefaultAutomationFlows,
  getAutomationFlow,
  getAutomationWorkerHealth,
  listAutomationFlows,
  listAutomationLogs,
  listEmailTemplates,
  listSuppressionList,
  markEnrollmentCompleted,
  preventDuplicateEnrollment,
  processDueAutomationSteps,
  setAutomationFlowStatus,
  startAutomationWorker,
  updateAutomationFlow,
  updateEmailTemplate,
};





