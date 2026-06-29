import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import {
  createProduct,
  deleteProduct,
  getAdminProducts,
  updateProduct,
} from "../../services/api";
import { formatNaira } from "../../utils/currency";

const initialForm = {
  name: "",
  description: "",
  price: "",
  size: "",
  stockQuantity: "",
  lowStockThreshold: "20",
  status: "draft",
  isActive: true,
  isFeatured: false,
  slug: "",
  metaTitle: "",
  metaDescription: "",
  image: null,
};

function getStockLabel(product) {
  if (product.stock_status === "out_of_stock") return "Out of stock";
  if (product.stock_status === "low_stock") return "Low stock";
  return "In stock";
}

export function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [imagePreview, setImagePreview] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminProducts();
      setProducts(response.data || []);
    } catch (error) {
      setError(error.message || "Failed to load products.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadProducts();
    });
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const value = search.toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        product.name?.toLowerCase().includes(value) ||
        product.description?.toLowerCase().includes(value) ||
        product.size?.toLowerCase().includes(value) ||
        product.status?.toLowerCase().includes(value);

      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      if (statusFilter === "active") return product.is_active !== false;
      if (statusFilter === "inactive") return product.is_active === false;
      if (statusFilter === "featured") return product.is_featured === true;
      if (statusFilter === "in-stock") return product.stock_status === "in_stock";
      if (statusFilter === "low-stock") return product.stock_status === "low_stock";
      if (statusFilter === "out-of-stock") {
        return product.stock_status === "out_of_stock";
      }

      return true;
    });
  }, [products, search, statusFilter]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFormData((current) => ({
      ...current,
      image: file,
    }));

    setImagePreview(URL.createObjectURL(file));
  }

  function buildProductFormData() {
    const data = new FormData();

    data.append("name", formData.name);
    data.append("description", formData.description);
    data.append("price", formData.price);
    data.append("size", formData.size);
    data.append("stockQuantity", formData.stockQuantity || "0");
    data.append("lowStockThreshold", formData.lowStockThreshold || "20");
    data.append("status", formData.status);
    data.append("isActive", String(formData.isActive));
    data.append("isFeatured", String(formData.isFeatured));
    data.append("slug", formData.slug);
    data.append("metaTitle", formData.metaTitle);
    data.append("metaDescription", formData.metaDescription);

    if (formData.image) {
      data.append("image", formData.image);
    }

    return data;
  }

  function resetForm() {
    setFormData(initialForm);
    setEditingProduct(null);
    setImagePreview("");
  }

  function startEdit(product) {
    setEditingProduct(product);

    setFormData({
      name: product.name || "",
      description: product.description || "",
      price: product.price || "",
      size: product.size || "",
      stockQuantity: product.stock_quantity ?? "",
      lowStockThreshold: product.low_stock_threshold ?? "20",
      status: product.status || "draft",
      isActive: product.is_active !== false,
      isFeatured: product.is_featured === true,
      slug: product.slug || "",
      metaTitle: product.meta_title || "",
      metaDescription: product.meta_description || "",
      image: null,
    });

    setImagePreview(product.image_url || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.name.trim() || !formData.price) {
      alert("Product name and price are required.");
      return;
    }

    try {
      setIsSubmitting(true);

      const productPayload = buildProductFormData();

      if (editingProduct) {
        const response = await updateProduct(editingProduct.id, productPayload);

        setProducts((current) =>
          current.map((product) =>
            product.id === editingProduct.id ? response.data : product
          )
        );
      } else {
        const response = await createProduct(productPayload);

        setProducts((current) => [response.data, ...current]);
      }

      resetForm();
    } catch (error) {
      alert(error.message || "Failed to save product.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(product) {
    const confirmed = window.confirm(`Delete ${product.name}?`);

    if (!confirmed) return;

    try {
      setActionLoadingId(product.id);

      await deleteProduct(product.id);

      setProducts((current) =>
        current.filter((item) => item.id !== product.id)
      );

      if (editingProduct?.id === product.id) {
        resetForm();
      }
    } catch (error) {
      alert(error.message || "Failed to delete product.");
    } finally {
      setActionLoadingId("");
    }
  }

  return (
    <>
      <AdminTopbar
        title="Products"
        subtitle="Create, edit, and manage all LUMA products."
      />

      <section className="admin-content">
        <div className="admin-card admin-product-form-card">
          <div className="admin-table-header">
            <h2>{editingProduct ? "Edit product" : "Add new product"}</h2>

            {editingProduct && (
              <button
                type="button"
                className="admin-button secondary"
                onClick={resetForm}
              >
                <X size={16} />
                Cancel edit
              </button>
            )}
          </div>

          <form className="admin-product-form" onSubmit={handleSubmit}>
            <div className="admin-product-image-box">
              {imagePreview ? (
                <img src={imagePreview} alt="Product preview" />
              ) : (
                <div>
                  <ImagePlus size={34} />
                  <span>Upload product image</span>
                </div>
              )}

              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleImageChange}
              />
            </div>

            <div className="admin-product-fields">
              <label>
                Product name
                <input
                  type="text"
                  name="name"
                  placeholder="LUMA Glow Serum"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Price NGN
                <input
                  type="number"
                  name="price"
                  placeholder="35000"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Size
                <input
                  type="text"
                  name="size"
                  placeholder="50ml"
                  value={formData.size}
                  onChange={handleChange}
                />
              </label>

              <label>
                Stock quantity
                <input
                  type="number"
                  name="stockQuantity"
                  placeholder="20"
                  min="0"
                  value={formData.stockQuantity}
                  onChange={handleChange}
                />
              </label>

              <label>
                Low-stock threshold
                <input
                  type="number"
                  name="lowStockThreshold"
                  placeholder="20"
                  min="0"
                  value={formData.lowStockThreshold}
                  onChange={handleChange}
                />
              </label>

              <label>
                Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </label>

              <label>
                <span>Product visibility</span>
                <select
                  name="isActive"
                  value={formData.isActive ? "true" : "false"}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      isActive: event.target.value === "true",
                    }))
                  }
                >
                  <option value="true">Visible / Active</option>
                  <option value="false">Hidden / Inactive</option>
                </select>
              </label>

              <label>
                <span>Featured product</span>
                <select
                  name="isFeatured"
                  value={formData.isFeatured ? "true" : "false"}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      isFeatured: event.target.value === "true",
                    }))
                  }
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>

              <label>
                SEO slug
                <input
                  type="text"
                  name="slug"
                  placeholder="luma-glow-serum"
                  value={formData.slug}
                  onChange={handleChange}
                />
              </label>

              <label>
                Meta title
                <input
                  type="text"
                  name="metaTitle"
                  placeholder="LUMA Glow Serum"
                  maxLength="180"
                  value={formData.metaTitle}
                  onChange={handleChange}
                />
              </label>

              <label className="full">
                Description
                <textarea
                  name="description"
                  placeholder="Describe the product..."
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                />
              </label>

              <label className="full">
                Meta description
                <textarea
                  name="metaDescription"
                  placeholder="Short SEO description for search and link previews..."
                  value={formData.metaDescription}
                  onChange={handleChange}
                  rows="3"
                  maxLength="300"
                />
              </label>

              <button
                type="submit"
                className="admin-button"
                disabled={isSubmitting}
              >
                <Plus size={16} />
                {isSubmitting
                  ? "Saving..."
                  : editingProduct
                  ? "Update product"
                  : "Create product"}
              </button>
            </div>
          </form>
        </div>

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>All products</h2>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="admin-search"
                type="search"
                placeholder="Search products..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select
                className="admin-search"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="featured">Featured</option>
                <option value="in-stock">In stock</option>
                <option value="low-stock">Low stock</option>
                <option value="out-of-stock">Out of stock</option>
              </select>
            </div>
          </div>

          {error && <div className="admin-error">{error}</div>}

          {isLoading ? (
            <div className="admin-empty">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="admin-empty">No products found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Size</th>
                    <th>Stock</th>
                    <th>Low stock</th>
                    <th>Visibility</th>
                    <th>Status</th>
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
                            <small>/{product.slug || product.id}</small>
                            <small>{product.description || "No description"}</small>
                            {product.is_featured && (
                              <small>Featured product</small>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>{formatNaira(product.price)}</td>
                      <td>{product.size || "—"}</td>
                      <td>
                        <strong>{product.stock_quantity ?? 0}</strong>
                        <br />
                        <small>{getStockLabel(product)}</small>
                      </td>
                      <td>{product.low_stock_threshold ?? 20}</td>
                      <td>
                        <span className="admin-badge">
                          {product.is_active === false ? "Hidden" : "Visible"}
                        </span>
                      </td>
                      <td>
                        <span className="admin-badge">
                          {product.status || "draft"}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="admin-button secondary"
                            onClick={() => startEdit(product)}
                          >
                            <Edit3 size={15} />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="admin-button danger"
                            onClick={() => handleDelete(product)}
                            disabled={actionLoadingId === product.id}
                          >
                            <Trash2 size={15} />
                            {actionLoadingId === product.id
                              ? "Deleting..."
                              : "Delete"}
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
