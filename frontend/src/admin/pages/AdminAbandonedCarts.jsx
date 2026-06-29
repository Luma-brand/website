import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { useToast } from "../../context/ToastContext";
import {
  getEmailAutomationAbandonedCarts,
  getEmailAutomationLogs,
  getEmailAutomationOverview,
  getEmailAutomationRecentCartSyncs,
  markAbandonedCartWhatsappOpened,
  markAbandonedCartWhatsappContacted,
  runEmailAutomationAbandonedCartCheck,
  sendAbandonedCartRecoveryEmail,
} from "../../services/api";
import { formatNaira } from "../../utils/currency";

const tabs = [
  { label: "Overview", value: "overview" },
  { label: "Carts", value: "carts" },
  { label: "Email logs", value: "logs" },
  { label: "Settings", value: "settings" },
];

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Not contacted", value: "not_contacted" },
  { label: "Checkout started", value: "checkout_started" },
  { label: "Email sent", value: "email_sent" },
  { label: "WhatsApp contacted", value: "whatsapp_contacted" },
  { label: "Recovered", value: "recovered" },
];

function formatStatus(status) {
  return String(status || "not_contacted").replaceAll("_", " ");
}

function getCartValue(cart) {
  return Number(cart.cart_value || cart.total_value || cart.cart_total || 0);
}

function getItemCount(cart) {
  if (Number.isFinite(Number(cart.item_count))) return Number(cart.item_count || 0);
  const items = Array.isArray(cart.cart_items) ? cart.cart_items : [];
  return items.reduce((total, item) => total + Number(item.quantity || 1), 0);
}

function getCustomerName(cart) {
  return cart.customer_name || cart.name || "Guest customer";
}

function getCustomerEmail(cart) {
  return cart.customer_email || cart.email || "No email captured";
}

function getReminderCount(cart) {
  return Number(cart.recovery_email_count || cart.recovery_email_attempts || 0);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function getLogType(log) {
  return String(log.type || log.email_type || "email").replaceAll("_", " ");
}

function StatCard({ label, value, icon: Icon, helper }) {
  return (
    <div className="admin-card stat-card">
      <small>{label}</small>
      <strong>{value}</strong>
      {helper && <span className="admin-muted">{helper}</span>}
      {Icon && <Icon size={20} />}
    </div>
  );
}

export function AdminAbandonedCarts() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState(null);
  const [carts, setCarts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [recentSyncs, setRecentSyncs] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [status, setStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [error, setError] = useState("");

  const loadPage = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [overviewResponse, cartsResponse, logsResponse, debugResponse] = await Promise.all([
        getEmailAutomationOverview(),
        getEmailAutomationAbandonedCarts({ status }),
        getEmailAutomationLogs({ limit: 75 }),
        getEmailAutomationRecentCartSyncs().catch(() => ({ data: { carts: [] } })),
      ]);

      setOverview(overviewResponse.data || null);
      setCarts(cartsResponse.data?.carts || []);
      setLogs(logsResponse.data?.logs || []);
      setRecentSyncs(debugResponse.data?.carts || []);
    } catch (error) {
      setError(error.message || "Failed to load abandoned cart recovery data.");
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadPage();
    });
  }, [loadPage]);

  const stats = useMemo(() => {
    const overviewCarts = overview?.abandonedCarts || {};
    const overviewLogs = overview?.emailLogs || {};
    const recoveredCarts = carts.filter((cart) => cart.recovery_status === "recovered" || cart.status === "recovered");
    const totalCarts = Number(overviewCarts.total || carts.length || 0);
    const recoveredCount = Number(overviewCarts.recovered || recoveredCarts.length || 0);
    const recoveredRevenue = recoveredCarts.reduce((sum, cart) => sum + getCartValue(cart), 0);
    const pendingCount = carts.filter((cart) => ["not_contacted", "checkout_started"].includes(cart.recovery_status || cart.status)).length;
    const recoveryRate = totalCarts > 0 ? Math.round((recoveredCount / totalCarts) * 100) : 0;

    return {
      totalCarts,
      abandonedValue: Number(overviewCarts.estimatedValue || carts.reduce((sum, cart) => sum + getCartValue(cart), 0)),
      recoveryEmailsSent: Number(overviewLogs.sent || 0),
      failedEmails: Number(overviewLogs.failed || 0),
      recoveredCount,
      recoveredRevenue,
      recoveryRate,
      pendingCount: Number(overviewCarts.readyForEmail || pendingCount || 0),
    };
  }, [carts, overview]);

  async function handleRunCheck() {
    try {
      setActionLoadingId("run-check");
      setError("");
      const response = await runEmailAutomationAbandonedCartCheck();
      const sent = response.data?.sent || 0;
      const processed = response.data?.processed || 0;
      showToast(`Abandoned cart check complete. ${sent} of ${processed} email(s) sent.`);
      await loadPage();
    } catch (error) {
      const message = error.message || "Failed to run abandoned cart check.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleSendRecoveryEmail(cart) {
    try {
      setActionLoadingId(cart.id);
      setError("");
      await sendAbandonedCartRecoveryEmail(cart.id);
      showToast("Recovery email sent.");
      await loadPage();
    } catch (error) {
      const message = error.message || "Failed to send recovery email.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleMarkWhatsappContacted(cart) {
    try {
      setActionLoadingId(cart.id);
      setError("");
      await markAbandonedCartWhatsappContacted(cart.id);
      showToast("WhatsApp follow-up marked.");
      await loadPage();
    } catch (error) {
      const message = error.message || "Failed to mark WhatsApp follow-up.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  function handleOpenWhatsapp(event, cart) {
    if (!cart.whatsapp_link) {
      event.preventDefault();
      return;
    }

    void markAbandonedCartWhatsappOpened(cart.id).catch(() => {});
  }

  return (
    <>
      <AdminTopbar
        title="Abandoned carts"
        subtitle="Recover saved carts with Resend reminders and manual WhatsApp follow-up."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-header">
          <div className="admin-tabs" role="tablist" aria-label="Abandoned cart sections">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={activeTab === tab.value ? "active" : ""}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button type="button" className="admin-button secondary" onClick={loadPage} disabled={isLoading}>
            <RefreshCw size={16} />
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>

          <button type="button" className="admin-button" onClick={handleRunCheck} disabled={actionLoadingId === "run-check"}>
            <Send size={16} />
            {actionLoadingId === "run-check" ? "Running..." : "Run abandoned cart check"}
          </button>
        </div>

        {activeTab === "overview" && (
          <>
            <div className="admin-grid">
              <StatCard label="Total abandoned carts" value={stats.totalCarts} icon={ShoppingCart} />
              <StatCard label="Abandoned cart value" value={formatNaira(stats.abandonedValue)} icon={TrendingUp} />
              <StatCard label="Recovery emails sent" value={stats.recoveryEmailsSent} icon={Mail} />
              <StatCard label="Failed emails" value={stats.failedEmails} icon={AlertCircle} />
              <StatCard label="Recovered carts" value={stats.recoveredCount} icon={CheckCircle2} />
              <StatCard label="Recovered revenue" value={formatNaira(stats.recoveredRevenue)} icon={TrendingUp} />
              <StatCard label="Recovery rate" value={`${stats.recoveryRate}%`} icon={CheckCircle2} />
              <StatCard label="Pending carts" value={stats.pendingCount} icon={ShoppingCart} />
            </div>

            <div className="admin-grid two-column-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Recovery settings</h2>
                </div>
                <div className="admin-detail-grid">
                  <span>Reminder delay</span>
                  <strong>{overview?.settings?.delayMinutes || 0} minutes</strong>
                  <span>Maximum reminders</span>
                  <strong>{overview?.settings?.maxEmails || 0}</strong>
                  <span>Resend status</span>
                  <strong>{overview?.emailConfig?.resendConfigured ? "Configured" : "Needs API key"}</strong>
                  <span>Sender status</span>
                  <strong>{overview?.emailConfig?.emailFromConfigured ? "Configured" : "Needs sender"}</strong>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Recent sync health</h2>
                </div>
                {recentSyncs.length === 0 ? (
                  <div className="admin-empty">No recent cart sync records yet.</div>
                ) : (
                  <div className="admin-detail-grid">
                    <span>Latest customer email</span>
                    <strong>{recentSyncs[0]?.customer_email || "Not captured"}</strong>
                    <span>Latest cart value</span>
                    <strong>{formatNaira(recentSyncs[0]?.cart_value || 0)}</strong>
                    <span>Latest item count</span>
                    <strong>{recentSyncs[0]?.item_count || 0}</strong>
                    <span>Latest status</span>
                    <strong>{formatStatus(recentSyncs[0]?.status)}</strong>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === "carts" && (
          <div className="admin-card admin-table-card">
            <div className="admin-table-header">
              <h2>Abandoned cart records</h2>
              <select className="admin-mini-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {isLoading ? (
              <div className="admin-empty">Loading abandoned carts...</div>
            ) : carts.length === 0 ? (
              <div className="admin-empty">No abandoned carts found.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table abandoned-cart-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Cart value</th>
                      <th>Items</th>
                      <th>Status</th>
                      <th>Last activity</th>
                      <th>Created</th>
                      <th>Reminder</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carts.map((cart) => (
                      <tr key={cart.id}>
                        <td>
                          <strong>{getCustomerEmail(cart)}</strong>
                          <small>{getCustomerName(cart)}</small>
                        </td>
                        <td>{formatNaira(getCartValue(cart))}</td>
                        <td>{getItemCount(cart)}</td>
                        <td><span className="admin-badge">{formatStatus(cart.recovery_status || cart.status)}</span></td>
                        <td>{formatDate(cart.last_activity_at)}</td>
                        <td>{formatDate(cart.created_at)}</td>
                        <td>
                          <span>{getReminderCount(cart)} sent</span>
                          <small>{cart.recovery_email_sent_at ? formatDate(cart.recovery_email_sent_at) : "No reminder yet"}</small>
                        </td>
                        <td>
                          <div className="abandoned-cart-actions">
                            <button
                              type="button"
                              className="admin-button secondary"
                              onClick={() => handleSendRecoveryEmail(cart)}
                              disabled={actionLoadingId === cart.id || !cart.customer_email || cart.recovery_status === "recovered"}
                            >
                              <Mail size={15} /> Email
                            </button>
                            <a
                              className={cart.whatsapp_link ? "admin-button secondary" : "admin-button secondary disabled"}
                              href={cart.whatsapp_link || undefined}
                              target="_blank"
                              rel="noreferrer"
                              aria-disabled={!cart.whatsapp_link}
                              onClick={(event) => handleOpenWhatsapp(event, cart)}
                            >
                              <MessageCircle size={15} /> WhatsApp
                            </a>
                            <button
                              type="button"
                              className="admin-button"
                              onClick={() => handleMarkWhatsappContacted(cart)}
                              disabled={actionLoadingId === cart.id || !cart.customer_phone || cart.recovery_status === "recovered"}
                            >
                              Mark contacted
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
        )}

        {activeTab === "logs" && (
          <div className="admin-card admin-table-card">
            <div className="admin-table-header">
              <h2>Recovery email logs</h2>
            </div>
            {isLoading ? (
              <div className="admin-empty">Loading recovery email logs...</div>
            ) : logs.length === 0 ? (
              <div className="admin-empty">No recovery email logs have been recorded yet.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Email type</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th>Sent date</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.recipient || log.recipient_email || "-"}</td>
                        <td>{getLogType(log)}</td>
                        <td>{log.subject || "-"}</td>
                        <td><span className="admin-badge">{log.status || "unknown"}</span></td>
                        <td>{formatDate(log.sent_at || log.created_at)}</td>
                        <td>{log.error_message || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="admin-card">
            <div className="admin-table-header">
              <h2>Settings and diagnostics</h2>
            </div>
            <div className="admin-detail-grid">
              <span>Cron endpoint</span>
              <strong>{overview?.settings?.cronEndpoint || "Set BACKEND_URL"}</strong>
              <span>Cron health endpoint</span>
              <strong>{overview?.settings?.cronHealthEndpoint || "Set BACKEND_URL"}</strong>
              <span>Resend webhook endpoint</span>
              <strong>{overview?.settings?.resendWebhookEndpoint || "Set BACKEND_URL"}</strong>
              <span>Webhook secret</span>
              <strong>{overview?.settings?.resendWebhookSecretConfigured ? "Configured" : "Optional"}</strong>
              <span>Recent sync records</span>
              <strong>{recentSyncs.length}</strong>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
