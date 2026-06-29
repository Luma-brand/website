import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CircleOff,
  Clock3,
  Mail,
  Package,
  Receipt,
  ShoppingBag,
  UserRound,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminTopbar } from "../components/AdminTopbar";
import { StatCard } from "../components/StatCard";
import { formatNaira } from "../../utils/currency";
import { getAdminDashboardStats } from "../../services/api";

export function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminDashboardStats();
      setDashboardData(response.data || null);
    } catch (error) {
      setError(error.message || "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadDashboardData();
    });
  }, [loadDashboardData]);

  const stats = dashboardData?.stats || {};
  const latestOrders = dashboardData?.recentOrders || [];
  const latestEnquiries = dashboardData?.recentEnquiries || [];
  const latestWaitlist = dashboardData?.recentWaitlist || [];
  const recentCustomers = dashboardData?.recentCustomers || [];
  const lowStockProducts = dashboardData?.lowStockList || [];
  const operationsChartData = [
    { label: "Orders", value: Number(stats.totalOrders || 0) },
    { label: "Pending", value: Number(stats.pendingOrders || 0) },
    { label: "Paid", value: Number(stats.paidOrders || 0) },
    { label: "Customers", value: Number(stats.totalCustomers || 0) },
  ];
  const inventoryChartData = [
    { label: "Products", value: Number(stats.totalProducts || 0) },
    { label: "Low stock", value: Number(stats.lowStockProducts || 0) },
    { label: "Out", value: Number(stats.outOfStockProducts || 0) },
    { label: "Waitlist", value: Number(stats.waitlistCount || 0) },
  ];

  return (
    <>
      <AdminTopbar
        title="Overview"
        subtitle="A quick look at your LUMA website, shop, and customer activity."
      />

      <section className="admin-content admin-dashboard-content">
        {error && <div className="admin-error">{error}</div>}

        {!error && (
          <div className="admin-grid admin-dashboard-grid">
            <StatCard icon={Package} label="Total products" value={stats.totalProducts || 0} />
            <StatCard icon={ShoppingBag} label="Total orders" value={stats.totalOrders || 0} />
            <StatCard icon={Banknote} label="Revenue" value={formatNaira(stats.totalRevenue || 0)} />
            <StatCard icon={Receipt} label="Average order" value={formatNaira(stats.averageOrderValue || 0)} />
            <StatCard icon={Clock3} label="Pending orders" value={stats.pendingOrders || 0} />
            <StatCard icon={AlertTriangle} label="Low stock" value={stats.lowStockProducts || 0} />
            <StatCard icon={CircleOff} label="Out of stock" value={stats.outOfStockProducts || 0} />
            <StatCard icon={Users} label="Customers" value={stats.totalCustomers || 0} />
            <StatCard icon={UserRound} label="Waitlist" value={stats.waitlistCount || 0} />
            <StatCard icon={Mail} label="Enquiries" value={stats.enquiryCount || 0} />
          </div>
        )}

        {isLoading ? (
          <div className="admin-card admin-table-card">Loading dashboard...</div>
        ) : error && !dashboardData ? (
          <div className="admin-card admin-table-card">
            Dashboard data could not be loaded. Check the backend deployment and
            try again.
          </div>
        ) : (
          <>
            <div className="admin-section-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Orders and customers</h2>
                </div>
                <div className="admin-chart">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={operationsChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#4f3426" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Inventory snapshot</h2>
                </div>
                <div className="admin-chart">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={inventoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8f6b4f" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="admin-section-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Latest orders</h2>
                </div>

                {latestOrders.length === 0 ? (
                  <div className="admin-empty">No orders yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {latestOrders.map((order) => (
                          <tr key={order.id}>
                            <td>{order.customer_name}</td>
                            <td>{formatNaira(order.total_amount)}</td>
                            <td>
                              <span className="admin-badge">
                                {order.status || "pending"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Latest enquiries</h2>
                </div>

                {latestEnquiries.length === 0 ? (
                  <div className="admin-empty">No enquiries yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Subject</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {latestEnquiries.map((item) => (
                          <tr key={item.id}>
                            <td>{item.full_name}</td>
                            <td>{item.subject || "General enquiry"}</td>
                            <td>
                              <span className="admin-badge">
                                {item.status || "new"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-section-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Low-stock alerts</h2>
                </div>

                {lowStockProducts.length === 0 ? (
                  <div className="admin-empty">No low-stock products.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Stock</th>
                          <th>Threshold</th>
                        </tr>
                      </thead>

                      <tbody>
                        {lowStockProducts.map((product) => (
                          <tr key={product.id}>
                            <td>{product.name}</td>
                            <td>{product.stock_quantity ?? 0}</td>
                            <td>{product.low_stock_threshold ?? 20}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Recent customers</h2>
                </div>

                {recentCustomers.length === 0 ? (
                  <div className="admin-empty">No customer orders yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Orders</th>
                          <th>Total spent</th>
                        </tr>
                      </thead>

                      <tbody>
                        {recentCustomers.map((customer) => (
                          <tr key={customer.customer_email}>
                            <td>{customer.customer_name || customer.customer_email}</td>
                            <td>{customer.order_count}</td>
                            <td>{formatNaira(customer.total_spent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-card admin-table-card">
              <div className="admin-table-header">
                <h2>Latest waitlist signups</h2>
              </div>

              {latestWaitlist.length === 0 ? (
                <div className="admin-empty">No waitlist users yet.</div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Interest</th>
                      </tr>
                    </thead>

                    <tbody>
                      {latestWaitlist.map((user) => (
                        <tr key={user.id}>
                          <td>{user.full_name || "—"}</td>
                          <td>{user.email}</td>
                          <td>{user.interest || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
