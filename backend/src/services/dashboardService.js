const pool = require("../config/db");

const DEFAULT_LOW_STOCK_THRESHOLD = 20;

async function runDashboardQuery(query, params = []) {
  const result = await pool.query(query, params);
  return result.rows;
}

async function getAdminDashboardStats() {
  const [productStats] = await runDashboardQuery(
    `
      SELECT
        COUNT(*)::int AS total_products,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_products,
        COUNT(*) FILTER (
          WHERE COALESCE(stock_quantity, 0) > 0
          AND COALESCE(stock_quantity, 0) <= COALESCE(low_stock_threshold, $1)
        )::int AS low_stock_products,
        COUNT(*) FILTER (WHERE COALESCE(stock_quantity, 0) <= 0)::int AS out_of_stock_products,
        COALESCE(SUM(stock_quantity), 0)::int AS total_stock_quantity
      FROM products
    `,
    [DEFAULT_LOW_STOCK_THRESHOLD],
    [
      {
        total_products: 0,
        active_products: 0,
        low_stock_products: 0,
        out_of_stock_products: 0,
        total_stock_quantity: 0,
      },
    ]
  );

  const [orderStats] = await runDashboardQuery(
    `
      SELECT
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
        COUNT(*) FILTER (WHERE status = 'processing')::int AS processing_orders,
        COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_orders,
        COUNT(*) FILTER (WHERE payment_status = 'unpaid')::int AS unpaid_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS total_revenue,
        COALESCE(AVG(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS average_order_value,
        COUNT(DISTINCT LOWER(customer_email))::int AS total_customers
      FROM orders
    `,
    [],
    [
      {
        total_orders: 0,
        pending_orders: 0,
        processing_orders: 0,
        delivered_orders: 0,
        cancelled_orders: 0,
        paid_orders: 0,
        unpaid_orders: 0,
        total_revenue: 0,
        average_order_value: 0,
        total_customers: 0,
      },
    ]
  );

  const [waitlistStats] = await runDashboardQuery(
    `
      SELECT COUNT(*)::int AS waitlist_count
      FROM newsletter_subscribers
    `,
    [],
    [{ waitlist_count: 0 }]
  );

  const [enquiryStats] = await runDashboardQuery(
    `
      SELECT
        COUNT(*)::int AS enquiry_count,
        COUNT(*) FILTER (WHERE status = 'new')::int AS new_enquiry_count
      FROM contacts
    `,
    [],
    [{ enquiry_count: 0, new_enquiry_count: 0 }]
  );

  const recentOrders = await runDashboardQuery(
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
      ORDER BY created_at DESC
      LIMIT 5
    `,
    [],
    []
  );

  const recentEnquiries = await runDashboardQuery(
    `
      SELECT id, full_name, email, subject, status, created_at
      FROM contacts
      ORDER BY created_at DESC
      LIMIT 5
    `,
    [],
    []
  );

  const recentWaitlist = await runDashboardQuery(
    `
      SELECT id, email, created_at
      FROM newsletter_subscribers
      ORDER BY created_at DESC
      LIMIT 5
    `,
    [],
    []
  );

  const recentCustomers = await runDashboardQuery(
    `
      SELECT
        customer_email,
        MAX(customer_name) AS customer_name,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS total_spent,
        MAX(created_at) AS last_order_at
      FROM orders
      WHERE customer_email IS NOT NULL
      GROUP BY customer_email
      ORDER BY last_order_at DESC
      LIMIT 5
    `,
    [],
    []
  );

  const lowStockList = await runDashboardQuery(
    `
      SELECT
        id,
        name,
        stock_quantity,
        low_stock_threshold,
        status,
        image_url,
        updated_at
      FROM products
      WHERE COALESCE(stock_quantity, 0) > 0
      AND COALESCE(stock_quantity, 0) <= COALESCE(low_stock_threshold, $1)
      ORDER BY stock_quantity ASC, updated_at DESC
      LIMIT 5
    `,
    [DEFAULT_LOW_STOCK_THRESHOLD],
    []
  );

  const stats = {
    totalProducts: Number(productStats?.total_products || 0),
    activeProducts: Number(productStats?.active_products || 0),
    lowStockProducts: Number(productStats?.low_stock_products || 0),
    outOfStockProducts: Number(productStats?.out_of_stock_products || 0),
    totalStockQuantity: Number(productStats?.total_stock_quantity || 0),
    totalOrders: Number(orderStats?.total_orders || 0),
    pendingOrders: Number(orderStats?.pending_orders || 0),
    processingOrders: Number(orderStats?.processing_orders || 0),
    deliveredOrders: Number(orderStats?.delivered_orders || 0),
    cancelledOrders: Number(orderStats?.cancelled_orders || 0),
    paidOrders: Number(orderStats?.paid_orders || 0),
    unpaidOrders: Number(orderStats?.unpaid_orders || 0),
    totalRevenue: Number(orderStats?.total_revenue || 0),
    averageOrderValue: Number(orderStats?.average_order_value || 0),
    totalCustomers: Number(orderStats?.total_customers || 0),
    waitlistCount: Number(waitlistStats?.waitlist_count || 0),
    enquiryCount: Number(enquiryStats?.enquiry_count || 0),
    newEnquiryCount: Number(enquiryStats?.new_enquiry_count || 0),
  };

  return {
    ...stats,
    stats,
    recentOrders,
    recentEnquiries,
    recentWaitlist,
    recentCustomers,
    lowStockList,
  };
}

module.exports = {
  getAdminDashboardStats,
};
