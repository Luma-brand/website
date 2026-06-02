import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2, LockKeyhole } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { formatNaira } from "../utils/currency";

export function Cart() {
  const {
    cartItems,
    subtotal,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
  } = useCart();

  const { isAuthenticated } = useAuth();

  const delivery = cartItems.length > 0 ? 6 : 0;
  const total = subtotal + delivery;

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <Link to="/products" className="back-link">
            <ArrowLeft size={17} />
            Continue shopping
          </Link>

          <p className="eyebrow">Your cart</p>
          <h1>Your LUMA essentials.</h1>
          <p>
            Review your beauty system before checkout. You’ll need a LUMA
            account before placing an order.
          </p>
        </div>

        {cartItems.length === 0 ? (
          <div className="empty-state">
            <h2>Your cart is empty.</h2>
            <p>Add LUMA products from the shop to begin your routine.</p>

            <Link to="/products" className="btn btn-primary">
              Shop products
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-list">
              {cartItems.map((item) => (
                <article className="cart-item" key={item.id}>
                  <div className="cart-item-image">
                    <img src={item.image} alt={item.name} />
                  </div>

                  <div className="cart-item-content">
                    <p>{item.size || "LUMA Beauty"}</p>
                    <h2>{item.name}</h2>
                    <strong>{formatNaira(item.price)}</strong>
                  </div>

                  <div
                    className="quantity-control"
                    aria-label={`Quantity for ${item.name}`}
                  >
                    <button type="button" onClick={() => decreaseQuantity(item.id)}>
                      <Minus size={15} />
                    </button>

                    <span>{item.quantity}</span>

                    <button type="button" onClick={() => increaseQuantity(item.id)}>
                      <Plus size={15} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={17} />
                  </button>
                </article>
              ))}
            </div>

            <aside className="order-summary">
              <h2>Order summary</h2>

              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatNaira(subtotal)}</strong>
              </div>

              <div className="summary-row">
                <span>Estimated delivery</span>
                <strong>{formatNaira(delivery)}</strong>
              </div>

              <div className="summary-line" />

              <div className="summary-row total">
                <span>Total</span>
                <strong>{formatNaira(total)}</strong>
              </div>

              {isAuthenticated ? (
                <Link to="/checkout" className="btn btn-primary summary-button">
                  Checkout
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <Link to="/account" className="btn btn-primary summary-button">
                  <LockKeyhole size={18} />
                  Create account to checkout
                </Link>
              )}

              <p>
                Checkout is protected. You need a LUMA account before placing an
                order.
              </p>
            </aside>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}