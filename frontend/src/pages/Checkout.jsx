import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, LockKeyhole, TicketPercent } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { LocationAutocomplete } from "../components/delivery/LocationAutocomplete";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { initializePaystackPayment, validateDiscountCode } from "../services/api";
import { calculateDeliveryFee } from "../services/deliveryApi";
import { getGrowthSessionId, saveCheckoutStart } from "../services/growthApi";
import { formatNaira, getStoredCurrency } from "../utils/currency";
import { getDeliveryFee } from "../utils/delivery";

const initialCheckout = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  region: "",
  country: "",
  deliveryNotes: "",
};

export function Checkout() {
  const { cartItems, subtotal, validateCartStock } = useCart();
  const {
    user,
    isAuthenticated,
    isAuthLoading,
    displayName,
    needsProfileCompletion,
  } = useAuth();

  const [formData, setFormData] = useState(initialCheckout);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [isDeliveryLoading, setIsDeliveryLoading] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountPreview, setDiscountPreview] = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [isDiscountLoading, setIsDiscountLoading] = useState(false);
  const checkoutTrackedRef = useRef(false);

  const delivery = deliveryQuote ? getDeliveryFee(cartItems, deliveryQuote) : 0;
  const discountAmount = Number(discountPreview?.discountAmount || 0);
  const displayedDelivery =
    discountPreview?.deliveryFee !== undefined
      ? Number(discountPreview.deliveryFee || 0)
      : delivery;
  const total =
    discountPreview?.totalAmount !== undefined
      ? Number(discountPreview.totalAmount || 0)
      : subtotal + delivery;
  const defaultFullName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    displayName ||
    "";
  const defaultEmail = user?.email || "";
  const defaultPhone = user?.phone || "";
  const checkoutFormData = {
    ...formData,
    fullName: formData.fullName || defaultFullName,
    email: formData.email || defaultEmail,
    phone: formData.phone || defaultPhone,
  };

  useEffect(() => {
    if (
      checkoutTrackedRef.current ||
      isAuthLoading ||
      !isAuthenticated ||
      cartItems.length === 0
    ) {
      return;
    }

    checkoutTrackedRef.current = true;
    void saveCheckoutStart({
      customerId: user?.id || null,
      customerName: checkoutFormData.fullName,
      customerEmail: checkoutFormData.email,
      customerPhone: checkoutFormData.phone,
      cartItems,
      cartValue: subtotal,
      totalAmount: subtotal,
    }).catch(() => {
      checkoutTrackedRef.current = false;
    });
  }, [
    cartItems,
    checkoutFormData.email,
    checkoutFormData.fullName,
    checkoutFormData.phone,
    isAuthenticated,
    isAuthLoading,
    subtotal,
    user?.id,
  ]);
  useEffect(() => {
    let isMounted = true;

    async function loadDeliveryQuote() {
      if (cartItems.length === 0) {
        setDeliveryQuote(null);
        setDeliveryError("");
        return;
      }

      if (!formData.country || !formData.state || !formData.region) {
        setDeliveryQuote(null);
        setDeliveryError("");
        return;
      }

      try {
        setIsDeliveryLoading(true);
        setDeliveryError("");

        const response = await calculateDeliveryFee({
          address: formData.address,
          country: formData.country,
          state: formData.state,
          region: formData.region,
        });

        if (isMounted) {
          setDeliveryQuote(response.data || null);
        }
      } catch (error) {
        if (isMounted) {
          setDeliveryQuote(null);
          setDeliveryError(
            error.message ||
              "Delivery fee could not be calculated for this location."
          );
        }
      } finally {
        if (isMounted) {
          setIsDeliveryLoading(false);
        }
      }
    }

    queueMicrotask(() => {
      loadDeliveryQuote();
    });

    return () => {
      isMounted = false;
    };
  }, [cartItems.length, formData.address, formData.country, formData.region, formData.state]);

  useEffect(() => {
    queueMicrotask(() => {
      setDiscountPreview(null);
      setDiscountError("");
    });
  }, [cartItems.length, formData.country, formData.region, formData.state]);

  if (isAuthLoading) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="empty-state">
            <h2>Checking account...</h2>
            <p>Please wait while we confirm your LUMA session.</p>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/account" replace />;
  }

  if (needsProfileCompletion) {
    return <Navigate to="/complete-profile" replace />;
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

  function handleLocationSelect(location) {
    setFormData((current) => ({
      ...current,
      address: location.address || current.address,
      country: location.country || current.country,
      state: location.state || current.state,
      region: location.region || current.region || current.city,
      city: location.region || current.city,
    }));

    setErrors((current) => ({
      ...current,
      address: "",
      country: "",
      state: "",
      region: "",
      city: "",
    }));
    setServerError("");
  }

  function getOrderItemsPayload() {
    return cartItems.map((item) => ({
      productId: item.id,
      name: item.name,
      image: item.image,
      price: Number(item.price),
      quantity: item.quantity,
      size: item.size,
    }));
  }

  function handleDiscountCodeChange(event) {
    setDiscountCode(event.target.value);
    setDiscountPreview(null);
    setDiscountError("");
  }

  async function handleApplyDiscount() {
    const code = discountCode.trim();

    if (!code) {
      setDiscountError("Enter a discount code first.");
      return;
    }

    if (cartItems.length === 0) {
      setDiscountError("Add products before applying a discount.");
      return;
    }

    try {
      setIsDiscountLoading(true);
      setDiscountError("");

      const response = await validateDiscountCode({
        discountCode: code,
        country: formData.country || "Default",
        state: formData.state || "Default",
        city: formData.region || formData.city || "Default",
        items: getOrderItemsPayload(),
      });

      setDiscountPreview(response.data || null);
    } catch (error) {
      setDiscountPreview(null);
      setDiscountError(error.message || "Discount code could not be applied.");
    } finally {
      setIsDiscountLoading(false);
    }
  }

  function handleRemoveDiscount() {
    setDiscountCode("");
    setDiscountPreview(null);
    setDiscountError("");
  }

  function validate() {
    const nextErrors = {};

    if (!checkoutFormData.fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }

    if (!checkoutFormData.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(checkoutFormData.email)) {
      nextErrors.email = "Enter a valid email.";
    }

    if (!checkoutFormData.phone.trim()) {
      nextErrors.phone = "Phone number is required.";
    }

    if (!formData.address.trim()) {
      nextErrors.address = "Delivery address is required.";
    }

    if (!formData.state.trim()) {
      nextErrors.state = "State is required.";
    }

    if (!formData.region.trim()) {
      nextErrors.region = "City or region is required.";
    }

    if (!formData.country.trim()) {
      nextErrors.country = "Country is required.";
    }

    if (cartItems.length > 0 && !deliveryQuote?.deliveryFee && deliveryQuote?.deliveryFee !== 0) {
      nextErrors.delivery = "Calculate a valid delivery fee before payment.";
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

    if (cartItems.length === 0) {
      setServerError("Your cart is empty. Please add a product before checkout.");
      return;
    }

    const selectedCurrency = getStoredCurrency();

    if (selectedCurrency !== "NGN") {
      setServerError("International payments are not configured yet. Please switch currency to NGN to complete checkout.");
      return;
    }
    const stockValidation = validateCartStock();

    if (!stockValidation.isValid) {
      setServerError(
        stockValidation.issues.map((issue) => issue.message).join(" ")
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError("");

      const orderPayload = {
        customerName: checkoutFormData.fullName,
        customerEmail: checkoutFormData.email,
        customerPhone: checkoutFormData.phone,
        deliveryAddress: formData.address,
        city: formData.region || formData.city,
        state: formData.state,
        country: formData.country,
        deliveryNotes: formData.deliveryNotes,
        discountCode: discountPreview?.discountCode || null,
        growthSessionId: getGrowthSessionId(),
        totalAmount: total,
        items: getOrderItemsPayload(),
      };

      const response = await initializePaystackPayment(orderPayload);
      const authorizationUrl = response.data?.authorizationUrl;

      if (!authorizationUrl) {
        throw new Error("The payment provider did not return an authorization URL.");
      }

      window.location.href = authorizationUrl;
    } catch (error) {
      if (error.status === 409 && error.data?.issues?.length) {
        setServerError(
          error.data.issues.map((issue) => issue.message).join(" ")
        );
        return;
      }

      setServerError(
        error.message || "Failed to initialize secure payment. Please try again."
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
          <p>Add your delivery details and pay securely online.</p>
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
                    value={checkoutFormData.fullName}
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
                    value={checkoutFormData.email}
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

              <LocationAutocomplete
                id="address"
                name="address"
                label="Delivery address"
                value={formData.address}
                onChange={handleChange}
                onSelect={handleLocationSelect}
                placeholder="Search or enter your delivery address"
                disabled={isSubmitting}
                error={errors.address}
              />

              <div className="form-grid two">
                <div className="form-field">
                  <label htmlFor="state">State</label>
                  <input
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Lagos"
                    disabled={isSubmitting}
                  />
                  {errors.state && <small>{errors.state}</small>}
                </div>

                <div className="form-field">
                  <label htmlFor="region">City / region</label>
                  <input
                    id="region"
                    name="region"
                    value={formData.region}
                    onChange={(event) => {
                      handleChange(event);
                      setFormData((current) => ({
                        ...current,
                        city: event.target.value,
                      }));
                    }}
                    placeholder="Ikeja, Lekki, Abuja..."
                    disabled={isSubmitting}
                  />
                  {errors.region && <small>{errors.region}</small>}
                </div>
              </div>

              <div className="form-grid two">
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

                <div className="form-field delivery-fee-status">
                  <label>Delivery fee</label>
                  <div className="delivery-fee-preview">
                    {isDeliveryLoading
                      ? "Calculating..."
                      : deliveryQuote?.deliveryFee !== undefined
                        ? formatNaira(deliveryQuote.deliveryFee)
                        : "Enter location to calculate"}
                  </div>
                  {(deliveryError || errors.delivery) && (
                    <small>{deliveryError || errors.delivery}</small>
                  )}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="deliveryNotes">Delivery notes</label>
                <textarea
                  id="deliveryNotes"
                  name="deliveryNotes"
                  rows="4"
                  value={formData.deliveryNotes}
                  onChange={handleChange}
                  placeholder="Gate code, landmark, preferred delivery time..."
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-field">
                <label htmlFor="paymentMethod">Payment method</label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  value="Paystack"
                  disabled
                >
                  <option>Secure online payment</option>
                </select>
              </div>

              <div className="checkout-discount-panel">
                <div className="form-section-title">
                  <TicketPercent size={18} />
                  <h2>Discount code</h2>
                </div>

                <div className="checkout-discount-row">
                  <div className="form-field">
                    <label htmlFor="discountCode">Code</label>
                    <input
                      id="discountCode"
                      name="discountCode"
                      value={discountCode}
                      onChange={handleDiscountCodeChange}
                      placeholder="Enter code"
                      disabled={isSubmitting || isDiscountLoading}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary checkout-discount-button"
                    onClick={handleApplyDiscount}
                    disabled={isSubmitting || isDiscountLoading}
                  >
                    {isDiscountLoading ? "Checking..." : "Apply"}
                  </button>
                </div>

                {discountPreview?.discountCode && (
                  <div className="checkout-discount-applied">
                    <p className="checkout-discount-success">
                      {discountPreview.discountCode} applied.
                    </p>
                    <button type="button" onClick={handleRemoveDiscount}>
                      Remove
                    </button>
                  </div>
                )}

                {discountError && (
                  <p className="checkout-discount-error">{discountError}</p>
                )}
              </div>

              {serverError && (
                <div className="empty-state">
                  <p>{serverError}</p>
                </div>
              )}

              <button
                type="submit"
                className="waitlist-button"
                disabled={isSubmitting || isDeliveryLoading || Boolean(deliveryError)}
              >
                {isSubmitting ? "Redirecting to secure payment..." : "Pay securely now"}
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
                <strong>
                  {isDeliveryLoading
                    ? "Calculating..."
                    : !deliveryQuote
                      ? "Enter location"
                    : displayedDelivery === 0 &&
                        discountPreview?.freeShipping
                      ? "Free"
                      : formatNaira(displayedDelivery)}
                </strong>
              </div>

              {deliveryQuote?.matchedZone && (
                <p className="checkout-summary-note">
                  Delivery zone: {[deliveryQuote.matchedZone.region, deliveryQuote.matchedZone.state]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}

              {deliveryError && (
                <p className="checkout-discount-error">{deliveryError}</p>
              )}

              {discountAmount > 0 && (
                <div className="summary-row discount">
                  <span>Discount</span>
                  <strong>-{formatNaira(discountAmount)}</strong>
                </div>
              )}

              {discountPreview?.freeShipping && (
                <p className="checkout-summary-note">
                  Free shipping applied to this order.
                </p>
              )}

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




