import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, Trash2 } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import {
  createProductSalesPairing,
  deleteProductSalesPairing,
  getAdminProducts,
  getProductSalesPairings,
} from "../../services/api";
import { formatNaira } from "../../utils/currency";

const relationshipOptions = [
  { value: "related", label: "Related product" },
  { value: "cross_sell", label: "Cart cross-sell" },
  { value: "frequently_bought", label: "Frequently bought together" },
  { value: "bundle", label: "Bundle item" },
  { value: "upsell", label: "One-click upsell" },
];

const initialForm = {
  sourceProductId: "",
  targetProductId: "",
  relationshipType: "related",
  label: "",
  priority: "20",
  isActive: true,
};

export function AdminProductSales() {
  const [products, setProducts] = useState([]);
  const [pairings, setPairings] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeProducts = useMemo(
    () => products.filter((product) => product.id),
    [products]
  );

  const loadProductSales = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [productsResponse, pairingsResponse] = await Promise.all([
        getAdminProducts(),
        getProductSalesPairings(),
      ]);

      setProducts(productsResponse.data || []);
      setPairings(pairingsResponse.data || []);
    } catch (error) {
      setError(error.message || "Failed to load product sales settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadProductSales();
    });
  }, [loadProductSales]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      setIsSubmitting(true);

      await createProductSalesPairing(formData);
      setFormData(initialForm);
      setSuccess("Product sales pairing saved.");
      await loadProductSales();
    } catch (error) {
      setError(error.message || "Failed to save product sales pairing.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(pairingId) {
    try {
      setDeletingId(pairingId);
      setError("");
      setSuccess("");

      await deleteProductSalesPairing(pairingId);
      setPairings((current) => current.filter((item) => item.id !== pairingId));
      setSuccess("Product sales pairing deleted.");
    } catch (error) {
      setError(error.message || "Failed to delete product sales pairing.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <>
      <AdminTopbar
        title="Product sales"
        subtitle="Manage related products, cart cross-sells, bundles, and upsells."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}
        {success && <div className="admin-success">{success}</div>}

        <div className="admin-card admin-product-form-card">
          <div className="admin-table-header">
            <h2>Manual product pairing</h2>
          </div>

          <form className="admin-product-form product-sales-form" onSubmit={handleSubmit}>
            <div className="admin-product-fields">
              <label>
                Source product
                <select
                  name="sourceProductId"
                  value={formData.sourceProductId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Choose source</option>
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Target product
                <select
                  name="targetProductId"
                  value={formData.targetProductId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Choose target</option>
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Sales placement
                <select
                  name="relationshipType"
                  value={formData.relationshipType}
                  onChange={handleChange}
                >
                  {relationshipOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Label
                <input
                  name="label"
                  value={formData.label}
                  onChange={handleChange}
                  placeholder="Complete the routine"
                />
              </label>

              <label>
                Priority
                <input
                  type="number"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  min="0"
                />
              </label>

              <label className="discount-checkbox">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                Active
              </label>

              <button type="submit" className="admin-button" disabled={isSubmitting}>
                <Link2 size={16} />
                {isSubmitting ? "Saving..." : "Save pairing"}
              </button>
            </div>
          </form>
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Current pairings</h2>
            <button
              type="button"
              className="admin-button secondary"
              onClick={loadProductSales}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {isLoading ? (
            <div className="admin-empty">Loading product sales pairings...</div>
          ) : pairings.length === 0 ? (
            <div className="admin-empty">
              No manual pairings yet. Recommendations will use paid order data
              and active product fallbacks.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Target</th>
                    <th>Placement</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pairings.map((pairing) => (
                    <tr key={pairing.id}>
                      <td>
                        <strong>{pairing.source_product_name}</strong>
                      </td>
                      <td>
                        <div className="admin-product-cell">
                          {pairing.target_product_image ? (
                            <img
                              src={pairing.target_product_image}
                              alt={pairing.target_product_name}
                            />
                          ) : (
                            <div className="admin-product-placeholder" />
                          )}
                          <div>
                            <strong>{pairing.target_product_name}</strong>
                            <small>
                              {formatNaira(pairing.target_product_price || 0)}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {relationshipOptions.find(
                          (option) => option.value === pairing.relationship_type
                        )?.label || pairing.relationship_type}
                      </td>
                      <td>{pairing.priority}</td>
                      <td>
                        <span className="admin-badge">
                          {pairing.is_active === false ? "Inactive" : "Active"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-button danger"
                          onClick={() => handleDelete(pairing.id)}
                          disabled={deletingId === pairing.id}
                        >
                          <Trash2 size={15} />
                          {deletingId === pairing.id ? "Deleting..." : "Delete"}
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
