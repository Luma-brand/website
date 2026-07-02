import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, Search } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { PageSeo } from "../components/seo/PageSeo";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useToast } from "../context/ToastContext";
import { getProducts } from "../services/api";
import { formatNaira } from "../utils/currency";
import { getProductImage } from "../utils/images";
import {
  getStockMessage,
  isLowStock,
  isProductUnavailable,
} from "../utils/stock";
import { createCanonical } from "../seo/siteSeo";
import {
  breadcrumbJsonLd,
  productsCollectionJsonLd,
} from "../seo/structuredData";

function formatProduct(product) {
  return {
    ...product,
    slug: product.slug || product.id,
    image: getProductImage(product),
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
    const result = addToCart(product);

    showToast(
      result.message ||
        (result.success
          ? `${product.name} added to cart. Go to your cart to checkout.`
          : "Unable to add product to cart."),
      result.success ? "success" : "error"
    );
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
      <PageSeo
        title="Shop Brow Products | LUMA Skincare"
        description="Explore LUMA brow products made for clean, polished, natural-looking brows. Shop premium brow essentials for everyday beauty."
        canonical={createCanonical("/products")}
        structuredData={[
          breadcrumbJsonLd([
            { name: "Home", url: createCanonical("/") },
            { name: "Products", url: createCanonical("/products") },
          ]),
          productsCollectionJsonLd(products),
        ]}
      />
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <p className="eyebrow">Shop LUMA</p>
          <h1>Shop LUMA brow products.</h1>
          <p>
            Explore clean, functional brow essentials created for polished
            everyday styling, natural-looking definition, and soft beauty rituals.
          </p>
        </div>

        <div className="product-tools">
          <label className="product-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search brow products..."
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
              const unavailable = isProductUnavailable(product);

              return (
                <article className="shop-product-card" key={product.id}>
                  <Link
                    to={`/products/${product.slug}`}
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
                      {isLowStock(product) && (
                        <small className="stock-warning">
                          {getStockMessage(product)}
                        </small>
                      )}
                    </div>

                    <div className="shop-product-actions">
                      {unavailable ? (
                        <Link
                          to={`/products/${product.slug}`}
                          className="product-button product-button-link"
                        >
                          Notify me
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="product-button"
                          onClick={() => handleAddToCart(product)}
                        >
                          Add to cart
                        </button>
                      )}
<Link to="/cart" className="product-learn-link mobile-cart-link">
  Go to cart
  <ArrowRight size={16} />
</Link>
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
                        to={`/products/${product.slug}`}
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
