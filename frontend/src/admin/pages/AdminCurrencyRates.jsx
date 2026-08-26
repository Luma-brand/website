import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { getAdminCurrencyRates, updateAdminCurrencyRate } from "../../services/api";

export function AdminCurrencyRates() {
  const [rates, setRates] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingCode, setSavingCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await getAdminCurrencyRates();
      setRates(response.data?.rates || []);
      setMeta(response.data || null);
    } catch (error) {
      setError(error.message || "Failed to load currency rates.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    getAdminCurrencyRates()
      .then((response) => {
        if (!isMounted) return;
        setRates(response.data?.rates || []);
        setMeta(response.data || null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setError(error.message || "Failed to load currency rates.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateLocalRate(code, field, value) {
    setRates((current) =>
      current.map((rate) =>
        rate.code === code
          ? {
              ...rate,
              [field]: field === "rateToNgn" ? value : Boolean(value),
            }
          : rate
      )
    );
  }

  async function saveRate(rate) {
    try {
      setSavingCode(rate.code);
      setError("");
      setSuccess("");
      await updateAdminCurrencyRate(rate.code, {
        rateToNgn: Number(rate.rateToNgn),
        isActive: rate.code === "NGN" ? true : rate.isActive,
        isDefault: rate.isDefault,
      });
      setSuccess(`${rate.code} rate updated.`);
      await loadRates();
    } catch (error) {
      setError(error.message || "Failed to update currency rate.");
    } finally {
      setSavingCode("");
    }
  }

  return (
    <>
      <AdminTopbar
        title="Currency rates"
        description="Manage customer display currencies. Rates are NGN per 1 unit of each currency."
      />

      <section className="admin-dashboard-content">
        <div className="admin-actions-row">
          <button type="button" className="admin-button secondary" onClick={loadRates} disabled={isLoading}>
            <RefreshCw size={16} />
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="admin-error">{error}</div>}
        {success && <div className="admin-success">{success}</div>}

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <div>
              <h2>Exchange rates</h2>
              <p>{meta?.rateDirection || "Example: USD rate 1500 means 1 USD = ?1500."}</p>
            </div>
            <span className="admin-badge success">Display rates · Paystack settles in NGN</span>
          </div>

          {isLoading ? (
            <div className="admin-empty">Loading currency rates...</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table currency-rates-table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Symbol</th>
                    <th>Rate to NGN</th>
                    <th>Active</th>
                    <th>Default</th>
                    <th>Last updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.code}>
                      <td><strong>{rate.code}</strong></td>
                      <td>{rate.symbol}</td>
                      <td>
                        <input
                          className="admin-inline-input"
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={rate.rateToNgn}
                          disabled={rate.code === "NGN"}
                          onChange={(event) => updateLocalRate(rate.code, "rateToNgn", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={rate.code === "NGN" || rate.isActive}
                          disabled={rate.code === "NGN"}
                          onChange={(event) => updateLocalRate(rate.code, "isActive", event.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={rate.isDefault}
                          onChange={(event) => updateLocalRate(rate.code, "isDefault", event.target.checked)}
                        />
                      </td>
                      <td>{rate.updatedAt ? new Date(rate.updatedAt).toLocaleString() : "Not updated"}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-button small"
                          onClick={() => saveRate(rate)}
                          disabled={savingCode === rate.code}
                        >
                          <Save size={15} />
                          {savingCode === rate.code ? "Saving..." : "Save"}
                        </button>
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
