import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { useToast } from "../../context/ToastContext";
import {
  cancelProductWaitlist,
  getAdminProducts,
  getProductWaitlists,
  sendProductWaitlistEmail,
  sendProductWaitlistEmailsForProduct,
  updateProductWaitlistStatus,
} from "../../services/api";
import { formatNaira } from "../../utils/currency";

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Waiting", value: "waiting" },
  { label: "Notified", value: "notified" },
  { label: "Purchased", value: "purchased" },
  { label: "Cancelled", value: "cancelled" },
];

const notifiedOptions = [
  { label: "All notifications", value: "all" },
  { label: "Email sent", value: "true" },
  { label: "Email not sent", value: "false" },
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function getContactLabel(entry) {
  return entry.full_name || entry.email || "Customer";
}

export function AdminBackInStock() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("all");
  const [notified, setNotified] = useState("all");
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [error, setError] = useState("");

  const loadWaitlists = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getProductWaitlists({
        status,
        search,
        productId: productFilter,
        notified,
      });
      setEntries(response.data?.entries || []);
      setStats(response.data?.stats || null);
    } catch (error) {
      setError(error.message || "Failed to load product waitlists.");
    } finally {
      setIsLoading(false);
    }
  }, [notified, productFilter, search, status]);

  useEffect(() => {
    queueMicrotask(() => {
      loadWaitlists();
    });
  }, [loadWaitlists]);

  useEffect(() => {
    let isMounted = true;

    getAdminProducts()
      .then((response) => {
        if (isMounted) setProducts(response.data || []);
      })
      .catch(() => {
        if (isMounted) setProducts([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totals = useMemo(
    () => ({
      total: Number(stats?.total || entries.length || 0),
      waiting: Number(stats?.waiting || 0),
      notified: Number(stats?.notified || 0),
      purchased: Number(stats?.purchased || 0),
      emailsSent: Number(stats?.emails_sent || 0),
    }),
    [entries.length, stats]
  );

  async function runAction(id, callback, successMessage) {
    try {
      setActionLoadingId(id);
      setError("");
      await callback();
      showToast(successMessage);
      await loadWaitlists();
    } catch (error) {
      const message = error.message || "Action failed.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  function handleSendOne(entry) {
    runAction(
      entry.id,
      () => sendProductWaitlistEmail(entry.id),
      "Back-in-stock email sent."
    );
  }

  function handleSendProduct(entry) {
    if (!window.confirm(`Send back-in-stock emails for ${entry.product_name}?`)) {
      return;
    }

    runAction(
      `product-${entry.product_id}`,
      () => sendProductWaitlistEmailsForProduct(entry.product_id),
      "Product waitlist email send finished."
    );
  }

  function handleCancel(entry) {
    if (!window.confirm(`Cancel waitlist entry for ${entry.email}?`)) return;

    runAction(
      entry.id,
      () => cancelProductWaitlist(entry.id),
      "Waitlist entry cancelled."
    );
  }

  function handleStatusChange(entry, nextStatus) {
    runAction(
      entry.id,
      () => updateProductWaitlistStatus(entry.id, nextStatus),
      "Waitlist status updated."
    );
  }

  return (
    <>
      <AdminTopbar
        title="Product waitlists"
        subtitle="Back-in-stock requests, Resend email alerts, and manual WhatsApp follow-up."
      />

      <section className="admin-content product-waitlist-admin">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-header">
          <div className="admin-search-row">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone, or product"
            />
          </div>

          <div className="admin-action-row">
            <select
              className="admin-mini-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="admin-mini-select"
              value={notified}
              onChange={(event) => setNotified(event.target.value)}
            >
              {notifiedOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="admin-mini-select"
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
              aria-label="Filter by product"
            >
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="admin-button secondary"
              onClick={loadWaitlists}
              disabled={isLoading}
            >
              <RefreshCw size={16} />
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="admin-grid">
          <div className="admin-card stat-card">
            <small>Total requests</small>
            <strong>{totals.total}</strong>
          </div>
          <div className="admin-card stat-card">
            <small>Waiting</small>
            <strong>{totals.waiting}</strong>
          </div>
          <div className="admin-card stat-card">
            <small>Notified</small>
            <strong>{totals.notified}</strong>
          </div>
          <div className="admin-card stat-card">
            <small>Purchased</small>
            <strong>{totals.purchased}</strong>
          </div>
          <div className="admin-card stat-card">
            <small>Emails sent</small>
            <strong>{totals.emailsSent}</strong>
          </div>
        </div>

        {stats?.topProducts?.length > 0 && (
          <div className="admin-card admin-table-card">
            <div className="admin-table-header">
              <h2>Most requested products</h2>
            </div>
            <div className="product-waitlist-demand">
              {stats.topProducts.map((product) => (
                <div key={product.product_id} className="product-waitlist-demand-item">
                  {product.product_image ? (
                    <img src={product.product_image} alt={product.product_name || "Product"} />
                  ) : (
                    <div className="admin-product-placeholder" />
                  )}
                  <div>
                    <strong>{product.product_name || "Product removed"}</strong>
                    <span>{product.waiting_count} waiting</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Waitlist entries</h2>
          </div>

          {isLoading ? (
            <div className="admin-empty">Loading product waitlists...</div>
          ) : entries.length === 0 ? (
            <div className="admin-empty">
              No product waitlist entries match the current filters.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table abandoned-cart-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Notification</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div className="admin-product-cell">
                          {entry.product_image ? (
                            <img
                              src={entry.product_image}
                              alt={entry.product_name || "Product"}
                            />
                          ) : (
                            <div className="admin-product-placeholder" />
                          )}

                          <div>
                            <strong>{entry.product_name || "Product removed"}</strong>
                            <small>
                              {formatNaira(entry.product_price)} - Stock:{" "}
                              {entry.product_stock_quantity ?? 0}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{getContactLabel(entry)}</strong>
                        <small>{entry.requested_size || "No size preference"}</small>
                      </td>
                      <td>
                        <strong>{entry.email}</strong>
                        <small>{entry.whatsapp_number || entry.phone || "No phone"}</small>
                      </td>
                      <td>
                        <select
                          className="admin-mini-select"
                          value={entry.status}
                          onChange={(event) =>
                            handleStatusChange(entry, event.target.value)
                          }
                          disabled={actionLoadingId === entry.id}
                        >
                          {statusOptions
                            .filter((option) => option.value !== "all")
                            .map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <span className="admin-badge">
                          {entry.notification_email_sent ? "Sent" : "Not sent"}
                        </span>
                        <small>{formatDate(entry.notification_email_sent_at)}</small>
                        {entry.last_notification_error && (
                          <small className="admin-error-text">
                            {entry.last_notification_error}
                          </small>
                        )}
                      </td>
                      <td>{formatDate(entry.created_at)}</td>
                      <td>
                        <div className="abandoned-cart-actions">
                          <button
                            type="button"
                            className="admin-button"
                            onClick={() => handleSendOne(entry)}
                            disabled={actionLoadingId === entry.id}
                          >
                            <Mail size={15} />
                            Send email
                          </button>

                          <button
                            type="button"
                            className="admin-button secondary"
                            onClick={() => handleSendProduct(entry)}
                            disabled={actionLoadingId === `product-${entry.product_id}`}
                          >
                            <Send size={15} />
                            Notify product
                          </button>

                          <a
                            className={
                              entry.whatsapp_link
                                ? "admin-button secondary"
                                : "admin-button secondary disabled"
                            }
                            href={entry.whatsapp_link || undefined}
                            target="_blank"
                            rel="noreferrer"
                            aria-disabled={!entry.whatsapp_link}
                            onClick={(event) => {
                              if (!entry.whatsapp_link) event.preventDefault();
                            }}
                          >
                            <MessageCircle size={15} />
                            WhatsApp
                          </a>

                          <button
                            type="button"
                            className="admin-button danger"
                            onClick={() => handleCancel(entry)}
                            disabled={entry.status === "cancelled"}
                          >
                            <XCircle size={15} />
                            Cancel
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
      </section>
    </>
  );
}
