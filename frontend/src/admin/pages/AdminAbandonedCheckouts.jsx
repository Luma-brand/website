import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, MessageCircle, RefreshCw } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { useToast } from "../../context/ToastContext";
import {
  getAbandonedCheckouts,
  markCheckoutWhatsappContacted,
  sendCheckoutRecoveryEmail,
} from "../../services/api";
import { formatNaira } from "../../utils/currency";

const statusOptions = [
  { label: "All active", value: "all" },
  { label: "Started", value: "started" },
  { label: "Not contacted", value: "not_contacted" },
  { label: "Email sent", value: "email_sent" },
  { label: "WhatsApp contacted", value: "whatsapp_contacted" },
  { label: "Recovered", value: "recovered" },
  { label: "Completed", value: "completed" },
];

function getCustomerLabel(checkout) {
  return (
    checkout.customer_name ||
    checkout.customer_email ||
    checkout.customer_phone ||
    "Guest customer"
  );
}

function formatStatus(value) {
  return String(value || "started").replaceAll("_", " ");
}

function getItemSummary(items = []) {
  if (!items.length) return "No items";

  return items
    .slice(0, 3)
    .map((item) => `${item.name || "Product"} x ${item.quantity || 1}`)
    .join(", ");
}

function isCompleted(checkout) {
  return (
    checkout.payment_status === "completed" ||
    checkout.recovery_status === "recovered" ||
    Boolean(checkout.completed_at)
  );
}

export function AdminAbandonedCheckouts() {
  const { showToast } = useToast();
  const [checkouts, setCheckouts] = useState([]);
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [status, setStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [error, setError] = useState("");

  const loadAbandonedCheckouts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAbandonedCheckouts({ status });
      setCheckouts(response.data?.checkouts || []);
      setDelayMinutes(response.data?.delayMinutes || 60);
    } catch (error) {
      setError(error.message || "Failed to load abandoned checkouts.");
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    queueMicrotask(() => {
      loadAbandonedCheckouts();
    });
  }, [loadAbandonedCheckouts]);

  const totals = useMemo(() => {
    return checkouts.reduce(
      (values, checkout) => ({
        count: values.count + 1,
        value: values.value + Number(checkout.total_amount || 0),
        ready: values.ready + (checkout.recovery_ready ? 1 : 0),
        completed: values.completed + (isCompleted(checkout) ? 1 : 0),
      }),
      { count: 0, value: 0, ready: 0, completed: 0 }
    );
  }, [checkouts]);

  async function handleSendRecoveryEmail(checkout) {
    try {
      setActionLoadingId(checkout.id);
      setError("");

      await sendCheckoutRecoveryEmail(checkout.id);
      showToast("Checkout recovery email sent.");
      await loadAbandonedCheckouts();
    } catch (error) {
      const message = error.message || "Failed to send checkout recovery email.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleMarkWhatsappContacted(checkout) {
    try {
      setActionLoadingId(checkout.id);
      setError("");

      await markCheckoutWhatsappContacted(checkout.id);
      showToast("Checkout WhatsApp follow-up marked.");
      await loadAbandonedCheckouts();
    } catch (error) {
      const message =
        error.message || "Failed to mark checkout WhatsApp follow-up.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  return (
    <>
      <AdminTopbar
        title="Abandoned checkouts"
        subtitle="Recover started checkouts that did not complete secure payment."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-header">
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

          <button
            type="button"
            className="admin-button secondary"
            onClick={loadAbandonedCheckouts}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="admin-grid">
          <div className="admin-card stat-card">
            <small>Started checkouts</small>
            <strong>{totals.count}</strong>
          </div>

          <div className="admin-card stat-card">
            <small>Checkout value</small>
            <strong>{formatNaira(totals.value)}</strong>
          </div>

          <div className="admin-card stat-card">
            <small>Ready for email</small>
            <strong>{totals.ready}</strong>
          </div>

          <div className="admin-card stat-card">
            <small>Email delay</small>
            <strong>{delayMinutes}m</strong>
          </div>
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Checkout recovery queue</h2>
          </div>

          {isLoading ? (
            <div className="admin-empty">Loading abandoned checkouts...</div>
          ) : checkouts.length === 0 ? (
            <div className="admin-empty">No abandoned checkouts found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table abandoned-cart-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Recovery</th>
                    <th>Started</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {checkouts.map((checkout) => {
                    const completed = isCompleted(checkout);

                    return (
                      <tr key={checkout.id}>
                        <td>
                          <strong>{getCustomerLabel(checkout)}</strong>
                          <small>
                            {checkout.customer_email || "No email yet"}
                          </small>
                        </td>
                        <td>{checkout.customer_phone || "-"}</td>
                        <td>
                          <span>{getItemSummary(checkout.cart_items)}</span>
                          <small>{checkout.item_count || 0} item(s)</small>
                        </td>
                        <td>{formatNaira(checkout.total_amount || 0)}</td>
                        <td>
                          <span className="admin-badge">
                            {formatStatus(checkout.payment_status)}
                          </span>
                        </td>
                        <td>
                          <span className="admin-badge">
                            {formatStatus(checkout.recovery_status)}
                          </span>
                        </td>
                        <td>
                          {checkout.started_at
                            ? new Date(checkout.started_at).toLocaleString()
                            : "-"}
                        </td>
                        <td>
                          <div className="abandoned-cart-actions">
                            <button
                              type="button"
                              className="admin-button secondary"
                              onClick={() => handleSendRecoveryEmail(checkout)}
                              disabled={
                                actionLoadingId === checkout.id ||
                                !checkout.customer_email ||
                                completed ||
                                checkout.recovery_status === "email_sent"
                              }
                            >
                              <Mail size={15} />
                              Email
                            </button>

                            <a
                              className={
                                checkout.whatsapp_link && !completed
                                  ? "admin-button secondary"
                                  : "admin-button secondary disabled"
                              }
                              href={
                                checkout.whatsapp_link && !completed
                                  ? checkout.whatsapp_link
                                  : undefined
                              }
                              target="_blank"
                              rel="noreferrer"
                              aria-disabled={!checkout.whatsapp_link || completed}
                              onClick={(event) => {
                                if (!checkout.whatsapp_link || completed) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <MessageCircle size={15} />
                              WhatsApp
                            </a>

                            <button
                              type="button"
                              className="admin-button"
                              onClick={() =>
                                handleMarkWhatsappContacted(checkout)
                              }
                              disabled={
                                actionLoadingId === checkout.id ||
                                !checkout.customer_phone ||
                                completed
                              }
                            >
                              Mark contacted
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
