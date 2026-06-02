import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Heart } from "lucide-react";
import { useWishlist } from "../context/WishlistContext";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";
import { getProductById, getProducts } from "../services/api";
import { formatNaira } from "../utils/currency";

function formatProduct(product) {
  return {
    ...product,
    slug: product.id,
    image: product.image_url,
    priceValue: Number(product.price),
        price: formatNaira(product.price),
    description: product.description || "A soft luxury LUMA beauty product.",
  };
}

export function ProductDetails() {
  const { slug } = useParams();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  useEffect(() => {
    async function loadProductDetails() {
      try {
        setIsLoading(true);
        setError("");

        const [singleResponse, allResponse] = await Promise.all([
          getProductById(slug),
          getProducts(),
        ]);

        const selectedProduct = formatProduct(singleResponse.data);

        const related = (allResponse.data || [])
          .filter(
            (item) => item.id !== selectedProduct.id && item.status === "active"
          )
          .slice(0, 3)
          .map(formatProduct);

        setProduct(selectedProduct);
        setRelatedProducts(related);
      } catch (error) {
        setError(error.message || "Failed to load product.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProductDetails();
  }, [slug]);

  if (isLoading) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="empty-state">
            <h2>Loading product...</h2>
            <p>Please wait while we fetch this LUMA product.</p>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="empty-state">
            <h2>Product not found.</h2>
            <p>{error || "This LUMA product does not exist or may have been moved."}</p>
            <Link to="/products" className="btn btn-primary">
              Back to products
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  const saved = isInWishlist(product.slug);
  const isOutOfStock = Number(product.stock_quantity) <= 0;

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
            {product.image ? (
             <img
  src={product.image || product.image_url}
  alt={product.name}
/>
            ) : (
              <div className="empty-state">
                <p>No product image</p>
              </div>
            )}
          </div>

          <div className="product-detail-content">
            <p className="eyebrow">{product.size || "LUMA Beauty"}</p>
            <h1>{product.name}</h1>
            <p>{product.description}</p>

            <div className="product-price-row">
              <strong>{product.price}</strong>
              <span>
                {isOutOfStock
                  ? "Out of stock"
                  : `${product.stock_quantity} in stock`}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary product-detail-button"
              onClick={() => addToCart(product)}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? "Out of stock" : "Add to cart"}
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
                <h2>Product details</h2>

                <span>
                  <Check size={15} />
                  Size: {product.size || "Not specified"}
                </span>

                <span>
                  <Check size={15} />
                  Stock: {product.stock_quantity ?? 0}
                </span>

                <span>
                  <Check size={15} />
                  Status: {product.status}
                </span>
              </div>

              <div>
                <h2>About LUMA</h2>

                <span>
                  <Check size={15} />
                  Soft luxury beauty ritual
                </span>

                <span>
                  <Check size={15} />
                  Designed for everyday use
                </span>

                <span>
                  <Check size={15} />
                  Curated beauty essentials
                </span>
              </div>
            </div>

            <div className="product-how-to">
              <h2>How to use</h2>
              <p>
                Use as part of your daily LUMA beauty ritual. Apply gently and
                consistently for the best experience.
              </p>
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="related-products">
            <div className="section-heading">
              <p className="eyebrow">Complete the routine</p>
              <h2>Pair it with.</h2>
            </div>

            <div className="related-grid">
              {relatedProducts.map((item) => (
                <Link
                  to={`/products/${item.id}`}
                  className="related-card"
                  key={item.id}
                >
                  {item.image && <img src={item.image || item.image_url} alt={item.name} />}
                  <div>
                    <p>{item.size || "LUMA Beauty"}</p>
                    <h3>{item.name}</h3>
                    <strong>{item.price}</strong>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </section>

      <Footer />
    </main>
  );
}