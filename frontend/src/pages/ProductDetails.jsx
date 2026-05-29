import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Heart } from "lucide-react";
import { useWishlist } from "../context/WishlistContext";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";
import { getProductBySlug, getRelatedProducts } from "../utils/productUtils";

export function ProductDetails() {
  const { slug } = useParams();
  const product = getProductBySlug(slug);
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  if (!product) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="empty-state">
            <h2>Product not found.</h2>
            <p>This LUMA product does not exist or may have been moved.</p>
            <Link to="/products" className="btn btn-primary">
              Back to products
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  const relatedProducts = getRelatedProducts(product.slug);

  const saved = isInWishlist(product.slug);

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="product-detail-page">
        <Link to="/products" className="back-link">
          <ArrowLeft size={17} />
          Back to products
        </Link>

        <div className="product-detail-layout">
          <div className="product-detail-image">
            <img src={product.image} alt={product.name} />
          </div>

          <div className="product-detail-content">
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            <p>{product.longDescription}</p>

            <div className="product-price-row">
              <strong>{product.price}</strong>
              <span>Frontend product preview</span>
            </div>

            <button
              type="button"
              className="btn btn-primary product-detail-button"
              onClick={() => addToCart(product)}
            >
              Add to cart
              <ArrowRight size={18} />
            </button>
            <button
  type="button"
  className={`wishlist-detail-button ${saved ? "saved" : ""}`}
  onClick={() => toggleWishlist(product)}
>
  <Heart size={18} />
  {saved ? "Saved to wishlist" : "Save to wishlist"}
</button>

            <div className="product-info-grid">
              <div>
                <h2>Best for</h2>
                {product.bestFor.map((item) => (
                  <span key={item}>
                    <Check size={15} />
                    {item}
                  </span>
                ))}
              </div>

              <div>
                <h2>What’s included</h2>
                {product.includes.map((item) => (
                  <span key={item}>
                    <Check size={15} />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="product-how-to">
              <h2>How to use</h2>
              <p>{product.howToUse}</p>
            </div>
          </div>
        </div>

        <section className="related-products">
          <div className="section-heading">
            <p className="eyebrow">Complete the routine</p>
            <h2>Pair it with.</h2>
          </div>

          <div className="related-grid">
            {relatedProducts.map((item) => (
              <Link
                to={`/products/${item.slug}`}
                className="related-card"
                key={item.slug}
              >
                <img src={item.image} alt={item.name} />
                <div>
                  <p>{item.category}</p>
                  <h3>{item.name}</h3>
                  <strong>{item.price}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <Footer />
    </main>
  );
}