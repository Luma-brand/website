import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";

export function Cart() {
  const {
    cartItems,
    subtotal,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
  } = useCart();

  const delivery = cartItems.length > 0 ? 6 : 0;
  const total = subtotal + delivery;

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <Link to="/" className="back-link">
            <ArrowLeft size={17} />
            Continue shopping
          </Link>

          <p className="eyebrow">Your cart</p>
          <h1>Your LUMA essentials.</h1>
          <p>
            Review your beauty system before checkout. Cart data is saved locally
            for now until backend checkout is connected.
          </p>
        </div>

        {cartItems.length === 0 ? (
          <div className="empty-state">
            <h2>Your cart is empty.</h2>
            <p>Add LUMA products from the homepage to begin your routine.</p>
            <Link to="/#products" className="btn btn-primary">
              Shop products
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-list">
              {cartItems.map((item) => (
                <article className="cart-item" key={item.name}>
                  <div className="cart-item-image">
                    <img src={item.image} alt={item.name} />
                  </div>

                  <div className="cart-item-content">
                    <p>{item.category}</p>
                    <h2>{item.name}</h2>
                    <strong>${item.price}</strong>
                  </div>

                  <div className="quantity-control" aria-label={`Quantity for ${item.name}`}>
                    <button type="button" onClick={() => decreaseQuantity(item.name)}>
                      <Minus size={15} />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => increaseQuantity(item.name)}>
                      <Plus size={15} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => removeFromCart(item.name)}
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
                <strong>${subtotal.toFixed(2)}</strong>
              </div>

              <div className="summary-row">
                <span>Estimated delivery</span>
                <strong>${delivery.toFixed(2)}</strong>
              </div>

              <div className="summary-line" />

              <div className="summary-row total">
                <span>Total</span>
                <strong>${total.toFixed(2)}</strong>
              </div>

              <Link to="/checkout" className="btn btn-primary summary-button">
                Checkout
                <ArrowRight size={18} />
              </Link>

              <p>
                Payments are not live yet. This checkout is frontend-ready for
                future Stripe, Paystack, or backend integration.
              </p>
            </aside>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}