import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Heart, ShoppingBag, Trash2 } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";

export function Wishlist() {
  const { addToCart } = useCart();
  const { wishlistItems, toggleWishlist, clearWishlist } = useWishlist();

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <Link to="/products" className="back-link">
            <ArrowLeft size={17} />
            Back to products
          </Link>

          <p className="eyebrow">Wishlist</p>
          <h1>Your saved beauty shelf.</h1>
          <p>
            Keep LUMA products saved for later. Wishlist data is stored locally
            in the browser for now.
          </p>
        </div>

        {wishlistItems.length === 0 ? (
          <div className="empty-state">
            <Heart size={28} />
            <h2>No saved products yet.</h2>
            <p>Save LUMA products you want to revisit later.</p>

            <Link to="/products" className="btn btn-primary">
              Explore products
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <>
            <div className="wishlist-actions-row">
              <p>{wishlistItems.length} saved product(s)</p>

              <button type="button" onClick={clearWishlist}>
                <Trash2 size={16} />
                Clear wishlist
              </button>
            </div>

            <div className="wishlist-grid">
              {wishlistItems.map((product) => (
                <article className="wishlist-card" key={product.slug}>
                  <Link to={`/products/${product.slug}`} className="wishlist-image">
                    <img src={product.image} alt={product.name} />
                  </Link>

                  <div className="wishlist-content">
                    <p>{product.category}</p>
                    <h2>{product.name}</h2>
                    <span>{product.price}</span>

                    <div className="wishlist-card-actions">
                      <button type="button" onClick={() => addToCart(product)}>
                        <ShoppingBag size={16} />
                        Add to cart
                      </button>

                      <button type="button" onClick={() => toggleWishlist(product)}>
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <Footer />
    </main>
  );
}