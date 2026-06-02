import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, Search } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useToast } from "../context/ToastContext";
import { getProducts } from "../services/api";
import { formatNaira } from "../utils/currency";

function formatProduct(product) {
  return {
    ...product,
    slug: product.id,
    image: product.image_url,
    priceValue: Number(product.price),
    price: formatNaira(product.price),
    description: product.description || "A soft luxury LUMA beauty product.",
    details: [
      product.size ? `Size: ${product.size}` : null,
      `Stock: ${product.stock_quantity ?? 0}`,
    ].filter(Boolean),
  };
}

export function Products() {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        setIsLoading(true);
        setError("");

        const response = await getProducts();

        const activeProducts = (response.data || [])
          .filter((product) => product.status === "active")
          .map(formatProduct);

        setProducts(activeProducts);
      } catch (error) {
        setError(error.message || "Failed to load products.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProducts();
  }, []);

  function handleAddToCart(product) {
    addToCart(product);
    showToast(`${product.name} added to cart.`);
  }

  function handleToggleWishlist(product) {
    const alreadySaved = isInWishlist(product.slug);

    toggleWishlist(product);

    showToast(
      alreadySaved
        ? `${product.name} removed from wishlist.`
        : `${product.name} saved to wishlist.`,
      alreadySaved ? "info" : "success"
    );
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const value = searchTerm.toLowerCase();

      return (
        product.name.toLowerCase().includes(value) ||
        product.description.toLowerCase().includes(value) ||
        product.size?.toLowerCase().includes(value)
      );
    });
  }, [products, searchTerm]);

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <p className="eyebrow">Shop LUMA</p>
          <h1>The full beauty system.</h1>
          <p>
            Explore clean, functional beauty essentials created for refined
            everyday rituals.
          </p>
        </div>

        <div className="product-tools">
          <label className="product-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>

        {error && (
          <div className="empty-state">
            <h2>Unable to load products.</h2>
            <p>{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="empty-state">
            <h2>Loading products...</h2>
            <p>Please wait while we prepare the LUMA collection.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <h2>No products found.</h2>
            <p>Add active products from the admin dashboard or try another search.</p>
          </div>
        ) : (
          <div className="shop-grid">
            {filteredProducts.map((product) => {
              const saved = isInWishlist(product.slug);

              return (
                <article className="shop-product-card" key={product.id}>
                  <Link
                    to={`/products/${product.id}`}
                    className="shop-product-image"
                  >
                    {product.image ? (
                     <img
  src={product.image || product.image_url}
  alt={product.name}
/>
                    ) : (
                      <div className="empty-state">
                        <p>No image</p>
                      </div>
                    )}
                  </Link>

                  <div className="shop-product-content">
                    <div className="product-meta">
                      <p>{product.size || "LUMA Beauty"}</p>
                      <strong>{product.price}</strong>
                    </div>

                    <h2>{product.name}</h2>
                    <p>{product.description}</p>

                    <div className="product-details">
                      {product.details.map((detail) => (
                        <small key={detail}>{detail}</small>
                      ))}
                    </div>

                    <div className="shop-product-actions">
                      <button
                        type="button"
                        className="product-button"
                        onClick={() => handleAddToCart(product)}
                        disabled={Number(product.stock_quantity) <= 0}
                      >
                        {Number(product.stock_quantity) <= 0
                          ? "Out of stock"
                          : "Add to cart"}
                      </button>

                      <button
                        type="button"
                        className={`wishlist-toggle ${saved ? "saved" : ""}`}
                        onClick={() => handleToggleWishlist(product)}
                        aria-label={
                          saved ? "Remove from wishlist" : "Add to wishlist"
                        }
                      >
                        <Heart size={18} />
                        {saved ? "Saved" : "Save"}
                      </button>

                      <Link
                        to={`/products/${product.id}`}
                        className="product-learn-link"
                      >
                        View details
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}