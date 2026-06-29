const pool = require("../config/db");
const { sendEmail } = require("./emailService");

const WAITING_STATUSES = ["waiting", "notified"];

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value) => String(value || "").trim();

function buildServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isMissingWaitlistTable(error) {
  return error?.code === "42P01" || /product_waitlists/i.test(error?.message || "");
}

function formatNaira(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

function getProductPath(product) {
  return `${getFrontendUrl()}/products/${product.slug || product.id}`;
}

function getWhatsAppLink(entry) {
  const phone = normalizeText(entry.whatsapp_number || entry.phone).replace(/\D/g, "");
  if (!phone) return "";

  const message = encodeURIComponent(
    `Hello ${entry.full_name || "there"}, ${entry.product_name || "your LUMA product"} is back in stock at LUMA. You can shop it here: ${entry.product_url || getProductPath(entry)}`
  );

  return `https://wa.me/${phone}?text=${message}`;
}

function formatWaitlistEntry(row) {
  if (!row) return null;

  const product = {
    id: row.product_id,
    name: row.product_name,
    slug: row.product_slug,
  };

  return {
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_name || "",
    product_slug: row.product_slug || "",
    product_image: row.product_image || "",
    product_price: Number(row.product_price || 0),
    product_stock_quantity: Number(row.product_stock_quantity || 0),
    product_url: row.product_id ? getProductPath(product) : "",
    customer_id: row.customer_id || null,
    full_name: row.full_name || "",
    email: row.email || "",
    phone: row.phone || "",
    whatsapp_number: row.whatsapp_number || "",
    requested_size: row.requested_size || "",
    source: row.source || "product_page",
    status: row.status || "waiting",
    notification_email_sent: row.notification_email_sent === true,
    notification_email_sent_at: row.notification_email_sent_at,
    notification_attempts: Number(row.notification_attempts || 0),
    last_notification_error: row.last_notification_error || "",
    notified_by_admin_id: row.notified_by_admin_id || null,
    converted_order_id: row.converted_order_id || null,
    converted_at: row.converted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    whatsapp_link: getWhatsAppLink({
      ...row,
      product_url: row.product_id ? getProductPath(product) : "",
    }),
  };
}

async function getProduct(productId) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        slug,
        image_url,
        price,
        size,
        stock_quantity,
        status,
        is_active
      FROM products
      WHERE id = $1
      LIMIT 1
    `,
    [productId]
  );

  return result.rows[0] || null;
}

function assertProductCanAcceptWaitlist(product) {
  if (!product) {
    throw buildServiceError("Product was not found.", 404);
  }

  if (product.is_active === false || product.status === "archived") {
    throw buildServiceError("This product is not available for waitlist requests.", 400);
  }

  if (Number(product.stock_quantity || 0) > 0) {
    throw buildServiceError("This product is already back in stock.", 409);
  }
}

async function joinProductWaitlist(data = {}) {
  const productId = normalizeText(data.productId || data.product_id);
  const customer = data.customer || null;
  const email = normalizeEmail(data.email || customer?.email);

  if (!productId) {
    throw buildServiceError("Product is required.");
  }

  if (!email) {
    throw buildServiceError("Email is required to join the product waitlist.");
  }

  const product = await getProduct(productId);
  assertProductCanAcceptWaitlist(product);

  const existingResult = await pool.query(
    `
      SELECT waitlist.*, product.name AS product_name, product.slug AS product_slug,
             product.image_url AS product_image, product.price AS product_price,
             product.stock_quantity AS product_stock_quantity
      FROM product_waitlists waitlist
      LEFT JOIN products product ON product.id = waitlist.product_id
      WHERE waitlist.product_id = $1
        AND LOWER(waitlist.email) = LOWER($2)
        AND waitlist.status = ANY($3::text[])
      ORDER BY waitlist.created_at DESC
      LIMIT 1
    `,
    [productId, email, WAITING_STATUSES]
  );

  if (existingResult.rows.length > 0) {
    return {
      alreadyExists: true,
      message: "You are already on the waitlist for this product.",
      entry: formatWaitlistEntry(existingResult.rows[0]),
    };
  }

  const result = await pool.query(
    `
      INSERT INTO product_waitlists (
        product_id,
        customer_id,
        full_name,
        email,
        phone,
        whatsapp_number,
        requested_size,
        source,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'waiting')
      RETURNING *
    `,
    [
      productId,
      customer?.id || data.customerId || data.customer_id || null,
      normalizeText(data.fullName || data.full_name || customer?.full_name || customer?.name),
      email,
      normalizeText(data.phone || customer?.phone),
      normalizeText(
        data.whatsappNumber ||
          data.whatsapp_number ||
          customer?.whatsapp_e164 ||
          customer?.whatsapp_number ||
          customer?.phone
      ),
      normalizeText(data.requestedSize || data.requested_size || product.size),
      normalizeText(data.source || "product_page"),
    ]
  );

  const joinedResult = await pool.query(
    `
      SELECT waitlist.*, product.name AS product_name, product.slug AS product_slug,
             product.image_url AS product_image, product.price AS product_price,
             product.stock_quantity AS product_stock_quantity
      FROM product_waitlists waitlist
      LEFT JOIN products product ON product.id = waitlist.product_id
      WHERE waitlist.id = $1
    `,
    [result.rows[0].id]
  );

  return {
    alreadyExists: false,
    message: "You are on the waitlist for this product.",
    entry: formatWaitlistEntry(joinedResult.rows[0]),
  };
}

async function getProductWaitlists(filters = {}) {
  const values = [];
  const conditions = [];
  const status = normalizeText(filters.status || "all");
  const search = normalizeText(filters.search);
  const productId = normalizeText(filters.productId || filters.product_id);
  const notified = filters.notified;

  if (status && status !== "all") {
    values.push(status);
    conditions.push(`waitlist.status = $${values.length}`);
  }

  if (productId) {
    values.push(productId);
    conditions.push(`waitlist.product_id = $${values.length}`);
  }

  if (notified === "true" || notified === true) {
    conditions.push("waitlist.notification_email_sent = true");
  }

  if (notified === "false" || notified === false) {
    conditions.push("waitlist.notification_email_sent = false");
  }

  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    conditions.push(`(
      LOWER(waitlist.email) LIKE $${values.length}
      OR LOWER(COALESCE(waitlist.full_name, '')) LIKE $${values.length}
      OR LOWER(COALESCE(product.name, '')) LIKE $${values.length}
      OR COALESCE(waitlist.phone, '') LIKE $${values.length}
    )`);
  }

  const limit = Math.min(Math.max(Number(filters.limit) || 150, 1), 500);
  values.push(limit);
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
      SELECT waitlist.*, product.name AS product_name, product.slug AS product_slug,
             product.image_url AS product_image, product.price AS product_price,
             product.stock_quantity AS product_stock_quantity
      FROM product_waitlists waitlist
      LEFT JOIN products product ON product.id = waitlist.product_id
      ${whereClause}
      ORDER BY waitlist.created_at DESC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows.map(formatWaitlistEntry);
}

async function getProductWaitlistById(id) {
  const result = await pool.query(
    `
      SELECT waitlist.*, product.name AS product_name, product.slug AS product_slug,
             product.image_url AS product_image, product.price AS product_price,
             product.stock_quantity AS product_stock_quantity
      FROM product_waitlists waitlist
      LEFT JOIN products product ON product.id = waitlist.product_id
      WHERE waitlist.id = $1
      LIMIT 1
    `,
    [id]
  );

  return formatWaitlistEntry(result.rows[0]);
}

async function getProductWaitlistsForProduct(productId) {
  return getProductWaitlists({ productId });
}

async function updateWaitlistStatus(id, status) {
  const allowed = ["waiting", "notified", "purchased", "cancelled"];
  if (!allowed.includes(status)) {
    throw buildServiceError("Unsupported waitlist status.");
  }

  const result = await pool.query(
    `
      UPDATE product_waitlists
      SET status = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `,
    [id, status]
  );

  if (result.rowCount === 0) {
    throw buildServiceError("Waitlist entry was not found.", 404);
  }

  return getProductWaitlistById(id);
}

async function cancelWaitlistEntry(id) {
  return updateWaitlistStatus(id, "cancelled");
}

async function findWaitingCustomersForRestockedProduct(productId) {
  const product = await getProduct(productId);
  const entries = await getProductWaitlists({ productId, status: "waiting" });

  return {
    product,
    entries: entries.filter((entry) => !entry.notification_email_sent),
  };
}

function buildBackInStockEmail({ product, waitlistEntry }) {
  const productUrl = getProductPath(product);
  const customerName = waitlistEntry.full_name || "there";
  const productImage = product.image_url
    ? `<img src="${product.image_url}" alt="${product.name}" style="width: 100%; max-height: 260px; object-fit: cover; border-radius: 18px; margin: 18px 0;" />`
    : "";

  return {
    subject: `${product.name} is back in stock`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f7efe4; padding: 32px;">
        <div style="max-width: 640px; margin: 0 auto; background: #fffaf3; border-radius: 24px; padding: 32px; color: #221912;">
          <p style="letter-spacing: 0.22em; text-transform: uppercase; color: #8a6b4f; font-size: 12px;">
            LUMA Stock Alert
          </p>

          <h1 style="margin: 0 0 12px; font-size: 28px;">
            ${product.name} is back in stock.
          </h1>

          <p style="font-size: 16px; line-height: 1.6;">
            Hi ${customerName}, the LUMA product you joined the waitlist for is available again.
            Stock can move quickly, so you can return now to place your order.
          </p>

          ${productImage}

          <div style="background: #f2e7d8; border-radius: 18px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px;"><strong>Product:</strong> ${product.name}</p>
            <p style="margin: 0 0 8px;"><strong>Price:</strong> ${formatNaira(product.price)}</p>
            ${
              product.size
                ? `<p style="margin: 0;"><strong>Size:</strong> ${product.size}</p>`
                : ""
            }
          </div>

          <div style="margin-top: 28px;">
            <a href="${productUrl}" style="display: inline-block; background: #2b1d14; color: #fff8ee; text-decoration: none; padding: 14px 20px; border-radius: 999px;">
              Shop now
            </a>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #7a6a5d; margin-top: 28px;">
            If you need help with your order, reply to this email and the LUMA team will assist.
          </p>

          <p style="color: #8a6b4f; font-size: 13px; margin-top: 32px;">
            LUMA Beauty
          </p>
        </div>
      </div>
    `,
    text: `${product.name} is back in stock. Shop now: ${productUrl}`,
  };
}

async function sendBackInStockEmail(waitlistId, options = {}) {
  const entry = await getProductWaitlistById(waitlistId);

  if (!entry) {
    throw buildServiceError("Waitlist entry was not found.", 404);
  }

  const product = await getProduct(entry.product_id);

  if (!product) {
    throw buildServiceError("Product was not found.", 404);
  }

  if (Number(product.stock_quantity || 0) <= 0 && !options.force) {
    throw buildServiceError("This product is still out of stock.");
  }

  await pool.query(
    `
      UPDATE product_waitlists
      SET notification_attempts = COALESCE(notification_attempts, 0) + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [waitlistId]
  );

  try {
    const email = buildBackInStockEmail({ product, waitlistEntry: entry });
    await sendEmail({ to: entry.email, ...email });

    await pool.query(
      `
        UPDATE product_waitlists
        SET notification_email_sent = true,
            notification_email_sent_at = CURRENT_TIMESTAMP,
            status = CASE WHEN status = 'waiting' THEN 'notified' ELSE status END,
            last_notification_error = NULL,
            notified_by_admin_id = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [waitlistId, options.adminId || null]
    );

    return {
      sent: true,
      entry: await getProductWaitlistById(waitlistId),
    };
  } catch (error) {
    await pool.query(
      `
        UPDATE product_waitlists
        SET last_notification_error = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [waitlistId, error.message || "Email failed"]
    );

    throw error;
  }
}

async function sendBackInStockEmailsForProduct(productId, options = {}) {
  const { product, entries } = await findWaitingCustomersForRestockedProduct(productId);

  if (!product) {
    throw buildServiceError("Product was not found.", 404);
  }

  if (Number(product.stock_quantity || 0) <= 0 && !options.force) {
    throw buildServiceError("This product is still out of stock.");
  }

  const results = [];

  for (const entry of entries) {
    try {
      const result = await sendBackInStockEmail(entry.id, options);
      results.push({ id: entry.id, sent: true, entry: result.entry });
    } catch (error) {
      results.push({ id: entry.id, sent: false, message: error.message });
    }
  }

  return {
    product,
    total: entries.length,
    sent: results.filter((item) => item.sent).length,
    failed: results.filter((item) => !item.sent).length,
    results,
  };
}

async function buildWaitlistStats() {
  const summary = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting,
      COUNT(*) FILTER (WHERE status = 'notified')::int AS notified,
      COUNT(*) FILTER (WHERE status = 'purchased')::int AS purchased,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (WHERE notification_email_sent = true)::int AS emails_sent
    FROM product_waitlists
  `);

  const topProducts = await pool.query(`
    SELECT
      waitlist.product_id,
      product.name AS product_name,
      product.slug AS product_slug,
      product.image_url AS product_image,
      COUNT(*)::int AS waitlist_count,
      COUNT(*) FILTER (WHERE waitlist.status = 'waiting')::int AS waiting_count
    FROM product_waitlists waitlist
    LEFT JOIN products product ON product.id = waitlist.product_id
    GROUP BY waitlist.product_id, product.name, product.slug, product.image_url
    ORDER BY waiting_count DESC, waitlist_count DESC
    LIMIT 8
  `);

  return {
    ...(summary.rows[0] || {
      total: 0,
      waiting: 0,
      notified: 0,
      purchased: 0,
      cancelled: 0,
      emails_sent: 0,
    }),
    topProducts: topProducts.rows,
  };
}

async function markWaitlistPurchased({
  productId,
  customerId,
  email,
  orderId,
  db = pool,
}) {
  const normalizedEmail = normalizeEmail(email);

  if (!productId || (!customerId && !normalizedEmail) || !orderId) {
    return { updated: 0 };
  }

  const params = [productId, orderId];
  const conditions = ["product_id = $1", "status IN ('waiting', 'notified')"];

  if (customerId) {
    params.push(customerId);
    conditions.push(`customer_id = $${params.length}`);
  }

  if (normalizedEmail) {
    params.push(normalizedEmail);
    conditions.push(`LOWER(email) = LOWER($${params.length})`);
  }

  const result = await db.query(
    `
      UPDATE product_waitlists
      SET status = 'purchased',
          converted_order_id = $2,
          converted_at = COALESCE(converted_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE ${conditions.join(" AND ")}
        AND converted_order_id IS NULL
    `,
    params
  );

  return { updated: result.rowCount };
}

async function markWaitlistsPurchasedForPaidOrder({ client = pool, order }) {
  if (!order?.id) return { updated: 0 };

  const itemsResult = await client.query(
    `
      SELECT product_id
      FROM order_items
      WHERE order_id = $1
    `,
    [order.id]
  );

  let updated = 0;

  for (const item of itemsResult.rows) {
    const result = await markWaitlistPurchased({
      productId: item.product_id,
      customerId: order.customer_id || null,
      email: order.customer_email || order.email,
      orderId: order.id,
      db: client,
    });
    updated += result.updated;
  }

  return { updated };
}

module.exports = {
  isMissingWaitlistTable,
  joinProductWaitlist,
  getProductWaitlists,
  getProductWaitlistById,
  getProductWaitlistsForProduct,
  cancelWaitlistEntry,
  updateWaitlistStatus,
  markWaitlistPurchased,
  markWaitlistsPurchasedForPaidOrder,
  findWaitingCustomersForRestockedProduct,
  sendBackInStockEmail,
  sendBackInStockEmailsForProduct,
  buildBackInStockEmail,
  buildWaitlistStats,
};
