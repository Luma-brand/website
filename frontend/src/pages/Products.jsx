import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, Search } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { products } from "../data/siteContent";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useToast } from "../context/ToastContext";

const categories = ["All", ...new Set(products.map((product) => product.category))];

export function Products() {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
const { showToast } = useToast();

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
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        activeCategory === "All" || product.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, activeCategory]);

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <p className="eyebrow">Shop LUMA</p>
          <h1>The full beauty system.</h1>
          <p>
            Explore clean, functional essentials for brows, lashes, and edges —
            made to bring professional-level results into everyday life.
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

          <div className="category-filters" aria-label="Product categories">
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={activeCategory === category ? "active" : ""}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <h2>No products found.</h2>
            <p>Try another search term or category.</p>
          </div>
        ) : (
          <div className="shop-grid">
            {filteredProducts.map((product) => {
              const saved = isInWishlist(product.slug);

              return (
                <article className="shop-product-card" key={product.slug}>
                  <Link to={`/products/${product.slug}`} className="shop-product-image">
                    <img src={product.image} alt={product.name} />
                  </Link>

                  <div className="shop-product-content">
                    <div className="product-meta">
                      <p>{product.category}</p>
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
                      >
                        Add to cart
                      </button>

                      <button
                        type="button"
                        className={`wishlist-toggle ${saved ? "saved" : ""}`}
                        onClick={() => handleToggleWishlist(product)}
                        aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
                      >
                        <Heart size={18} />
                        {saved ? "Saved" : "Save"}
                      </button>

                      <Link to={`/products/${product.slug}`} className="product-learn-link">
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