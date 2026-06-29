import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, RefreshCw, Trash2 } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { useToast } from "../../context/ToastContext";
import { formatNaira } from "../../utils/currency";
import {
  createDiscountCode,
  deleteDiscountCode,
  disableDiscountCode,
  enableDiscountCode,
  getDiscountCodes,
  getDiscountSettings,
  updateDiscountCode,
  updateFreeShippingThreshold,
} from "../../services/api";

const emptyForm = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  minimumOrderAmount: "",
  usageLimit: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

function formatDate(value) {
  if (!value) return "No expiry";

  return new Date(value).toLocaleDateString();
}

function toDateInputValue(value) {
  if (!value) return "";

  return new Date(value).toISOString().slice(0, 10);
}

function formatDiscountValue(discount) {
  if (discount.discountType === "percentage") {
    return `${Number(discount.discountValue || 0)}%`;
  }

  return formatNaira(discount.discountValue || 0);
}

export function AdminDiscounts() {
  const { showToast } = useToast();
  const [discounts, setDiscounts] = useState([]);
  const [settings, setSettings] = useState({ freeShippingThreshold: null });
  const [formData, setFormData] = useState(emptyForm);
  const [editingDiscountId, setEditingDiscountId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [freeShippingThreshold, setFreeShippingThresholdInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [error, setError] = useState("");

  const totals = useMemo(
    () =>
      discounts.reduce(
        (values, discount) => ({
          total: values.total + 1,
          active: values.active + (discount.isActive ? 1 : 0),
          expired:
            values.expired +
            (discount.expiresAt && new Date(discount.expiresAt) < new Date()
              ? 1
              : 0),
          used: values.used + Number(discount.usedCount || 0),
        }),
        { total: 0, active: 0, expired: 0, used: 0 }
      ),
    [discounts]
  );

  const filteredDiscounts = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();

    if (!value) return discounts;

    return discounts.filter((discount) =>
      [
        discount.code,
        discount.description,
        discount.discountType,
        discount.isActive ? "active" : "inactive",
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [discounts, searchTerm]);

  const loadDiscounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [discountResponse, settingsResponse] = await Promise.all([
        getDiscountCodes(),
        getDiscountSettings(),
      ]);

      setDiscounts(discountResponse.data || []);
      setSettings(settingsResponse.data || { freeShippingThreshold: null });
      setFreeShippingThresholdInput(
        settingsResponse.data?.freeShippingThreshold
          ? String(settingsResponse.data.freeShippingThreshold)
          : ""
      );
    } catch (error) {
      const message = error.message || "Failed to load discounts.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    queueMicrotask(() => {
      loadDiscounts();
    });
  }, [loadDiscounts]);

  function handleFormChange(event) {
    const { name, type, value, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  }

  function resetForm() {
    setFormData(emptyForm);
    setEditingDiscountId("");
  }

  function handleEdit(discount) {
    setEditingDiscountId(discount.id);
    setFormData({
      code: discount.code || "",
      description: discount.description || "",
      discountType: discount.discountType || "percentage",
      discountValue: String(discount.discountValue ?? ""),
      minimumOrderAmount: String(discount.minimumOrderAmount ?? ""),
      usageLimit: discount.usageLimit ? String(discount.usageLimit) : "",
      startsAt: toDateInputValue(discount.startsAt),
      expiresAt: toDateInputValue(discount.expiresAt),
      isActive: discount.isActive !== false,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError("");

      const payload = {
        code: formData.code,
        description: formData.description,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minimumOrderAmount: Number(formData.minimumOrderAmount || 0),
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        startsAt: formData.startsAt || null,
        expiresAt: formData.expiresAt || null,
        isActive: formData.isActive,
      };

      if (editingDiscountId) {
        await updateDiscountCode(editingDiscountId, payload);
        showToast("Discount code updated.");
      } else {
        await createDiscountCode(payload);
        showToast("Discount code created.");
      }

      resetForm();
      await loadDiscounts();
    } catch (error) {
      const message = error.message || "Failed to save discount code.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(discount) {
    try {
      setActionLoadingId(discount.id);
      setError("");

      if (discount.isActive) {
        await disableDiscountCode(discount.id);
        showToast(`${discount.code} disabled.`);
      } else {
        await enableDiscountCode(discount.id);
        showToast(`${discount.code} enabled.`);
      }
      await loadDiscounts();
    } catch (error) {
      const message = error.message || "Failed to disable discount code.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleDelete(discount) {
    try {
      setActionLoadingId(discount.id);
      setError("");

      await deleteDiscountCode(discount.id);
      showToast(
        Number(discount.usedCount || 0) > 0
          ? `${discount.code} has usage history, so it was disabled.`
          : `${discount.code} deleted.`
      );
      await loadDiscounts();
    } catch (error) {
      const message = error.message || "Failed to delete discount code.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleFreeShippingSubmit(event) {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError("");

      const response = await updateFreeShippingThreshold(
        Number(freeShippingThreshold || 0)
      );

      setSettings(response.data || { freeShippingThreshold: null });
      showToast("Free shipping threshold updated.");
    } catch (error) {
      const message =
        error.message || "Failed to update free shipping threshold.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <AdminTopbar
        title="Discounts"
        subtitle="Manage promo codes and the free shipping threshold."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-header">
          <button
            type="button"
            className="admin-button secondary"
            onClick={loadDiscounts}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
            {isLoading ? "Refreshing..." : "Refresh discounts"}
          </button>
        </div>

        <div className="admin-grid">
          <div className="admin-card">
            <p className="admin-eyebrow">Discount codes</p>
            <h2>{totals.total}</h2>
          </div>

          <div className="admin-card">
            <p className="admin-eyebrow">Active</p>
            <h2>{totals.active}</h2>
          </div>

          <div className="admin-card">
            <p className="admin-eyebrow">Expired</p>
            <h2>{totals.expired}</h2>
          </div>

          <div className="admin-card">
            <p className="admin-eyebrow">Total uses</p>
            <h2>{totals.used}</h2>
          </div>
        </div>

        <div className="admin-card admin-table-card discount-settings-card">
          <div className="admin-table-header">
            <h2>Free shipping</h2>
            <span>
              Current:{" "}
              {settings.freeShippingThreshold
                ? formatNaira(settings.freeShippingThreshold)
                : "Disabled"}
            </span>
          </div>

          <form
            className="discount-settings-form"
            onSubmit={handleFreeShippingSubmit}
          >
            <label>
              Free shipping threshold
              <input
                type="number"
                min="0"
                step="100"
                value={freeShippingThreshold}
                onChange={(event) =>
                  setFreeShippingThresholdInput(event.target.value)
                }
                placeholder="Example: 50000"
              />
            </label>

            <button type="submit" className="admin-button" disabled={isSaving}>
              Save threshold
            </button>
          </form>
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>{editingDiscountId ? "Edit discount" : "Create discount"}</h2>
          </div>

          <form className="admin-product-fields" onSubmit={handleSubmit}>
            <label>
              Code
              <input
                name="code"
                value={formData.code}
                onChange={handleFormChange}
                placeholder="LUMA10"
              />
            </label>

            <label>
              Discount type
              <select
                name="discountType"
                value={formData.discountType}
                onChange={handleFormChange}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>

            <label>
              Discount value
              <input
                name="discountValue"
                type="number"
                min="0"
                step="0.01"
                value={formData.discountValue}
                onChange={handleFormChange}
                placeholder={formData.discountType === "percentage" ? "10" : "5000"}
              />
            </label>

            <label>
              Minimum order amount
              <input
                name="minimumOrderAmount"
                type="number"
                min="0"
                step="100"
                value={formData.minimumOrderAmount}
                onChange={handleFormChange}
                placeholder="0"
              />
            </label>

            <label>
              Usage limit
              <input
                name="usageLimit"
                type="number"
                min="1"
                value={formData.usageLimit}
                onChange={handleFormChange}
                placeholder="Optional"
              />
            </label>

            <label>
              Start date
              <input
                name="startsAt"
                type="date"
                value={formData.startsAt}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Expiry date
              <input
                name="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={handleFormChange}
              />
            </label>

            <label className="full">
              Description
              <textarea
                name="description"
                rows="3"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="Internal note or campaign name"
              />
            </label>

            <label className="discount-checkbox">
              <input
                name="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={handleFormChange}
              />
              Active
            </label>

            <div className="discount-form-actions">
              <button type="submit" className="admin-button" disabled={isSaving}>
                <BadgePercent size={16} />
                {isSaving
                  ? "Saving..."
                  : editingDiscountId
                    ? "Save discount"
                    : "Create discount"}
              </button>

              {editingDiscountId && (
                <button
                  type="button"
                  className="admin-button secondary"
                  onClick={resetForm}
                  disabled={isSaving}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Discount codes</h2>
            <input
              className="admin-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search codes"
              aria-label="Search discount codes"
            />
          </div>

          {isLoading ? (
            <div className="admin-empty">Loading discounts...</div>
          ) : filteredDiscounts.length === 0 ? (
            <div className="admin-empty">No discount codes configured yet.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Value</th>
                    <th>Minimum</th>
                    <th>Usage</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDiscounts.map((discount) => (
                    <tr key={discount.id}>
                      <td>
                        <strong>{discount.code}</strong>
                        <small>{discount.description || "No description"}</small>
                      </td>
                      <td>{formatDiscountValue(discount)}</td>
                      <td>{formatNaira(discount.minimumOrderAmount || 0)}</td>
                      <td>
                        {discount.usedCount || 0}
                        {discount.usageLimit ? ` / ${discount.usageLimit}` : ""}
                      </td>
                      <td>{formatDate(discount.expiresAt)}</td>
                      <td>
                        <span
                          className={
                            discount.isActive
                              ? "status-pill active"
                              : "status-pill inactive"
                          }
                        >
                          {discount.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="discount-table-actions">
                          <button
                            type="button"
                            className="admin-button secondary"
                            onClick={() => handleEdit(discount)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className={
                              discount.isActive
                                ? "admin-button danger"
                                : "admin-button secondary"
                            }
                            onClick={() => handleToggleActive(discount)}
                            disabled={actionLoadingId === discount.id}
                          >
                            {actionLoadingId === discount.id
                              ? "Saving..."
                              : discount.isActive
                                ? "Disable"
                                : "Enable"}
                          </button>

                          <button
                            type="button"
                            className="admin-button danger"
                            onClick={() => handleDelete(discount)}
                            disabled={actionLoadingId === discount.id}
                          >
                            <Trash2 size={15} />
                            Delete
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
