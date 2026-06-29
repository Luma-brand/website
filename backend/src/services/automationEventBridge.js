const pool = require("../config/db");
const { enrollCustomerInFlow } = require("./automationService");

const ANALYTICS_EVENT_BY_TRIGGER = {
  order_completed: "order_completed",
  product_viewed: "product_view",
  checkout_started: "checkout_started",
  cart_abandoned: "cart_abandoned",
  product_back_in_stock: "back_in_stock",
  low_stock_product: "stock_low",
};

const OPTIONAL_SCHEMA_ERRORS = new Set(["42P01", "42703"]);

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeContext(context = {}) {
  const customer = context.customer || context.user || {};
  const order = context.order || {};
  const product = context.product || {};

  return {
    ...context,
    customerId: pick(context.customerId, context.customer_id, customer.id, customer.customer_id),
    customerEmail: String(
      pick(context.customerEmail, context.customer_email, context.email, customer.email, order.customer_email, "")
    ).trim().toLowerCase(),
    customerName: pick(context.customerName, context.customer_name, context.name, customer.name, order.customer_name),
    customerPhone: pick(context.customerPhone, context.customer_phone, context.phone, customer.phone, order.customer_phone),
    sessionId: pick(context.sessionId, context.session_id),
    orderId: pick(context.orderId, context.order_id, order.id),
    productId: pick(context.productId, context.product_id, product.id),
    order,
    product,
  };
}

function getTimeBucket(minutes) {
  return Math.floor(Date.now() / (Math.max(minutes, 1) * 60 * 1000));
}

function buildEventKey(trigger, context) {
  if (context.eventKey || context.event_key) return context.eventKey || context.event_key;
  if (trigger === "order_completed" && context.orderId) return `${trigger}:${context.orderId}`;
  if (trigger === "product_viewed" && context.sessionId && context.productId) {
    return `${trigger}:${context.sessionId}:${context.productId}:${getTimeBucket(30)}`;
  }
  if (trigger === "checkout_started" && context.sessionId) {
    return `${trigger}:${context.sessionId}:${getTimeBucket(120)}`;
  }
  if (trigger === "cart_abandoned" && context.cartId) return `${trigger}:${context.cartId}`;
  if (trigger === "product_back_in_stock" && context.productId) {
    return `${trigger}:${context.productId}:${context.previousStock || 0}:${context.newStock || 0}`;
  }
  if (trigger === "low_stock_product" && context.productId) {
    return `${trigger}:${context.productId}:${context.previousStock || 0}:${context.newStock || 0}`;
  }
  return null;
}

async function storeTriggerEvent(trigger, context, eventKey) {
  try {
    const result = await pool.query(
      `INSERT INTO automation_trigger_events (
         trigger_event, dedupe_key, customer_id, customer_email, session_id,
         order_id, product_id, status, context
       ) VALUES ($1, $2, $3::uuid, $4, $5, $6::uuid, $7::uuid, 'emitted', $8::jsonb)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        trigger,
        eventKey,
        context.customerId || null,
        context.customerEmail || null,
        context.sessionId || null,
        context.orderId || null,
        context.productId || null,
        JSON.stringify(context),
      ]
    );
    return { available: true, duplicate: result.rowCount === 0, id: result.rows[0]?.id || null };
  } catch (error) {
    if (OPTIONAL_SCHEMA_ERRORS.has(error.code)) return { available: false, duplicate: false, id: null };
    throw error;
  }
}

async function updateTriggerEvent(eventId, status, enrollmentCount, flowIds = []) {
  if (!eventId) return;
  try {
    await pool.query(
      `UPDATE automation_trigger_events
       SET status = $2,
           enrollment_count = $3,
           flow_ids = $4::uuid[],
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [eventId, status, Number(enrollmentCount || 0), flowIds]
    );
  } catch (error) {
    if (!OPTIONAL_SCHEMA_ERRORS.has(error.code)) throw error;
  }
}

async function recordAnalytics(trigger, context) {
  const eventType = ANALYTICS_EVENT_BY_TRIGGER[trigger];
  if (!eventType || context.analyticsAlreadyRecorded) return;

  try {
    await pool.query(
      `INSERT INTO analytics_events (
         event_type, session_id, customer_email, product_id, order_id, value,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term, metadata
       ) VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
      [
        eventType,
        context.sessionId || null,
        context.customerEmail || null,
        context.productId || null,
        context.orderId || null,
        context.value ?? context.cartValue ?? context.totalAmount ?? null,
        context.utm?.utm_source || null,
        context.utm?.utm_medium || null,
        context.utm?.utm_campaign || null,
        context.utm?.utm_content || null,
        context.utm?.utm_term || null,
        JSON.stringify({ source: context.source || "automation_event_bridge", trigger }),
      ]
    );
  } catch (error) {
    if (!OPTIONAL_SCHEMA_ERRORS.has(error.code)) throw error;
  }
}

async function emitAutomationEvent(trigger, input = {}, options = {}) {
  try {
    const context = normalizeContext(input);
    const eventKey = buildEventKey(trigger, context);
    const storedEvent = await storeTriggerEvent(trigger, context, eventKey);

    if (storedEvent.duplicate) {
      return { emitted: false, duplicate: true, trigger, enrolled: 0 };
    }

    await recordAnalytics(trigger, context);

    let enrollmentResult = { success: true, enrolled: 0, enrollments: [] };
    if (options.enroll !== false) {
      enrollmentResult = await enrollCustomerInFlow(trigger, {
        ...context,
        email: context.customerEmail,
        name: context.customerName,
        phone: context.customerPhone,
        eventKey,
      });
    }

    const enrolled = Number(enrollmentResult?.enrolled || 0);
    await updateTriggerEvent(
      storedEvent.id,
      enrollmentResult?.status === "suppressed" ? "suppressed" : enrolled > 0 ? "enrolled" : "logged",
      enrolled,
      (enrollmentResult?.enrollments || [])
        .filter((item) => item.status === "enrolled")
        .map((item) => item.flowId)
    );

    if (process.env.NODE_ENV !== "production") {
      console.log("Automation trigger emitted", {
        trigger,
        customer: context.customerEmail || context.customerId || null,
        session: context.sessionId || null,
        enrollments: enrolled,
      });
    }

    return { emitted: true, duplicate: false, trigger, enrolled, enrollmentResult };
  } catch (error) {
    console.error(`Automation trigger failed (${trigger}):`, error.message);
    return { emitted: false, duplicate: false, trigger, enrolled: 0, error: error.message };
  }
}

function emitOrderCompleted(order, context = {}) {
  return emitAutomationEvent("order_completed", {
    ...context,
    order,
    orderId: order?.id,
    customerEmail: order?.customer_email,
    customerName: order?.customer_name,
    customerPhone: order?.customer_phone,
    value: Number(order?.total_amount || 0),
  });
}

function emitProductViewed(context) {
  return emitAutomationEvent("product_viewed", {
    ...context,
    product: context?.product || {
      id: context?.productId || context?.product_id || null,
      name: context?.productName || context?.product_name || null,
      sessionId: context?.sessionId || context?.session_id || null,
    },
  });
}

function emitCheckoutStarted(context) {
  return emitAutomationEvent("checkout_started", {
    ...context,
    order: {
      type: "checkout",
      sessionId: context?.sessionId || context?.session_id || null,
      cartItems: context?.cartItems || context?.cart_items || [],
      cartValue: context?.cartValue ?? context?.cart_value ?? context?.totalAmount ?? 0,
    },
  });
}

function emitProductBackInStock(product, previousStock, newStock) {
  return emitAutomationEvent(
    "product_back_in_stock",
    { product, productId: product?.id, previousStock, newStock },
    { enroll: false }
  );
}

function emitLowStockProduct(product, context = {}) {
  return emitAutomationEvent(
    "low_stock_product",
    { ...context, product, productId: product?.id },
    { enroll: false }
  );
}

async function emitStockTransition(product, previousStock, newStock, context = {}) {
  try {
    let resolvedProduct = product || {};
    if (resolvedProduct.id && resolvedProduct.low_stock_threshold === undefined) {
      const result = await pool.query(
        "SELECT id, name, stock_quantity, low_stock_threshold FROM products WHERE id = $1 LIMIT 1",
        [resolvedProduct.id]
      );
      resolvedProduct = result.rows[0] || resolvedProduct;
    }

    const threshold = Number(resolvedProduct.low_stock_threshold ?? 20);
    const results = [];
    if (Number(previousStock) <= 0 && Number(newStock) > 0) {
      results.push(await emitProductBackInStock(resolvedProduct, previousStock, newStock));
    }
    if (Number(previousStock) > threshold && Number(newStock) <= threshold) {
      results.push(
        await emitLowStockProduct(resolvedProduct, {
          ...context,
          previousStock: Number(previousStock),
          newStock: Number(newStock),
          threshold,
        })
      );
    }
    return results;
  } catch (error) {
    console.error("Stock automation transition failed:", error.message);
    return [];
  }
}
async function listAutomationTriggerEvents({ limit = 50, trigger } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const params = [];
  let where = "";
  if (trigger) {
    params.push(trigger);
    where = `WHERE event.trigger_event = $${params.length}`;
  }
  params.push(safeLimit);

  try {
    const result = await pool.query(
      `SELECT event.*,
              COALESCE(
                ARRAY_AGG(DISTINCT flow.name) FILTER (WHERE flow.name IS NOT NULL),
                '{}'::text[]
              ) AS flow_names
       FROM automation_trigger_events event
       LEFT JOIN automation_flows flow ON flow.id = ANY(COALESCE(event.flow_ids, '{}'::uuid[]))
       ${where}
       GROUP BY event.id
       ORDER BY event.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return result.rows;
  } catch (error) {
    if (OPTIONAL_SCHEMA_ERRORS.has(error.code)) return [];
    throw error;
  }
}
module.exports = {
  emitAutomationEvent,
  emitCheckoutStarted,
  emitLowStockProduct,
  emitOrderCompleted,
  emitProductBackInStock,
  emitProductViewed,
  emitStockTransition,
  listAutomationTriggerEvents,
};




