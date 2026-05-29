import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const initialCheckout = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  paymentMethod: "Card payment",
};

export function Checkout() {
    const navigate = useNavigate();
const { cartItems, subtotal, clearCart, createOrder } = useCart();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    ...initialCheckout,
    fullName: user?.name || "",
    email: user?.email || "",
  });

  const [errors, setErrors] = useState({});
  const [isComplete, setIsComplete] = useState(false);

  const delivery = cartItems.length > 0 ? 6 : 0;
  const total = subtotal + delivery;

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

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

  const order = createOrder({
  customer: {
    fullName: formData.fullName,
    email: formData.email,
    phone: formData.phone,
    address: formData.address,
    city: formData.city,
    country: formData.country,
  },
  paymentMethod: formData.paymentMethod,
  subtotal,
  delivery,
  total,
});

console.log("LUMA checkout order:", order);

clearCart();
navigate(`/order-success/${order.id}`);
  }

  if (isComplete) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="success-panel">
            <CheckCircle2 size={34} />
            <p className="eyebrow">Order received</p>
            <h1>Your LUMA order is prepared.</h1>
            <p>
              This is a frontend confirmation. When backend/payment is connected,
              this page will save orders and send email confirmations.
            </p>

            <Link to="/" className="btn btn-primary">
              Back to homepage
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    );
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
          <p>
            Add delivery details and choose a payment method. Payment connection
            will be added when backend or payment provider is ready.
          </p>
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
                  />
                  {errors.country && <small>{errors.country}</small>}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="paymentMethod">Payment method</label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                >
                  <option>Card payment</option>
                  <option>Bank transfer</option>
                  <option>Paystack later</option>
                </select>
              </div>

              <button type="submit" className="waitlist-button">
                Place frontend order
              </button>
            </form>

            <aside className="order-summary">
              <h2>Checkout summary</h2>

              <div className="mini-cart-list">
                {cartItems.map((item) => (
                  <div className="mini-cart-item" key={item.name}>
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <strong>${(item.price * item.quantity).toFixed(2)}</strong>
                  </div>
                ))}
              </div>

              <div className="summary-line" />

              <div className="summary-row">
                <span>Subtotal</span>
                <strong>${subtotal.toFixed(2)}</strong>
              </div>

              <div className="summary-row">
                <span>Delivery</span>
                <strong>${delivery.toFixed(2)}</strong>
              </div>

              <div className="summary-row total">
                <span>Total</span>
                <strong>${total.toFixed(2)}</strong>
              </div>
            </aside>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}