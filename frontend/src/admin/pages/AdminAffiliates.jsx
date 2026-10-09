import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Save, X } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { getAdminAffiliates, reviewAffiliatePayout, saveAffiliateSettings, updateAffiliateAccount } from "../../services/api";
import "../affiliateAdmin.css";

const money = (minor) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(minor || 0) / 100);
const date = (value) => new Date(value).toLocaleString("en-NG");

function ReviewDialog({ selection, onClose, onSave }) {
  const dialog = useRef(null);
  const account = selection.kind === "account";
  const record = selection.record;
  const [status, setStatus] = useState(account ? record.status : record.status === "approved" ? "paid" : "approved");
  const [rate, setRate] = useState(record.customCommissionPercent ?? "");
  const [note, setNote] = useState(record.adminNote || "");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current.showModal(); }, []);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await onSave(account ? { status, commissionPercent: rate === "" ? null : rate, note } : { status, paymentReference: reference, note });
      onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="affiliate-admin-dialog" aria-labelledby="affiliate-review-title" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}>
    <button type="button" className="affiliate-dialog-close" aria-label="Close review" onClick={onClose} disabled={busy}><X size={20} /></button>
    <h2 id="affiliate-review-title">{account ? "Review affiliate" : "Review withdrawal"}</h2><p>{record.fullName || record.full_name} · {record.email}</p>
    {account ? <div className="affiliate-review-details"><a href={record.socialUrl} target="_blank" rel="noreferrer">{record.socialUrl}</a><p>{record.promotionPlan}</p><small>Code: {record.code} · Current rate: {record.commissionPercent}%</small></div> : <div className="affiliate-review-details"><strong>{money(record.amount_minor)}</strong><p>{record.bank_name}<br />{record.account_name}<br />{record.account_number}</p><p>Send the bank transfer separately. Mark this request paid only after the transfer succeeds, and enter its unique reference.</p></div>}
    <form className="admin-form" onSubmit={submit}>
      <label>{account ? "Account status" : "Next step"}<select value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>{(account ? ["pending", "approved", "rejected", "suspended"] : record.status === "approved" ? ["paid", "rejected"] : ["approved", "rejected"]).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      {account && <label>Commission rate (%)<input type="number" min="0" max="100" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Use the program default" disabled={busy} /><small>Leave blank to use the default. This affects new checkouts.</small></label>}
      {!account && status === "paid" && <label>Successful bank transfer reference<input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={160} required disabled={busy} /></label>}
      <label>{account ? "Internal review note" : status === "rejected" ? "Reason for rejection (visible to affiliate)" : "Review note (visible to affiliate)"}<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} required={!account && status === "rejected"} disabled={busy} /></label>
      {error && <div className="admin-error" role="alert">{error}</div>}
      <button className="admin-button" disabled={busy}><Save size={16} />{busy ? "Saving…" : "Save review"}</button>
    </form>
  </dialog>;
}

export function AdminAffiliates() {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState("accounts");
  const [selection, setSelection] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "all", page: 1 });
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await getAdminAffiliates(filters);
      setData(response.data); setSettings(response.data.settings);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  async function saveSettings(event) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try { await saveAffiliateSettings(settings); setSuccess("Affiliate program settings saved. Existing order rates are preserved."); await load(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  async function saveReview(payload) {
    if (selection.kind === "account") await updateAffiliateAccount(selection.record.id, payload);
    else await reviewAffiliatePayout(selection.record.id, payload);
    setSuccess("Review saved."); await load();
  }
  function field(key, value) { setSettings((current) => ({ ...current, [key]: value })); }
  return <><AdminTopbar title="Affiliate marketing" description="Approve partners, manage commission rates and review bank withdrawals." />
    <section className="admin-dashboard-content affiliate-admin">
      <div className="admin-actions-row"><button className="admin-button secondary" type="button" onClick={load} disabled={loading}><RefreshCw size={16} />{loading ? "Refreshing…" : "Refresh"}</button></div>
      {error && <div className="admin-error" role="alert">{error}</div>}{success && <div className="admin-success" role="status">{success}</div>}
      {data && <div className="affiliate-admin-metrics">{[["Approved affiliates", data.summary.active], ["Pending applications", data.summary.applications], ["Commission earned", money(data.summary.earned)], ["Paid withdrawals", money(data.summary.paid)]].map(([label, value]) => <div className="admin-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>}
      {settings && <section className="admin-card"><div className="admin-table-header"><div><h2>Program settings</h2><p>Commission rates are editable here. Each checkout records its rate and hold period.</p></div></div>
        <form className="admin-form affiliate-settings-form" onSubmit={saveSettings}>
          <label>New applications and referrals<select value={String(settings.enabled)} onChange={(e) => field("enabled", e.target.value === "true")} disabled={saving}><option value="true">Enabled</option><option value="false">Paused</option></select></label>
          <label>Default commission (%)<input type="number" min="0" max="100" step="0.01" value={settings.commissionPercent} onChange={(e) => field("commissionPercent", e.target.value)} required disabled={saving} /></label>
          <label>Minimum withdrawal (NGN)<input type="number" min="0.01" step="0.01" value={settings.minimumPayout} onChange={(e) => field("minimumPayout", e.target.value)} required disabled={saving} /></label>
          <label>Referral window (days)<input type="number" min="1" max="90" step="1" value={settings.attributionDays} onChange={(e) => field("attributionDays", e.target.value)} required disabled={saving} /></label>
          <label>Commission hold (days)<input type="number" min="0" max="90" step="1" value={settings.holdDays} onChange={(e) => field("holdDays", e.target.value)} required disabled={saving} /></label>
          <button className="admin-button" disabled={saving}><Save size={16} />{saving ? "Saving…" : "Save settings"}</button>
        </form><p className="admin-form-note">NGN product totals after discounts, excluding delivery. Withdrawals require verified payment, fulfilment and the hold period. Pausing the program leaves earned balances accessible.</p>
      </section>}
      <div className="affiliate-admin-tabs" aria-label="Affiliate views">{[["accounts", "Affiliates"], ["commissions", "Commissions"], ["payouts", "Withdrawals"]].map(([id, label]) => <button type="button" className={`admin-button ${tab === id ? "" : "secondary"}`} key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
      {loading && !data ? <div className="admin-card" role="status">Loading affiliate activity…</div> : data && <section className="admin-card admin-table-card">
        {tab === "accounts" && <><div className="admin-table-header"><div><h2>Affiliate applications & accounts</h2><p>{data.total} matching accounts</p></div><form className="affiliate-admin-filters" onSubmit={(event) => { event.preventDefault(); setFilters({ ...filters, search: searchInput, page: 1 }); }}><label className="affiliate-visually-hidden" htmlFor="affiliate-admin-search">Search affiliates</label><input id="affiliate-admin-search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, email or code" /><label className="affiliate-visually-hidden" htmlFor="affiliate-admin-status">Account status</label><select id="affiliate-admin-status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>{["all", "pending", "approved", "rejected", "suspended"].map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="admin-button small" disabled={loading}>Search</button></form></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Affiliate</th><th>Code</th><th>Status</th><th>Commission</th><th>Referrals / orders</th><th>Action</th></tr></thead><tbody>{data.accounts.map((a) => <tr key={a.id}><td><strong>{a.fullName}</strong><small>{a.email}</small></td><td>{a.code}</td><td><span className={`admin-badge ${a.status === "approved" ? "success" : "warning"}`}>{a.status}</span></td><td>{a.commissionPercent}%<small>{a.customCommissionPercent == null ? "Program default" : "Custom rate"}</small></td><td>{a.clicks} / {a.conversions}</td><td><button type="button" className="admin-button small secondary" onClick={() => setSelection({ kind: "account", record: a })}>Review</button></td></tr>)}</tbody></table></div>
          {!data.accounts.length && <div className="admin-empty">No matching affiliates.</div>}<div className="affiliate-admin-pagination"><button className="admin-button small secondary" type="button" disabled={loading || data.page <= 1} onClick={() => setFilters({ ...filters, page: data.page - 1 })}>Previous</button><span>Page {data.page}</span><button className="admin-button small secondary" type="button" disabled={loading || data.page * 50 >= data.total} onClick={() => setFilters({ ...filters, page: data.page + 1 })}>Next</button></div>
        </>}
        {tab === "commissions" && <><div className="admin-table-header"><div><h2>Recent commissions</h2><p>Latest 100 entries. Reversed orders keep their audit record.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Affiliate</th><th>Order</th><th>Product total</th><th>Rate</th><th>Commission</th><th>Status</th><th>Available after</th></tr></thead><tbody>{data.commissions.map((c) => <tr key={c.id}><td>{c.code}</td><td>#{c.order_id.slice(0, 8)}</td><td>{money(c.eligible_minor)}</td><td>{c.rate_bps / 100}%</td><td>{money(c.amount_minor)}</td><td>{c.status}{c.void_reason && <small>{c.void_reason}</small>}</td><td>{date(c.available_at)}<small>Fulfilment also required</small></td></tr>)}</tbody></table></div>{!data.commissions.length && <div className="admin-empty">No verified referral orders yet.</div>}</>}
        {tab === "payouts" && <><div className="admin-table-header"><div><h2>Withdrawal requests</h2><p>Latest 100 entries, with open requests first. Approve, make the transfer, then record its reference.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Affiliate</th><th>Amount</th><th>Bank account</th><th>Status</th><th>Reference / note</th><th>Requested</th><th>Action</th></tr></thead><tbody>{data.payouts.map((p) => <tr key={p.id}><td><strong>{p.full_name}</strong><small>{p.email}</small></td><td>{money(p.amount_minor)}</td><td>{p.bank_name}<small>{p.account_name} · {p.account_number}</small></td><td>{p.status}</td><td>{p.payment_reference || p.admin_note || "—"}</td><td>{date(p.created_at)}</td><td>{["pending", "approved"].includes(p.status) ? <button type="button" className="admin-button small secondary" onClick={() => setSelection({ kind: "payout", record: p })}>Review</button> : "Closed"}</td></tr>)}</tbody></table></div>{!data.payouts.length && <div className="admin-empty">No withdrawal requests yet.</div>}</>}
      </section>}
    </section>{selection && <ReviewDialog key={`${selection.kind}:${selection.record.id}`} selection={selection} onClose={() => setSelection(null)} onSave={saveReview} />}
  </>;
}
