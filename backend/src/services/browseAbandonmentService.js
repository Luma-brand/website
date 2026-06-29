const pool = require("../config/db");
const { sendEmail } = require("./emailService");
const {
  baseEmailTemplate,
  escapeHtml,
  formatMoney,
  getFrontendUrl,
  stripHtml,
} = require("../utils/emailTemplates");

const OPTIONAL_SCHEMA_ERRORS = new Set(["42P01", "42703", "42P10"]);
const DEFAULT_DELAY_MINUTES = 120;
const DEFAULT_MAX_EMAILS = 1;

function isOptionalSchemaError(error) {
  return OPTIONAL_SCHEMA_ERRORS.has(error?.code);
}

async function runOptionalQuery(query, params = [], fallback = [], { client = pool } = {}) {
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    if (isOptionalSchemaError(error)) {
      return fallback;
    }
    throw error;
  }
}

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function isUuid(value) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    String(value || "")
  );
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function normalizeSessionId(value) {
  const sessionId = String(value || "").trim();
  return sessionId || null;
}

function normalizeProductIds(items = []) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => pick(item.productId, item.product_id, item.id, item.product?.id))
      .filter(isUuid)
  )];
}

function normalizeBrowsePayload(payload = {}) {
  const customer = payload.customer || payload.user || {};
  const product = payload.product || {};

  return {
    sessionId: normalizeSessionId(pick(payload.session_id, payload.sessionId)),
    customerId: isUuid(pick(payload.customer_id, payload.customerId, customer.id))
      ? pick(payload.customer_id, payload.customerId, customer.id)
      : null,
    customerEmail: normalizeEmail(
      pick(payload.customer_email, payload.customerEmail, payload.email, customer.email)
    ),
    productId: pick(payload.product_id, payload.productId, product.id),
    productName: pick(payload.product_name, payload.productName, product.name),
    productImage: pick(payload.product_image, payload.productImage, product.image, product.image_url),
    productUrl: pick(payload.product_url, payload.productUrl),
    productSlug: pick(payload.product_slug, payload.productSlug, product.slug),
    source: pick(payload.source, "product_view"),
    metadata: payload.metadata || {},
  };
}

function getDelayMinutes() {
  const value = Number(process.env.BROWSE_ABANDONMENT_DELAY_MINUTES || process.env.ABANDONED_CART_DELAY_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DELAY_MINUTES;
}

function getMaxEmails() {
  const value = Number(process.env.BROWSE_ABANDONMENT_MAX_EMAILS || DEFAULT_MAX_EMAILS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_EMAILS;
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

async function isBrowseAbandonmentFlowEnabled() {
  const rows = await runOptionalQuery(
    `
      SELECT id
      FROM automation_flows
      WHERE COALESCE(trigger_event, trigger_type) = 'product_viewed'
        AND COALESCE(type, flow_key) = 'browse_abandonment'
        AND is_active = true
        AND COALESCE(status, 'draft') = 'active'
      LIMIT 1
    `,
    [],
    []
  );

  return rows.length > 0;
}

async function getProductSnapshot(productId) {
  if (!isUuid(productId)) return null;

  const rows = await runOptionalQuery(
    `
      SELECT id, name, slug, image_url, price, stock_quantity, status
      FROM products
      WHERE id = $1
      LIMIT 1
    `,
    [productId],
    []
  );

  return rows[0] || null;
}

function formatBrowseAbandonment(row = {}) {
  const productSlug = row.product_slug || row.metadata?.productSlug || row.product_id;
  const productUrl = row.product_url || (productSlug
    ? `${getFrontendUrl()}/products/${productSlug}`
    : `${getFrontendUrl()}/products`);

  return {
    ...row,
    product_name: row.product_name || row.product_display_name || "LUMA product",
    product_image: row.product_image || row.product_image_url || row.metadata?.productImage || "",
    product_url: productUrl,
    email_count: Number(row.email_count || 0),
    recovery_ready: Boolean(row.recovery_ready),
  };
}

function buildBrowseAbandonmentTemplate(abandonment = {}) {
  const productName = abandonment.product_name || abandonment.product_display_name || "your LUMA pick";
  const productImage = abandonment.product_image || abandonment.product_image_url || "";
  const productUrl = abandonment.product_url || `${getFrontendUrl()}/products/${abandonment.product_slug || abandonment.product_id || ""}`;
  const imageHtml = productImage
    ? `<img src="${escapeHtml(productImage)}" alt="" style="width:100%;max-width:220px;border-radius:18px;margin:0 0 16px;display:block;" />`
    : "";
  const priceHtml = abandonment.product_price
    ? `<p style="margin:8px 0 0;color:#6f5b4a;"><strong>Price:</strong> ${formatMoney(abandonment.product_price)}</p>`
    : "";

  const html = baseEmailTemplate({
    previewText: "A LUMA product you viewed is still here.",
    title: "Still thinking about this LUMA pick?",
    body: `<p style="margin:0 0 16px;">Hi ${escapeHtml(abandonment.customer_name || "there")}, you viewed something from LUMA recently. If it still feels right for your routine, here is a simple way back.</p>
      <div style="background:#f2e7d8;border-radius:18px;padding:18px;margin:22px 0;">
        ${imageHtml}
        <strong style="display:block;color:#2b1d14;font-size:18px;">${escapeHtml(productName)}</strong>
        ${priceHtml}
      </div>`,
    buttonText: "View product",
    buttonUrl: productUrl,
  });

  return {
    subject: "Still thinking about this LUMA pick?",
    html,
    text: stripHtml(html),
  };
}

async function createOrUpdateBrowseAbandonmentFromProductView(payload = {}) {
  const normalized = normalizeBrowsePayload(payload);

  if (!isUuid(normalized.productId)) {
    return { stored: false, status: "invalid_product", message: "A valid product is required." };
  }

  if (!normalized.sessionId && !normalized.customerEmail && !normalized.customerId) {
    return { stored: false, status: "missing_identity", message: "Session or customer identity is required." };
  }

  const product = await getProductSnapshot(normalized.productId);
  const productUrl = normalized.productUrl || (
    normalized.productSlug || product?.slug
      ? `${getFrontendUrl()}/products/${normalized.productSlug || product?.slug}`
      : null
  );
  const metadata = {
    ...(normalized.metadata || {}),
    source: normalized.source,
    productSlug: normalized.productSlug || product?.slug || null,
    productImage: normalized.productImage || product?.image_url || null,
    productUrl,
  };

  const existingRows = await runOptionalQuery(
    `
      SELECT id
      FROM browse_abandonments
      WHERE product_id = $1
        AND status = 'pending'
        AND (
          ($2::text IS NOT NULL AND session_id = $2)
          OR ($3::text IS NOT NULL AND LOWER(customer_email) = LOWER($3))
          OR ($4::uuid IS NOT NULL AND customer_id = $4::uuid)
        )
      ORDER BY last_activity_at DESC
      LIMIT 1
    `,
    [
      normalized.productId,
      normalized.sessionId,
      normalized.customerEmail,
      normalized.customerId,
    ],
    []
  );

  let rows = [];
  if (existingRows.length) {
    rows = await runOptionalQuery(
      `
        UPDATE browse_abandonments
        SET
          session_id = COALESCE($2, session_id),
          customer_id = COALESCE($3::uuid, customer_id),
          customer_email = COALESCE($4, customer_email),
          product_name = COALESCE($5, product_name),
          product_image = COALESCE($6, product_image),
          product_url = COALESCE($7, product_url),
          last_activity_at = NOW(),
          eligible_at = NOW() + ($8 || ' minutes')::interval,
          metadata = COALESCE(metadata, '{}'::jsonb) || $9::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        existingRows[0].id,
        normalized.sessionId,
        normalized.customerId,
        normalized.customerEmail,
        normalized.productName || product?.name || null,
        normalized.productImage || product?.image_url || null,
        productUrl,
        getDelayMinutes(),
        JSON.stringify(metadata),
      ],
      []
    );
  } else {
    rows = await runOptionalQuery(
      `
        INSERT INTO browse_abandonments (
          session_id,
          customer_id,
          customer_email,
          product_id,
          product_name,
          product_image,
          product_url,
          status,
          viewed_at,
          last_activity_at,
          eligible_at,
          metadata
        )
        VALUES ($1, $2::uuid, $3, $4::uuid, $5, $6, $7, 'pending', NOW(), NOW(), NOW() + ($8 || ' minutes')::interval, $9::jsonb)
        RETURNING *
      `,
      [
        normalized.sessionId,
        normalized.customerId,
        normalized.customerEmail,
        normalized.productId,
        normalized.productName || product?.name || null,
        normalized.productImage || product?.image_url || null,
        productUrl,
        getDelayMinutes(),
        JSON.stringify(metadata),
      ],
      []
    );
  }

  if (!rows.length) {
    return {
      stored: false,
      status: "not_configured",
      message: "Browse abandonment table is not available yet.",
    };
  }

  return {
    stored: true,
    status: rows[0].status,
    data: formatBrowseAbandonment({ ...rows[0], ...product }),
  };
}

async function markBrowseAbandonmentConverted(payload = {}) {
  const client = payload.client || pool;
  const sessionId = normalizeSessionId(pick(payload.session_id, payload.sessionId));
  const customerId = isUuid(pick(payload.customer_id, payload.customerId))
    ? pick(payload.customer_id, payload.customerId)
    : null;
  const customerEmail = normalizeEmail(pick(payload.customer_email, payload.customerEmail, payload.email));
  const orderId = isUuid(pick(payload.order_id, payload.orderId)) ? pick(payload.order_id, payload.orderId) : null;
  const productIds = normalizeProductIds(
    payload.productIds || payload.product_ids || payload.cartItems || payload.cart_items || payload.items || []
  );

  if (!sessionId && !customerEmail && !customerId && !orderId) {
    return { updated: false, count: 0, status: "missing_identity" };
  }

  let resolvedProductIds = productIds;
  if (!resolvedProductIds.length && orderId) {
    const rows = await runOptionalQuery(
      "SELECT product_id FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL",
      [orderId],
      [],
      { client }
    );
    resolvedProductIds = rows.map((row) => row.product_id).filter(isUuid);
  }

  const params = [];
  const identityClauses = [];
  if (sessionId) {
    params.push(sessionId);
    identityClauses.push(`session_id = $${params.length}`);
  }
  if (customerEmail) {
    params.push(customerEmail);
    identityClauses.push(`LOWER(customer_email) = LOWER($${params.length})`);
  }
  if (customerId) {
    params.push(customerId);
    identityClauses.push(`customer_id = $${params.length}::uuid`);
  }

  if (!identityClauses.length && !orderId) {
    return { updated: false, count: 0, status: "missing_identity" };
  }

  const whereClauses = ["status IN ('pending', 'eligible', 'emailed')"];
  if (identityClauses.length) whereClauses.push(`(${identityClauses.join(" OR ")})`);

  if (resolvedProductIds.length) {
    params.push(resolvedProductIds);
    whereClauses.push(`product_id = ANY($${params.length}::uuid[])`);
  }

  const rows = await runOptionalQuery(
    `
      UPDATE browse_abandonments
      SET
        status = 'converted',
        converted_at = COALESCE(converted_at, NOW()),
        last_activity_at = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || $${params.length + 1}::jsonb,
        updated_at = NOW()
      WHERE ${whereClauses.join(" AND ")}
      RETURNING id
    `,
    [
      ...params,
      JSON.stringify({
        conversionSource: payload.source || "store_event",
        orderId,
      }),
    ],
    [],
    { client }
  );

  return {
    updated: rows.length > 0,
    count: rows.length,
    status: rows.length > 0 ? "converted" : "not_found",
  };
}

async function markBrowseAbandonmentsConvertedForCart(payload = {}) {
  return markBrowseAbandonmentConverted({
    ...payload,
    productIds: normalizeProductIds(
      payload.productIds || payload.product_ids || payload.cartItems || payload.cart_items || payload.items || []
    ),
    source: payload.source || "cart_activity",
  });
}

async function markBrowseAbandonmentsConvertedForOrder(order = {}) {
  return markBrowseAbandonmentConverted({
    orderId: order.id,
    customerEmail: order.customer_email,
    customerId: order.customer_id,
    source: "paid_order",
  });
}

async function findDueBrowseAbandonments({ limit = 25 } = {}) {
  const delayMinutes = getDelayMinutes();
  const maxEmails = getMaxEmails();
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);

  const rows = await runOptionalQuery(
    `
      SELECT
        browse.*,
        product.name AS product_display_name,
        product.slug AS product_slug,
        product.image_url AS product_image_url,
        product.price AS product_price
      FROM browse_abandonments browse
      LEFT JOIN products product ON product.id = browse.product_id
      WHERE browse.status IN ('pending', 'eligible')
        AND browse.customer_email IS NOT NULL
        AND COALESCE(browse.email_count, 0) < $2
        AND COALESCE(browse.eligible_at, browse.viewed_at + ($1 || ' minutes')::interval) <= NOW()
        AND NOT EXISTS (
          SELECT 1
          FROM analytics_events event
          WHERE event.created_at >= browse.viewed_at
            AND (
              (event.session_id IS NOT NULL AND event.session_id = browse.session_id)
              OR (event.customer_email IS NOT NULL AND LOWER(event.customer_email) = LOWER(browse.customer_email))
            )
            AND (
              (event.event_type = 'add_to_cart' AND event.product_id = browse.product_id)
              OR event.event_type IN ('checkout_started', 'purchase_completed', 'order_completed')
            )
        )
      ORDER BY browse.viewed_at ASC
      LIMIT $3
    `,
    [delayMinutes, maxEmails, safeLimit],
    []
  );

  const formattedRows = rows.map(formatBrowseAbandonment);
  if (formattedRows.length) {
    await runOptionalQuery(
      `
        UPDATE browse_abandonments
        SET status = 'eligible',
            updated_at = NOW()
        WHERE id = ANY($1::uuid[])
          AND status = 'pending'
      `,
      [formattedRows.map((row) => row.id)],
      []
    );
  }

  return formattedRows;
}

async function sendBrowseAbandonmentEmail(abandonmentId, { manual = false } = {}) {
  const rows = await runOptionalQuery(
    `
      SELECT
        browse.*,
        product.name AS product_display_name,
        product.slug AS product_slug,
        product.image_url AS product_image_url,
        product.price AS product_price
      FROM browse_abandonments browse
      LEFT JOIN products product ON product.id = browse.product_id
      WHERE browse.id = $1
      LIMIT 1
    `,
    [abandonmentId],
    []
  );

  const abandonment = rows[0] ? formatBrowseAbandonment(rows[0]) : null;
  if (!abandonment) {
    return { sent: false, status: "not_found", message: "Browse abandonment record was not found." };
  }

  if (!["pending", "eligible", "emailed"].includes(abandonment.status)) {
    return { sent: false, status: "not_eligible", message: "This browse record is no longer eligible for email.", data: abandonment };
  }

  if (!abandonment.customer_email) {
    return { sent: false, status: "missing_email", message: "Customer email is missing.", data: abandonment };
  }

  if (await isEmailSuppressed(abandonment.customer_email)) {
    return { sent: false, status: "suppressed", message: "This customer is suppressed from automation emails.", data: abandonment };
  }

  if (!manual && !(await isBrowseAbandonmentFlowEnabled())) {
    return { sent: false, status: "flow_disabled", message: "Browse abandonment flow is not enabled.", data: abandonment };
  }

  const maxEmails = getMaxEmails();
  if (Number(abandonment.email_count || 0) >= maxEmails) {
    return { sent: false, status: "duplicate", message: "Browse abandonment email limit has already been reached.", data: abandonment };
  }

  const template = buildBrowseAbandonmentTemplate(abandonment);
  const emailResult = await sendEmail({
    to: abandonment.customer_email,
    ...template,
    type: "browse_abandonment",
    metadata: {
      browseAbandonmentId: abandonment.id,
      productId: abandonment.product_id,
      source: manual ? "manual_admin" : "due_browse_abandonment",
    },
  });

  if (!emailResult?.success && !emailResult?.sent) {
    await runOptionalQuery(
      `
        UPDATE browse_abandonments
        SET
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        abandonment.id,
        JSON.stringify({
          lastEmailError: emailResult?.message || emailResult?.error || "Email provider did not send the message.",
        }),
      ],
      []
    );

    return {
      sent: false,
      status: emailResult?.status || "failed",
      message: emailResult?.message || emailResult?.error || "Browse abandonment email was not sent.",
      data: abandonment,
    };
  }

  const updatedRows = await runOptionalQuery(
    `
      UPDATE browse_abandonments
      SET
        status = CASE WHEN status = 'converted' THEN status ELSE 'emailed' END,
        email_sent_at = NOW(),
        email_count = COALESCE(email_count, 0) + 1,
        last_activity_at = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      abandonment.id,
      JSON.stringify({
        lastProviderMessageId: emailResult.providerMessageId || emailResult.id || null,
        lastEmailSource: manual ? "manual_admin" : "due_browse_abandonment",
      }),
    ],
    []
  );

  return {
    sent: true,
    status: "email_sent",
    data: updatedRows[0] ? formatBrowseAbandonment(updatedRows[0]) : abandonment,
  };
}

async function sendDueBrowseAbandonmentEmails({ limit = 25 } = {}) {
  const flowEnabled = await isBrowseAbandonmentFlowEnabled();
  if (!flowEnabled) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      status: "flow_disabled",
      message: "Browse abandonment flow is not enabled.",
    };
  }

  const dueRows = await findDueBrowseAbandonments({ limit });
  const results = [];

  for (const row of dueRows) {
    try {
      results.push({
        browseAbandonmentId: row.id,
        ...(await sendBrowseAbandonmentEmail(row.id)),
      });
    } catch (error) {
      results.push({
        browseAbandonmentId: row.id,
        sent: false,
        status: "failed",
        message: error.message,
      });
    }
  }

  return {
    delayMinutes: getDelayMinutes(),
    processed: results.length,
    sent: results.filter((result) => result.sent).length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

async function getAdminBrowseAbandonments({ status = "all", limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
  const params = [];
  const where = [];

  if (status && status !== "all") {
    params.push(status);
    where.push(`browse.status = $${params.length}`);
  }

  params.push(getDelayMinutes(), safeLimit);
  const delayPlaceholder = `$${params.length - 1}`;
  const limitPlaceholder = `$${params.length}`;

  const rows = await runOptionalQuery(
    `
      SELECT
        browse.*,
        product.name AS product_display_name,
        product.slug AS product_slug,
        product.image_url AS product_image_url,
        product.price AS product_price,
        (
          browse.status = 'pending'
          AND browse.customer_email IS NOT NULL
          AND browse.viewed_at <= NOW() - (${delayPlaceholder} || ' minutes')::interval
        ) AS recovery_ready
      FROM browse_abandonments browse
      LEFT JOIN products product ON product.id = browse.product_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY browse.last_activity_at DESC
      LIMIT ${limitPlaceholder}
    `,
    params,
    []
  );

  const summaryRows = await runOptionalQuery(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'emailed')::int AS emailed,
        COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COALESCE(SUM(email_count), 0)::int AS emails_sent
      FROM browse_abandonments
    `,
    [],
    [{ total: 0, pending: 0, emailed: 0, converted: 0, cancelled: 0, emails_sent: 0 }]
  );

  const overview = await getBrowseAbandonmentOverview();
  const flowEnabled = overview.flowEnabled;

  return {
    delayMinutes: getDelayMinutes(),
    maxEmails: getMaxEmails(),
    flowEnabled,
    summary: summaryRows[0] || overview.summary,
    abandonments: rows.map(formatBrowseAbandonment),
  };
}

async function getBrowseAbandonmentOverview() {
  const summaryRows = await runOptionalQuery(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'eligible')::int AS eligible,
        COUNT(*) FILTER (WHERE status = 'emailed')::int AS emailed,
        COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COUNT(*) FILTER (
          WHERE status IN ('pending', 'eligible')
            AND customer_email IS NOT NULL
            AND COALESCE(email_count, 0) < $2
            AND COALESCE(eligible_at, viewed_at + ($1 || ' minutes')::interval) <= NOW()
        )::int AS due,
        COALESCE(SUM(email_count), 0)::int AS emails_sent
      FROM browse_abandonments
    `,
    [getDelayMinutes(), getMaxEmails()],
    []
  );

  const emptySummary = {
    total: 0,
    pending: 0,
    eligible: 0,
    emailed: 0,
    converted: 0,
    cancelled: 0,
    due: 0,
    emails_sent: 0,
  };

  return {
    delayMinutes: getDelayMinutes(),
    maxEmails: getMaxEmails(),
    flowEnabled: await isBrowseAbandonmentFlowEnabled(),
    summary: summaryRows[0] || emptySummary,
    status: summaryRows.length ? "configured" : "not_configured",
  };
}

module.exports = {
  createOrUpdateBrowseAbandonmentFromProductView,
  findDueBrowseAbandonments,
  getAdminBrowseAbandonments,
  getBrowseAbandonmentOverview,
  isBrowseAbandonmentFlowEnabled,
  markBrowseAbandonmentConverted,
  markBrowseAbandonmentsConvertedForCart,
  markBrowseAbandonmentsConvertedForOrder,
  sendBrowseAbandonmentEmail,
  sendDueBrowseAbandonmentEmails,
};
