import { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw, Save } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import {
  getAdminCurrencyRates,
  syncAdminCurrencyRates,
  updateAdminCurrencyRate,
} from "../../services/api";

export function AdminCurrencyRates() {
  const [rates, setRates] = useState([]);
  const [history, setHistory] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingCode, setSavingCode] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await getAdminCurrencyRates();
      setRates(response.data?.rates || []);
      setHistory(response.data?.history || []);
      setJobs(response.data?.jobs || []);
      setMeta(response.data || null);
    } catch (loadError) {
      setError(loadError.message || "Failed to load currency rates.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { void loadRates(); }); }, [loadRates]);

  function updateLocalRate(code, field, value) {
    setRates((current) => current.map((rate) =>
      rate.code === code ? { ...rate, [field]: value } : rate
    ));
  }

  async function saveRate(rate, { reset = false } = {}) {
    try {
      setSavingCode(rate.code);
      setError("");
      setSuccess("");
      await updateAdminCurrencyRate(rate.code, {
        markupPercent: Number(rate.markupPercent || 0),
        manualOverrideRate: reset ? null : rate.manualOverrideRate,
        resetManualOverride: reset,
        isActive: rate.code === "NGN" ? true : Boolean(rate.isActive),
        isDefault: rate.isDefault,
      });
      setSuccess(reset ? `${rate.code} returned to automatic rates.` : `${rate.code} settings updated.`);
      await loadRates();
    } catch (saveError) {
      setError(saveError.message || "Failed to update currency rate.");
    } finally {
      setSavingCode("");
    }
  }

  async function syncRates() {
    try {
      setIsSyncing(true);
      setError("");
      setSuccess("");
      await syncAdminCurrencyRates();
      setSuccess("Provider rates synced. Markups and manual overrides were preserved.");
      await loadRates();
    } catch (syncError) {
      setError(syncError.message || "Provider sync failed. Last known valid rates remain active.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <>
      <AdminTopbar
        title="Currency rates"
        description="Automatic daily display rates. Paystack continues to settle checkout payments in NGN."
      />
      <section className="admin-dashboard-content">
        <div className="admin-actions-row">
          <button type="button" className="admin-button" onClick={syncRates} disabled={isSyncing}>
            <RefreshCw size={16} /> {isSyncing ? "Syncing provider…" : "Sync provider now"}
          </button>
          <button type="button" className="admin-button secondary" onClick={loadRates} disabled={isLoading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        {error && <div className="admin-error">{error}</div>}
        {success && <div className="admin-success">{success}</div>}

        <div className="admin-card admin-table-card">
          <div className="admin-table-header"><div><h2>Exchange rates</h2><p>{meta?.rateDirection}</p></div><span className="admin-badge success">Display only · NGN checkout</span></div>
          {isLoading ? <div className="admin-empty">Loading currency rates…</div> : (
            <div className="admin-table-wrap"><table className="admin-table currency-rates-table"><thead><tr><th>Currency</th><th>Provider rate</th><th>Markup %</th><th>Manual override</th><th>Effective rate</th><th>Mode / status</th><th>Action</th></tr></thead><tbody>
              {rates.map((rate) => <tr key={rate.code}>
                <td><strong>{rate.symbol} {rate.code}</strong><small>{rate.provider || "Awaiting provider"}</small></td>
                <td>{Number(rate.providerRateToBase || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td><input className="admin-inline-input" type="number" step="0.1" value={rate.markupPercent ?? 0} disabled={rate.code === "NGN"} onChange={(event) => updateLocalRate(rate.code, "markupPercent", event.target.value)} /></td>
                <td><input className="admin-inline-input" type="number" min="0.0001" step="0.0001" value={rate.manualOverrideRate ?? ""} disabled={rate.code === "NGN"} placeholder="Automatic" onChange={(event) => updateLocalRate(rate.code, "manualOverrideRate", event.target.value)} /></td>
                <td><strong>{Number(rate.effectiveRateToBase || rate.rateToNgn || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong></td>
                <td><span className={`admin-badge ${rate.lastSyncStatus === "FAILED" ? "warning" : "success"}`}>{rate.mode} · {rate.lastSyncStatus}</span>{rate.lastSyncError && <small title={rate.lastSyncError}>Last sync failed; cached rate active</small>}</td>
                <td><button className="admin-button small" type="button" onClick={() => saveRate(rate)} disabled={savingCode === rate.code}><Save size={14} /> Save</button>{rate.manualOverrideRate !== null && <button className="admin-button small secondary" type="button" onClick={() => saveRate(rate, { reset: true })}><RotateCcw size={14} /> Auto</button>}</td>
              </tr>)}
            </tbody></table></div>
          )}
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header"><div><h2>Sync history</h2><p>Recent provider results and fallback status.</p></div><span className="admin-badge">Next update: 00:00 Africa/Lagos</span></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>Currency</th><th>Provider</th><th>Raw rate</th><th>Effective</th><th>Result</th></tr></thead><tbody>
            {history.slice(0, 30).map((entry) => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleString()}</td><td>{entry.currency_code}</td><td>{entry.provider}</td><td>{entry.raw_rate_to_base ?? "—"}</td><td>{entry.effective_rate_to_base ?? "—"}</td><td><span className={`admin-badge ${entry.success ? "success" : "warning"}`}>{entry.success ? "Success" : "Failed"}</span></td></tr>)}
          </tbody></table></div>
          {history.length === 0 && <div className="admin-empty">No automatic sync history yet.</div>}
        </div>

        {jobs[0] && <div className="admin-card"><strong>Last job: {jobs[0].status}</strong><p>{new Date(jobs[0].started_at).toLocaleString()} · {jobs[0].provider || "provider unavailable"}</p></div>}
      </section>
    </>
  );
}
