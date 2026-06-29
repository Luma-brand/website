import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Pause, Play, Plus, RefreshCw, ShieldOff, Trash2, Workflow } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { StatCard } from "../components/StatCard";
import { useToast } from "../../context/ToastContext";
import {
  addAdminAutomationSuppression,
  createAdminAutomation,
  deleteAdminAutomation,
  disableAdminAutomation,
  enableAdminAutomation,
  getAdminBrowseAbandonments,
  getAdminBrowseAbandonmentOverview,
  getAdminAutomationLogs,
  getAdminAutomationTriggerEvents,
  getAdminAutomationSuppressionList,
  getAdminAutomations,
  runAdminBrowseAbandonmentCheck,
  runDueAdminAutomations,
  sendAdminBrowseAbandonmentEmail,
  updateAdminAutomation,
} from "../../services/api";

const triggerOptions = [
  { value: "customer_signup", label: "Customer signup" },
  { value: "order_completed", label: "Order completed" },
  { value: "product_viewed", label: "Product viewed" },
  { value: "cart_abandoned", label: "Cart abandoned" },
  { value: "checkout_started", label: "Checkout started" },
  { value: "checkout_abandoned", label: "Checkout abandoned" },
  { value: "product_back_in_stock", label: "Product back in stock" },
  { value: "customer_inactive", label: "Customer inactive" },
  { value: "low_stock_product", label: "Low stock product" },
];

const emptyForm = {
  id: "",
  name: "",
  type: "welcome_series",
  triggerEvent: "customer_signup",
  description: "",
  delayAmount: 0,
  delayUnit: "minutes",
  maxSends: 1,
  status: "draft",
  subject: "",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function getStatusClass(status) {
  if (status === "active" || status === "sent") return "admin-badge success";
  if (status === "failed" || status === "cancelled") return "admin-badge danger";
  if (status === "paused") return "admin-badge warning";
  return "admin-badge";
}

function getTriggerLabel(value) {
  return triggerOptions.find((option) => option.value === value)?.label || value || "-";
}

export function AdminAutomations() {
  const { showToast } = useToast();
  const [flows, setFlows] = useState([]);
  const [logs, setLogs] = useState([]);
  const [triggerEvents, setTriggerEvents] = useState([]);
  const [browseAbandonments, setBrowseAbandonments] = useState([]);
  const [browseOverview, setBrowseOverview] = useState(null);
  const [suppressionList, setSuppressionList] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [suppressionEmail, setSuppressionEmail] = useState("");
  const [suppressionReason, setSuppressionReason] = useState("manual_admin");
  const [activeTab, setActiveTab] = useState("flows");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningBrowse, setIsRunningBrowse] = useState(false);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const active = flows.filter((flow) => flow.status === "active" || flow.isActive).length;
    const paused = flows.filter((flow) => flow.status === "paused").length;
    const draft = flows.filter((flow) => flow.status === "draft").length;
    const sent = logs.filter((log) => log.status === "sent").length;
    const failed = logs.filter((log) => log.status === "failed").length;
    return { active, paused, draft, sent, failed };
  }, [flows, logs]);

  const loadAutomations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const [
        flowsResponse,
        logsResponse,
        triggerEventsResponse,
        browseResponse,
        browseOverviewResponse,
        suppressionResponse,
      ] = await Promise.all([
        getAdminAutomations(),
        getAdminAutomationLogs({ limit: 25 }),
        getAdminAutomationTriggerEvents({ limit: 50 }),
        getAdminBrowseAbandonments({ limit: 100 }),
        getAdminBrowseAbandonmentOverview(),
        getAdminAutomationSuppressionList(),
      ]);
      setFlows(flowsResponse.data || []);
      setLogs(logsResponse.data || []);
      setTriggerEvents(triggerEventsResponse.data || []);
      setBrowseAbandonments(browseResponse.data?.abandonments || []);
      setBrowseOverview(browseOverviewResponse.data || browseResponse.data || null);
      setSuppressionList(suppressionResponse.data || []);
    } catch (error) {
      setError(error.message || "Failed to load automation flows.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(loadAutomations);
  }, [loadAutomations]);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function editFlow(flow) {
    setFormData({
      id: flow.id,
      name: flow.name || "",
      type: flow.type || flow.flowKey || "welcome_series",
      triggerEvent: flow.triggerEvent || flow.trigger_event || "customer_signup",
      description: flow.description || "",
      delayAmount: flow.delayAmount ?? flow.delay_amount ?? 0,
      delayUnit: flow.delayUnit || flow.delay_unit || "minutes",
      maxSends: flow.maxSends ?? flow.max_sends ?? 1,
      status: flow.status || "draft",
      subject: "",
    });
    setActiveTab("flows");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError("");
      const payload = {
        ...formData,
        delayAmount: Number(formData.delayAmount || 0),
        maxSends: Number(formData.maxSends || 1),
      };
      if (formData.id) {
        await updateAdminAutomation(formData.id, payload);
        showToast?.("Automation flow updated.", "success");
      } else {
        await createAdminAutomation(payload);
        showToast?.("Automation flow created as a draft.", "success");
      }
      setFormData(emptyForm);
      await loadAutomations();
    } catch (error) {
      setError(error.message || "Failed to save automation flow.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleFlow(flow) {
    try {
      if (flow.status === "active" || flow.isActive) {
        await disableAdminAutomation(flow.id);
        showToast?.("Automation flow paused.", "success");
      } else {
        await enableAdminAutomation(flow.id);
        showToast?.("Automation flow enabled.", "success");
      }
      await loadAutomations();
    } catch (error) {
      setError(error.message || "Failed to update automation status.");
    }
  }

  async function removeFlow(flow) {
    if (!window.confirm(`Delete ${flow.name}?`)) return;
    try {
      await deleteAdminAutomation(flow.id);
      showToast?.("Automation flow deleted.", "success");
      await loadAutomations();
    } catch (error) {
      setError(error.message || "Failed to delete automation flow.");
    }
  }

  async function runDueSteps() {
    try {
      setIsRunning(true);
      const response = await runDueAdminAutomations({ limit: 25 });
      const data = response.data || {};
      showToast?.(`Processed ${data.processed || 0}. Sent ${data.sent || 0}.`, "success");
      await loadAutomations();
    } catch (error) {
      setError(error.message || "Failed to run due automation steps.");
    } finally {
      setIsRunning(false);
    }
  }

  async function runBrowseAbandonmentCheck() {
    try {
      setIsRunningBrowse(true);
      const response = await runAdminBrowseAbandonmentCheck({ limit: 25 });
      const data = response.data || {};
      showToast?.(`Processed ${data.processed || 0}. Sent ${data.sent || 0}.`, "success");
      await loadAutomations();
    } catch (error) {
      setError(error.message || "Failed to run browse abandonment check.");
    } finally {
      setIsRunningBrowse(false);
    }
  }

  async function sendBrowseEmail(record) {
    try {
      await sendAdminBrowseAbandonmentEmail(record.id);
      showToast?.("Browse abandonment email sent.", "success");
      await loadAutomations();
    } catch (error) {
      setError(error.message || "Failed to send browse abandonment email.");
    }
  }

  async function addSuppression(event) {
    event.preventDefault();
    try {
      await addAdminAutomationSuppression({ email: suppressionEmail, reason: suppressionReason });
      setSuppressionEmail("");
      showToast?.("Email added to suppression list.", "success");
      await loadAutomations();
    } catch (error) {
      setError(error.message || "Failed to update suppression list.");
    }
  }

  return (
    <>
      <AdminTopbar
        title="Automations"
        subtitle="Internal customer journey flows powered by LUMA data and Resend."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-header">
          <div className="admin-tabs" role="tablist" aria-label="Automation sections">
            {[
              ["flows", "Flows"],
              ["browse", "Browse Abandonment"],
              ["triggers", "Trigger events"],
              ["logs", "Email logs"],
              ["suppression", "Suppression"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`admin-tab ${activeTab === value ? "active" : ""}`}
                onClick={() => setActiveTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="admin-actions-row">
            <button type="button" className="admin-button secondary" onClick={loadAutomations} disabled={isLoading}>
              <RefreshCw size={16} /> {isLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" className="admin-button" onClick={runDueSteps} disabled={isRunning}>
              <Mail size={16} /> {isRunning ? "Running..." : "Run due steps"}
            </button>
          </div>
        </div>

        <div className="admin-grid">
          <StatCard label="Active flows" value={stats.active} icon={Play} />
          <StatCard label="Paused flows" value={stats.paused} icon={Pause} />
          <StatCard label="Draft flows" value={stats.draft} icon={Workflow} />
          <StatCard label="Sent logs" value={stats.sent} icon={Mail} />
          <StatCard label="Failed logs" value={stats.failed} icon={ShieldOff} />
        </div>

        {activeTab === "flows" && (
          <div className="admin-split-grid">
            <form className="admin-card admin-form" onSubmit={handleSubmit}>
              <div className="admin-card-header">
                <div>
                  <h3>{formData.id ? "Edit flow" : "Create flow"}</h3>
                  <p>Flows stay inactive unless you explicitly enable them.</p>
                </div>
                <Plus size={18} />
              </div>

              <label>
                Flow name
                <input name="name" value={formData.name} onChange={handleFieldChange} placeholder="Welcome Series" required />
              </label>
              <label>
                Flow type
                <input name="type" value={formData.type} onChange={handleFieldChange} placeholder="welcome_series" required />
              </label>
              <label>
                Trigger
                <select name="triggerEvent" value={formData.triggerEvent} onChange={handleFieldChange} required>
                  {triggerOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <textarea name="description" value={formData.description} onChange={handleFieldChange} rows={3} placeholder="Describe when this journey should run." />
              </label>
              <div className="admin-form-grid two">
                <label>
                  Delay amount
                  <input name="delayAmount" type="number" min="0" value={formData.delayAmount} onChange={handleFieldChange} />
                </label>
                <label>
                  Delay unit
                  <select name="delayUnit" value={formData.delayUnit} onChange={handleFieldChange}>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </label>
              </div>
              <div className="admin-form-grid two">
                <label>
                  Max sends
                  <input name="maxSends" type="number" min="1" value={formData.maxSends} onChange={handleFieldChange} />
                </label>
                <label>
                  Status
                  <select name="status" value={formData.status} onChange={handleFieldChange}>
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                    <option value="active">Active</option>
                  </select>
                </label>
              </div>
              <label>
                First email subject
                <input name="subject" value={formData.subject} onChange={handleFieldChange} placeholder="A warm LUMA note" />
              </label>
              <div className="admin-actions-row">
                <button type="submit" className="admin-button" disabled={isSaving}>{isSaving ? "Saving..." : formData.id ? "Save flow" : "Create draft"}</button>
                {formData.id && <button type="button" className="admin-button secondary" onClick={() => setFormData(emptyForm)}>Cancel</button>}
              </div>
            </form>

            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h3>Journey flows</h3>
                  <p>Enable a flow only after its copy and timing are approved.</p>
                </div>
              </div>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Trigger</th>
                      <th>Status</th>
                      <th>Sent</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flows.map((flow) => (
                      <tr key={flow.id}>
                        <td>
                          <strong>{flow.name}</strong>
                          <span>{flow.description || flow.type}</span>
                        </td>
                        <td>{getTriggerLabel(flow.triggerEvent || flow.trigger_event)}</td>
                        <td><span className={getStatusClass(flow.status)}>{flow.status}</span></td>
                        <td>{flow.sent || 0}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button type="button" className="admin-icon-button" onClick={() => editFlow(flow)}>Edit</button>
                            <button type="button" className="admin-icon-button" onClick={() => toggleFlow(flow)}>{flow.status === "active" || flow.isActive ? "Pause" : "Enable"}</button>
                            <button type="button" className="admin-icon-button danger" onClick={() => removeFlow(flow)}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!flows.length && !isLoading && (
                      <tr><td colSpan="5">No automation flows are available yet. Run migration 028, then refresh this page.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "triggers" && (
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3>Recent store triggers</h3>
                <p>Real store events and the automation enrollments they created.</p>
              </div>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr><th>Trigger</th><th>Customer</th><th>Flow</th><th>Context</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {triggerEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{getTriggerLabel(event.trigger_event)}</td>
                      <td>{event.customer_email || event.customer_id || "-"}</td>
                      <td>{event.flow_names?.join(", ") || "No active flow"}</td>
                      <td>{event.order_id ? `Order ${event.order_id.slice(0, 8)}` : event.product_id ? `Product ${event.product_id.slice(0, 8)}` : event.session_id ? `Session ${event.session_id.slice(0, 8)}` : "-"}</td>
                      <td><span className={getStatusClass(event.status)}>{event.status}</span></td>
                      <td>{formatDate(event.created_at)}</td>
                    </tr>
                  ))}
                  {!triggerEvents.length && !isLoading && <tr><td colSpan="6">No store automation triggers have been recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === "browse" && (
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3>Browse abandonment</h3>
                <p>Recently viewed product follow-ups are sent by the internal LUMA runner.</p>
              </div>
              <button type="button" className="admin-button" onClick={runBrowseAbandonmentCheck} disabled={isRunningBrowse}>
                <Mail size={16} /> {isRunningBrowse ? "Running..." : "Run check"}
              </button>
            </div>

            <div className="admin-grid">
              <StatCard label="Pending" value={browseOverview?.summary?.pending || 0} icon={RefreshCw} />
              <StatCard label="Due now" value={browseOverview?.summary?.due || 0} icon={Mail} />
              <StatCard label="Emailed" value={browseOverview?.summary?.emailed || 0} icon={Mail} />
              <StatCard label="Converted" value={browseOverview?.summary?.converted || 0} icon={Play} />
            </div>

            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Session</th>
                    <th>Viewed</th>
                    <th>Eligible</th>
                    <th>Status</th>
                    <th>Emails</th>
                    <th>Converted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {browseAbandonments.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.product_name || "LUMA product"}</strong>
                        <span>{record.product_id ? record.product_id.slice(0, 8) : "-"}</span>
                      </td>
                      <td>{record.customer_email || "-"}</td>
                      <td>{record.session_id ? record.session_id.slice(0, 12) : "-"}</td>
                      <td>{formatDate(record.viewed_at)}</td>
                      <td>{formatDate(record.eligible_at)}</td>
                      <td><span className={getStatusClass(record.status)}>{record.status}</span></td>
                      <td>{record.email_count || 0}</td>
                      <td>{formatDate(record.converted_at)}</td>
                      <td>
                        {record.recovery_ready && record.customer_email ? (
                          <button type="button" className="admin-icon-button" onClick={() => sendBrowseEmail(record)}>
                            Send
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                  {!browseAbandonments.length && !isLoading && (
                    <tr><td colSpan="9">No browse abandonment records yet. Run migration 030, then view a product.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === "logs" && (
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3>Recent automation email logs</h3>
                <p>Only real send attempts are listed here.</p>
              </div>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr><th>Recipient</th><th>Flow</th><th>Subject</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.customer_email || log.recipient_email || "-"}</td>
                      <td>{log.flow_name || log.email_type || log.event_type || "-"}</td>
                      <td>{log.subject || "-"}</td>
                      <td><span className={getStatusClass(log.status)}>{log.status}</span></td>
                      <td>{formatDate(log.sent_at || log.created_at)}</td>
                    </tr>
                  ))}
                  {!logs.length && !isLoading && <tr><td colSpan="5">No automation emails have been sent yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "suppression" && (
          <div className="admin-split-grid">
            <form className="admin-card admin-form" onSubmit={addSuppression}>
              <div className="admin-card-header">
                <div>
                  <h3>Add suppression</h3>
                  <p>Prevent future internal automation emails to an address.</p>
                </div>
              </div>
              <label>
                Email address
                <input type="email" value={suppressionEmail} onChange={(event) => setSuppressionEmail(event.target.value)} placeholder="customer@example.com" required />
              </label>
              <label>
                Reason
                <input value={suppressionReason} onChange={(event) => setSuppressionReason(event.target.value)} placeholder="manual_admin" />
              </label>
              <button type="submit" className="admin-button">Add to suppression list</button>
            </form>

            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <h3>Suppressed emails</h3>
                  <p>Suppressed contacts are skipped by automation processing.</p>
                </div>
              </div>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead><tr><th>Email</th><th>Reason</th><th>Source</th><th>Date</th></tr></thead>
                  <tbody>
                    {suppressionList.map((item) => (
                      <tr key={item.id || item.email}>
                        <td>{item.email}</td>
                        <td>{item.reason || "-"}</td>
                        <td>{item.source || "-"}</td>
                        <td>{formatDate(item.created_at)}</td>
                      </tr>
                    ))}
                    {!suppressionList.length && !isLoading && <tr><td colSpan="4">No suppressed email addresses yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

