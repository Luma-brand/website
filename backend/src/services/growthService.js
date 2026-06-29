const pool = require("../config/db");
const { queueAutomationEvent } = require("./automationService");
const { emitAutomationEvent } = require("./automationEventBridge");
const {
  sendAbandonedCartRecoveryEmail,
  sendBackInStockEmail,
  sendCheckoutRecoveryEmail,
} = require("./emailService");

const RECOVERY_STATUSES = [
  "not_contacted",
  "checkout_started",
  "email_sent",
  "whatsapp_contacted",
  "recovered",
  "expired",
];
const DEFAULT_RECOVERY_DELAY_MINUTES = 60;

function isOptionalTableError(error) {
  return ["42P01", "42703"].includes(error.code);
}

function isTransientDatabaseError(error) {
  const message = error?.message || "";
  return [
    "ECONNRESET",
    "ENOTFOUND",
    "ETIMEDOUT",
    "Connection terminated",
    "timeout exceeded",
  ].some((pattern) => message.includes(pattern));
}

async function runOptionalQuery(query, params = [], fallback, { client = pool } = {}) {
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    if (isOptionalTableError(error) || isTransientDatabaseError(error)) {
      if (!isOptionalTableError(error)) {
        console.warn("Optional growth query skipped:", pool.describeError ? pool.describeError(error) : error.message);
      }
      return fallback;
    }

    throw error;
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    productId: item.productId || item.id || null,
    name: item.name || "",
    quantity: Number(item.quantity || 1),
    price: Number(item.price || item.priceValue || 0),
    image: item.image || item.product_image || "",
    size: item.size || "",
  }));
}

function getSessionId(value) {
  return String(value || "").trim() || null;
}

function getRecoveryDelayMinutes() {
  const delay = Number(process.env.ABANDONED_CART_DELAY_MINUTES);
  return Number.isFinite(delay) && delay > 0
    ? delay
    : DEFAULT_RECOVERY_DELAY_MINUTES;
}

function getCartTotal(items = [], fallback = 0) {
  const computedTotal = items.reduce(
    (total, item) => total + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  return computedTotal > 0 ? computedTotal : Number(fallback || 0);
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

function buildWhatsAppLink(cart) {
  const phone = normalizePhone(cart?.customer_phone);

  if (!phone) {
    return null;
  }

  const frontendUrl =
    process.env.FRONTEND_URL || "https://shopwithluma.com";
  const cartUrl = `${frontendUrl.replace(/\/$/, "")}/cart`;
  const itemNames = Array.isArray(cart.cart_items)
    ? cart.cart_items
        .slice(0, 3)
        .map((item) => item.name)
        .filter(Boolean)
        .join(", ")
    : "";
  const message = [
    "Hi, this is LUMA Skincare.",
    itemNames
      ? `You left ${itemNames} in your cart.`
      : "You left a few LUMA products in your cart.",
    `You can complete your order here: ${cartUrl}`,
  ].join(" ");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildCheckoutWhatsAppLink(checkout) {
  const phone = normalizePhone(checkout?.customer_phone);

  if (!phone) {
    return null;
  }

  const frontendUrl =
    process.env.FRONTEND_URL || "https://shopwithluma.com";
  const checkoutUrl = `${frontendUrl.replace(/\/$/, "")}/checkout`;
  const itemNames = Array.isArray(checkout.cart_items)
    ? checkout.cart_items
        .slice(0, 3)
        .map((item) => item.name)
        .filter(Boolean)
        .join(", ")
    : "";
  const message = [
    "Hi, this is LUMA Skincare.",
    itemNames
      ? `You started checkout for ${itemNames}.`
      : "You started checkout for your LUMA skincare picks.",
    `You can finish payment here: ${checkoutUrl}`,
  ].join(" ");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildBackInStockWhatsAppLink(request) {
  const phone = normalizePhone(request?.customer_phone);

  if (!phone) {
    return null;
  }

  const frontendUrl =
    process.env.FRONTEND_URL || "https://shopwithluma.com";
  const productPath = request.product_slug || request.product_id;
  const productUrl = `${frontendUrl.replace(/\/$/, "")}/products/${productPath}`;
  const message = [
    "Hi, this is LUMA Skincare.",
    request.product_name
      ? `${request.product_name} is back in stock.`
      : "The LUMA product you requested is back in stock.",
    `You can view it here: ${productUrl}`,
  ].join(" ");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function formatAbandonedCart(cart) {
  if (!cart) return null;

  const items = Array.isArray(cart.cart_items) ? cart.cart_items : [];

  return {
    ...cart,
    cart_items: items,
    total_value: Number(cart.total_value || 0),
    item_count: items.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    ),
    whatsapp_link: buildWhatsAppLink(cart),
    recovery_ready: Boolean(cart.recovery_ready),
  };
}

function formatAbandonedCheckout(checkout) {
  if (!checkout) return null;

  const items = Array.isArray(checkout.cart_items) ? checkout.cart_items : [];

  return {
    ...checkout,
    cart_items: items,
    total_amount: Number(checkout.total_amount || 0),
    item_count: items.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    ),
    whatsapp_link: buildCheckoutWhatsAppLink(checkout),
    recovery_ready: Boolean(checkout.recovery_ready),
  };
}

function formatBackInStockRequest(request) {
  if (!request) return null;

  return {
    ...request,
    whatsapp_link: buildBackInStockWhatsAppLink(request),
  };
}

async function recordAnalyticsEvent({
  eventType,
  sessionId,
  customerEmail,
  productId,
  orderId,
  value,
  utm = {},
  metadata = {},
} = {}) {
  if (!eventType) {
    return {
      stored: false,
      status: "invalid_event",
      message: "eventType is required.",
    };
  }

  const rows = await runOptionalQuery(
    `
      INSERT INTO analytics_events (
        event_type,
        session_id,
        customer_email,
        product_id,
        order_id,
        value,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING id, event_type, created_at
    `,
    [
      eventType,
      getSessionId(sessionId),
      customerEmail || null,
      productId || null,
      orderId || null,
      value === undefined || value === null ? null : Number(value),
      utm.utm_source || null,
      utm.utm_medium || null,
      utm.utm_campaign || null,
      utm.utm_content || null,
      utm.utm_term || null,
      JSON.stringify(metadata || {}),
    ],
    []
  );

  if (!rows.length) {
    return {
      stored: false,
      status: "not_configured",
      message: "Analytics event table is not available yet.",
    };
  }

  return {
    stored: true,
    status: "stored",
    data: rows[0],
  };
}

async function recordProductView({
  productId,
  sessionId,
  customerEmail,
  source,
  utm = {},
}) {
  if (!productId) {
    return {
      stored: false,
      status: "invalid_product",
      message: "productId is required.",
    };
  }

  const rows = await runOptionalQuery(
    `
      INSERT INTO product_views (product_id, session_id, customer_email, source)
      VALUES ($1, $2, $3, $4)
      RETURNING id, product_id, created_at
    `,
    [productId, getSessionId(sessionId), customerEmail || null, source || null],
    []
  );

  await recordAnalyticsEvent({
    eventType: "product_view",
    productId,
    sessionId,
    customerEmail,
    utm,
    metadata: { source },
  });

  if (!rows.length) {
    return {
      stored: false,
      status: "not_configured",
      message: "Product view table is not available yet.",
    };
  }

  return {
    stored: true,
    status: "stored",
    data: rows[0],
  };
}

async function saveAbandonedCart({
  sessionId,
  customerName,
  customerEmail,
  customerPhone,
  cartItems = [],
  totalValue = 0,
  utm = {},
} = {}) {
  const normalizedItems = normalizeItems(cartItems);
  const normalizedSessionId = getSessionId(sessionId);

  if (!normalizedItems.length) {
    if (normalizedSessionId) {
      await runOptionalQuery(
        `
          UPDATE abandoned_carts
          SET
            recovery_status = CASE
              WHEN recovery_status = 'recovered' THEN recovery_status
              ELSE 'expired'
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE session_id = $1
            AND recovery_status <> 'recovered'
          RETURNING id
        `,
        [normalizedSessionId],
        []
      );
    }

    return {
      stored: false,
      status: "empty_cart",
    };
  }

  const calculatedTotalValue = getCartTotal(normalizedItems, totalValue);
  let rows = [];

  if (normalizedSessionId) {
    const existingRows = await runOptionalQuery(
      `
        SELECT id
        FROM abandoned_carts
        WHERE session_id = $1
          AND recovery_status <> 'recovered'
        ORDER BY last_activity_at DESC
        LIMIT 1
      `,
      [normalizedSessionId],
      []
    );

    if (existingRows.length) {
      rows = await runOptionalQuery(
        `
          UPDATE abandoned_carts
          SET
            customer_email = COALESCE($2, customer_email),
            customer_phone = COALESCE($3, customer_phone),
            cart_items = $4::jsonb,
            total_value = $5,
            recovery_status = CASE
              WHEN recovery_status IN ('email_sent', 'whatsapp_contacted', 'checkout_started')
                THEN recovery_status
              ELSE 'not_contacted'
            END,
            last_activity_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, recovery_status, last_activity_at
        `,
        [
          existingRows[0].id,
          customerEmail || null,
          customerPhone || null,
          JSON.stringify(normalizedItems),
          calculatedTotalValue,
        ],
        []
      );
    }
  }

  if (!rows.length) {
    rows = await runOptionalQuery(
      `
        INSERT INTO abandoned_carts (
          session_id,
          customer_email,
          customer_phone,
          cart_items,
          total_value,
          recovery_status,
          last_activity_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, 'not_contacted', CURRENT_TIMESTAMP)
        RETURNING id, recovery_status, last_activity_at
      `,
      [
        normalizedSessionId,
        customerEmail || null,
        customerPhone || null,
        JSON.stringify(normalizedItems),
        calculatedTotalValue,
      ],
      []
    );
  }

  if (rows.length && customerName) {
    await runOptionalQuery(
      `
        UPDATE abandoned_carts
        SET customer_name = COALESCE($2, customer_name)
        WHERE id = $1
      `,
      [rows[0].id, customerName],
      []
    );
  }

  await recordAnalyticsEvent({
    eventType: "cart_abandoned",
    sessionId,
    customerEmail,
    value: calculatedTotalValue,
    utm,
    metadata: { itemCount: normalizedItems.length },
  });

  if (!rows.length) {
    return {
      stored: false,
      status: "not_configured",
      message: "Abandoned cart table is not available yet.",
    };
  }

  return {
    stored: true,
    status: rows[0].recovery_status,
    data: rows[0],
  };
}

async function saveCheckoutStart({
  sessionId,
  customerEmail,
  customerName,
  customerPhone,
  cartItems = [],
  totalAmount = 0,
  utm = {},
} = {}) {
  const normalizedItems = normalizeItems(cartItems);
  const normalizedSessionId = getSessionId(sessionId);
  const calculatedTotalAmount = getCartTotal(normalizedItems, totalAmount);

  if (normalizedItems.length) {
    const cartResult = await saveAbandonedCart({
      sessionId: normalizedSessionId,
      customerName,
      customerEmail,
      customerPhone,
      cartItems: normalizedItems,
      totalValue: calculatedTotalAmount,
    });

    if (cartResult?.data?.id) {
      await runOptionalQuery(
        `
          UPDATE abandoned_carts
          SET
            customer_name = COALESCE($2, customer_name),
            customer_email = COALESCE($3, customer_email),
            customer_phone = COALESCE($4, customer_phone),
            recovery_status = CASE
              WHEN recovery_status = 'recovered' THEN recovery_status
              ELSE 'checkout_started'
            END,
            checkout_started_at = COALESCE(checkout_started_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [
          cartResult.data.id,
          customerName || null,
          customerEmail || null,
          customerPhone || null,
        ],
        []
      );
    }
  }

  let rows = [];

  if (normalizedSessionId) {
    const existingRows = await runOptionalQuery(
      `
        SELECT id
        FROM abandoned_checkouts
        WHERE session_id = $1
          AND payment_status <> 'completed'
          AND recovery_status <> 'recovered'
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [normalizedSessionId],
      []
    );

    if (existingRows.length) {
      rows = await runOptionalQuery(
        `
          UPDATE abandoned_checkouts
          SET
            customer_email = COALESCE($2, customer_email),
            customer_name = COALESCE($3, customer_name),
            customer_phone = COALESCE($4, customer_phone),
            cart_items = $5::jsonb,
            total_amount = $6,
            payment_status = 'started',
            recovery_status = CASE
              WHEN recovery_status IN ('email_sent', 'whatsapp_contacted')
                THEN recovery_status
              ELSE 'not_contacted'
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, payment_status, recovery_status, started_at
        `,
        [
          existingRows[0].id,
          customerEmail || null,
          customerName || null,
          customerPhone || null,
          JSON.stringify(normalizedItems),
          calculatedTotalAmount,
        ],
        []
      );
    }
  }

  if (!rows.length) {
    rows = await runOptionalQuery(
      `
        INSERT INTO abandoned_checkouts (
          session_id,
          customer_email,
          customer_name,
          customer_phone,
          cart_items,
          total_amount,
          payment_status,
          recovery_status
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'started', 'not_contacted')
        RETURNING id, payment_status, recovery_status, started_at
      `,
      [
        normalizedSessionId,
        customerEmail || null,
        customerName || null,
        customerPhone || null,
        JSON.stringify(normalizedItems),
        calculatedTotalAmount,
      ],
      []
    );
  }

  await recordAnalyticsEvent({
    eventType: "checkout_started",
    sessionId,
    customerEmail,
    value: calculatedTotalAmount,
    utm,
    metadata: { itemCount: normalizedItems.length },
  });

  if (!rows.length) {
    return {
      stored: false,
      status: "not_configured",
      message: "Abandoned checkout table is not available yet.",
    };
  }

  return {
    stored: true,
    status: rows[0].payment_status,
    data: rows[0],
  };
}

async function createBackInStockRequest({
  productId,
  customerEmail,
  customerPhone,
} = {}) {
  const normalizedEmail = String(customerEmail || "").trim().toLowerCase();
  const normalizedPhone = String(customerPhone || "").trim();

  if (!productId || (!normalizedEmail && !normalizedPhone)) {
    return {
      stored: false,
      status: "invalid_request",
      message: "Product and email or phone are required.",
    };
  }

  const productRows = await runOptionalQuery(
    `
      SELECT id, name, slug, stock_quantity, status, is_active
      FROM products
      WHERE id = $1
      LIMIT 1
    `,
    [productId],
    []
  );

  const product = productRows[0];

  if (!product) {
    return {
      stored: false,
      status: "invalid_product",
      message: "Product was not found.",
    };
  }

  if (
    Number(product.stock_quantity || 0) > 0 &&
    product.status === "active" &&
    product.is_active !== false
  ) {
    return {
      stored: false,
      status: "already_available",
      message: "This product is already back in stock.",
    };
  }

  const existingRows = await runOptionalQuery(
    `
      SELECT id, product_id, customer_email, customer_phone, status, created_at
      FROM back_in_stock_requests
      WHERE product_id = $1
        AND status IN ('waiting', 'ready_to_notify')
        AND (
          ($2::text IS NOT NULL AND LOWER(customer_email) = LOWER($2))
          OR ($3::text IS NOT NULL AND customer_phone = $3)
        )
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [productId, normalizedEmail || null, normalizedPhone || null],
    []
  );

  if (existingRows.length) {
    return {
      stored: true,
      status: "already_waiting",
      message: "This contact is already on the back-in-stock list.",
      data: existingRows[0],
    };
  }

  const rows = await runOptionalQuery(
    `
      INSERT INTO back_in_stock_requests (
        product_id,
        customer_email,
        customer_phone,
        status
      )
      VALUES ($1, $2, $3, 'waiting')
      RETURNING id, product_id, status, created_at
    `,
    [productId, normalizedEmail || null, normalizedPhone || null],
    []
  );

  await queueAutomationEvent({
    eventType: "back_in_stock",
    status: "pending",
    channel: normalizedPhone ? "whatsapp" : "email",
    customerEmail: normalizedEmail || null,
    customerPhone: normalizedPhone || null,
    productId,
    payload: { source: "back_in_stock_form" },
  });

  if (!rows.length) {
    return {
      stored: false,
      status: "not_configured",
      message: "Back-in-stock request table is not available yet.",
    };
  }

  return {
    stored: true,
    status: rows[0].status,
    data: rows[0],
  };
}

async function listBackInStockRequests({ status = "all", productId, limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
  const values = [];
  const conditions = [];

  if (status && status !== "all") {
    values.push(status);
    conditions.push(`request.status = $${values.length}`);
  }

  if (productId) {
    values.push(productId);
    conditions.push(`request.product_id = $${values.length}`);
  }

  values.push(safeLimit);
  const limitPlaceholder = `$${values.length}`;
  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const rows = await runOptionalQuery(
    `
      SELECT
        request.id,
        request.product_id,
        request.customer_email,
        request.customer_phone,
        request.status,
        request.ready_to_notify_at,
        request.notified_at,
        request.created_at,
        request.updated_at,
        request.whatsapp_contacted_at,
        request.whatsapp_contact_count,
        request.notification_channel,
        request.last_notification_error,
        product.name AS product_name,
        product.slug AS product_slug,
        product.image_url AS product_image,
        product.stock_quantity AS product_stock_quantity
      FROM back_in_stock_requests request
      LEFT JOIN products product ON product.id = request.product_id
      ${whereClause}
      ORDER BY request.created_at DESC
      LIMIT ${limitPlaceholder}
    `,
    values,
    []
  );

  if (rows.length) {
    return rows.map(formatBackInStockRequest);
  }

  const fallbackRows = await runOptionalQuery(
    `
      SELECT
        request.id,
        request.product_id,
        request.customer_email,
        request.customer_phone,
        request.status,
        request.ready_to_notify_at,
        request.notified_at,
        request.created_at,
        request.updated_at,
        NULL::timestamp AS whatsapp_contacted_at,
        0::int AS whatsapp_contact_count,
        NULL::text AS notification_channel,
        NULL::text AS last_notification_error,
        product.name AS product_name,
        product.slug AS product_slug,
        product.image_url AS product_image,
        product.stock_quantity AS product_stock_quantity
      FROM back_in_stock_requests request
      LEFT JOIN products product ON product.id = request.product_id
      ${whereClause}
      ORDER BY request.created_at DESC
      LIMIT ${limitPlaceholder}
    `,
    values,
    []
  );

  return fallbackRows.map(formatBackInStockRequest);
}

async function markBackInStockWhatsappContacted(requestId) {
  const rows = await runOptionalQuery(
    `
      UPDATE back_in_stock_requests
      SET
        status = CASE
          WHEN status = 'email_sent' THEN status
          ELSE 'whatsapp_contacted'
        END,
        whatsapp_contacted_at = CURRENT_TIMESTAMP,
        whatsapp_contact_count = COALESCE(whatsapp_contact_count, 0) + 1,
        notification_channel = COALESCE(notification_channel, 'whatsapp'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `,
    [requestId],
    []
  );

  const fallbackRows = rows.length
    ? rows
    : await runOptionalQuery(
        `
          UPDATE back_in_stock_requests
          SET
            status = CASE
              WHEN status = 'email_sent' THEN status
              ELSE 'whatsapp_contacted'
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id
        `,
        [requestId],
        []
      );

  if (!fallbackRows.length) {
    return {
      updated: false,
      status: "not_found",
      message: "Back-in-stock request not found.",
    };
  }

  return {
    updated: true,
    status: "whatsapp_contacted",
    data: (await listBackInStockRequests({ limit: 250 })).find(
      (request) => request.id === requestId
    ),
  };
}

async function sendBackInStockNotificationsForProduct({
  productId,
  product,
  previousStock,
  newStock,
} = {}) {
  const oldStock = Number(previousStock || 0);
  const currentStock = Number(newStock ?? product?.stock_quantity ?? 0);
  const resolvedProductId = productId || product?.id;

  if (!resolvedProductId || oldStock > 0 || currentStock <= 0) {
    return {
      processed: 0,
      emailSent: 0,
      whatsappReady: 0,
      skipped: true,
    };
  }

  const productRows = product?.id
    ? [product]
    : await runOptionalQuery(
        `
          SELECT id, name, slug, price, image_url, stock_quantity, status, is_active
          FROM products
          WHERE id = $1
          LIMIT 1
        `,
        [resolvedProductId],
        []
      );
  const currentProduct = productRows[0];

  if (
    !currentProduct ||
    currentProduct.status !== "active" ||
    currentProduct.is_active === false ||
    Number(currentProduct.stock_quantity || currentStock) <= 0
  ) {
    return {
      processed: 0,
      emailSent: 0,
      whatsappReady: 0,
      skipped: true,
    };
  }

  const requestRows = await runOptionalQuery(
    `
      SELECT
        id,
        product_id,
        customer_email,
        customer_phone,
        status,
        notified_at,
        created_at
      FROM back_in_stock_requests
      WHERE product_id = $1
        AND status IN ('waiting', 'ready_to_notify')
        AND notified_at IS NULL
      ORDER BY created_at ASC
    `,
    [resolvedProductId],
    []
  );

  let emailSent = 0;
  let whatsappReady = 0;
  const results = [];

  for (const request of requestRows) {
    if (request.customer_email) {
      try {
        await sendBackInStockEmail({
          product: currentProduct,
          request,
        });

        await runOptionalQuery(
          `
            UPDATE back_in_stock_requests
            SET
              status = 'email_sent',
              notified_at = CURRENT_TIMESTAMP,
              notification_channel = 'email',
              last_notification_error = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `,
          [request.id],
          []
        );

        await runOptionalQuery(
          `
            UPDATE back_in_stock_requests
            SET
              status = 'email_sent',
              notified_at = COALESCE(notified_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `,
          [request.id],
          []
        );

        emailSent += 1;
        results.push({ requestId: request.id, status: "email_sent" });
      } catch (error) {
        await runOptionalQuery(
          `
            UPDATE back_in_stock_requests
            SET
              status = 'ready_to_notify',
              ready_to_notify_at = COALESCE(ready_to_notify_at, CURRENT_TIMESTAMP),
              last_notification_error = $2,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `,
          [request.id, error.message],
          []
        );

        await runOptionalQuery(
          `
            UPDATE back_in_stock_requests
            SET
              status = 'ready_to_notify',
              ready_to_notify_at = COALESCE(ready_to_notify_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `,
          [request.id],
          []
        );

        results.push({
          requestId: request.id,
          status: "email_failed",
          message: error.message,
        });
      }

      continue;
    }

    if (request.customer_phone) {
      await runOptionalQuery(
        `
          UPDATE back_in_stock_requests
          SET
            status = 'ready_to_notify',
            ready_to_notify_at = COALESCE(ready_to_notify_at, CURRENT_TIMESTAMP),
            notification_channel = COALESCE(notification_channel, 'whatsapp'),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [request.id],
        []
      );

      await runOptionalQuery(
        `
          UPDATE back_in_stock_requests
          SET
            status = 'ready_to_notify',
            ready_to_notify_at = COALESCE(ready_to_notify_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [request.id],
        []
      );

      whatsappReady += 1;
      results.push({ requestId: request.id, status: "whatsapp_ready" });
    }
  }

  return {
    processed: requestRows.length,
    emailSent,
    whatsappReady,
    results,
  };
}

async function getAbandonedCartById(cartId) {
  const rows = await runOptionalQuery(
    `
      SELECT
        id,
        session_id,
        customer_name,
        customer_email,
        customer_phone,
        cart_items,
        total_value,
        recovery_status,
        last_activity_at,
        recovery_email_sent_at,
        recovery_email_count,
        whatsapp_contacted_at,
        whatsapp_contact_count,
        checkout_started_at,
        recovered_at,
        recovered_order_id,
        created_at,
        updated_at
      FROM abandoned_carts
      WHERE id = $1
    `,
    [cartId],
    []
  );

  if (rows.length) {
    return formatAbandonedCart(rows[0]);
  }

  const fallbackRows = await runOptionalQuery(
    `
      SELECT
        id,
        session_id,
        NULL::text AS customer_name,
        customer_email,
        customer_phone,
        cart_items,
        total_value,
        recovery_status,
        last_activity_at,
        NULL::timestamp AS recovery_email_sent_at,
        0::int AS recovery_email_count,
        NULL::timestamp AS whatsapp_contacted_at,
        0::int AS whatsapp_contact_count,
        NULL::timestamp AS checkout_started_at,
        NULL::timestamp AS recovered_at,
        recovered_order_id,
        created_at,
        updated_at
      FROM abandoned_carts
      WHERE id = $1
    `,
    [cartId],
    []
  );

  return formatAbandonedCart(fallbackRows[0]);
}

async function listAbandonedCarts({ status, limit = 100 } = {}) {
  const delayMinutes = getRecoveryDelayMinutes();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
  const params = [delayMinutes, safeLimit];
  const statusFilter = status && status !== "all" ? "AND recovery_status = $3" : "";

  if (statusFilter) {
    params.push(status);
  }

  const rows = await runOptionalQuery(
    `
      SELECT
        id,
        session_id,
        customer_name,
        customer_email,
        customer_phone,
        cart_items,
        total_value,
        recovery_status,
        last_activity_at,
        recovery_email_sent_at,
        recovery_email_count,
        whatsapp_contacted_at,
        whatsapp_contact_count,
        checkout_started_at,
        recovered_at,
        recovered_order_id,
        created_at,
        updated_at,
        (
          recovery_status IN ('not_contacted', 'checkout_started')
          AND customer_email IS NOT NULL
          AND last_activity_at <= CURRENT_TIMESTAMP - ($1 || ' minutes')::interval
        ) AS recovery_ready
      FROM abandoned_carts
      WHERE recovery_status <> 'expired'
      ${statusFilter}
      ORDER BY last_activity_at DESC
      LIMIT $2
    `,
    params,
    []
  );

  if (rows.length) {
    return {
      delayMinutes,
      carts: rows.map(formatAbandonedCart),
    };
  }

  const fallbackRows = await runOptionalQuery(
    `
      SELECT
        id,
        session_id,
        NULL::text AS customer_name,
        customer_email,
        customer_phone,
        cart_items,
        total_value,
        recovery_status,
        last_activity_at,
        NULL::timestamp AS recovery_email_sent_at,
        0::int AS recovery_email_count,
        NULL::timestamp AS whatsapp_contacted_at,
        0::int AS whatsapp_contact_count,
        NULL::timestamp AS checkout_started_at,
        NULL::timestamp AS recovered_at,
        recovered_order_id,
        created_at,
        updated_at,
        (
          recovery_status IN ('not_contacted', 'checkout_started')
          AND customer_email IS NOT NULL
          AND last_activity_at <= CURRENT_TIMESTAMP - ($1 || ' minutes')::interval
        ) AS recovery_ready
      FROM abandoned_carts
      WHERE recovery_status <> 'expired'
      ${statusFilter}
      ORDER BY last_activity_at DESC
      LIMIT $2
    `,
    params,
    []
  );

  return {
    delayMinutes,
    carts: fallbackRows.map(formatAbandonedCart),
  };
}

async function markAbandonedCartRecovered({
  sessionId,
  customerEmail,
  customerPhone,
  orderId,
  client = pool,
} = {}) {
  const normalizedSessionId = getSessionId(sessionId);

  if (!normalizedSessionId && !customerEmail && !customerPhone && !orderId) {
    return {
      stored: false,
      status: "missing_identifier",
    };
  }

  const rows = await runOptionalQuery(
    `
      UPDATE abandoned_carts
      SET
        recovery_status = 'recovered',
        recovered_order_id = COALESCE($4, recovered_order_id),
        recovered_at = COALESCE(recovered_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE recovery_status <> 'recovered'
        AND (
          ($1::text IS NOT NULL AND session_id = $1)
          OR ($2::text IS NOT NULL AND LOWER(customer_email) = LOWER($2))
          OR ($3::text IS NOT NULL AND customer_phone = $3)
        )
      RETURNING id
    `,
    [
      normalizedSessionId,
      customerEmail || null,
      customerPhone || null,
      orderId || null,
    ],
    [],
    { client }
  );

  const fallbackRows = rows.length
    ? rows
    : await runOptionalQuery(
        `
          UPDATE abandoned_carts
          SET
            recovery_status = 'recovered',
            recovered_order_id = COALESCE($4, recovered_order_id),
            updated_at = CURRENT_TIMESTAMP
          WHERE recovery_status <> 'recovered'
            AND (
              ($1::text IS NOT NULL AND session_id = $1)
              OR ($2::text IS NOT NULL AND LOWER(customer_email) = LOWER($2))
              OR ($3::text IS NOT NULL AND customer_phone = $3)
            )
          RETURNING id
        `,
        [
          normalizedSessionId,
          customerEmail || null,
          customerPhone || null,
          orderId || null,
        ],
        [],
        { client }
      );

  await runOptionalQuery(
    `
      UPDATE abandoned_checkouts
      SET
        payment_status = 'completed',
        recovery_status = 'recovered',
        order_id = COALESCE($4, order_id),
        completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE payment_status <> 'completed'
        AND (
          ($1::text IS NOT NULL AND session_id = $1)
          OR ($2::text IS NOT NULL AND LOWER(customer_email) = LOWER($2))
          OR ($3::text IS NOT NULL AND customer_phone = $3)
        )
    `,
    [
      normalizedSessionId,
      customerEmail || null,
      customerPhone || null,
      orderId || null,
    ],
    [],
    { client }
  );

  return {
    stored: fallbackRows.length > 0,
    status: fallbackRows.length ? "recovered" : "not_found",
    count: fallbackRows.length,
  };
}

async function getAbandonedCheckoutById(checkoutId) {
  const rows = await runOptionalQuery(
    `
      SELECT
        id,
        session_id,
        customer_email,
        customer_name,
        customer_phone,
        cart_items,
        total_amount,
        payment_status,
        recovery_status,
        order_id,
        paystack_reference,
        started_at,
        completed_at,
        recovery_email_sent_at,
        recovery_email_count,
        whatsapp_contacted_at,
        whatsapp_contact_count,
        updated_at
      FROM abandoned_checkouts
      WHERE id = $1
    `,
    [checkoutId],
    []
  );

  if (rows.length) {
    return formatAbandonedCheckout(rows[0]);
  }

  const fallbackRows = await runOptionalQuery(
    `
      SELECT
        id,
        session_id,
        customer_email,
        customer_name,
        customer_phone,
        cart_items,
        total_amount,
        payment_status,
        recovery_status,
        order_id,
        paystack_reference,
        started_at,
        completed_at,
        NULL::timestamp AS recovery_email_sent_at,
        0::int AS recovery_email_count,
        NULL::timestamp AS whatsapp_contacted_at,
        0::int AS whatsapp_contact_count,
        updated_at
      FROM abandoned_checkouts
      WHERE id = $1
    `,
    [checkoutId],
    []
  );

  return formatAbandonedCheckout(fallbackRows[0]);
}

async function listAbandonedCheckouts({ status, limit = 100 } = {}) {
  const delayMinutes = getRecoveryDelayMinutes();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
  const params = [delayMinutes, safeLimit];
  let statusFilter =
    "payment_status <> 'completed' AND recovery_status <> 'recovered'";

  if (status && status !== "all") {
    params.push(status);
    statusFilter = "(payment_status = $3 OR recovery_status = $3)";
  }

  const rows = await runOptionalQuery(
    `
      SELECT
        id,
        session_id,
        customer_email,
        customer_name,
        customer_phone,
        cart_items,
        total_amount,
        payment_status,
        recovery_status,
        order_id,
        paystack_reference,
        started_at,
        completed_at,
        recovery_email_sent_at,
        recovery_email_count,
        whatsapp_contacted_at,
        whatsapp_contact_count,
        updated_at,
        (
          payment_status <> 'completed'
          AND recovery_status NOT IN ('email_sent', 'whatsapp_contacted', 'recovered')
          AND customer_email IS NOT NULL
          AND started_at <= CURRENT_TIMESTAMP - ($1 || ' minutes')::interval
        ) AS recovery_ready
      FROM abandoned_checkouts
      WHERE ${statusFilter}
      ORDER BY started_at DESC
      LIMIT $2
    `,
    params,
    []
  );

  if (rows.length) {
    return {
      delayMinutes,
      checkouts: rows.map(formatAbandonedCheckout),
    };
  }

  const fallbackRows = await runOptionalQuery(
    `
      SELECT
        id,
        session_id,
        customer_email,
        customer_name,
        customer_phone,
        cart_items,
        total_amount,
        payment_status,
        recovery_status,
        order_id,
        paystack_reference,
        started_at,
        completed_at,
        NULL::timestamp AS recovery_email_sent_at,
        0::int AS recovery_email_count,
        NULL::timestamp AS whatsapp_contacted_at,
        0::int AS whatsapp_contact_count,
        updated_at,
        (
          payment_status <> 'completed'
          AND recovery_status NOT IN ('email_sent', 'whatsapp_contacted', 'recovered')
          AND customer_email IS NOT NULL
          AND started_at <= CURRENT_TIMESTAMP - ($1 || ' minutes')::interval
        ) AS recovery_ready
      FROM abandoned_checkouts
      WHERE ${statusFilter}
      ORDER BY started_at DESC
      LIMIT $2
    `,
    params,
    []
  );

  return {
    delayMinutes,
    checkouts: fallbackRows.map(formatAbandonedCheckout),
  };
}

async function sendRecoveryEmailForCart(cartId) {
  const cart = await getAbandonedCartById(cartId);

  if (!cart) {
    return {
      sent: false,
      status: "not_found",
      message: "Abandoned cart not found.",
    };
  }

  if (!cart.customer_email) {
    return {
      sent: false,
      status: "missing_email",
      message: "This cart does not have a customer email.",
    };
  }

  await sendAbandonedCartRecoveryEmail(cart);

  await runOptionalQuery(
    `
      UPDATE abandoned_carts
      SET
        recovery_status = CASE
          WHEN recovery_status = 'recovered' THEN recovery_status
          ELSE 'email_sent'
        END,
        recovery_email_sent_at = CURRENT_TIMESTAMP,
        recovery_email_count = COALESCE(recovery_email_count, 0) + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [cartId],
    []
  );

  await runOptionalQuery(
    `
      UPDATE abandoned_carts
      SET
        recovery_status = CASE
          WHEN recovery_status = 'recovered' THEN recovery_status
          ELSE 'email_sent'
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [cartId],
    []
  );

  await recordAnalyticsEvent({
    eventType: "abandoned_cart_recovery_email",
    sessionId: cart.session_id,
    customerEmail: cart.customer_email,
    value: cart.total_value,
    metadata: {
      cartId,
    },
  });
  await emitAutomationEvent(
    "cart_abandoned",
    {
      cartId,
      sessionId: cart.session_id,
      customerEmail: cart.customer_email,
      cartValue: Number(cart.total_value || 0),
      analyticsAlreadyRecorded: false,
      source: "abandoned_cart_recovery_sent",
    },
    { enroll: false }
  );

  return {
    sent: true,
    status: "email_sent",
    data: await getAbandonedCartById(cartId),
  };
}

async function sendRecoveryEmailForCheckout(checkoutId) {
  const checkout = await getAbandonedCheckoutById(checkoutId);

  if (!checkout) {
    return {
      sent: false,
      status: "not_found",
      message: "Abandoned checkout not found.",
    };
  }

  if (
    checkout.payment_status === "completed" ||
    checkout.recovery_status === "recovered" ||
    checkout.completed_at
  ) {
    return {
      sent: false,
      status: "completed",
      message: "Payment already succeeded. Recovery email was not sent.",
    };
  }

  if (!checkout.customer_email) {
    return {
      sent: false,
      status: "missing_email",
      message: "This checkout does not have a customer email.",
    };
  }

  if (
    checkout.recovery_email_sent_at ||
    Number(checkout.recovery_email_count || 0) > 0 ||
    checkout.recovery_status === "email_sent"
  ) {
    return {
      sent: false,
      status: "duplicate",
      message: "A checkout recovery email has already been sent.",
      data: checkout,
    };
  }

  await sendCheckoutRecoveryEmail(checkout);

  const rows = await runOptionalQuery(
    `
      UPDATE abandoned_checkouts
      SET
        recovery_status = CASE
          WHEN payment_status = 'completed' OR recovery_status = 'recovered'
            THEN recovery_status
          ELSE 'email_sent'
        END,
        recovery_email_sent_at = CURRENT_TIMESTAMP,
        recovery_email_count = COALESCE(recovery_email_count, 0) + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND payment_status <> 'completed'
        AND recovery_status <> 'recovered'
      RETURNING id
    `,
    [checkoutId],
    []
  );

  const fallbackRows = rows.length
    ? rows
    : await runOptionalQuery(
        `
          UPDATE abandoned_checkouts
          SET
            recovery_status = CASE
              WHEN payment_status = 'completed' OR recovery_status = 'recovered'
                THEN recovery_status
              ELSE 'email_sent'
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND payment_status <> 'completed'
            AND recovery_status <> 'recovered'
          RETURNING id
        `,
        [checkoutId],
        []
      );

  await recordAnalyticsEvent({
    eventType: "checkout_recovery_email",
    sessionId: checkout.session_id,
    customerEmail: checkout.customer_email,
    value: checkout.total_amount,
    metadata: {
      checkoutId,
      stored: fallbackRows.length > 0,
    },
  });

  return {
    sent: true,
    status: "email_sent",
    data: await getAbandonedCheckoutById(checkoutId),
  };
}

async function sendDueAbandonedCartRecoveryEmails({ limit = 25 } = {}) {
  const delayMinutes = getRecoveryDelayMinutes();
  const maxEmails = Math.max(Number(process.env.ABANDONED_CART_MAX_EMAILS || 3), 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const dueRows = await runOptionalQuery(
    `
      SELECT id
      FROM abandoned_carts
      WHERE recovery_status IN ('not_contacted', 'checkout_started', 'email_sent')
        AND customer_email IS NOT NULL
        AND recovered_at IS NULL
        AND COALESCE(recovery_email_count, 0) < $2
        AND COALESCE(recovery_email_sent_at, last_activity_at) <= CURRENT_TIMESTAMP - ($1 || ' minutes')::interval
      ORDER BY COALESCE(recovery_email_sent_at, last_activity_at) ASC
      LIMIT $3
    `,
    [delayMinutes, maxEmails, safeLimit],
    []
  );

  const results = [];

  for (const row of dueRows) {
    try {
      const result = await sendRecoveryEmailForCart(row.id);
      results.push({
        cartId: row.id,
        ...result,
      });
    } catch (error) {
      results.push({
        cartId: row.id,
        sent: false,
        status: "failed",
        message: error.message,
      });
    }
  }

  return {
    delayMinutes,
    maxEmails,
    processed: results.length,
    sent: results.filter((result) => result.sent).length,
    results,
  };
}
async function sendDueCheckoutRecoveryEmails({ limit = 25 } = {}) {
  const delayMinutes = getRecoveryDelayMinutes();
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const dueRows = await runOptionalQuery(
    `
      SELECT id
      FROM abandoned_checkouts
      WHERE payment_status <> 'completed'
        AND recovery_status NOT IN ('email_sent', 'whatsapp_contacted', 'recovered')
        AND customer_email IS NOT NULL
        AND started_at <= CURRENT_TIMESTAMP - ($1 || ' minutes')::interval
      ORDER BY started_at ASC
      LIMIT $2
    `,
    [delayMinutes, safeLimit],
    []
  );

  const results = [];

  for (const row of dueRows) {
    try {
      const result = await sendRecoveryEmailForCheckout(row.id);
      results.push({
        checkoutId: row.id,
        ...result,
      });
    } catch (error) {
      results.push({
        checkoutId: row.id,
        sent: false,
        status: "failed",
        message: error.message,
      });
    }
  }

  return {
    delayMinutes,
    processed: results.length,
    sent: results.filter((result) => result.sent).length,
    results,
  };
}

let abandonedCartRecoveryWorkerTimer = null;
let isRecoveryWorkerRunning = false;
let recoveryWorkerFailureCount = 0;

function startAbandonedCartRecoveryWorker() {
  if (process.env.ABANDONED_CART_WORKER_ENABLED === "false") {
    console.log("Abandoned cart recovery worker disabled.");
    return null;
  }

  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY missing. Abandoned cart recovery worker idle.");
    return null;
  }

  if (abandonedCartRecoveryWorkerTimer) {
    console.log("Abandoned cart recovery worker already started.");
    return abandonedCartRecoveryWorkerTimer;
  }

  const intervalMinutes = Number(
    process.env.ABANDONED_CART_WORKER_INTERVAL_MINUTES || 5
  );
  const intervalMs =
    (Number.isFinite(intervalMinutes) && intervalMinutes > 0
      ? intervalMinutes
      : 5) *
    60 *
    1000;
  const maxBackoffMs = 30 * 60 * 1000;

  const scheduleNextRun = (delayMs) => {
    abandonedCartRecoveryWorkerTimer = setTimeout(run, delayMs);
    abandonedCartRecoveryWorkerTimer.unref?.();
  };

  const run = async () => {
    if (isRecoveryWorkerRunning) {
      console.log("Abandoned cart recovery worker skipped: previous scan still running.");
      scheduleNextRun(intervalMs);
      return;
    }

    isRecoveryWorkerRunning = true;
    const startedAt = Date.now();

    try {
      console.log("Abandoned cart recovery worker scan started.");
      const cartResult = await sendDueAbandonedCartRecoveryEmails();
      const checkoutResult = await sendDueCheckoutRecoveryEmails();

      recoveryWorkerFailureCount = 0;

      console.log("Abandoned cart recovery worker scan completed:", {
        cartsProcessed: cartResult.processed,
        cartsSent: cartResult.sent,
        checkoutsProcessed: checkoutResult.processed,
        checkoutsSent: checkoutResult.sent,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      recoveryWorkerFailureCount += 1;
      console.error(
        "Abandoned cart recovery worker error:",
        pool.describeError ? pool.describeError(error) : { message: error.message, code: error.code }
      );
    } finally {
      isRecoveryWorkerRunning = false;
      const backoffMs = recoveryWorkerFailureCount
        ? Math.min(intervalMs * (recoveryWorkerFailureCount + 1), maxBackoffMs)
        : intervalMs;
      scheduleNextRun(backoffMs);
    }
  };

  scheduleNextRun(30000);
  console.log("Abandoned cart recovery worker started.");

  return abandonedCartRecoveryWorkerTimer;
}
async function markWhatsappContacted(cartId) {
  const rows = await runOptionalQuery(
    `
      UPDATE abandoned_carts
      SET
        recovery_status = CASE
          WHEN recovery_status = 'recovered' THEN recovery_status
          ELSE 'whatsapp_contacted'
        END,
        whatsapp_contacted_at = CURRENT_TIMESTAMP,
        whatsapp_contact_count = COALESCE(whatsapp_contact_count, 0) + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `,
    [cartId],
    []
  );

  const fallbackRows = rows.length
    ? rows
    : await runOptionalQuery(
        `
          UPDATE abandoned_carts
          SET
            recovery_status = CASE
              WHEN recovery_status = 'recovered' THEN recovery_status
              ELSE 'whatsapp_contacted'
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id
        `,
        [cartId],
        []
      );

  if (!fallbackRows.length) {
    return {
      updated: false,
      status: "not_found",
      message: "Abandoned cart not found.",
    };
  }

  return {
    updated: true,
    status: "whatsapp_contacted",
    data: await getAbandonedCartById(cartId),
  };
}

async function markCheckoutWhatsappContacted(checkoutId) {
  const checkout = await getAbandonedCheckoutById(checkoutId);

  if (!checkout) {
    return {
      updated: false,
      status: "not_found",
      message: "Abandoned checkout not found.",
    };
  }

  if (
    checkout.payment_status === "completed" ||
    checkout.recovery_status === "recovered" ||
    checkout.completed_at
  ) {
    return {
      updated: false,
      status: "completed",
      message: "Payment already succeeded. WhatsApp follow-up was not marked.",
      data: checkout,
    };
  }

  const rows = await runOptionalQuery(
    `
      UPDATE abandoned_checkouts
      SET
        recovery_status = CASE
          WHEN payment_status = 'completed' OR recovery_status = 'recovered'
            THEN recovery_status
          ELSE 'whatsapp_contacted'
        END,
        whatsapp_contacted_at = CURRENT_TIMESTAMP,
        whatsapp_contact_count = COALESCE(whatsapp_contact_count, 0) + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND payment_status <> 'completed'
        AND recovery_status <> 'recovered'
      RETURNING id
    `,
    [checkoutId],
    []
  );

  const fallbackRows = rows.length
    ? rows
    : await runOptionalQuery(
        `
          UPDATE abandoned_checkouts
          SET
            recovery_status = CASE
              WHEN payment_status = 'completed' OR recovery_status = 'recovered'
                THEN recovery_status
              ELSE 'whatsapp_contacted'
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND payment_status <> 'completed'
            AND recovery_status <> 'recovered'
          RETURNING id
        `,
        [checkoutId],
        []
      );

  if (!fallbackRows.length) {
    return {
      updated: false,
      status: "not_found",
      message: "Abandoned checkout not found.",
    };
  }

  return {
    updated: true,
    status: "whatsapp_contacted",
    data: await getAbandonedCheckoutById(checkoutId),
  };
}

async function getGrowthOverview() {
  const [cartSummary] = await runOptionalQuery(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE recovery_status = 'recovered')::int AS recovered,
        COALESCE(SUM(total_value), 0)::numeric AS estimated_value
      FROM abandoned_carts
    `,
    [],
    [{ total: 0, recovered: 0, estimated_value: 0 }]
  );

  const [checkoutSummary] = await runOptionalQuery(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE payment_status = 'completed')::int AS completed,
        COALESCE(SUM(total_amount), 0)::numeric AS estimated_value
      FROM abandoned_checkouts
    `,
    [],
    [{ total: 0, completed: 0, estimated_value: 0 }]
  );

  const [viewSummary] = await runOptionalQuery(
    `
      SELECT COUNT(*)::int AS total
      FROM product_views
    `,
    [],
    [{ total: 0 }]
  );

  const [backInStockSummary] = await runOptionalQuery(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting,
        COUNT(*) FILTER (WHERE status = 'ready_to_notify')::int AS ready_to_notify
      FROM back_in_stock_requests
    `,
    [],
    [{ total: 0, waiting: 0, ready_to_notify: 0 }]
  );

  const recentAbandonedCarts = await runOptionalQuery(
    `
      SELECT id, customer_email, customer_phone, total_value, recovery_status, last_activity_at
      FROM abandoned_carts
      ORDER BY last_activity_at DESC
      LIMIT 10
    `,
    [],
    []
  );

  const recentBackInStockRequests = await runOptionalQuery(
    `
      SELECT
        request.id,
        request.customer_email,
        request.customer_phone,
        request.status,
        request.created_at,
        product.name AS product_name
      FROM back_in_stock_requests request
      LEFT JOIN products product ON product.id = request.product_id
      ORDER BY request.created_at DESC
      LIMIT 10
    `,
    [],
    []
  );

  return {
    recoveryStatuses: RECOVERY_STATUSES,
    summary: {
      abandonedCarts: Number(cartSummary?.total || 0),
      recoveredCarts: Number(cartSummary?.recovered || 0),
      abandonedCartValue: Number(cartSummary?.estimated_value || 0),
      checkoutStarts: Number(checkoutSummary?.total || 0),
      completedCheckouts: Number(checkoutSummary?.completed || 0),
      abandonedCheckoutValue: Number(checkoutSummary?.estimated_value || 0),
      productViews: Number(viewSummary?.total || 0),
      backInStockRequests: Number(backInStockSummary?.total || 0),
      backInStockWaiting: Number(backInStockSummary?.waiting || 0),
      backInStockReady: Number(backInStockSummary?.ready_to_notify || 0),
    },
    recentAbandonedCarts,
    recentBackInStockRequests,
  };
}

module.exports = {
  RECOVERY_STATUSES,
  listBackInStockRequests,
  listAbandonedCarts,
  listAbandonedCheckouts,
  markAbandonedCartRecovered,
  markBackInStockWhatsappContacted,
  markCheckoutWhatsappContacted,
  markWhatsappContacted,
  recordAnalyticsEvent,
  recordProductView,
  saveAbandonedCart,
  saveCheckoutStart,
  createBackInStockRequest,
  sendDueAbandonedCartRecoveryEmails,
  sendDueCheckoutRecoveryEmails,
  sendBackInStockNotificationsForProduct,
  sendRecoveryEmailForCheckout,
  sendRecoveryEmailForCart,
  startAbandonedCartRecoveryWorker,
  getGrowthOverview,
};


