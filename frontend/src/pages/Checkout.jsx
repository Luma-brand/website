import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { initializePaystackPayment } from "../services/api";
import { formatNaira } from "../utils/currency";

const initialCheckout = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
};

export function Checkout() {
  const { cartItems, subtotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    ...initialCheckout,
    fullName: user?.name || "",
    email: user?.email || "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const delivery = cartItems.length > 0 ? 6 : 0;
  const total = subtotal + delivery;

  if (!isAuthenticated) {
    return <Navigate to="/account" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));

    setServerError("");
  }

  function validate() {
    const nextErrors = {};

    if (!formData.fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }

    if (!formData.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = "Enter a valid email.";
    }

    if (!formData.phone.trim()) {
      nextErrors.phone = "Phone number is required.";
    }

    if (!formData.address.trim()) {
      nextErrors.address = "Delivery address is required.";
    }

    if (!formData.city.trim()) {
      nextErrors.city = "City is required.";
    }

    if (!formData.country.trim()) {
      nextErrors.country = "Country is required.";
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError("");

      const orderPayload = {
        customerName: formData.fullName,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        deliveryAddress: formData.address,
        city: formData.city,
        country: formData.country,
        totalAmount: total,
        items: cartItems.map((item) => ({
          productId: item.id,
          name: item.name,
          image: item.image,
          price: Number(item.price),
          quantity: item.quantity,
          size: item.size,
        })),
      };

      const response = await initializePaystackPayment(orderPayload);

      clearCart();

      window.location.href = response.data.authorizationUrl;
    } catch (error) {
      setServerError(
        error.message || "Failed to initialize Paystack payment. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <Link to="/cart" className="back-link">
            <ArrowLeft size={17} />
            Back to cart
          </Link>

          <p className="eyebrow">Checkout</p>
          <h1>Complete your routine.</h1>
          <p>Add your delivery details and pay securely with Paystack.</p>
        </div>

        {cartItems.length === 0 && (
          <div className="empty-state checkout-empty-state">
            <h2>Your cart is empty.</h2>
            <p>Add LUMA products before continuing to checkout.</p>

            <Link to="/products" className="btn btn-primary">
              Shop products
            </Link>
          </div>
        )}

        {cartItems.length > 0 && (
          <div className="checkout-layout">
            <form className="checkout-form" onSubmit={handleSubmit} noValidate>
              <div className="form-section-title">
                <LockKeyhole size={18} />
                <h2>Delivery information</h2>
              </div>

              <div className="form-grid two">
                <div className="form-field">
                  <label htmlFor="fullName">Full name</label>
                  <input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Your full name"
                    disabled={isSubmitting}
                  />
                  {errors.fullName && <small>{errors.fullName}</small>}
                </div>

                <div className="form-field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                  />
                  {errors.email && <small>{errors.email}</small>}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+234..."
                  disabled={isSubmitting}
                />
                {errors.phone && <small>{errors.phone}</small>}
              </div>

              <div className="form-field">
                <label htmlFor="address">Delivery address</label>
                <input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address"
                  disabled={isSubmitting}
                />
                {errors.address && <small>{errors.address}</small>}
              </div>

              <div className="form-grid two">
                <div className="form-field">
                  <label htmlFor="city">City</label>
                  <input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    disabled={isSubmitting}
                  />
                  {errors.city && <small>{errors.city}</small>}
                </div>

                <div className="form-field">
                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="Country"
                    disabled={isSubmitting}
                  />
                  {errors.country && <small>{errors.country}</small>}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="paymentMethod">Payment method</label>
                <select id="paymentMethod" name="paymentMethod" value="Paystack" disabled>
                  <option>Paystack</option>
                </select>
              </div>

              {serverError && (
                <div className="empty-state">
                  <p>{serverError}</p>
                </div>
              )}

              <button
                type="submit"
                className="waitlist-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Redirecting to Paystack..." : "Pay with Paystack"}
              </button>
            </form>

            <aside className="order-summary">
              <h2>Checkout summary</h2>

              <div className="mini-cart-list">
                {cartItems.map((item) => (
                  <div className="mini-cart-item" key={item.id}>
                    <span>
                      {item.name} × {item.quantity}
                    </span>

                    <strong>
                      {formatNaira(Number(item.price) * item.quantity)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="summary-line" />

              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatNaira(subtotal)}</strong>
              </div>

              <div className="summary-row">
                <span>Delivery</span>
                <strong>{formatNaira(delivery)}</strong>
              </div>

              <div className="summary-row total">
                <span>Total</span>
                <strong>{formatNaira(total)}</strong>
              </div>
            </aside>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}