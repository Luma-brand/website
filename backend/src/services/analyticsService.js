const pool = require("../config/db");

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

async function runAnalyticsQuery(query, params = [], fallback) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    if (["42P01", "42703"].includes(error.code) || isTransientDatabaseError(error)) {
      if (!["42P01", "42703"].includes(error.code)) {
        console.warn("Analytics query returned fallback:", pool.describeError ? pool.describeError(error) : error.message);
      }
      return fallback;
    }

    throw error;
  }
}
function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getFunnelRate(current, previous) {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);

  if (previousValue <= 0) return 0;

  return Math.round((currentValue / previousValue) * 1000) / 10;
}

function formatFunnel(rows) {
  const eventMap = new Map(rows.map((row) => [row.event_type, row]));
  const steps = [
    { eventType: "page_view", label: "Page views" },
    { eventType: "product_view", label: "Product views" },
    { eventType: "add_to_cart", label: "Add to cart" },
    { eventType: "checkout_started", label: "Checkout started" },
    { eventType: "purchase_completed", label: "Purchase completed" },
  ];

  return steps.map((step, index) => {
    const row = eventMap.get(step.eventType) || {};
    const previousRow = index > 0 ? eventMap.get(steps[index - 1].eventType) : null;
    const sessions = toNumber(row.sessions);

    return {
      ...step,
      events: toNumber(row.events),
      sessions,
      conversionFromPrevious:
        index === 0 ? 100 : getFunnelRate(sessions, previousRow?.sessions),
    };
  });
}

function getDateRange({ range = "30d", startDate, endDate } = {}) {
  const now = new Date();
  const end = endDate ? new Date(endDate) : now;
  const start = startDate ? new Date(startDate) : new Date(now);

  if (!startDate) {
    if (range === "7d") start.setDate(now.getDate() - 7);
    else if (range === "90d") start.setDate(now.getDate() - 90);
    else if (range === "this_year") start.setMonth(0, 1);
    else if (range === "1y") start.setFullYear(now.getFullYear() - 1);
    else if (range === "2y") start.setFullYear(now.getFullYear() - 2);
    else start.setDate(now.getDate() - 30);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end, range };
}

async function getAdminAnalytics(filters = {}) {
  const dateRange = getDateRange(filters);
  const dateParams = [dateRange.start, dateRange.end];
  const [salesSummary] = await runAnalyticsQuery(
    `
      SELECT
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_orders,
        COUNT(*) FILTER (WHERE payment_status = 'unpaid')::int AS unpaid_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS total_revenue,
        COALESCE(AVG(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS average_order_value,
        COALESCE(MAX(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS highest_order_value,
        COUNT(DISTINCT LOWER(customer_email)) FILTER (WHERE payment_status = 'paid')::int AS paid_customers
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
    `,
    dateParams,
    [
      {
        total_orders: 0,
        paid_orders: 0,
        unpaid_orders: 0,
        total_revenue: 0,
        average_order_value: 0,
        highest_order_value: 0,
        paid_customers: 0,
      },
    ]
  );

  const bestSellingProducts = await runAnalyticsQuery(
    `
      SELECT
        oi.product_id,
        oi.product_name,
        COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
        COALESCE(SUM(oi.price * oi.quantity), 0)::numeric AS revenue,
        COUNT(DISTINCT oi.order_id)::int AS order_count
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status = 'paid'
        AND o.created_at BETWEEN $1 AND $2
      GROUP BY oi.product_id, oi.product_name
      ORDER BY units_sold DESC, revenue DESC
      LIMIT 10
    `,
    dateParams,
    []
  );

  const recentPaidOrders = await runAnalyticsQuery(
    `
      SELECT
        id,
        customer_name,
        customer_email,
        total_amount,
        status,
        payment_status,
        paystack_reference,
        created_at
      FROM orders
      WHERE payment_status = 'paid'
        AND created_at BETWEEN $1 AND $2
      ORDER BY created_at DESC
      LIMIT 10
    `,
    dateParams,
    []
  );

  const revenueByDay = await runAnalyticsQuery(
    `
      SELECT
        DATE_TRUNC('day', created_at)::date AS day,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(total_amount), 0)::numeric AS revenue
      FROM orders
      WHERE payment_status = 'paid'
        AND created_at BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('day', created_at)::date
      ORDER BY day DESC
      LIMIT 30
    `,
    dateParams,
    []
  );

  const funnelRows = await runAnalyticsQuery(
    `
      SELECT
        event_type,
        COUNT(*)::int AS events,
        COUNT(DISTINCT COALESCE(session_id, id::text))::int AS sessions
      FROM analytics_events
      WHERE event_type IN (
        'page_view',
        'product_view',
        'add_to_cart',
        'checkout_started',
        'purchase_completed',
        'cart_abandoned'
      )
        AND created_at BETWEEN $1 AND $2
      GROUP BY event_type
    `,
    dateParams,
    []
  );

  const trafficSources = await runAnalyticsQuery(
    `
      SELECT
        COALESCE(NULLIF(utm_source, ''), 'direct') AS source,
        COALESCE(NULLIF(utm_medium, ''), 'none') AS medium,
        COALESCE(NULLIF(utm_campaign, ''), 'uncampaign') AS campaign,
        COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
        COUNT(DISTINCT COALESCE(session_id, id::text))::int AS sessions,
        COUNT(*) FILTER (WHERE event_type = 'purchase_completed')::int AS purchases,
        COALESCE(SUM(value) FILTER (WHERE event_type = 'purchase_completed'), 0)::numeric AS revenue
      FROM analytics_events
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY
        COALESCE(NULLIF(utm_source, ''), 'direct'),
        COALESCE(NULLIF(utm_medium, ''), 'none'),
        COALESCE(NULLIF(utm_campaign, ''), 'uncampaign')
      ORDER BY sessions DESC, revenue DESC
      LIMIT 12
    `,
    dateParams,
    []
  );

  const returningCustomers = await runAnalyticsQuery(
    `
      SELECT
        LOWER(customer_email) AS customer_email,
        MAX(customer_name) AS customer_name,
        COUNT(*)::int AS paid_order_count,
        COALESCE(SUM(total_amount), 0)::numeric AS total_spent,
        MAX(created_at) AS last_order_at
      FROM orders
      WHERE payment_status = 'paid'
        AND customer_email IS NOT NULL
        AND created_at BETWEEN $1 AND $2
      GROUP BY LOWER(customer_email)
      HAVING COUNT(*) > 1
      ORDER BY total_spent DESC, paid_order_count DESC
      LIMIT 10
    `,
    dateParams,
    []
  );

  const [cartAbandonmentSummary] = await runAnalyticsQuery(
    `
      SELECT
        COUNT(*)::int AS total_carts,
        COUNT(*) FILTER (WHERE recovery_status = 'recovered')::int AS recovered_carts,
        COUNT(*) FILTER (WHERE recovery_status <> 'recovered' AND recovery_status <> 'expired')::int AS open_carts,
        COALESCE(SUM(total_value), 0)::numeric AS total_cart_value,
        COALESCE(SUM(total_value) FILTER (WHERE recovery_status <> 'recovered' AND recovery_status <> 'expired'), 0)::numeric AS open_cart_value
      FROM abandoned_carts
      WHERE created_at BETWEEN $1 AND $2
    `,
    dateParams,
    [
      {
        total_carts: 0,
        recovered_carts: 0,
        open_carts: 0,
        total_cart_value: 0,
        open_cart_value: 0,
      },
    ]
  );

  const recentAbandonedCarts = await runAnalyticsQuery(
    `
      SELECT
        id,
        customer_email,
        customer_phone,
        total_value,
        recovery_status,
        last_activity_at,
        checkout_started_at,
        recovered_at
      FROM abandoned_carts
      WHERE recovery_status <> 'expired'
        AND last_activity_at BETWEEN $1 AND $2
      ORDER BY last_activity_at DESC
      LIMIT 10
    `,
    dateParams,
    []
  );

  const lowStockProducts = await runAnalyticsQuery(
    `
      SELECT
        id,
        name,
        stock_quantity,
        low_stock_threshold,
        status,
        updated_at
      FROM products
      WHERE COALESCE(stock_quantity, 0) <= COALESCE(low_stock_threshold, 20)
      ORDER BY stock_quantity ASC, updated_at DESC
      LIMIT 10
    `,
    [],
    []
  );

  const customersOverTime = await runAnalyticsQuery(
    `
      SELECT
        DATE_TRUNC('day', created_at)::date AS day,
        COUNT(*)::int AS customers
      FROM customer_accounts
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('day', created_at)::date
      ORDER BY day DESC
      LIMIT 90
    `,
    dateParams,
    []
  );

  const userCountries = await runAnalyticsQuery(
    `
      SELECT
        COALESCE(NULLIF(phone_country_name, ''), NULLIF(country, ''), 'Unknown') AS label,
        COUNT(*)::int AS value
      FROM customer_accounts
      LEFT JOIN orders ON LOWER(orders.customer_email) = LOWER(customer_accounts.email)
      WHERE customer_accounts.created_at BETWEEN $1 AND $2
      GROUP BY COALESCE(NULLIF(phone_country_name, ''), NULLIF(country, ''), 'Unknown')
      ORDER BY value DESC
      LIMIT 12
    `,
    dateParams,
    []
  );

  const referralSources = await runAnalyticsQuery(
    `
      SELECT
        COALESCE(NULLIF(referral_source, ''), 'Unknown') AS label,
        COUNT(*)::int AS value
      FROM customer_accounts
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY COALESCE(NULLIF(referral_source, ''), 'Unknown')
      ORDER BY value DESC
      LIMIT 12
    `,
    dateParams,
    []
  );

  const whyLumaBreakdown = await runAnalyticsQuery(
    `
      SELECT
        COALESCE(NULLIF(why_luma, ''), 'Unknown') AS label,
        COUNT(*)::int AS value
      FROM customer_accounts
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY COALESCE(NULLIF(why_luma, ''), 'Unknown')
      ORDER BY value DESC
      LIMIT 12
    `,
    dateParams,
    []
  );

  const browGoalBreakdown = await runAnalyticsQuery(
    `
      SELECT
        COALESCE(NULLIF(brow_goal, ''), 'Unknown') AS label,
        COUNT(*)::int AS value
      FROM customer_accounts
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY COALESCE(NULLIF(brow_goal, ''), 'Unknown')
      ORDER BY value DESC
      LIMIT 12
    `,
    dateParams,
    []
  );

  const firstTimeBreakdown = await runAnalyticsQuery(
    `
      SELECT
        COALESCE(NULLIF(first_time_luma, ''), 'Unknown') AS label,
        COUNT(*)::int AS value
      FROM customer_accounts
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY COALESCE(NULLIF(first_time_luma, ''), 'Unknown')
      ORDER BY value DESC
      LIMIT 12
    `,
    dateParams,
    []
  );

  const paidOrders = toNumber(salesSummary?.paid_orders);
  const paidCustomers = toNumber(salesSummary?.paid_customers);

  return {
    summary: {
      totalOrders: toNumber(salesSummary?.total_orders),
      paidOrders,
      unpaidOrders: toNumber(salesSummary?.unpaid_orders),
      totalRevenue: toNumber(salesSummary?.total_revenue),
      averageOrderValue: toNumber(salesSummary?.average_order_value),
      highestOrderValue: toNumber(salesSummary?.highest_order_value),
      paidCustomers,
      returningCustomerRate:
        paidCustomers > 0
          ? Math.round((returningCustomers.length / paidCustomers) * 1000) / 10
          : 0,
      repeatPurchaseRate:
        paidOrders > 0
          ? Math.round((returningCustomers.length / paidOrders) * 1000) / 10
          : 0,
    },
    bestSellingProducts,
    recentPaidOrders,
    revenueByDay,
    conversionFunnel: formatFunnel(funnelRows),
    trafficSources: trafficSources.map((source) => ({
      ...source,
      page_views: toNumber(source.page_views),
      sessions: toNumber(source.sessions),
      purchases: toNumber(source.purchases),
      revenue: toNumber(source.revenue),
    })),
    returningCustomers: returningCustomers.map((customer) => ({
      ...customer,
      paid_order_count: toNumber(customer.paid_order_count),
      total_spent: toNumber(customer.total_spent),
    })),
    cartAbandonment: {
      totalCarts: toNumber(cartAbandonmentSummary?.total_carts),
      recoveredCarts: toNumber(cartAbandonmentSummary?.recovered_carts),
      openCarts: toNumber(cartAbandonmentSummary?.open_carts),
      totalCartValue: toNumber(cartAbandonmentSummary?.total_cart_value),
      openCartValue: toNumber(cartAbandonmentSummary?.open_cart_value),
      recoveryRate: getFunnelRate(
        cartAbandonmentSummary?.recovered_carts,
        cartAbandonmentSummary?.total_carts
      ),
      recentCarts: recentAbandonedCarts.map((cart) => ({
        ...cart,
        total_value: toNumber(cart.total_value),
      })),
    },
    lowStockProducts,
    filters: {
      range: dateRange.range,
      startDate: dateRange.start,
      endDate: dateRange.end,
    },
    salesOverTime: revenueByDay,
    ordersOverTime: revenueByDay,
    revenueOverTime: revenueByDay,
    customersOverTime: customersOverTime.map((row) => ({
      ...row,
      customers: toNumber(row.customers),
    })),
    userCountries: userCountries.map((row) => ({
      ...row,
      value: toNumber(row.value),
    })),
    referralSources: referralSources.map((row) => ({
      ...row,
      value: toNumber(row.value),
    })),
    whyLumaBreakdown: whyLumaBreakdown.map((row) => ({
      ...row,
      value: toNumber(row.value),
    })),
    browGoalBreakdown: browGoalBreakdown.map((row) => ({
      ...row,
      value: toNumber(row.value),
    })),
    firstTimeBreakdown: firstTimeBreakdown.map((row) => ({
      ...row,
      value: toNumber(row.value),
    })),
    productPerformance: bestSellingProducts,
    recentActivity: recentPaidOrders,
  };
}

async function getAdminAnalyticsEvents(filters = {}) {
  const dateRange = getDateRange(filters);
  const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 250);
  const rows = await runAnalyticsQuery(
    `
      SELECT
        id,
        event_type,
        session_id,
        customer_email,
        product_id,
        order_id,
        value,
        currency,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        metadata,
        created_at
      FROM analytics_events
      WHERE created_at BETWEEN $1 AND $2
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [dateRange.start, dateRange.end, limit],
    []
  );

  return {
    events: rows.map((event) => ({
      ...event,
      value: toNumber(event.value),
      metadata: event.metadata || {},
    })),
    filters: {
      range: dateRange.range,
      startDate: dateRange.start,
      endDate: dateRange.end,
      limit,
    },
  };
}

module.exports = {
  getAdminAnalytics,
  getAdminAnalyticsEvents,
};
