import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminTopbar } from "../components/AdminTopbar";
import { StatCard } from "../components/StatCard";
import { getAdminAnalytics } from "../../services/api";
import { formatNaira } from "../../utils/currency";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatStatus(value) {
  return String(value || "unknown").replaceAll("_", " ");
}

const chartColors = ["#4f3426", "#8f6b4f", "#c69b6d", "#d7b98f", "#6f5a49", "#b8875a"];
const rangeOptions = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "This year", value: "this_year" },
  { label: "Past 1 year", value: "1y" },
  { label: "Past 2 years", value: "2y" },
];

function ChartEmpty({ children }) {
  return <div className="admin-empty">{children}</div>;
}

export function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [range, setRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminAnalytics({ range });
      setAnalytics(response.data || null);
    } catch (error) {
      setError(error.message || "Failed to load analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    queueMicrotask(() => {
      loadAnalytics();
    });
  }, [loadAnalytics]);

  const summary = analytics?.summary || {};
  const bestSellingProducts = analytics?.bestSellingProducts || [];
  const recentPaidOrders = analytics?.recentPaidOrders || [];
  const revenueByDay = analytics?.revenueByDay || [];
  const lowStockProducts = analytics?.lowStockProducts || [];
  const conversionFunnel = analytics?.conversionFunnel || [];
  const trafficSources = analytics?.trafficSources || [];
  const returningCustomers = analytics?.returningCustomers || [];
  const cartAbandonment = analytics?.cartAbandonment || {};
  const recentAbandonedCarts = cartAbandonment.recentCarts || [];
  const customersOverTime = analytics?.customersOverTime || [];
  const userCountries = analytics?.userCountries || [];
  const referralSources = analytics?.referralSources || [];
  const whyLumaBreakdown = analytics?.whyLumaBreakdown || [];
  const browGoalBreakdown = analytics?.browGoalBreakdown || [];

  return (
    <>
      <AdminTopbar
        title="Analytics"
        subtitle="Sales, conversion, traffic, customer, and cart abandonment signals from real LUMA data."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-header">
          <select
            className="admin-mini-select"
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="admin-button secondary"
            onClick={loadAnalytics}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
            {isLoading ? "Refreshing..." : "Refresh analytics"}
          </button>
        </div>

        <div className="admin-grid">
          <StatCard label="Total revenue" value={formatNaira(summary.totalRevenue || 0)} />
          <StatCard label="Paid orders" value={summary.paidOrders || 0} />
          <StatCard label="Average order" value={formatNaira(summary.averageOrderValue || 0)} />
          <StatCard label="Paid customers" value={summary.paidCustomers || 0} />
          <StatCard label="Returning rate" value={`${summary.returningCustomerRate || 0}%`} />
          <StatCard label="Open cart value" value={formatNaira(cartAbandonment.openCartValue || 0)} />
        </div>

        {isLoading ? (
          <div className="admin-card admin-table-card">Loading analytics...</div>
        ) : (
          <>
            <div className="admin-section-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Revenue over time</h2>
                </div>
                {revenueByDay.length === 0 ? (
                  <ChartEmpty>No paid revenue for this range.</ChartEmpty>
                ) : (
                  <div className="admin-chart">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={[...revenueByDay].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                        <XAxis dataKey="day" tickFormatter={formatDate} />
                        <YAxis />
                        <Tooltip formatter={(value) => formatNaira(value)} />
                        <Line type="monotone" dataKey="revenue" stroke="#4f3426" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Orders over time</h2>
                </div>
                {revenueByDay.length === 0 ? (
                  <ChartEmpty>No paid orders for this range.</ChartEmpty>
                ) : (
                  <div className="admin-chart">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={[...revenueByDay].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                        <XAxis dataKey="day" tickFormatter={formatDate} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="order_count" fill="#8f6b4f" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-section-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Customers over time</h2>
                </div>
                {customersOverTime.length === 0 ? (
                  <ChartEmpty>No customer signups for this range.</ChartEmpty>
                ) : (
                  <div className="admin-chart">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={[...customersOverTime].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                        <XAxis dataKey="day" tickFormatter={formatDate} />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="customers" stroke="#6f5a49" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>User countries</h2>
                </div>
                {userCountries.length === 0 ? (
                  <ChartEmpty>No country data yet.</ChartEmpty>
                ) : (
                  <div className="admin-chart">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={userCountries} dataKey="value" nameKey="label" outerRadius={92} label>
                          {userCountries.map((entry, index) => (
                            <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-section-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Referral sources</h2>
                </div>
                {referralSources.length === 0 ? (
                  <ChartEmpty>No referral source data yet.</ChartEmpty>
                ) : (
                  <div className="admin-chart">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={referralSources} dataKey="value" nameKey="label" innerRadius={48} outerRadius={92} label>
                          {referralSources.map((entry, index) => (
                            <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Why customers choose LUMA</h2>
                </div>
                {whyLumaBreakdown.length === 0 ? (
                  <ChartEmpty>No onboarding answers yet.</ChartEmpty>
                ) : (
                  <div className="admin-chart">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={whyLumaBreakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                        <XAxis type="number" />
                        <YAxis dataKey="label" type="category" width={150} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#4f3426" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-section-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Brow result goals</h2>
                </div>
                {browGoalBreakdown.length === 0 ? (
                  <ChartEmpty>No brow goal data yet.</ChartEmpty>
                ) : (
                  <div className="admin-chart">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={browGoalBreakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                        <XAxis type="number" />
                        <YAxis dataKey="label" type="category" width={150} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8f6b4f" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Conversion funnel</h2>
                </div>

                {conversionFunnel.length === 0 ? (
                  <div className="admin-empty">No funnel events yet.</div>
                ) : (
                  <div className="analytics-funnel">
                    {conversionFunnel.map((step) => (
                      <div className="analytics-funnel-step" key={step.eventType}>
                        <div>
                          <strong>{step.label}</strong>
                          <small>{step.eventType}</small>
                        </div>
                        <span>{step.sessions} sessions</span>
                        <span>{step.events} events</span>
                        <b>{step.conversionFromPrevious}%</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Traffic sources</h2>
                </div>

                {trafficSources.length === 0 ? (
                  <div className="admin-empty">No UTM traffic data yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Sessions</th>
                          <th>Purchases</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>

                      <tbody>
                        {trafficSources.map((source) => (
                          <tr
                            key={`${source.source}-${source.medium}-${source.campaign}`}
                          >
                            <td>
                              <strong>{source.source}</strong>
                              <small>
                                {source.medium} / {source.campaign}
                              </small>
                            </td>
                            <td>{source.sessions}</td>
                            <td>{source.purchases}</td>
                            <td>{formatNaira(source.revenue)}</td>
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
                  <h2>Best-selling products</h2>
                </div>

                {bestSellingProducts.length === 0 ? (
                  <div className="admin-empty">No paid product sales yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Units</th>
                          <th>Orders</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>

                      <tbody>
                        {bestSellingProducts.map((product) => (
                          <tr key={`${product.product_id}-${product.product_name}`}>
                            <td>{product.product_name}</td>
                            <td>{product.units_sold}</td>
                            <td>{product.order_count}</td>
                            <td>{formatNaira(product.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Returning customers</h2>
                </div>

                {returningCustomers.length === 0 ? (
                  <div className="admin-empty">No repeat paid customers yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Orders</th>
                          <th>Total spent</th>
                          <th>Last order</th>
                        </tr>
                      </thead>

                      <tbody>
                        {returningCustomers.map((customer) => (
                          <tr key={customer.customer_email}>
                            <td>
                              <strong>
                                {customer.customer_name || customer.customer_email}
                              </strong>
                              <small>{customer.customer_email}</small>
                            </td>
                            <td>{customer.paid_order_count}</td>
                            <td>{formatNaira(customer.total_spent)}</td>
                            <td>{formatDate(customer.last_order_at)}</td>
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
                  <h2>Cart abandonment</h2>
                </div>

                <div className="analytics-mini-grid">
                  <div>
                    <small>Total carts</small>
                    <strong>{cartAbandonment.totalCarts || 0}</strong>
                  </div>
                  <div>
                    <small>Open carts</small>
                    <strong>{cartAbandonment.openCarts || 0}</strong>
                  </div>
                  <div>
                    <small>Recovered</small>
                    <strong>{cartAbandonment.recoveredCarts || 0}</strong>
                  </div>
                  <div>
                    <small>Recovery rate</small>
                    <strong>{cartAbandonment.recoveryRate || 0}%</strong>
                  </div>
                </div>

                {recentAbandonedCarts.length === 0 ? (
                  <div className="admin-empty">No abandoned cart data yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Value</th>
                          <th>Status</th>
                          <th>Last activity</th>
                        </tr>
                      </thead>

                      <tbody>
                        {recentAbandonedCarts.map((cart) => (
                          <tr key={cart.id}>
                            <td>{cart.customer_email || cart.customer_phone || "Guest"}</td>
                            <td>{formatNaira(cart.total_value || 0)}</td>
                            <td>{formatStatus(cart.recovery_status)}</td>
                            <td>{formatDate(cart.last_activity_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Recent paid orders</h2>
                </div>

                {recentPaidOrders.length === 0 ? (
                  <div className="admin-empty">No paid orders yet.</div>
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
                        {recentPaidOrders.map((order) => (
                          <tr key={order.id}>
                            <td>{order.customer_name || order.customer_email}</td>
                            <td>{formatNaira(order.total_amount)}</td>
                            <td>{order.status || "processing"}</td>
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
                  <h2>Last 30 days revenue</h2>
                </div>

                {revenueByDay.length === 0 ? (
                  <div className="admin-empty">No paid revenue in the last 30 days.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Orders</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>

                      <tbody>
                        {revenueByDay.map((day) => (
                          <tr key={day.day}>
                            <td>{formatDate(day.day)}</td>
                            <td>{day.order_count}</td>
                            <td>{formatNaira(day.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Inventory alerts</h2>
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
                            <td>{product.stock_quantity}</td>
                            <td>{product.low_stock_threshold ?? 20}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
