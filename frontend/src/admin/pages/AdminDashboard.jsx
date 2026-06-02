import { useEffect, useState } from "react";
import { AdminTopbar } from "../components/AdminTopbar";
import { StatCard } from "../components/StatCard";
import { formatNaira } from "../../utils/currency";

import {
  getEnquiries,
  getProducts,
  getWaitlistUsers,
  getOrders,
} from "../../services/api";

export function AdminDashboard() {
  const [waitlist, setWaitlist] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setIsLoading(true);
        setError("");

        const [waitlistResponse, enquiriesResponse, productsResponse, ordersResponse] =
          await Promise.all([
            getWaitlistUsers(),
            getEnquiries(),
            getProducts(),
            getOrders(),
          ]);

        setWaitlist(waitlistResponse.data || []);
        setEnquiries(enquiriesResponse.data || []);
        setProducts(productsResponse.data || []);
        setOrders(ordersResponse.data || []);
      } catch (error) {
        setError(error.message || "Failed to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const latestWaitlist = waitlist.slice(0, 5);
  const latestEnquiries = enquiries.slice(0, 5);
  const latestOrders = orders.slice(0, 5);

  const activeProducts = products.filter((product) => product.status === "active");
  const pendingOrders = orders.filter((order) => order.status === "pending");
  const unpaidOrders = orders.filter((order) => order.payment_status === "unpaid");

  const totalRevenue = orders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  return (
    <>
      <AdminTopbar
        title="Overview"
        subtitle="A quick look at your LUMA website, shop, and customer activity."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-grid">
          <StatCard label="Waitlist users" value={waitlist.length} />
          <StatCard label="Enquiries" value={enquiries.length} />
          <StatCard label="Products" value={products.length} />
          <StatCard label="Active products" value={activeProducts.length} />
          <StatCard label="Total orders" value={orders.length} />
          <StatCard label="Pending orders" value={pendingOrders.length} />
          <StatCard label="Unpaid orders" value={unpaidOrders.length} />
          <StatCard label="Revenue" value={formatNaira(totalRevenue)} />
        </div>

        {isLoading ? (
          <div className="admin-card admin-table-card">Loading dashboard...</div>
        ) : (
          <>
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
                            <td>${Number(order.total_amount).toFixed(2)}</td>
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