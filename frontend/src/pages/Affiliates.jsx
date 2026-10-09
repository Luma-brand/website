import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Copy, Link2, RefreshCw, Wallet } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { applyForAffiliate, getAffiliateDashboard, getAffiliateProgram, getProducts, requestAffiliatePayout, saveAffiliateBank } from "../services/api";
import "../styles/affiliates.css";

const money = (minor) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(minor || 0) / 100);
const date = (value) => new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

function ProgramTerms({ settings }) {
  return <div className="affiliate-terms">
    <h3>How earnings work</h3>
    <p>Commission applies to products after discounts. Delivery fees are excluded. A shopper must use your link and order within {settings.attributionDays} days. Your rate is recorded when they check out.</p>
    <p>Earnings become available after payment, fulfilment and a {settings.holdDays}-day hold from payment. Cancelled or refunded orders reverse the commission, including earnings already withdrawn. Self-referrals are excluded.</p>
    <p>Withdraw from {money(settings.minimumPayout * 100)} to a Nigerian bank account. LUMA reviews requests and pays by bank transfer. <Link to="/terms-and-conditions">Read the store terms <ArrowRight size={14} /></Link></p>
  </div>;
}

function ApplicationForm({ settings, onApplied }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await applyForAffiliate({ socialUrl: form.get("socialUrl"), promotionPlan: form.get("promotionPlan"), acceptTerms: form.get("acceptTerms") === "on" });
      await onApplied();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="affiliate-card" id="affiliate-application">
    <p className="affiliate-kicker">Let’s work together</p><h2>Become a LUMA affiliate.</h2>
    <p>Tell us where you’ll share LUMA. We’ll review your application before activating your link.</p>
    <form className="affiliate-form" onSubmit={submit}>
      <label>Website or social profile<input name="socialUrl" type="url" placeholder="https://instagram.com/yourprofile" maxLength={500} required disabled={busy} /></label>
      <label>How will you promote LUMA?<textarea name="promotionPlan" placeholder="Tell us about your audience and how you’ll share our products." minLength={10} maxLength={2000} rows={4} required disabled={busy} /></label>
      <ProgramTerms settings={settings} />
      <label className="affiliate-check"><input name="acceptTerms" type="checkbox" required disabled={busy} /><span>I accept these affiliate terms and the LUMA store terms.</span></label>
      {error && <p className="affiliate-error" role="alert">{error}</p>}
      <button className="affiliate-button" disabled={busy || !settings.enabled}>{busy ? "Submitting…" : "Submit application"}<ArrowRight size={17} /></button>
    </form>
  </section>;
}

function BankForm({ account, onSaved }) {
  const [bank, setBank] = useState({ bankName: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try { await saveAffiliateBank(bank); setMessage("Bank details saved."); await onSaved(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="affiliate-card"><h2>Your payout account</h2><p>Check these details carefully. Each request keeps the bank details saved when you submit it.</p>
    <form className="affiliate-form" onSubmit={submit}>
      <label>Bank name<input value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} maxLength={120} required disabled={busy} autoComplete="organization" /></label>
      <label>Account holder’s name<input value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} maxLength={160} required disabled={busy} autoComplete="name" /></label>
      <label>Account number<input value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required disabled={busy} /></label>
      {error && <p className="affiliate-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <button className="affiliate-button secondary" disabled={busy}>{busy ? "Saving…" : "Save bank details"}<Check size={16} /></button>
    </form>
  </section>;
}

function WithdrawalForm({ data, onRequested }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(null);
  const minimum = data.settings.minimumPayout;
  const available = Number(data.balances.available) / 100;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const signature = `${data.account.id}:${Number(amount).toFixed(2)}`;
    try {
      if (!request.current || request.current.signature !== signature) {
        try { request.current = JSON.parse(sessionStorage.getItem("luma_affiliate_payout_request") || "null"); } catch { /* Storage is optional. */ }
        if (request.current?.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
        try { sessionStorage.setItem("luma_affiliate_payout_request", JSON.stringify(request.current)); } catch { /* Use in-memory retry key. */ }
      }
      await requestAffiliatePayout({ amount, requestKey: request.current.key });
      request.current = null;
      try { sessionStorage.removeItem("luma_affiliate_payout_request"); } catch { /* Storage is optional. */ }
      setAmount(""); await onRequested();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="affiliate-card"><Wallet size={24} /><h2>Withdraw your earnings</h2><p>Available: <strong>{money(data.balances.available)}</strong>. Minimum: {money(minimum * 100)}.</p>
    <form className="affiliate-form" onSubmit={submit}>
      <label>Amount (NGN)<input type="number" inputMode="decimal" min={minimum} max={Math.max(0, available)} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={busy} placeholder={String(minimum)} /></label>
      {error && <p className="affiliate-error" role="alert">{error}</p>}
      <button className="affiliate-button" disabled={busy || available < minimum || data.account.status !== "approved" || !data.account.accountNumber}>{busy ? "Requesting…" : "Request withdrawal"}<ArrowRight size={17} /></button>
    </form>
    {!data.account.accountNumber && <small>Save your bank details to enable withdrawals.</small>}
    {available < 0 && <small>Reversed orders exceeded your remaining earnings. New earnings will clear this balance.</small>}
  </section>;
}

function ReferralLink({ account, enabled }) {
  const [products, setProducts] = useState([]);
  const [productPath, setProductPath] = useState("/products");
  const { showToast } = useToast();
  useEffect(() => {
    let active = true;
    getProducts().then((res) => { if (active) setProducts(res.data || []); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const shareUrl = new URL(productPath, window.location.origin);
  shareUrl.searchParams.set("ref", account.code);
  const link = shareUrl.toString();
  async function copy() {
    try { await navigator.clipboard.writeText(link); showToast("Referral link copied."); }
    catch { showToast("Select the link below to copy it.", "error"); }
  }
  return <section className="affiliate-card affiliate-link-card"><div><Link2 size={23} /><h2>Your link. Your audience.</h2><p>Share the shop or a specific product. Purchases made through this link earn you {account.commissionPercent}%.</p></div>
    <div className="affiliate-form"><label>Where should your link open?<select value={productPath} onChange={(e) => setProductPath(e.target.value)}><option value="/products">All LUMA products</option>{products.map((p) => <option key={p.id} value={`/products/${p.slug || p.id}`}>{p.name}</option>)}</select></label>
      <label>Your referral link<input readOnly value={link} onFocus={(e) => e.target.select()} /></label>
      <div className="affiliate-actions"><button className="affiliate-button" onClick={copy} type="button"><Copy size={16} />Copy link</button><a className="affiliate-button secondary" href={`https://wa.me/?text=${encodeURIComponent(`Shop LUMA with my link: ${link}`)}`} target="_blank" rel="noreferrer">Share on WhatsApp<ArrowRight size={16} /></a></div>
      <small>Referral code: <strong>{account.code}</strong>{!enabled && " · New referrals are currently paused."}</small>
    </div>
  </section>;
}

export function Affiliates() {
  const { user, isAuthLoading, displayName } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const customerId = user?.id;
  const load = useCallback(async () => {
    if (isAuthLoading) return;
    setLoading(true); setError("");
    try {
      const response = customerId ? await getAffiliateDashboard() : await getAffiliateProgram();
      setData(customerId ? response.data : { settings: response.data, account: null });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [customerId, isAuthLoading]);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  const account = customerId ? data?.account : null;
  const settings = data?.settings;
  const approved = account?.status === "approved" || account?.status === "suspended";
  return <main className="page-shell"><Header /><div className="affiliate-page">
    <div className="affiliate-heading"><p className="affiliate-kicker">LUMA Affiliate Program</p><h1>{approved ? `Your LUMA circle, ${displayName?.split(" ")[0] || "affiliate"}.` : "Love LUMA? Share it."}</h1><p>{approved ? "Every referral and every earning, in one place." : "Introduce your audience to our brow essentials and earn from the orders you inspire."}</p></div>
    {error && <div className="affiliate-error" role="alert">{error}<button type="button" onClick={load} disabled={loading}>Try again</button></div>}
    {(loading || isAuthLoading) && !data ? <div className="affiliate-card" role="status">Loading the affiliate program…</div> : settings && <>
      {!settings.enabled && <p className="affiliate-notice" role="status">New applications and referrals are paused. Existing earnings and withdrawal requests are still accessible.</p>}
      {approved ? <>
        <div className="affiliate-toolbar"><span className={`affiliate-status ${account.status}`}>{account.status} · {account.commissionPercent}% commission</span><button type="button" className="affiliate-button secondary" onClick={load} disabled={loading}><RefreshCw size={15} />{loading ? "Refreshing…" : "Refresh"}</button></div>
        {account.status === "suspended" && <p className="affiliate-notice">Your affiliate account is suspended. Contact <a href="mailto:hello@shopwithluma.com">LUMA support</a> to reactivate referrals and withdrawals.</p>}
        <div className="affiliate-metrics">{[["Available balance", money(data.balances.available)], ["Pending earnings", money(data.balances.pending)], ["Paid out", money(data.balances.paid)], ["Referrals / orders", `${data.clicks} / ${data.conversions}`]].map(([label, value]) => <div className="affiliate-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {account.status === "approved" && <ReferralLink account={account} enabled={settings.enabled} />}
        <div className="affiliate-columns"><BankForm account={account} onSaved={load} /><WithdrawalForm data={data} onRequested={async () => { showToast("Withdrawal request submitted."); await load(); }} /></div>
        <section className="affiliate-card"><h2>Your earnings</h2><p>Latest 100 orders. Available earnings are included in your balance; requested and paid withdrawals are deducted.</p><div className="affiliate-table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Product total</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead><tbody>{data.commissions.map((c) => <tr key={c.id}><td>#{c.order_reference}</td><td>{date(c.created_at)}</td><td>{money(c.eligible_minor)}</td><td>{c.rate_bps / 100}%</td><td>{money(c.amount_minor)}</td><td><span className={`affiliate-status ${c.status}`}>{c.status}</span>{c.status === "pending" && <small>After fulfilment and {date(c.available_at)}</small>}{c.void_reason && <small>{c.void_reason}</small>}</td></tr>)}</tbody></table></div>{!data.commissions.length && <p className="affiliate-empty">Your first verified referral order will appear here.</p>}</section>
        <section className="affiliate-card"><h2>Withdrawal history</h2><div className="affiliate-table-wrap"><table><thead><tr><th>Requested</th><th>Amount</th><th>Status</th><th>Transfer / note</th></tr></thead><tbody>{data.payouts.map((p) => <tr key={p.id}><td>{date(p.created_at)}</td><td>{money(p.amount_minor)}</td><td><span className={`affiliate-status ${p.status}`}>{p.status}</span></td><td>{p.payment_reference || p.admin_note || "Awaiting review"}</td></tr>)}</tbody></table></div>{!data.payouts.length && <p className="affiliate-empty">No withdrawal requests yet.</p>}</section>
        <ProgramTerms settings={settings} />
      </> : account ? <section className="affiliate-card affiliate-application-state"><span className={`affiliate-status ${account.status}`}>{account.status}</span><h2>{account.status === "pending" ? "Your application is with us." : "Your application hasn’t been approved."}</h2><p>{account.status === "pending" ? "Once approved, you’ll find your referral link and earnings here." : "Contact LUMA if you’d like us to review your application again."}</p><button className="affiliate-button secondary" type="button" onClick={load} disabled={loading}><RefreshCw size={16} />Check status</button><a href="mailto:hello@shopwithluma.com">hello@shopwithluma.com</a></section> : <>
        <div className="affiliate-benefits"><div className="affiliate-card affiliate-feature"><Link2 size={24} /><h2>Share your favourites.</h2><p>Get a personal link for the shop or any LUMA product.</p></div><div className="affiliate-card affiliate-feature"><Wallet size={24} /><h2>Earn {settings.commissionPercent}%.</h2><p>Track verified sales and commissions in your own dashboard.</p></div><div className="affiliate-card affiliate-feature"><Check size={24} /><h2>Paid to your bank.</h2><p>Request a withdrawal from {money(settings.minimumPayout * 100)}.</p></div></div>
        {customerId ? settings.enabled ? <ApplicationForm settings={settings} onApplied={load} /> : <ProgramTerms settings={settings} /> : <section className="affiliate-card affiliate-join"><h2>Ready to join the circle?</h2><p>Sign in or create a LUMA account to apply.</p><div className="affiliate-actions"><Link className="affiliate-button" to="/login?next=%2Faffiliates">Sign in<ArrowRight size={16} /></Link><Link className="affiliate-button secondary" to="/register?next=%2Faffiliates">Create an account</Link></div><ProgramTerms settings={settings} /></section>}
      </>}
    </>}
  </div><Footer /></main>;
}
