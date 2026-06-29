import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, Plus, RefreshCw, Tag, X } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import {
  createCustomerSegment,
  createCustomerTag,
  exportCustomersCsv,
  getCustomerAnalyticsOverview,
  getCustomerProfile,
  getCustomerSegments,
  getCustomerTags,
  getCustomers,
  updateCustomerTags,
} from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { formatNaira } from "../../utils/currency";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function getCustomerId(customer) {
  return customer?.accountId || customer?.account_id || customer?.id || customer?.email;
}

function itemSummary(order) {
  const items = order.items || [];
  if (!items.length) return "No item details";
  return items.map((item) => `${item.product_name || item.name || "Item"} x ${item.quantity || 1}`).join(", ");
}

const statusOptions = [
  { label: "All statuses", value: "" },
  { label: "Repeat", value: "repeat" },
  { label: "First-time", value: "first_time" },
  { label: "No purchase", value: "no_purchase" },
  { label: "Inactive", value: "inactive" },
  { label: "High value", value: "high_value" },
];

const sortOptions = [
  { label: "Recent activity", value: "last_activity_desc" },
  { label: "Highest spend", value: "total_spent_desc" },
  { label: "Most orders", value: "orders_desc" },
  { label: "Newest", value: "created_desc" },
  { label: "Email A-Z", value: "email_asc" },
];

export function AdminCustomers() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [tags, setTags] = useState([]);
  const [segments, setSegments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileTab, setProfileTab] = useState("overview");
  const [filters, setFilters] = useState({ search: "", tag: "", segment: "", status: "", sort: "last_activity_desc" });
  const [newTagName, setNewTagName] = useState("");
  const [newSegment, setNewSegment] = useState({ name: "", description: "", type: "tag", tag: "" });
  const [selectedTagToAdd, setSelectedTagToAdd] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const [customerResponse, analyticsResponse, tagsResponse, segmentsResponse] = await Promise.all([
        getCustomers(filters),
        getCustomerAnalyticsOverview(filters),
        getCustomerTags(),
        getCustomerSegments(),
      ]);
      setCustomers(customerResponse.data || customerResponse.customers || []);
      setAnalytics(analyticsResponse.data || null);
      setTags(tagsResponse.data || []);
      setSegments(segmentsResponse.data || []);
    } catch (error) {
      const message = error.message || "Failed to load customers.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadCustomers, 250);
    return () => window.clearTimeout(timeoutId);
  }, [loadCustomers]);

  const savedSegments = useMemo(() => segments.filter((segment) => segment.type === "saved"), [segments]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function openProfile(customer) {
    try {
      const id = getCustomerId(customer);
      setActionLoading(id);
      setProfileTab("overview");
      const response = await getCustomerProfile(id);
      setProfile(response.data || null);
      setSelectedTagToAdd("");
    } catch (error) {
      const message = error.message || "Failed to load customer profile.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoading("");
    }
  }

  async function handleExportCustomers() {
    try {
      setIsExporting(true);
      const blob = await exportCustomersCsv(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `luma-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("Customer CSV exported.");
    } catch (error) {
      showToast(error.message || "Failed to export customers.", "error");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleCreateTag(event) {
    event.preventDefault();
    if (!newTagName.trim()) return;
    try {
      await createCustomerTag({ name: newTagName.trim() });
      setNewTagName("");
      showToast("Tag created.");
      await loadCustomers();
    } catch (error) {
      showToast(error.message || "Failed to create tag.", "error");
    }
  }

  async function handleAddTag() {
    if (!profile?.customer || !selectedTagToAdd) return;
    try {
      const response = await updateCustomerTags(getCustomerId(profile.customer), { add: [selectedTagToAdd] });
      setProfile(response.data || profile);
      setSelectedTagToAdd("");
      showToast("Customer tag added.");
      await loadCustomers();
    } catch (error) {
      showToast(error.message || "Failed to add tag.", "error");
    }
  }

  async function handleRemoveTag(tagName) {
    if (!profile?.customer) return;
    try {
      const response = await updateCustomerTags(getCustomerId(profile.customer), { remove: [tagName] });
      setProfile(response.data || profile);
      showToast("Customer tag removed.");
      await loadCustomers();
    } catch (error) {
      showToast(error.message || "Failed to remove tag.", "error");
    }
  }

  async function handleCreateSegment(event) {
    event.preventDefault();
    if (!newSegment.name.trim()) return;
    try {
      const rules = newSegment.type === "tag" ? { type: "tag", tag: newSegment.tag } : { type: newSegment.type };
      await createCustomerSegment({ name: newSegment.name, description: newSegment.description, rules });
      setNewSegment({ name: "", description: "", type: "tag", tag: "" });
      showToast("Segment created.");
      await loadCustomers();
    } catch (error) {
      showToast(error.message || "Failed to create segment.", "error");
    }
  }

  const customer = profile?.customer;
  const summary = profile?.summary || {};

  return (
    <>
      <AdminTopbar title="Customers" subtitle="Customer profiles, LTV, purchase history, segments, tags, and exports." />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-header">
          <button type="button" className="admin-button secondary" onClick={loadCustomers} disabled={isLoading}>
            <RefreshCw size={16} />
            {isLoading ? "Refreshing..." : "Refresh customers"}
          </button>
          <button type="button" className="admin-button" onClick={handleExportCustomers} disabled={isExporting}>
            <Download size={16} />
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>

        <div className="admin-grid">
          <div className="admin-card"><p className="admin-eyebrow">Total customers</p><h2>{analytics?.totalCustomers || 0}</h2></div>
          <div className="admin-card"><p className="admin-eyebrow">Repeat customers</p><h2>{analytics?.repeatCustomers || 0}</h2></div>
          <div className="admin-card"><p className="admin-eyebrow">Average LTV</p><h2>{formatNaira(analytics?.averageCustomerLtv || 0)}</h2></div>
          <div className="admin-card"><p className="admin-eyebrow">Average order</p><h2>{formatNaira(analytics?.averageOrderValue || 0)}</h2></div>
          <div className="admin-card"><p className="admin-eyebrow">Repeat rate</p><h2>{analytics?.repeatPurchaseRate || 0}%</h2></div>
          <div className="admin-card"><p className="admin-eyebrow">Abandoned cart customers</p><h2>{analytics?.abandonedCartCustomers || 0}</h2></div>
          <div className="admin-card"><p className="admin-eyebrow">New this month</p><h2>{analytics?.newCustomers || 0}</h2></div>
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Customer list</h2>
            <input className="admin-search" type="search" placeholder="Search name, email, or phone..." value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
          </div>
          <div className="admin-filter-row">
            <select className="admin-mini-select" value={filters.tag} onChange={(event) => updateFilter("tag", event.target.value)}>
              <option value="">All tags</option>
              {tags.map((tag) => <option key={tag.id || tag.name} value={tag.name}>{tag.name}</option>)}
            </select>
            <select className="admin-mini-select" value={filters.segment} onChange={(event) => updateFilter("segment", event.target.value)}>
              <option value="">All segments</option>
              {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
            </select>
            <select className="admin-mini-select" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="admin-mini-select" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          {isLoading ? <div className="admin-empty">Loading customers...</div> : customers.length === 0 ? <div className="admin-empty">No customers found.</div> : (
            <div className="admin-table-wrap">
              <table className="admin-table customer-report-table">
                <thead>
                  <tr><th>Customer</th><th>Phone</th><th>Total spent</th><th>Orders</th><th>AOV</th><th>Last order</th><th>Tags</th><th>Segments</th><th>Created</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {customers.map((item) => (
                    <tr key={item.email}>
                      <td><strong>{item.name || "Customer"}</strong><small>{item.email}</small></td>
                      <td>{item.phone || "-"}</td>
                      <td>{formatNaira(item.totalSpent || 0)}</td>
                      <td>{item.paidOrderCount || 0}</td>
                      <td>{formatNaira(item.averageOrderValue || 0)}</td>
                      <td>{formatDate(item.lastOrderDate || item.lastOrderAt)}</td>
                      <td><div className="customer-tag-list">{(item.tags || []).slice(0, 3).map((tag) => <span className="status-pill" key={tag}>{tag}</span>)}</div></td>
                      <td><div className="customer-tag-list">{(item.segments || []).slice(0, 2).map((segment) => <span className="status-pill active" key={segment}>{segment}</span>)}</div></td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td><button type="button" className="admin-button secondary" onClick={() => openProfile(item)} disabled={actionLoading === getCustomerId(item)}><Eye size={15} />{actionLoading === getCustomerId(item) ? "Loading..." : "View"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-section-grid">
          <div className="admin-card">
            <div className="admin-table-header"><h2>Tags</h2></div>
            <form className="admin-inline-form" onSubmit={handleCreateTag}>
              <input className="admin-input" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Create customer tag" />
              <button type="submit" className="admin-button"><Plus size={15} />Create</button>
            </form>
            <div className="customer-tag-list">{tags.length === 0 ? <span className="admin-muted">No manual tags yet.</span> : tags.map((tag) => <span className="status-pill" key={tag.id || tag.name}>{tag.name} ({tag.customer_count || 0})</span>)}</div>
          </div>

          <div className="admin-card">
            <div className="admin-table-header"><h2>Segments</h2></div>
            <form className="admin-form-grid" onSubmit={handleCreateSegment}>
              <input className="admin-input" value={newSegment.name} onChange={(event) => setNewSegment((current) => ({ ...current, name: event.target.value }))} placeholder="Segment name" />
              <select className="admin-input" value={newSegment.type} onChange={(event) => setNewSegment((current) => ({ ...current, type: event.target.value }))}>
                <option value="tag">Customers with tag</option>
                <option value="repeat">Repeat customers</option>
                <option value="first_time">First-time customers</option>
                <option value="no_purchase">No purchase yet</option>
                <option value="high_value">High value customers</option>
                <option value="abandoned_cart">Abandoned cart customers</option>
              </select>
              {newSegment.type === "tag" && <input className="admin-input" value={newSegment.tag} onChange={(event) => setNewSegment((current) => ({ ...current, tag: event.target.value }))} placeholder="Tag name" />}
              <input className="admin-input" value={newSegment.description} onChange={(event) => setNewSegment((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
              <button type="submit" className="admin-button"><Plus size={15} />Save segment</button>
            </form>
            <div className="customer-tag-list">{savedSegments.length === 0 ? <span className="admin-muted">Built-in segments are available. Saved segments will appear here.</span> : savedSegments.map((segment) => <span className="status-pill active" key={segment.id}>{segment.name}</span>)}</div>
          </div>
        </div>

        {profile && customer && (
          <div className="admin-card admin-table-card customer-profile-card">
            <div className="admin-table-header">
              <div><h2>{customer.name || customer.email}</h2><p className="admin-muted">{customer.email}</p></div>
              <button type="button" className="admin-button secondary" onClick={() => setProfile(null)}><X size={15} />Close</button>
            </div>
            <div className="customer-tag-list">
              {["overview", "orders", "carts", "events", "tags"].map((tab) => <button type="button" className={profileTab === tab ? "status-pill active" : "status-pill"} onClick={() => setProfileTab(tab)} key={tab}>{tab}</button>)}
            </div>
            {profileTab === "overview" && <div className="customer-profile-grid">
              <div><h3>Profile</h3><p><strong>Phone:</strong> {customer.phone || "-"}</p><p><strong>Created:</strong> {formatDate(customer.createdAt)}</p><p><strong>Last activity:</strong> {formatDate(summary.lastActivityAt)}</p></div>
              <div><h3>Value</h3><p><strong>LTV:</strong> {formatNaira(summary.ltv || 0)}</p><p><strong>AOV:</strong> {formatNaira(summary.averageOrderValue || 0)}</p><p><strong>Paid orders:</strong> {summary.paidOrders || 0}</p></div>
              <div><h3>Segments</h3><div className="customer-tag-list">{(profile.segments || []).map((segment) => <span className="status-pill active" key={segment}>{segment}</span>)}</div></div>
            </div>}
            {profileTab === "orders" && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Total</th><th>Items</th><th>Date</th></tr></thead><tbody>{(profile.purchaseHistory || []).length === 0 ? <tr><td colSpan="4"><div className="admin-empty">No paid purchase history found.</div></td></tr> : profile.purchaseHistory.map((order) => <tr key={order.id}><td>{order.id}</td><td>{formatNaira(order.total_amount || 0)}</td><td>{itemSummary(order)}</td><td>{formatDate(order.created_at)}</td></tr>)}</tbody></table></div>}
            {profileTab === "carts" && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Cart</th><th>Value</th><th>Status</th><th>Last activity</th></tr></thead><tbody>{(profile.abandonedCarts || []).length === 0 ? <tr><td colSpan="4"><div className="admin-empty">No abandoned carts found for this customer.</div></td></tr> : profile.abandonedCarts.map((cart) => <tr key={cart.id}><td>{cart.id}</td><td>{formatNaira(cart.total_value || 0)}</td><td><span className="status-pill">{cart.recovery_status || "not contacted"}</span></td><td>{formatDate(cart.last_activity_at)}</td></tr>)}</tbody></table></div>}
            {profileTab === "events" && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Event</th><th>Value</th><th>Source</th><th>Date</th></tr></thead><tbody>{(profile.recentEvents || []).length === 0 ? <tr><td colSpan="4"><div className="admin-empty">No recent tracked events found.</div></td></tr> : profile.recentEvents.map((event) => <tr key={event.id}><td>{event.event_type}</td><td>{event.value || "-"}</td><td>{event.utm_source || "direct"}</td><td>{formatDate(event.created_at)}</td></tr>)}</tbody></table></div>}
            {profileTab === "tags" && <div className="admin-card soft-card"><div className="admin-table-header"><h3>Customer tags</h3></div><div className="customer-tag-list">{(customer.tags || []).map((tagName) => <button type="button" className="status-pill" key={tagName} onClick={() => handleRemoveTag(tagName)}><Tag size={13} />{tagName} x</button>)}</div><div className="admin-inline-form"><select className="admin-input" value={selectedTagToAdd} onChange={(event) => setSelectedTagToAdd(event.target.value)}><option value="">Choose tag</option>{tags.map((tag) => <option key={tag.id || tag.name} value={tag.name}>{tag.name}</option>)}</select><button type="button" className="admin-button" onClick={handleAddTag} disabled={!selectedTagToAdd}>Add tag</button></div></div>}
          </div>
        )}
      </section>
    </>
  );
}