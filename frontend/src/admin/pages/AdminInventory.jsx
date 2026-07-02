import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, FileUp, Minus, Plus, RefreshCw, Save, Truck } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import {
  adjustProductStock,
  bulkUpdateInventoryStock,
  bulkUpdateProductPrices,
  createPurchaseOrder,
  getInventoryOverview,
  getInventoryForecast,
  getInventoryProducts,
  getPurchaseOrders,
  getStockMovements,
  postProductStockAdjustment,
  receivePurchaseOrder,
  uploadProductsCsv,
} from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { formatNaira } from "../../utils/currency";

function formatMovementType(type) {
  return String(type || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStockStatus(status) {
  return String(status || "in_stock").replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString();
}

function getProductSku(product) {
  return product.sku || product.sku_code || product.product_sku || "";
}

export function AdminInventory() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [stockDrafts, setStockDrafts] = useState({});
  const [adjustDrafts, setAdjustDrafts] = useState({});
  const [csvFileName, setCsvFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [bulkPriceText, setBulkPriceText] = useState("");
  const [bulkStockText, setBulkStockText] = useState("");
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [purchaseOrderForm, setPurchaseOrderForm] = useState({
    supplierName: "",
    expectedArrivalDate: "",
    notes: "",
    productId: "",
    quantityOrdered: "",
    unitCost: "",
  });
  const [advancedAction, setAdvancedAction] = useState("");
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const [overviewResponse, productsResponse, movementsResponse] =
        await Promise.all([
          getInventoryOverview(),
          getInventoryProducts(),
          getStockMovements({ limit: 30 }),
        ]);
      const [purchaseOrdersResponse, forecastResponse] = await Promise.all([
        getPurchaseOrders().catch(() => ({ data: [] })),
        getInventoryForecast({ days: 30 }).catch(() => ({ data: [] })),
      ]);

      setOverview(overviewResponse.data || null);
      setProducts(productsResponse.data || []);
      setMovements(movementsResponse.data || []);
      setPurchaseOrders(purchaseOrdersResponse.data || []);
      setForecast(forecastResponse.data || []);
    } catch (error) {
      setError(error.message || "Failed to load inventory.");
      showToast(error.message || "Failed to load inventory.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    queueMicrotask(() => {
      loadInventory();
    });
  }, [loadInventory]);

  const filteredProducts = useMemo(() => {
    const value = search.toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        product.name?.toLowerCase().includes(value) ||
        product.size?.toLowerCase().includes(value) ||
        getProductSku(product).toLowerCase().includes(value);

      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      if (statusFilter === "in-stock") return product.stock_status === "in_stock";
      if (statusFilter === "low-stock") return product.stock_status === "low_stock";
      if (statusFilter === "out-of-stock") {
        return product.stock_status === "out_of_stock";
      }
      if (statusFilter === "inactive") return product.is_active === false;

      return true;
    });
  }, [products, search, statusFilter]);

  async function runStockAction(product, action) {
    try {
      setActionLoadingId(product.id);
      setError("");

      await action();

      await loadInventory();
      showToast(`${product.name} stock updated.`, "success");
    } catch (error) {
      const message = error.message || "Failed to update stock.";
      setError(message);
      showToast(message, "error");
    } finally {
      setActionLoadingId("");
    }
  }

  function getSetStockValue(product) {
    return stockDrafts[product.id] ?? String(product.stock_quantity ?? 0);
  }

  function getAdjustValue(product) {
    return adjustDrafts[product.id] ?? "1";
  }

  function parseWholeNumber(value, { allowZero = false } = {}) {
    if (String(value).trim() === "") {
      return null;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
      return null;
    }

    return parsed;
  }

  function parseBulkLines(text, valueKey) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [productId, value] = line.split(",").map((item) => item.trim());
        return {
          productId,
          [valueKey]: Number(value),
        };
      });
  }

  async function handleCsvFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setCsvFileName(file.name);
    setCsvText(await file.text());
  }

  async function runAdvancedAction(actionName, action, successMessage) {
    try {
      setAdvancedAction(actionName);
      setError("");

      const response = await action();
      await loadInventory();
      showToast(successMessage || response.message || "Action completed.", "success");
    } catch (error) {
      const message = error.message || "Inventory action failed.";
      setError(message);
      showToast(message, "error");
    } finally {
      setAdvancedAction("");
    }
  }

  function handleCsvUpload() {
    if (!csvText.trim()) {
      showToast("Choose a CSV file before uploading.", "error");
      return;
    }

    runAdvancedAction(
      "csv",
      () => uploadProductsCsv(csvText),
      "Product CSV upload processed."
    );
  }

  function handleBulkPriceUpdate() {
    const updates = parseBulkLines(bulkPriceText, "price");

    if (!updates.length) {
      showToast("Add productId,price rows before updating prices.", "error");
      return;
    }

    runAdvancedAction(
      "prices",
      () => bulkUpdateProductPrices(updates),
      "Bulk price update processed."
    );
  }

  function handleBulkStockUpdate() {
    const updates = parseBulkLines(bulkStockText, "stockQuantity");

    if (!updates.length) {
      showToast("Add productId,stockQuantity rows before updating stock.", "error");
      return;
    }

    runAdvancedAction(
      "stock",
      () => bulkUpdateInventoryStock(updates),
      "Bulk inventory update processed."
    );
  }

  function handlePurchaseOrderFormChange(event) {
    const { name, value } = event.target;

    setPurchaseOrderForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleCreatePurchaseOrder(event) {
    event.preventDefault();

    runAdvancedAction(
      "purchase-order",
      () =>
        createPurchaseOrder({
          supplierName: purchaseOrderForm.supplierName,
          expectedArrivalDate: purchaseOrderForm.expectedArrivalDate || null,
          notes: purchaseOrderForm.notes,
          items: [
            {
              productId: purchaseOrderForm.productId,
              quantityOrdered: Number(purchaseOrderForm.quantityOrdered),
              unitCost:
                purchaseOrderForm.unitCost === ""
                  ? null
                  : Number(purchaseOrderForm.unitCost),
            },
          ],
        }),
      "Purchase order created."
    );
  }

  function handleReceivePurchaseOrder(purchaseOrder) {
    runAdvancedAction(
      purchaseOrder.id,
      () => receivePurchaseOrder(purchaseOrder.id),
      "Purchase order received and stock updated."
    );
  }

  function handleSetStock(product) {
    const stockQuantity = parseWholeNumber(getSetStockValue(product), {
      allowZero: true,
    });

    if (stockQuantity === null) {
      showToast("Enter a whole stock number of 0 or more.", "error");
      return;
    }

    runStockAction(product, () =>
      adjustProductStock(product.id, {
        stockQuantity,
        reason: "Admin stock set from inventory page",
      })
    );
  }

  function handleAdjustStock(product, direction) {
    const quantity = parseWholeNumber(getAdjustValue(product));

    if (quantity === null) {
      showToast("Enter a whole adjustment quantity greater than 0.", "error");
      return;
    }

    const signedQuantity = direction === "decrease" ? -quantity : quantity;

    runStockAction(product, () =>
      postProductStockAdjustment(product.id, {
        quantity: signedQuantity,
        movementType: signedQuantity > 0 ? "stock_added" : "stock_reduced",
        reason:
          signedQuantity > 0
            ? "Admin stock increase from inventory page"
            : "Admin stock decrease from inventory page",
      })
    );
  }

  function handleMarkOutOfStock(product) {
    runStockAction(product, () =>
      adjustProductStock(product.id, {
        stockQuantity: 0,
        reason: "Admin marked product out of stock",
      })
    );
  }

  function renderProductActions(product) {
    const isActionLoading = actionLoadingId === product.id;

    return (
      <div className="inventory-actions">
        <div className="inventory-action-row">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={getSetStockValue(product)}
            onChange={(event) =>
              setStockDrafts((current) => ({
                ...current,
                [product.id]: event.target.value,
              }))
            }
            disabled={isActionLoading}
            aria-label={`Set stock for ${product.name}`}
          />

          <button
            type="button"
            className="admin-button secondary inventory-icon-button"
            onClick={() => handleSetStock(product)}
            disabled={isActionLoading}
            title="Set stock"
          >
            <Save size={15} />
            <span>Set</span>
          </button>
        </div>

        <div className="inventory-action-row">
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={getAdjustValue(product)}
            onChange={(event) =>
              setAdjustDrafts((current) => ({
                ...current,
                [product.id]: event.target.value,
              }))
            }
            disabled={isActionLoading}
            aria-label={`Adjustment quantity for ${product.name}`}
          />

          <button
            type="button"
            className="admin-button secondary inventory-icon-button"
            onClick={() => handleAdjustStock(product, "increase")}
            disabled={isActionLoading}
            title="Increase stock"
          >
            <Plus size={15} />
            <span>Add</span>
          </button>

          <button
            type="button"
            className="admin-button secondary inventory-icon-button"
            onClick={() => handleAdjustStock(product, "decrease")}
            disabled={isActionLoading}
            title="Decrease stock"
          >
            <Minus size={15} />
            <span>Less</span>
          </button>
        </div>

        <button
          type="button"
          className="admin-button danger inventory-full-action"
          onClick={() => handleMarkOutOfStock(product)}
          disabled={isActionLoading || Number(product.stock_quantity || 0) === 0}
        >
          <Ban size={15} />
          Mark out of stock
        </button>

        {isActionLoading && <small>Updating stock...</small>}
      </div>
    );
  }

  return (
    <>
      <AdminTopbar
        title="Inventory Management"
        subtitle="Track stock, low-stock products, out-of-stock products, and stock movements."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-header">
          <button
            type="button"
            className="admin-button secondary"
            onClick={loadInventory}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
            {isLoading ? "Refreshing..." : "Refresh inventory"}
          </button>
        </div>

        <div className="admin-grid">
          <div className="admin-card">
            <p className="admin-eyebrow">Total products</p>
            <h2>{overview?.totalProducts ?? 0}</h2>
          </div>

          <div className="admin-card">
            <p className="admin-eyebrow">Total stock quantity</p>
            <h2>{overview?.totalStockQuantity ?? 0}</h2>
          </div>

          <div className="admin-card">
            <p className="admin-eyebrow">Low-stock products</p>
            <h2>{overview?.lowStockProducts ?? 0}</h2>
          </div>

          <div className="admin-card">
            <p className="admin-eyebrow">Out-of-stock products</p>
            <h2>{overview?.outOfStockProducts ?? 0}</h2>
          </div>

          <div className="admin-card">
            <p className="admin-eyebrow">Active products</p>
            <h2>{overview?.activeProducts ?? 0}</h2>
          </div>

          <div className="admin-card">
            <p className="admin-eyebrow">Inactive products</p>
            <h2>{overview?.inactiveProducts ?? 0}</h2>
          </div>
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Inventory products</h2>

            <div className="admin-toolbar-group">
              <input
                className="admin-search"
                type="search"
                placeholder="Search name, size, or SKU..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select
                className="admin-search"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="in-stock">In stock</option>
                <option value="low-stock">Low stock</option>
                <option value="out-of-stock">Out of stock</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="admin-empty">Loading inventory...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="admin-empty">No inventory products found.</div>
          ) : (
            <>
              <div className="admin-table-wrap inventory-table-wrap">
                <table className="admin-table inventory-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Threshold</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="admin-product-cell">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} />
                            ) : (
                              <div className="admin-product-placeholder" />
                            )}

                            <div>
                              <strong>{product.name}</strong>
                              <small>{product.size || "No size"}</small>
                            </div>
                          </div>
                        </td>

                        <td>{getProductSku(product) || "—"}</td>
                        <td>{formatNaira(product.price)}</td>
                        <td>{product.stock_quantity ?? 0}</td>
                        <td>{product.low_stock_threshold ?? 20}</td>
                        <td>
                          <span className="admin-badge">
                            {formatStockStatus(product.stock_status)}
                          </span>
                        </td>
                        <td>{formatDate(product.updated_at)}</td>
                        <td>{renderProductActions(product)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="inventory-card-list">
                {filteredProducts.map((product) => (
                  <article className="inventory-product-card" key={product.id}>
                    <div className="inventory-product-card-header">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} />
                      ) : (
                        <div className="admin-product-placeholder" />
                      )}

                      <div>
                        <h3>{product.name}</h3>
                        <p>{product.size || "No size"}</p>
                      </div>
                    </div>

                    <dl className="inventory-product-details">
                      <div>
                        <dt>SKU</dt>
                        <dd>{getProductSku(product) || "—"}</dd>
                      </div>
                      <div>
                        <dt>Stock</dt>
                        <dd>{product.stock_quantity ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{formatStockStatus(product.stock_status)}</dd>
                      </div>
                      <div>
                        <dt>Threshold</dt>
                        <dd>{product.low_stock_threshold ?? 20}</dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>{formatDate(product.updated_at)}</dd>
                      </div>
                    </dl>

                    {renderProductActions(product)}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="admin-section-grid advanced-inventory-grid">
          <div className="admin-card">
            <div className="admin-table-header">
              <h2>Bulk product CSV upload</h2>
            </div>

            <div className="advanced-inventory-panel">
              <p>
                Upload CSV columns: name, description, price, size,
                stock_quantity, low_stock_threshold, status, is_active,
                is_featured, slug, image_url.
              </p>

              <label className="inventory-file-upload">
                <FileUp size={18} />
                <span>{csvFileName || "Choose product CSV"}</span>
                <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} />
              </label>

              <button
                type="button"
                className="admin-button"
                onClick={handleCsvUpload}
                disabled={advancedAction === "csv"}
              >
                {advancedAction === "csv" ? "Uploading..." : "Upload CSV"}
              </button>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-table-header">
              <h2>Bulk price edits</h2>
            </div>

            <div className="advanced-inventory-panel">
              <p>One product per line: productId,price</p>
              <textarea
                className="admin-textarea"
                rows="6"
                value={bulkPriceText}
                onChange={(event) => setBulkPriceText(event.target.value)}
                placeholder="Product ID,25000"
              />

              <button
                type="button"
                className="admin-button"
                onClick={handleBulkPriceUpdate}
                disabled={advancedAction === "prices"}
              >
                {advancedAction === "prices" ? "Updating..." : "Update prices"}
              </button>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-table-header">
              <h2>Bulk inventory updates</h2>
            </div>

            <div className="advanced-inventory-panel">
              <p>One product per line: productId,stockQuantity</p>
              <textarea
                className="admin-textarea"
                rows="6"
                value={bulkStockText}
                onChange={(event) => setBulkStockText(event.target.value)}
                placeholder="Product ID,40"
              />

              <button
                type="button"
                className="admin-button"
                onClick={handleBulkStockUpdate}
                disabled={advancedAction === "stock"}
              >
                {advancedAction === "stock" ? "Updating..." : "Update stock"}
              </button>
            </div>
          </div>
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Inventory forecasting</h2>
          </div>

          {forecast.length === 0 ? (
            <div className="admin-empty">No forecast data available.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current stock</th>
                    <th>Average daily sales</th>
                    <th>Days until out</th>
                    <th>Forecast</th>
                  </tr>
                </thead>

                <tbody>
                  {forecast.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <div className="admin-product-cell">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.productName} />
                          ) : (
                            <div className="admin-product-placeholder" />
                          )}
                          <div>
                            <strong>{item.productName}</strong>
                            <small>{item.salesWindowDays} day window</small>
                          </div>
                        </div>
                      </td>
                      <td>{item.currentStock}</td>
                      <td>
                        {item.hasEnoughSalesData
                          ? item.averageDailySales
                          : "Not enough sales data yet."}
                      </td>
                      <td>
                        {item.estimatedDaysUntilOutOfStock === null
                          ? "Not enough sales data yet."
                          : `${item.estimatedDaysUntilOutOfStock} days`}
                      </td>
                      <td>{item.message || "Forecast available"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Purchase order management</h2>
          </div>

          <form className="purchase-order-form" onSubmit={handleCreatePurchaseOrder}>
            <label>
              Supplier
              <input
                name="supplierName"
                value={purchaseOrderForm.supplierName}
                onChange={handlePurchaseOrderFormChange}
                placeholder="Supplier name"
                required
              />
            </label>

            <label>
              Expected arrival
              <input
                type="date"
                name="expectedArrivalDate"
                value={purchaseOrderForm.expectedArrivalDate}
                onChange={handlePurchaseOrderFormChange}
              />
            </label>

            <label>
              Product
              <select
                name="productId"
                value={purchaseOrderForm.productId}
                onChange={handlePurchaseOrderFormChange}
                required
              >
                <option value="">Choose product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity
              <input
                type="number"
                min="1"
                name="quantityOrdered"
                value={purchaseOrderForm.quantityOrdered}
                onChange={handlePurchaseOrderFormChange}
                required
              />
            </label>

            <label>
              Unit cost
              <input
                type="number"
                min="0"
                name="unitCost"
                value={purchaseOrderForm.unitCost}
                onChange={handlePurchaseOrderFormChange}
                placeholder="Optional"
              />
            </label>

            <label className="full">
              Notes
              <textarea
                name="notes"
                value={purchaseOrderForm.notes}
                onChange={handlePurchaseOrderFormChange}
                rows="3"
              />
            </label>

            <button
              type="submit"
              className="admin-button"
              disabled={advancedAction === "purchase-order"}
            >
              <Truck size={16} />
              {advancedAction === "purchase-order" ? "Creating..." : "Create PO"}
            </button>
          </form>

          {purchaseOrders.length === 0 ? (
            <div className="admin-empty">No purchase orders yet.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Total cost</th>
                    <th>Expected</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {purchaseOrders.map((purchaseOrder) => (
                    <tr key={purchaseOrder.id}>
                      <td>
                        <strong>{purchaseOrder.supplier_name}</strong>
                        <small>{purchaseOrder.notes || "No notes"}</small>
                      </td>
                      <td>
                        <span className="admin-badge">
                          {purchaseOrder.status}
                        </span>
                      </td>
                      <td>{purchaseOrder.total_quantity_ordered || 0}</td>
                      <td>{purchaseOrder.total_quantity_received || 0}</td>
                      <td>{formatNaira(purchaseOrder.total_cost || 0)}</td>
                      <td>{purchaseOrder.expected_arrival_date || "No date"}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-button secondary"
                          onClick={() => handleReceivePurchaseOrder(purchaseOrder)}
                          disabled={
                            purchaseOrder.status === "received" ||
                            advancedAction === purchaseOrder.id
                          }
                        >
                          {advancedAction === purchaseOrder.id
                            ? "Receiving..."
                            : "Receive stock"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Recent stock movements</h2>
          </div>

          {movements.length === 0 ? (
            <div className="admin-empty">No stock movement yet.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Change</th>
                    <th>Previous</th>
                    <th>New</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.product_name || "Unknown product"}</td>
                      <td>{formatMovementType(movement.movement_type)}</td>
                      <td>{movement.quantity_changed}</td>
                      <td>{movement.previous_stock}</td>
                      <td>{movement.new_stock}</td>
                      <td>{movement.reason || "—"}</td>
                      <td>
                        {movement.created_at
                          ? new Date(movement.created_at).toLocaleString()
                          : "—"}
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
