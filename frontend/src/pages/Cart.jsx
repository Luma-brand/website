import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2, LockKeyhole } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { ProductSalesStrip } from "../components/product/ProductSalesStrip";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getCartSalesRecommendations } from "../services/api";
import { formatNaira } from "../utils/currency";
import { getDeliveryFee } from "../utils/delivery";
import { getImageUrl } from "../utils/images";

export function Cart() {
  const {
    cartItems,
    subtotal,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    validateCartStock,
  } = useCart();

  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [crossSells, setCrossSells] = useState([]);

  const delivery = getDeliveryFee(cartItems);
  const total = subtotal + delivery;
  const cartStockValidation = validateCartStock();
  const cartProductIds = useMemo(
    () => cartItems.map((item) => item.id).filter(Boolean),
    [cartItems]
  );

  useEffect(() => {
    if (!cartProductIds.length) {
      queueMicrotask(() => {
        setCrossSells([]);
      });
      return;
    }

    let isMounted = true;

    getCartSalesRecommendations({
      productIds: cartProductIds,
      limit: 4,
    })
      .then((response) => {
        if (!isMounted) return;
        setCrossSells(response.data?.crossSells || []);
      })
      .catch(() => {
        if (isMounted) setCrossSells([]);
      });

    return () => {
      isMounted = false;
    };
  }, [cartProductIds]);

  function handleIncreaseQuantity(productId) {
    const result = increaseQuantity(productId);

    if (!result.success) {
      showToast(result.message || "Unable to increase quantity.", "error");
    }
  }

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
                    {getImageUrl(item.image) ? (
                      <img src={getImageUrl(item.image)} alt={item.name} />
                    ) : (
                      <span className="image-fallback">LUMA</span>
                    )}
                  </div>

                  <div className="cart-item-content">
                    <p>{item.size || "LUMA Beauty"}</p>
                    <h2>{item.name}</h2>
                    <strong>{formatNaira(item.price)}</strong>
                    <small className="stock-note">
                      {item.isActive === false
                        ? "Currently unavailable"
                        : Number(item.stockQuantity || 0) <= 0
                        ? "Out of stock"
                        : `${item.stockQuantity} available`}
                    </small>
                  </div>

                  <div
                    className="quantity-control"
                    aria-label={`Quantity for ${item.name}`}
                  >
                    <button type="button" onClick={() => decreaseQuantity(item.id)}>
                      <Minus size={15} />
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      type="button"
                      onClick={() => handleIncreaseQuantity(item.id)}
                      disabled={
                        item.isActive === false ||
                        Number(item.stockQuantity || 0) <= 0 ||
                        item.quantity >= Number(item.stockQuantity || 0)
                      }
                    >
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

              {!cartStockValidation.isValid && (
                <div className="cart-stock-alert">
                  {cartStockValidation.issues.map((issue) => (
                    <p key={`${issue.productId}-${issue.message}`}>
                      {issue.message}
                    </p>
                  ))}
                </div>
              )}

              {!cartStockValidation.isValid ? (
                <button
                  type="button"
                  className="btn btn-primary summary-button"
                  disabled
                >
                  Resolve stock issues
                </button>
              ) : isAuthenticated ? (
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

        {cartItems.length > 0 && (
          <ProductSalesStrip
            eyebrow="Complete your cart"
            title="Customers also pair these with LUMA essentials."
            products={crossSells}
            actionLabel="Add"
          />
        )}
      </section>

      <Footer />
    </main>
  );
}
