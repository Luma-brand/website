import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { formatNaira } from "../../utils/currency";
import { getProductImage } from "../../utils/images";

function formatProduct(product) {
  return {
    ...product,
    slug: product.slug || product.id,
    image: getProductImage(product),
    priceValue: Number(product.priceValue ?? product.price ?? 0),
  };
}

export function ProductSalesStrip({
  eyebrow,
  title,
  products = [],
  mode = "cards",
  actionLabel = "Add",
}) {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const formattedProducts = products.map(formatProduct).filter((item) => item.id);

  if (!formattedProducts.length) {
    return null;
  }

  function handleAdd(product) {
    const result = addToCart(product);

    showToast(
      result.message ||
        (result.success ? `${product.name} added to cart.` : "Unable to add item."),
      result.success ? "success" : "error"
    );
  }

  function handleAddAll() {
    let added = 0;

    for (const product of formattedProducts) {
      const result = addToCart(product);
      if (result.success) added += 1;
    }

    showToast(
      added
        ? `${added} product${added === 1 ? "" : "s"} added to cart.`
        : "No bundle products could be added.",
      added ? "success" : "error"
    );
  }

  return (
    <section className={`product-sales-strip ${mode}`}>
      <div className="section-heading">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>

      <div className="product-sales-grid">
        {formattedProducts.map((product) => (
          <article className="product-sales-card" key={product.id}>
            <Link to={`/products/${product.slug}`} className="product-sales-image">
              {product.image ? (
                <img src={product.image} alt={product.name} />
              ) : (
                <span>No image</span>
              )}
            </Link>

            <div>
              <p>{product.size || "LUMA Beauty"}</p>
              <h3>{product.name}</h3>
              <strong>{formatNaira(product.priceValue)}</strong>
              <small>
                {Number(product.stock_quantity || product.stockQuantity || 0)} available
              </small>
            </div>

            <button
              type="button"
              className="btn btn-secondary product-sales-add"
              onClick={() => handleAdd(product)}
              disabled={product.can_purchase === false}
            >
              <Plus size={16} />
              {actionLabel}
            </button>
          </article>
        ))}
      </div>

      {mode === "bundle" && formattedProducts.length > 1 && (
        <button type="button" className="btn btn-primary product-sales-bundle" onClick={handleAddAll}>
          Add bundle
          <ArrowRight size={18} />
        </button>
      )}
    </section>
  );
}
