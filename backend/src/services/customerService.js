const pool = require("../config/db");

function isMissingSchemaError(error) {
  return ["42P01", "42703"].includes(error.code);
}

function normalizeMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function buildCustomerTags(customer) {
  const tags = [];
  const paidOrderCount = Number(customer.paid_order_count || 0);
  const totalSpent = normalizeMoney(customer.total_spent);
  const lastOrderAt = customer.last_order_at
    ? new Date(customer.last_order_at)
    : null;
  const firstOrderAt = customer.first_order_at
    ? new Date(customer.first_order_at)
    : null;
  const now = new Date();
  const daysSinceLastOrder = lastOrderAt
    ? Math.floor((now - lastOrderAt) / (1000 * 60 * 60 * 24))
    : null;
  const daysSinceFirstOrder = firstOrderAt
    ? Math.floor((now - firstOrderAt) / (1000 * 60 * 60 * 24))
    : null;

  if (paidOrderCount >= 2) tags.push("Repeat customer");
  if (paidOrderCount === 1) tags.push("First-time buyer");
  if (paidOrderCount === 0) tags.push("Prospect");
  if (totalSpent >= 100000) tags.push("VIP");
  else if (totalSpent >= 50000) tags.push("High value");
  if (daysSinceFirstOrder !== null && daysSinceFirstOrder <= 30) {
    tags.push("New customer");
  }
  if (daysSinceLastOrder !== null && daysSinceLastOrder >= 90) {
    tags.push("Inactive 90 days");
  }

  return tags;
}

function formatCustomer(row) {
  const paidOrderCount = Number(row.paid_order_count || 0);
  const totalSpent = normalizeMoney(row.total_spent);
  const averageOrderValue = normalizeMoney(row.average_order_value);
  const tags = buildCustomerTags(row);

  return {
    email: row.email,
    name: row.name || "",
    phone: row.phone || "",
    phoneCountryName: row.phone_country_name || "",
    phone_country_name: row.phone_country_name || "",
    phoneCountryIso2: row.phone_country_iso2 || "",
    phone_country_iso2: row.phone_country_iso2 || "",
    phoneCountryCode: row.phone_country_code || "",
    phone_country_code: row.phone_country_code || "",
    phoneE164: row.phone_e164 || row.phone || "",
    phone_e164: row.phone_e164 || row.phone || "",
    whatsappNumber: row.whatsapp_number || "",
    whatsapp_number: row.whatsapp_number || "",
    whatsappE164: row.whatsapp_e164 || "",
    whatsapp_e164: row.whatsapp_e164 || "",
    whatsappCountryName: row.whatsapp_country_name || "",
    whatsapp_country_name: row.whatsapp_country_name || "",
    whatsappCountryCode: row.whatsapp_country_code || "",
    whatsapp_country_code: row.whatsapp_country_code || "",
    whyLuma: row.why_luma || "",
    why_luma: row.why_luma || "",
    firstTimeLuma: row.first_time_luma || "",
    first_time_luma: row.first_time_luma || "",
    browGoal: row.brow_goal || "",
    brow_goal: row.brow_goal || "",
    referralSource: row.referral_source || "",
    referral_source: row.referral_source || "",
    referralSourceOther: row.referral_source_other || "",
    referral_source_other: row.referral_source_other || "",
    lastLoginAt: row.last_login_at || null,
    last_login_at: row.last_login_at || null,
    accountId: row.account_id || null,
    authProvider: row.auth_provider || null,
    marketingOptIn: row.marketing_opt_in,
    accountCreatedAt: row.account_created_at || null,
    totalOrderCount: Number(row.total_order_count || 0),
    order_count: Number(row.total_order_count || 0),
    paidOrderCount,
    paid_order_count: paidOrderCount,
    unpaidOrderCount: Number(row.unpaid_order_count || 0),
    totalSpent,
    total_spent: totalSpent,
    averageOrderValue,
    average_order_value: averageOrderValue,
    lastOrderAt: row.last_order_at || null,
    last_order_at: row.last_order_at || null,
    firstOrderAt: row.first_order_at || null,
    first_order_at: row.first_order_at || null,
    lastActivityAt: row.last_activity_at || null,
    repeatCustomer: paidOrderCount >= 2,
    repeat_customer: paidOrderCount >= 2,
    segment:
      tags.find((tag) => ["VIP", "High value", "Repeat customer"].includes(tag)) ||
      tags[0] ||
      "Customer",
    tags,
  };
}

async function runCustomerQuery(query, params = [], fallbackQuery = null) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    if (isMissingSchemaError(error) && fallbackQuery) {
      const result = await pool.query(fallbackQuery, params);
      return result.rows;
    }

    if (isMissingSchemaError(error)) {
      return [];
    }

    throw error;
  }
}

function buildSearchClause(search, values, alias = "customers") {
  if (!search) return "";

  values.push(`%${search}%`);
  const placeholder = `$${values.length}`;

  return `
    WHERE (
      ${alias}.name ILIKE ${placeholder}
      OR ${alias}.email ILIKE ${placeholder}
      OR ${alias}.phone ILIKE ${placeholder}
      OR ${alias}.phone_country_name ILIKE ${placeholder}
      OR ${alias}.referral_source ILIKE ${placeholder}
    )
  `;
}

async function getCustomers({ search = "" } = {}) {
  const values = [];
  const searchClause = buildSearchClause(search, values);

  const query = `
    WITH source_emails AS (
      SELECT LOWER(email) AS email
      FROM customer_accounts
      WHERE email IS NOT NULL

      UNION

      SELECT LOWER(customer_email) AS email
      FROM orders
      WHERE customer_email IS NOT NULL
    ),
    order_rollup AS (
      SELECT
        LOWER(customer_email) AS email,
        MAX(customer_name) AS order_name,
        MAX(customer_phone) AS order_phone,
        COUNT(*)::int AS total_order_count,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_order_count,
        COUNT(*) FILTER (WHERE payment_status <> 'paid' OR payment_status IS NULL)::int AS unpaid_order_count,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS total_spent,
        COALESCE(AVG(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS average_order_value,
        MIN(created_at) FILTER (WHERE payment_status = 'paid') AS first_order_at,
        MAX(created_at) FILTER (WHERE payment_status = 'paid') AS last_order_at,
        MAX(created_at) AS last_activity_at
      FROM orders
      WHERE customer_email IS NOT NULL
      GROUP BY LOWER(customer_email)
    ),
    customers AS (
      SELECT
        source_emails.email,
        COALESCE(MAX(customer_accounts.full_name), MAX(order_rollup.order_name), '') AS name,
        COALESCE(MAX(customer_accounts.phone), MAX(order_rollup.order_phone), '') AS phone,
        MAX(customer_accounts.phone_country_name) AS phone_country_name,
        MAX(customer_accounts.phone_country_iso2) AS phone_country_iso2,
        MAX(customer_accounts.phone_country_code) AS phone_country_code,
        MAX(customer_accounts.phone_e164) AS phone_e164,
        MAX(customer_accounts.whatsapp_number) AS whatsapp_number,
        MAX(customer_accounts.whatsapp_e164) AS whatsapp_e164,
        MAX(customer_accounts.whatsapp_country_name) AS whatsapp_country_name,
        MAX(customer_accounts.whatsapp_country_code) AS whatsapp_country_code,
        MAX(customer_accounts.why_luma) AS why_luma,
        MAX(customer_accounts.first_time_luma) AS first_time_luma,
        MAX(customer_accounts.brow_goal) AS brow_goal,
        MAX(customer_accounts.referral_source) AS referral_source,
        MAX(customer_accounts.referral_source_other) AS referral_source_other,
        MAX(customer_accounts.id::text) AS account_id,
        MAX(customer_accounts.auth_provider) AS auth_provider,
        BOOL_OR(customer_accounts.marketing_opt_in) AS marketing_opt_in,
        MIN(customer_accounts.created_at) AS account_created_at,
        MAX(customer_accounts.last_login_at) AS last_login_at,
        COALESCE(MAX(order_rollup.total_order_count), 0)::int AS total_order_count,
        COALESCE(MAX(order_rollup.paid_order_count), 0)::int AS paid_order_count,
        COALESCE(MAX(order_rollup.unpaid_order_count), 0)::int AS unpaid_order_count,
        COALESCE(MAX(order_rollup.total_spent), 0)::numeric AS total_spent,
        COALESCE(MAX(order_rollup.average_order_value), 0)::numeric AS average_order_value,
        MAX(order_rollup.first_order_at) AS first_order_at,
        MAX(order_rollup.last_order_at) AS last_order_at,
        MAX(order_rollup.last_activity_at) AS last_activity_at
      FROM source_emails
      LEFT JOIN customer_accounts
        ON LOWER(customer_accounts.email) = source_emails.email
      LEFT JOIN order_rollup
        ON order_rollup.email = source_emails.email
      GROUP BY source_emails.email
    )
    SELECT *
    FROM customers
    ${searchClause}
    ORDER BY COALESCE(last_order_at, account_created_at, last_activity_at) DESC NULLS LAST
  `;

  const fallbackQuery = `
    WITH customers AS (
      SELECT
        LOWER(customer_email) AS email,
        MAX(customer_name) AS name,
        MAX(customer_phone) AS phone,
        NULL::text AS phone_country_name,
        NULL::text AS phone_country_iso2,
        NULL::text AS phone_country_code,
        MAX(customer_phone) AS phone_e164,
        NULL::text AS whatsapp_number,
        NULL::text AS whatsapp_e164,
        NULL::text AS whatsapp_country_name,
        NULL::text AS whatsapp_country_code,
        NULL::text AS why_luma,
        NULL::text AS first_time_luma,
        NULL::text AS brow_goal,
        NULL::text AS referral_source,
        NULL::text AS referral_source_other,
        NULL::text AS account_id,
        NULL::text AS auth_provider,
        NULL::boolean AS marketing_opt_in,
        NULL::timestamp AS account_created_at,
        NULL::timestamp AS last_login_at,
        COUNT(*)::int AS total_order_count,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_order_count,
        COUNT(*) FILTER (WHERE payment_status <> 'paid' OR payment_status IS NULL)::int AS unpaid_order_count,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS total_spent,
        COALESCE(AVG(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS average_order_value,
        MIN(created_at) FILTER (WHERE payment_status = 'paid') AS first_order_at,
        MAX(created_at) FILTER (WHERE payment_status = 'paid') AS last_order_at,
        MAX(created_at) AS last_activity_at
      FROM orders
      WHERE customer_email IS NOT NULL
      GROUP BY LOWER(customer_email)
    )
    SELECT *
    FROM customers
    ${searchClause}
    ORDER BY COALESCE(last_order_at, last_activity_at) DESC NULLS LAST
  `;

  const rows = await runCustomerQuery(query, values, fallbackQuery);
  return rows.map(formatCustomer);
}

async function getCustomerOrders(email) {
  return runCustomerQuery(
    `
      SELECT
        id,
        customer_name,
        customer_email,
        customer_phone,
        delivery_address,
        city,
        country,
        total_amount,
        status,
        payment_status,
        payment_provider,
        paystack_reference,
        subtotal_amount,
        discount_code,
        discount_amount,
        delivery_fee,
        created_at,
        updated_at
      FROM orders
      WHERE LOWER(customer_email) = LOWER($1)
        AND payment_status = 'paid'
      ORDER BY created_at DESC
    `,
    [email],
    `
      SELECT
        id,
        customer_name,
        customer_email,
        customer_phone,
        delivery_address,
        city,
        country,
        total_amount,
        status,
        payment_status,
        payment_provider,
        paystack_reference,
        created_at,
        updated_at
      FROM orders
      WHERE LOWER(customer_email) = LOWER($1)
        AND payment_status = 'paid'
      ORDER BY created_at DESC
    `
  );
}

async function getCustomerOrderItems(orderIds = []) {
  if (!orderIds.length) {
    return [];
  }

  return runCustomerQuery(
    `
      SELECT *
      FROM order_items
      WHERE order_id = ANY($1::uuid[])
      ORDER BY created_at ASC
    `,
    [orderIds]
  );
}

function escapeCsvCell(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCustomersCsv(customers) {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Paid Orders",
    "Total Orders",
    "Total Spent",
    "Average Order Value",
    "Last Paid Order",
    "Repeat Customer",
    "Segment",
    "Tags",
    "Marketing Opt-In",
  ];
  const rows = customers.map((customer) => [
    customer.name,
    customer.email,
    customer.phone,
    customer.paidOrderCount,
    customer.totalOrderCount,
    customer.totalSpent,
    customer.averageOrderValue,
    customer.lastOrderAt,
    customer.repeatCustomer ? "Yes" : "No",
    customer.segment,
    customer.tags.join("; "),
    customer.marketingOptIn === null || customer.marketingOptIn === undefined
      ? ""
      : customer.marketingOptIn
        ? "Yes"
        : "No",
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

module.exports = {
  buildCustomersCsv,
  getCustomers,
  getCustomerOrders,
  getCustomerOrderItems,
};

// Shopify-style customer analytics/profile extensions.
const baseCustomerExports = module.exports;

const BUILT_IN_CUSTOMER_SEGMENTS = [
  { id: "all_customers", name: "All customers", description: "Every customer account or order customer.", type: "built_in", rules: { type: "all" } },
  { id: "first_time_customers", name: "First-time customers", description: "Customers with exactly one paid order.", type: "built_in", rules: { type: "first_time" } },
  { id: "repeat_customers", name: "Repeat customers", description: "Customers with two or more paid orders.", type: "built_in", rules: { type: "repeat" } },
  { id: "high_value_customers", name: "High value customers", description: "Customers with at least 100,000 NGN in paid revenue.", type: "built_in", rules: { type: "high_value", minimumTotalSpent: 100000 } },
  { id: "abandoned_cart_customers", name: "Customers with abandoned carts", description: "Customers with at least one abandoned cart record.", type: "built_in", rules: { type: "abandoned_cart" } },
  { id: "inactive_customers", name: "Inactive customers", description: "Customers whose last activity is at least 90 days old.", type: "built_in", rules: { type: "inactive", days: 90 } },
  { id: "no_purchase_yet", name: "No purchase yet", description: "Customers with no paid order yet.", type: "built_in", rules: { type: "no_purchase" } },
  { id: "recent_signups", name: "Recent signups", description: "Customers created in the last 30 days.", type: "built_in", rules: { type: "recent_signup", days: 30 } },
  { id: "traffic_source_customers", name: "Customers from traffic source", description: "Foundation segment for source and UTM filters.", type: "built_in", rules: { type: "traffic_source" } },
  { id: "viewed_product_no_purchase", name: "Viewed product but did not buy", description: "Foundation segment using analytics events when available.", type: "built_in", rules: { type: "viewed_product_no_purchase" } },
];

function normalizeCustomerEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function daysSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
}

function parseSegmentRules(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return { type: String(value) };
  }
}

async function runOptionalCustomerQuery(query, params = [], fallback = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    if (isMissingSchemaError(error)) return fallback;
    throw error;
  }
}

async function getCustomerManualTagsMap() {
  const rows = await runOptionalCustomerQuery(
    `
      SELECT LOWER(assignment.customer_email) AS email, tag.name, tag.color
      FROM customer_tag_assignments assignment
      INNER JOIN customer_tags tag ON tag.id = assignment.tag_id
      WHERE assignment.customer_email IS NOT NULL
      ORDER BY tag.name ASC
    `
  );

  return rows.reduce((map, row) => {
    const email = normalizeCustomerEmail(row.email);
    if (!map.has(email)) map.set(email, []);
    map.get(email).push(row.name);
    return map;
  }, new Map());
}

function customerMatchesBuiltInSegment(customer, segment) {
  const rules = segment.rules || {};
  const type = rules.type || segment.id;
  const paidOrders = Number(customer.paidOrderCount ?? customer.paid_order_count ?? 0);
  const totalSpent = Number(customer.totalSpent ?? customer.total_spent ?? 0);
  const abandonedCarts = Number(customer.abandonedCartCount ?? customer.abandoned_cart_count ?? 0);
  const productViews = Number(customer.productViewCount ?? customer.product_view_count ?? 0);
  const createdAt = customer.createdAt || customer.created_at || customer.accountCreatedAt || customer.account_created_at;
  const lastActivity = customer.lastActivityAt || customer.last_activity_at || customer.lastOrderAt || customer.last_order_at;

  if (type === "all") return true;
  if (type === "first_time") return paidOrders === 1;
  if (type === "repeat") return paidOrders >= 2;
  if (type === "high_value") return totalSpent >= Number(rules.minimumTotalSpent || 100000);
  if (type === "abandoned_cart") return abandonedCarts > 0;
  if (type === "inactive") {
    const days = daysSince(lastActivity);
    return days !== null && days >= Number(rules.days || 90);
  }
  if (type === "no_purchase") return paidOrders === 0;
  if (type === "recent_signup") {
    const days = daysSince(createdAt);
    return days !== null && days <= Number(rules.days || 30);
  }
  if (type === "traffic_source") {
    const source = String(rules.source || "").toLowerCase();
    const values = [customer.utmSource, customer.utm_source, customer.referralSource, customer.referral_source]
      .map((item) => String(item || "").toLowerCase())
      .filter(Boolean);
    return source ? values.includes(source) : values.length > 0;
  }
  if (type === "viewed_product_no_purchase") return productViews > 0 && paidOrders === 0;
  if (type === "tag") {
    const tag = String(rules.tag || "").toLowerCase();
    return Boolean(tag) && (customer.tags || []).some((item) => String(item).toLowerCase() === tag);
  }

  return false;
}

function enrichCustomer(customer, manualTags = []) {
  const tags = [...new Set([...(manualTags || []), ...(customer.tags || [])].filter(Boolean))];
  const matchedBuiltIns = BUILT_IN_CUSTOMER_SEGMENTS.filter((segment) => customerMatchesBuiltInSegment({ ...customer, tags }, segment));
  const segments = matchedBuiltIns.map((segment) => segment.name);
  const segmentIds = matchedBuiltIns.map((segment) => segment.id);
  const paidOrderCount = Number(customer.paidOrderCount ?? customer.paid_order_count ?? 0);

  return {
    ...customer,
    id: customer.accountId || customer.account_id || customer.email,
    createdAt: customer.accountCreatedAt || customer.account_created_at || customer.firstOrderAt || customer.first_order_at || customer.lastActivityAt || null,
    created_at: customer.accountCreatedAt || customer.account_created_at || customer.firstOrderAt || customer.first_order_at || customer.lastActivityAt || null,
    totalOrders: customer.totalOrderCount ?? customer.total_orders ?? customer.order_count ?? 0,
    total_orders: customer.totalOrderCount ?? customer.total_orders ?? customer.order_count ?? 0,
    ltv: Number(customer.totalSpent ?? customer.total_spent ?? 0),
    repeatPurchaseCount: Math.max(0, paidOrderCount - 1),
    repeat_purchase_count: Math.max(0, paidOrderCount - 1),
    lastOrderDate: customer.lastOrderAt || customer.last_order_at || null,
    last_order_date: customer.lastOrderAt || customer.last_order_at || null,
    abandonedCartCount: Number(customer.abandonedCartCount ?? customer.abandoned_cart_count ?? 0),
    abandoned_cart_count: Number(customer.abandonedCartCount ?? customer.abandoned_cart_count ?? 0),
    productViewCount: Number(customer.productViewCount ?? customer.product_view_count ?? 0),
    product_view_count: Number(customer.productViewCount ?? customer.product_view_count ?? 0),
    tags,
    manualTags,
    manual_tags: manualTags,
    segments,
    segmentIds,
    segment_ids: segmentIds,
    segment: segments[0] || customer.segment || "Customer",
  };
}

function filterCustomers(customers, filters = {}) {
  const tag = String(filters.tag || "").toLowerCase();
  const segment = String(filters.segment || "").toLowerCase();
  const status = String(filters.status || "").toLowerCase();
  const source = String(filters.source || "").toLowerCase();

  return customers.filter((customer) => {
    if (tag && !(customer.tags || []).some((item) => String(item).toLowerCase() === tag)) return false;
    if (segment) {
      const matchesSegment = (customer.segmentIds || []).some((item) => String(item).toLowerCase() === segment) ||
        (customer.segments || []).some((item) => String(item).toLowerCase() === segment);
      if (!matchesSegment) return false;
    }
    if (status === "repeat" && !customer.repeatCustomer) return false;
    if (status === "first_time" && Number(customer.paidOrderCount || 0) !== 1) return false;
    if (status === "no_purchase" && Number(customer.paidOrderCount || 0) !== 0) return false;
    if (status === "inactive" && !(customer.segmentIds || []).includes("inactive_customers")) return false;
    if (status === "high_value" && !(customer.segmentIds || []).includes("high_value_customers")) return false;
    if (source) {
      const sources = [customer.utmSource, customer.utm_source, customer.referralSource, customer.referral_source]
        .map((item) => String(item || "").toLowerCase());
      if (!sources.includes(source)) return false;
    }
    return true;
  });
}

function sortCustomerList(customers, sort = "last_activity_desc") {
  const sorted = [...customers];
  const getDate = (customer, key) => new Date(customer[key] || 0).getTime() || 0;
  sorted.sort((a, b) => {
    if (sort === "total_spent_desc") return Number(b.totalSpent || 0) - Number(a.totalSpent || 0);
    if (sort === "orders_desc") return Number(b.paidOrderCount || 0) - Number(a.paidOrderCount || 0);
    if (sort === "created_desc") return getDate(b, "createdAt") - getDate(a, "createdAt");
    if (sort === "email_asc") return String(a.email || "").localeCompare(String(b.email || ""));
    return getDate(b, "lastActivityAt") - getDate(a, "lastActivityAt");
  });
  return sorted;
}

async function getCustomersEnhanced(filters = {}) {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 250);
  const [baseCustomers, tagsMap, cartRows, eventRows] = await Promise.all([
    baseCustomerExports.getCustomers({ search: filters.search || "" }),
    getCustomerManualTagsMap(),
    runOptionalCustomerQuery(
      `SELECT LOWER(customer_email) AS email, COUNT(*)::int AS abandoned_cart_count FROM abandoned_carts WHERE customer_email IS NOT NULL GROUP BY LOWER(customer_email)`
    ),
    runOptionalCustomerQuery(
      `SELECT LOWER(customer_email) AS email,
        COUNT(*) FILTER (WHERE event_type = 'product_view')::int AS product_view_count,
        MAX(utm_source) AS utm_source,
        MAX(utm_medium) AS utm_medium,
        MAX(utm_campaign) AS utm_campaign,
        MAX(created_at) AS last_event_at
       FROM analytics_events WHERE customer_email IS NOT NULL GROUP BY LOWER(customer_email)`
    ),
  ]);
  const cartMap = new Map(cartRows.map((row) => [normalizeCustomerEmail(row.email), row]));
  const eventMap = new Map(eventRows.map((row) => [normalizeCustomerEmail(row.email), row]));
  const activeSavedSegments = await runOptionalCustomerQuery(
    `SELECT id::text, name, description, rules, is_active, created_at, updated_at, 'saved' AS type
     FROM customer_segments
     WHERE COALESCE(is_active, true) = true
     ORDER BY created_at DESC`
  );

  const enriched = baseCustomers.map((customer) => {
    const email = normalizeCustomerEmail(customer.email);
    const cart = cartMap.get(email) || {};
    const event = eventMap.get(email) || {};
    return enrichCustomer(
      {
        ...customer,
        abandonedCartCount: Number(cart.abandoned_cart_count || 0),
        abandoned_cart_count: Number(cart.abandoned_cart_count || 0),
        productViewCount: Number(event.product_view_count || 0),
        product_view_count: Number(event.product_view_count || 0),
        utmSource: event.utm_source || "",
        utm_source: event.utm_source || "",
        utmMedium: event.utm_medium || "",
        utm_medium: event.utm_medium || "",
        utmCampaign: event.utm_campaign || "",
        utm_campaign: event.utm_campaign || "",
        lastActivityAt: event.last_event_at || customer.lastActivityAt || customer.last_activity_at,
      },
      tagsMap.get(email) || []
    );
  });

  const customersWithSavedSegments = enriched.map((customer) => {
    const savedMatches = activeSavedSegments.filter((segment) =>
      customerMatchesBuiltInSegment(customer, { ...segment, rules: parseSegmentRules(segment.rules) })
    );
    const segmentIds = [...new Set([...(customer.segmentIds || []), ...savedMatches.map((segment) => segment.id)])];
    return {
      ...customer,
      segments: [...new Set([...(customer.segments || []), ...savedMatches.map((segment) => segment.name)])],
      segmentIds,
      segment_ids: segmentIds,
    };
  });

  const filtered = filterCustomers(customersWithSavedSegments, filters);
  const sorted = sortCustomerList(filtered, filters.sort);
  const start = (page - 1) * limit;

  return {
    customers: sorted.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
  };
}

async function getCustomerAnalyticsOverview(filters = {}) {
  const { customers } = await getCustomersEnhanced({ ...filters, page: 1, limit: 250 });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalCustomers = customers.length;
  const repeatCustomers = customers.filter((customer) => Number(customer.paidOrderCount || 0) >= 2).length;
  const firstTimeCustomers = customers.filter((customer) => Number(customer.paidOrderCount || 0) === 1).length;
  const inactiveCustomers = customers.filter((customer) => (customer.segmentIds || []).includes("inactive_customers")).length;
  const noPurchaseCustomers = customers.filter((customer) => Number(customer.paidOrderCount || 0) === 0).length;
  const highValueCustomers = customers.filter((customer) => (customer.segmentIds || []).includes("high_value_customers")).length;
  const abandonedCartCustomers = customers.filter((customer) => Number(customer.abandonedCartCount || 0) > 0).length;
  const newCustomers = customers.filter((customer) => {
    const createdAt = customer.createdAt ? new Date(customer.createdAt) : null;
    return createdAt && createdAt >= monthStart;
  }).length;
  const totalCustomerRevenue = customers.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0);
  const paidOrders = customers.reduce((sum, customer) => sum + Number(customer.paidOrderCount || 0), 0);
  const sourceMap = new Map();
  customers.forEach((customer) => {
    const source = customer.utmSource || customer.referralSource || "Unknown";
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });

  return {
    totalCustomers,
    newCustomers,
    repeatCustomers,
    firstTimeCustomers,
    inactiveCustomers,
    noPurchaseCustomers,
    highValueCustomers,
    abandonedCartCustomers,
    totalCustomerRevenue,
    averageCustomerLtv: totalCustomers > 0 ? totalCustomerRevenue / totalCustomers : 0,
    averageOrderValue: paidOrders > 0 ? totalCustomerRevenue / paidOrders : 0,
    repeatPurchaseRate: totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0,
    customersBySource: [...sourceMap.entries()].map(([source, count]) => ({ source, count })),
  };
}

async function getCustomerAbandonedCarts(email) {
  return runOptionalCustomerQuery(
    `SELECT id, session_id, customer_email, customer_name, customer_phone, cart_items, total_value, recovery_status, email_reminder_count, last_activity_at, checkout_started_at, recovered_at, created_at
     FROM abandoned_carts WHERE LOWER(customer_email) = LOWER($1)
     ORDER BY last_activity_at DESC NULLS LAST, created_at DESC LIMIT 20`,
    [email]
  );
}

async function getCustomerRecentEvents(email) {
  return runOptionalCustomerQuery(
    `SELECT id, event_type, session_id, product_id, order_id, value, currency, utm_source, utm_medium, utm_campaign, metadata, created_at
     FROM analytics_events WHERE LOWER(customer_email) = LOWER($1)
     ORDER BY created_at DESC LIMIT 30`,
    [email]
  );
}

async function getCustomerProfile(identifier) {
  const decoded = decodeURIComponent(String(identifier || ""));
  const key = decoded.toLowerCase();
  const { customers } = await getCustomersEnhanced({ page: 1, limit: 250 });
  const customer = customers.find(
    (item) => String(item.accountId || item.account_id || "").toLowerCase() === key || normalizeCustomerEmail(item.email) === key
  );
  if (!customer) return null;

  const orders = await baseCustomerExports.getCustomerOrders(customer.email);
  const items = await baseCustomerExports.getCustomerOrderItems(orders.map((order) => order.id));
  const itemsByOrderId = new Map();
  items.forEach((item) => {
    const current = itemsByOrderId.get(item.order_id) || [];
    current.push(item);
    itemsByOrderId.set(item.order_id, current);
  });
  const [abandonedCarts, recentEvents] = await Promise.all([
    getCustomerAbandonedCarts(customer.email),
    getCustomerRecentEvents(customer.email),
  ]);

  return {
    customer,
    summary: {
      totalOrders: customer.totalOrders,
      paidOrders: customer.paidOrderCount,
      totalSpent: customer.totalSpent,
      ltv: customer.ltv,
      averageOrderValue: customer.averageOrderValue,
      repeatPurchaseCount: customer.repeatPurchaseCount,
      lastOrderDate: customer.lastOrderDate,
      abandonedCartCount: customer.abandonedCartCount,
      productViewCount: customer.productViewCount,
      lastActivityAt: customer.lastActivityAt,
    },
    purchaseHistory: orders.map((order) => ({ ...order, items: itemsByOrderId.get(order.id) || [] })),
    abandonedCarts,
    recentEvents,
    tags: customer.tags,
    segments: customer.segments,
  };
}

async function listCustomerTags() {
  return runOptionalCustomerQuery(
    `SELECT tag.id, tag.name, tag.color, COUNT(assignment.id)::int AS customer_count, tag.created_at, tag.updated_at
     FROM customer_tags tag
     LEFT JOIN customer_tag_assignments assignment ON assignment.tag_id = tag.id
     GROUP BY tag.id
     ORDER BY tag.name ASC`
  );
}

async function createCustomerTag({ name, color = "" } = {}) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    const error = new Error("Tag name is required.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `INSERT INTO customer_tags (name, color)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET
       color = COALESCE(NULLIF(EXCLUDED.color, ''), customer_tags.color),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [normalizedName, color || null]
  );
  return result.rows[0];
}

async function updateCustomerTags(identifier, { tags, add = [], remove = [] } = {}) {
  const profile = await getCustomerProfile(identifier);
  if (!profile) {
    const error = new Error("Customer not found.");
    error.statusCode = 404;
    throw error;
  }

  const manualTags = new Set((profile.customer.manualTags || []).map(String));
  if (Array.isArray(tags)) {
    manualTags.clear();
    tags.forEach((tag) => tag && manualTags.add(String(tag).trim()));
  }
  add.forEach((tag) => tag && manualTags.add(String(tag).trim()));
  remove.forEach((tag) => {
    const target = String(tag || "").toLowerCase();
    for (const existing of [...manualTags]) {
      if (String(existing).toLowerCase() === target) manualTags.delete(existing);
    }
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM customer_tag_assignments WHERE LOWER(customer_email) = LOWER($1)", [profile.customer.email]);
    for (const tagName of [...manualTags].filter(Boolean)) {
      const tagResult = await client.query(
        `INSERT INTO customer_tags (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [tagName]
      );
      await client.query(
        `INSERT INTO customer_tag_assignments (customer_id, customer_email, tag_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [isUuid(profile.customer.accountId) ? profile.customer.accountId : null, profile.customer.email, tagResult.rows[0].id]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getCustomerProfile(identifier);
}

async function listCustomerSegments() {
  const saved = await runOptionalCustomerQuery(
    `SELECT id::text, name, description, rules, is_active, created_at, updated_at, 'saved' AS type
     FROM customer_segments
     ORDER BY created_at DESC`
  );
  return [
    ...BUILT_IN_CUSTOMER_SEGMENTS,
    ...saved.map((segment) => ({ ...segment, rules: parseSegmentRules(segment.rules) })),
  ];
}

async function createCustomerSegment({ name, description = "", rules = {} } = {}) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    const error = new Error("Segment name is required.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `INSERT INTO customer_segments (name, description, rules, is_active)
     VALUES ($1, $2, $3::jsonb, true)
     RETURNING id::text, name, description, rules, is_active, created_at, updated_at, 'saved' AS type`,
    [normalizedName, description || null, JSON.stringify(parseSegmentRules(rules))]
  );
  return result.rows[0];
}

async function updateCustomerSegment(segmentId, payload = {}) {
  const updates = [];
  const values = [];
  if (payload.name !== undefined) {
    values.push(String(payload.name || "").trim());
    updates.push(`name = $${values.length}`);
  }
  if (payload.description !== undefined) {
    values.push(payload.description || null);
    updates.push(`description = $${values.length}`);
  }
  if (payload.rules !== undefined) {
    values.push(JSON.stringify(parseSegmentRules(payload.rules)));
    updates.push(`rules = $${values.length}::jsonb`);
  }
  if (payload.isActive !== undefined || payload.is_active !== undefined) {
    values.push(Boolean(payload.isActive ?? payload.is_active));
    updates.push(`is_active = $${values.length}`);
  }
  if (!updates.length) {
    const error = new Error("No segment fields were provided.");
    error.statusCode = 400;
    throw error;
  }
  values.push(segmentId);
  const result = await pool.query(
    `UPDATE customer_segments
     SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length}
     RETURNING id::text, name, description, rules, is_active, created_at, updated_at, 'saved' AS type`,
    values
  );
  return result.rows[0] || null;
}

async function deleteCustomerSegment(segmentId) {
  const result = await pool.query(
    "DELETE FROM customer_segments WHERE id = $1 RETURNING id::text, name",
    [segmentId]
  );
  return result.rows[0] || null;
}

function buildCustomersCsvEnhanced(customers) {
  const list = Array.isArray(customers) ? customers : customers.customers || [];
  const headers = ["name", "email", "phone", "total_orders", "total_spent", "average_order_value", "repeat_purchase_count", "last_order_date", "tags", "segments", "created_at"];
  const rows = list.map((customer) => [
    customer.name,
    customer.email,
    customer.phone,
    customer.totalOrders,
    customer.totalSpent,
    customer.averageOrderValue,
    customer.repeatPurchaseCount,
    customer.lastOrderDate,
    (customer.tags || []).join("; "),
    (customer.segments || []).join("; "),
    customer.createdAt,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

module.exports = {
  ...baseCustomerExports,
  buildCustomersCsv: buildCustomersCsvEnhanced,
  createCustomerSegment,
  createCustomerTag,
  deleteCustomerSegment,
  getCustomerAnalyticsOverview,
  getCustomerProfile,
  getCustomers: getCustomersEnhanced,
  listCustomerSegments,
  listCustomerTags,
  updateCustomerSegment,
  updateCustomerTags,
};
