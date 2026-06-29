import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { formatNaira } from "../../utils/currency";
import {
  deleteOrder,
  getOrderById,
  getOrders,
  updateOrderStatus,
} from "../../services/api";

const orderStatuses = ["pending", "processing", "delivered", "cancelled"];
const paymentStatuses = ["unpaid", "paid", "refunded"];

export function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getOrders();
      setOrders(response.data || []);
    } catch (error) {
      setError(error.message || "Failed to load orders.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadOrders();
    });
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const value = search.toLowerCase();

    return orders.filter((order) => {
      return (
        order.customer_name?.toLowerCase().includes(value) ||
        order.customer_email?.toLowerCase().includes(value) ||
        order.customer_phone?.toLowerCase().includes(value) ||
        order.status?.toLowerCase().includes(value) ||
        order.payment_status?.toLowerCase().includes(value) ||
        order.paystack_reference?.toLowerCase().includes(value)
      );
    });
  }, [orders, search]);

  async function handleViewOrder(order) {
    try {
      setActionLoadingId(order.id);

      const response = await getOrderById(order.id);
      setSelectedOrder(response.data);
    } catch (error) {
      alert(error.message || "Failed to load order details.");
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleStatusChange(order, field, value) {
    try {
      setActionLoadingId(order.id);

      const payload =
        field === "status" ? { status: value } : { paymentStatus: value };

      const response = await updateOrderStatus(order.id, payload);
      const updatedOrder = response.data;

      setOrders((current) =>
        current.map((item) => (item.id === order.id ? updatedOrder : item))
      );

      if (selectedOrder?.id === order.id) {
        setSelectedOrder((current) => ({
          ...current,
          ...updatedOrder,
        }));
      }
    } catch (error) {
      alert(error.message || "Failed to update order.");
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleDeleteOrder(order) {
    const confirmed = window.confirm(
      `Delete order from ${order.customer_email}?`
    );

    if (!confirmed) return;

    try {
      setActionLoadingId(order.id);

      await deleteOrder(order.id);

      setOrders((current) => current.filter((item) => item.id !== order.id));

      if (selectedOrder?.id === order.id) {
        setSelectedOrder(null);
      }
    } catch (error) {
      alert(error.message || "Failed to delete order.");
    } finally {
      setActionLoadingId("");
    }
  }

  return (
    <>
      <AdminTopbar
        title="Orders"
        subtitle="View, process, and manage LUMA customer orders."
      />

      <section className="admin-content">
        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Customer orders</h2>

            <input
              className="admin-search"
              type="search"
              placeholder="Search orders, emails, status, reference..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {error && <div className="admin-error">{error}</div>}

          {isLoading ? (
            <div className="admin-empty">Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="admin-empty">No orders found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Total</th>
                    <th>Order status</th>
                    <th>Payment</th>
                    <th>Reference</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.customer_name}</td>
                      <td>{order.customer_email}</td>
                      <td>{formatNaira(order.total_amount)}</td>

                      <td>
                        <select
                          className="admin-mini-select"
                          value={order.status || "pending"}
                          onChange={(event) =>
                            handleStatusChange(
                              order,
                              "status",
                              event.target.value
                            )
                          }
                          disabled={actionLoadingId === order.id}
                        >
                          {orderStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          className="admin-mini-select"
                          value={order.payment_status || "unpaid"}
                          onChange={(event) =>
                            handleStatusChange(
                              order,
                              "paymentStatus",
                              event.target.value
                            )
                          }
                          disabled={actionLoadingId === order.id}
                        >
                          {paymentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <small>
                          {order.paystack_reference
                            ? `${order.paystack_reference.slice(0, 18)}...`
                            : "—"}
                        </small>
                      </td>

                      <td>
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString()
                          : "—"}
                      </td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            className="admin-button secondary"
                            onClick={() => handleViewOrder(order)}
                            disabled={actionLoadingId === order.id}
                          >
                            <Eye size={15} />
                            View
                          </button>

                          <button
                            type="button"
                            className="admin-button danger"
                            onClick={() => handleDeleteOrder(order)}
                            disabled={actionLoadingId === order.id}
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedOrder && (
          <div className="admin-card admin-table-card">
            <div className="admin-table-header">
              <h2>Order details</h2>

              <button
                type="button"
                className="admin-button secondary"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>

            <div className="admin-order-details-grid">
              <div>
                <h3>Customer</h3>

                <p>
                  <strong>Name:</strong> {selectedOrder.customer_name}
                </p>

                <p>
                  <strong>Email:</strong> {selectedOrder.customer_email}
                </p>

                <p>
                  <strong>Phone:</strong>{" "}
                  {selectedOrder.customer_phone || "—"}
                </p>
              </div>

              <div>
                <h3>Delivery</h3>

                <p>
                  <strong>Address:</strong>{" "}
                  {selectedOrder.delivery_address || "—"}
                </p>

                <p>
                  <strong>City / state:</strong>{" "}
                  {selectedOrder.state || selectedOrder.city || "—"}
                </p>

                <p>
                  <strong>Country:</strong> {selectedOrder.country || "—"}
                </p>

                <p>
                  <strong>Delivery fee:</strong>{" "}
                  {selectedOrder.delivery_fee !== undefined &&
                  selectedOrder.delivery_fee !== null
                    ? formatNaira(selectedOrder.delivery_fee)
                    : "—"}
                </p>

                <p>
                  <strong>Notes:</strong>{" "}
                  {selectedOrder.delivery_notes || "—"}
                </p>
              </div>

              <div>
                <h3>Payment</h3>

                <p>
                  <strong>Order:</strong> {selectedOrder.status || "pending"}
                </p>

                <p>
                  <strong>Payment:</strong>{" "}
                  {selectedOrder.payment_status || "unpaid"}
                </p>

                <p>
                  <strong>Provider:</strong>{" "}
                  {selectedOrder.payment_provider || "paystack"}
                </p>

                <p>
                  <strong>Reference:</strong>{" "}
                  {selectedOrder.paystack_reference || "—"}
                </p>

                <p>
                  <strong>Discount:</strong>{" "}
                  {Number(selectedOrder.discount_amount || 0) > 0
                    ? `${selectedOrder.discount_code || "Discount"} - ${formatNaira(
                        selectedOrder.discount_amount
                      )}`
                    : "—"}
                </p>

                <p>
                  <strong>Total:</strong>{" "}
                  {formatNaira(selectedOrder.total_amount)}
                </p>

                {selectedOrder.final_amount !== undefined &&
                  selectedOrder.final_amount !== null && (
                    <p>
                      <strong>Final amount:</strong>{" "}
                      {formatNaira(selectedOrder.final_amount)}
                    </p>
                  )}
              </div>
            </div>

            <div className="admin-table-wrap" style={{ marginTop: 20 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Size</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {(selectedOrder.items || []).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="admin-product-cell">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                            />
                          ) : (
                            <div className="admin-product-placeholder" />
                          )}

                          <div>
                            <strong>{item.product_name}</strong>
                            <small>
                              {item.product_id || "Product removed"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>{item.size || "—"}</td>
                      <td>{formatNaira(item.price)}</td>
                      <td>{item.quantity}</td>
                      <td>
                        {formatNaira(Number(item.price) * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
