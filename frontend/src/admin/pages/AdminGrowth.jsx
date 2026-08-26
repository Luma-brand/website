import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminTopbar } from "../components/AdminTopbar";
import { StatCard } from "../components/StatCard";
import {
  getAutomationStatus,
  getGrowthOverview,
  getIntegrationStatus,
  triggerAutomationFlow,
} from "../../services/api";
import { formatNaira } from "../../utils/currency";

const nativeFeatureGroups = [
  {
    title: "Recovery & retention",
    features: [
      { label: "Abandoned cart recovery", detail: "Email + tracked WhatsApp follow-up", path: "/luma-control-room/abandoned-carts", status: "Live" },
      { label: "Checkout abandonment", detail: "Track checkout starts and recover unfinished checkouts", path: "/luma-control-room/abandoned-checkouts", status: "Live" },
      { label: "Browse abandonment", detail: "Product views are tracked and converted when shoppers buy", path: "/luma-control-room/growth", status: "Live" },
      { label: "Back-in-stock & waitlists", detail: "Collect demand and notify shoppers when stock returns", path: "/luma-control-room/product-waitlists", status: "Live" },
      { label: "Storefront promotion + exit intent", detail: "Admin-selected discount popup with schedule, eligibility, and frequency controls", path: "/luma-control-room/discounts", status: "Live" },
    ],
  },
  {
    title: "Customer intelligence",
    features: [
      { label: "Customer profiles", detail: "Purchase history, LTV, AOV and repeat behaviour", path: "/luma-control-room/customers", status: "Live" },
      { label: "Segments & tags", detail: "Filter, tag, segment and export customer lists", path: "/luma-control-room/customers", status: "Live" },
      { label: "Sales analytics", detail: "Conversion, acquisition, returning customers and best sellers", path: "/luma-control-room/analytics", status: "Live" },
    ],
  },
  {
    title: "Merchandising & operations",
    features: [
      { label: "Recommendations & cross-sells", detail: "Frequently bought together, related products and upsells", path: "/luma-control-room/product-sales", status: "Live" },
      { label: "Discounts & free shipping", detail: "Codes, usage rules, expiry and free-shipping threshold", path: "/luma-control-room/discounts", status: "Live" },
      { label: "Inventory intelligence", detail: "Low-stock alerts, forecast, bulk updates and purchase orders", path: "/luma-control-room/inventory", status: "Live" },
      { label: "SEO foundation", detail: "Editable product SEO, schema and generated XML sitemap", path: "/luma-control-room/products", status: "Live" },
    ],
  },
  {
    title: "Lifecycle automation",
    features: [
      { label: "Automated customer journeys", detail: "Welcome, post-purchase, review, reorder and win-back flows", path: "/luma-control-room/automations", status: "Live" },
      { label: "Email broadcasts", detail: "Branded campaigns and recipient tracking", path: "/luma-control-room/email-broadcasts", status: "Live" },
      { label: "Meta / TikTok / GA4", detail: "Ready to wire when their IDs are supplied", path: "/luma-control-room/settings", status: "External setup" },
      { label: "Automatic WhatsApp delivery", detail: "Needs an approved WhatsApp provider/API and templates", path: "/luma-control-room/settings", status: "External setup" },
    ],
  },
];

function getReadinessStatus(item) {
  const status = String(item?.status || "").toLowerCase();
  const requirements = Array.isArray(item?.requirements) ? item.requirements : [];

  if (["configured", "ready", "enabled", "active"].includes(status)) {
    return { label: status === "configured" ? "Configured" : "Ready", tone: "success" };
  }

  if (["partial", "partially_configured"].includes(status)) {
    return { label: "Partially configured", tone: "warning" };
  }

  const requirementText = requirements.join(" ").toLowerCase();
  if (requirementText.includes("api") || requirementText.includes("key")) {
    return { label: "Missing API key", tone: "warning" };
  }
  if (requirementText.includes("template")) {
    return { label: "Missing template", tone: "warning" };
  }
  if (requirementText.includes("cron")) {
    return { label: "Missing cron", tone: "warning" };
  }
  if (["disabled", "inactive"].includes(status)) {
    return { label: "Disabled", tone: "warning" };
  }

  return { label: "Needs verification", tone: "warning" };
}

export function AdminGrowth() {
  const [growth, setGrowth] = useState(null);
  const [automation, setAutomation] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [triggeringFlow, setTriggeringFlow] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadGrowthTools = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [growthResponse, automationResponse, integrationResponse] =
        await Promise.all([
          getGrowthOverview(),
          getAutomationStatus(),
          getIntegrationStatus(),
        ]);

      setGrowth(growthResponse.data || null);
      setAutomation(automationResponse.data || null);
      setIntegrations(integrationResponse.data || null);
    } catch (error) {
      setError(error.message || "Failed to load growth tools.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTriggerAutomation = async (flow) => {
    try {
      setTriggeringFlow(flow.eventType);
      setError("");
      setSuccessMessage("");

      const response = await triggerAutomationFlow(flow.eventType, {
        limit: 25,
      });
      const data = response.data || {};
      const processed = data.processed ?? data.result?.processed ?? 0;
      const sent = data.sent === true ? 1 : Number(data.sent || 0);

      await loadGrowthTools();
      setSuccessMessage(
        `${flow.label || flow.eventType} processed. Sent ${sent}${
          processed ? ` of ${processed}` : ""
        }.`
      );
    } catch (error) {
      setError(error.message || "Failed to trigger automation flow.");
    } finally {
      setTriggeringFlow("");
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadGrowthTools();
    });
  }, [loadGrowthTools]);

  const summary = growth?.summary || {};
  const recentAbandonedCarts = growth?.recentAbandonedCarts || [];
  const recentBackInStockRequests = growth?.recentBackInStockRequests || [];
  const automationRows = automation?.automations || [];
  const integrationRows = integrations?.integrations || [];
  const runnableFlows = new Set([
    "post_purchase_followup",
    "review_request",
    "reorder_reminder",
    "winback_email",
    "abandoned_cart_recovery",
    "checkout_recovery",
    "back_in_stock_alert",
  ]);

  return (
    <>
      <AdminTopbar
        title="Growth tools"
        subtitle="LUMA's native commerce growth, automation, retention, and integration hub."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}
        {successMessage && <div className="admin-success">{successMessage}</div>}

        <div className="admin-table-header">
          <div>
            <p className="admin-muted" style={{ margin: 0 }}>
              Native features stay inside LUMA. External services are only required where the provider owns the channel.
            </p>
          </div>
          <button
            type="button"
            className="admin-button secondary"
            onClick={loadGrowthTools}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh growth tools"}
          </button>
        </div>

        <div className="admin-grid">
          <StatCard label="Abandoned carts" value={summary.abandonedCarts || 0} />
          <StatCard label="Abandoned cart value" value={formatNaira(summary.abandonedCartValue || 0)} />
          <StatCard label="Checkout starts" value={summary.checkoutStarts || 0} />
          <StatCard label="Product views" value={summary.productViews || 0} />
          <StatCard label="Back-in-stock requests" value={summary.backInStockRequests || 0} />
          <StatCard label="Ready to notify" value={summary.backInStockReady || 0} />
        </div>

        <div className="admin-card" style={{ marginTop: 24 }}>
          <div className="admin-table-header">
            <div>
              <p className="eyebrow" style={{ marginBottom: 6 }}>LUMA commerce stack</p>
              <h2 style={{ margin: 0 }}>What is built into the store now</h2>
            </div>
          </div>

          <div className="admin-section-grid" style={{ marginTop: 18 }}>
            {nativeFeatureGroups.map((group) => (
              <div className="admin-card" key={group.title} style={{ boxShadow: "none" }}>
                <div className="admin-table-header">
                  <h3 style={{ margin: 0 }}>{group.title}</h3>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {group.features.map((feature) => (
                    <Link
                      to={feature.path}
                      key={`${group.title}-${feature.label}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 12,
                        alignItems: "center",
                        padding: "13px 14px",
                        border: "1px solid var(--admin-border, rgba(22,22,22,.1))",
                        borderRadius: 14,
                        color: "inherit",
                        textDecoration: "none",
                      }}
                    >
                      <span>
                        <strong style={{ display: "block" }}>{feature.label}</strong>
                        <small className="admin-muted">{feature.detail}</small>
                      </span>
                      <span className={`admin-badge ${feature.status === "Live" ? "success" : "warning"}`}>
                        {feature.status}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="admin-card admin-table-card">Loading live growth data...</div>
        ) : (
          <>
            <div className="admin-section-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Integration readiness</h2>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Integration</th>
                        <th>Status</th>
                        <th>Needed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrationRows.map((item) => {
                        const readiness = getReadinessStatus(item);
                        return (
                          <tr key={item.key}>
                            <td><strong>{item.label}</strong></td>
                            <td><span className={`admin-badge ${readiness.tone}`}>{readiness.label}</span></td>
                            <td>{item.requirements?.length ? item.requirements.join(", ") : "Built into LUMA"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Automation status</h2>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Flow</th>
                        <th>Status</th>
                        <th>Pending</th>
                        <th>Sent</th>
                        <th>Failed</th>
                        <th>Manual trigger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {automationRows.map((item) => (
                        <tr key={item.eventType}>
                          <td>
                            <strong>{item.label || item.eventType.replaceAll("_", " ")}</strong>
                            <small>{item.triggerMode?.replaceAll("_", " ")}</small>
                          </td>
                          <td>
                            <span className="admin-badge">
                              {item.status?.replaceAll("_", " ") || "Needs verification"}
                            </span>
                          </td>
                          <td>{item.pending}</td>
                          <td>{item.sent}</td>
                          <td>{item.failed}</td>
                          <td>
                            {runnableFlows.has(item.eventType) ? (
                              <button
                                type="button"
                                className="admin-button secondary"
                                onClick={() => handleTriggerAutomation(item)}
                                disabled={triggeringFlow === item.eventType || !item.configured}
                              >
                                {triggeringFlow === item.eventType ? "Running..." : "Run due"}
                              </button>
                            ) : (
                              <span className="admin-muted">Automatic</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="admin-section-grid">
              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Recent abandoned carts</h2>
                </div>

                {recentAbandonedCarts.length === 0 ? (
                  <div className="admin-empty">No abandoned carts yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Value</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentAbandonedCarts.map((cart) => (
                          <tr key={cart.id}>
                            <td>{cart.customer_email || cart.customer_phone || "Guest"}</td>
                            <td>{formatNaira(cart.total_value || 0)}</td>
                            <td>{cart.recovery_status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-table-header">
                  <h2>Back-in-stock requests</h2>
                </div>

                {recentBackInStockRequests.length === 0 ? (
                  <div className="admin-empty">No back-in-stock requests yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Customer</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBackInStockRequests.map((request) => (
                          <tr key={request.id}>
                            <td>{request.product_name || "Product"}</td>
                            <td>{request.customer_email || request.customer_phone || "Guest"}</td>
                            <td>{request.status}</td>
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
