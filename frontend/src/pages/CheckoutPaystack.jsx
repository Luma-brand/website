import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { LocationAutocomplete } from "../components/delivery/LocationAutocomplete";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { validateDiscountCode } from "../services/api";
import { initializePaystackPayment } from "../services/paymentApi";
import { calculateDeliveryFee } from "../services/deliveryApi";
import {
  getGrowthSessionId,
  saveCheckoutStart,
} from "../services/growthApi";
import { formatNaira } from "../utils/currency";
import { getDeliveryFee } from "../utils/delivery";

const initialCheckout = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  region: "",
  area: "",
  country: "Nigeria",
  deliveryNotes: "",
};

export function Checkout() {
  const { cartItems, subtotal, validateCartStock } = useCart();
  const { user, isAuthenticated, isAuthLoading, displayName } = useAuth();

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

  const defaultFullName =
    user?.full_name ||
    user?.name ||
    user?.user_metadata?.name ||
    displayName ||
    "";
  const defaultEmail = user?.email || "";
  const defaultPhone = user?.phone || "";

  const checkoutFormData = useMemo(
    () => ({
      ...formData,
      fullName: formData.fullName || defaultFullName,
      email: formData.email || defaultEmail,
      phone: formData.phone || defaultPhone,
    }),
    [defaultEmail, defaultFullName, defaultPhone, formData]
  );

  const delivery = deliveryQuote
    ? getDeliveryFee(cartItems, deliveryQuote)
    : 0;
  const discountAmount = Number(discountPreview?.discountAmount || 0);
  const displayedDelivery =
    discountPreview?.deliveryFee !== undefined
      ? Number(discountPreview.deliveryFee || 0)
      : delivery;
  const total =
    discountPreview?.totalAmount !== undefined
      ? Number(discountPreview.totalAmount || 0)
      : subtotal + delivery;

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
    let mounted = true;

    async function loadDeliveryQuote() {
      if (
        cartItems.length === 0 ||
        !formData.country ||
        !formData.state ||
        !formData.region
      ) {
        if (mounted) {
          setDeliveryQuote(null);
          setDeliveryError("");
        }
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
          area: formData.area,
        });

        if (mounted) setDeliveryQuote(response.data || null);
      } catch (error) {
        if (mounted) {
          setDeliveryQuote(null);
          setDeliveryError(
            error.message ||
              "Delivery fee could not be calculated for this location."
          );
        }
      } finally {
        if (mounted) setIsDeliveryLoading(false);
      }
    }

    const timer = window.setTimeout(loadDeliveryQuote, 250);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [
    cartItems.length,
    formData.address,
    formData.area,
    formData.country,
    formData.region,
    formData.state,
  ]);

  if (isAuthLoading) {
    return (
      <main className="page-shell inner-page">
        <Header />
        <section className="commerce-page">
          <div className="empty-state">
            <h2>Opening secure checkout...</h2>
            <p>One moment, please.</p>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setServerError("");

    if (["country", "state", "region", "city"].includes(name)) {
      setDiscountPreview(null);
      setDiscountError("");
    }
  }

  function handleLocationSelect(location) {
    setFormData((current) => ({
      ...current,
      address: location.address || current.address,
      country: location.country || current.country,
      state: location.state || current.state,
      region: location.region || current.region || current.city,
      city: location.region || current.city,
      area: location.area || current.area,
    }));
    setErrors({});
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

  async function handleApplyDiscount() {
    const code = discountCode.trim();

    if (!code) {
      setDiscountError("Enter a discount code first.");
      return;
    }

    try {
      setIsDiscountLoading(true);
      setDiscountError("");
      const response = await validateDiscountCode({
        discountCode: code,
        country: formData.country || "Nigeria",
        state: formData.state || "Default",
        city: formData.region || formData.city || "Default",
        area: formData.area || "Default",
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

  function validate() {
    const nextErrors = {};

    if (!checkoutFormData.fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!checkoutFormData.email.trim()) nextErrors.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(checkoutFormData.email)) {
      nextErrors.email = "Enter a valid email.";
    }
    if (!checkoutFormData.phone.trim()) nextErrors.phone = "Phone number is required.";
    if (!formData.address.trim()) nextErrors.address = "Delivery address is required.";
    if (!formData.state.trim()) nextErrors.state = "State is required.";
    if (!formData.region.trim()) nextErrors.region = "City or region is required.";
    if (!formData.country.trim()) nextErrors.country = "Country is required.";
    if (
      cartItems.length > 0 &&
      deliveryQuote?.deliveryFee === undefined
    ) {
      nextErrors.delivery = "Enter a valid location so we can calculate delivery.";
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
      setServerError("Your bag is empty.");
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

      const response = await initializePaystackPayment({
        customerName: checkoutFormData.fullName,
        customerEmail: checkoutFormData.email,
        customerPhone: checkoutFormData.phone,
        deliveryAddress: formData.address,
        city: formData.region || formData.city,
        region: formData.region || formData.city,
        area: formData.area || "Default",
        state: formData.state,
        country: formData.country,
        deliveryNotes: formData.deliveryNotes,
        discountCode: discountPreview?.discountCode || discountCode.trim() || null,
        growthSessionId: getGrowthSessionId(),
        items: getOrderItemsPayload(),
      });

      const authorizationUrl =
        response.checkoutUrl ||
        response.data?.checkoutUrl ||
        response.data?.authorizationUrl;

      if (!authorizationUrl) {
        throw new Error("Paystack did not return a secure checkout URL.");
      }

      window.location.assign(authorizationUrl);
    } catch (error) {
      if (error.status === 409 && error.data?.issues?.length) {
        setServerError(
          error.data.issues.map((issue) => issue.message).join(" ")
        );
      } else {
        setServerError(
          error.message || "Secure payment could not be started. Please try again."
        );
      }
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
            <ArrowLeft size={17} /> Back to bag
          </Link>
          <p className="eyebrow">Secure checkout</p>
          <h1>Almost yours.</h1>
          <p>Delivery details here. Secure payment on Paystack next.</p>
        </div>

        {cartItems.length === 0 ? (
          <div className="empty-state checkout-empty-state">
            <h2>Your bag is empty.</h2>
            <p>Add your LUMA picks before continuing.</p>
            <Link to="/products" className="btn btn-primary">
              Shop LUMA
            </Link>
          </div>
        ) : (
          <div className="checkout-layout">
            <form className="checkout-form" onSubmit={handleSubmit} noValidate>
              <div className="form-section-title">
                <LockKeyhole size={18} />
                <h2>Delivery</h2>
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
                  value={checkoutFormData.phone}
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
                    onChange={handleChange}
                    placeholder="Ikeja, Lekki, Benin City..."
                    disabled={isSubmitting}
                  />
                  {errors.region && <small>{errors.region}</small>}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="area">Area / LGA <span style={{ opacity: 0.55 }}>(optional)</span></label>
                <input
                  id="area"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  placeholder="Optional area or LGA"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-grid two">
                <div className="form-field">
                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="Nigeria"
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
                        ? formatNaira(displayedDelivery)
                        : "Add city and state"}
                  </div>
                  {(deliveryError || errors.delivery) && (
                    <small>{deliveryError || errors.delivery}</small>
                  )}
                  {!deliveryError && deliveryQuote?.etaMinDays !== null && deliveryQuote?.etaMinDays !== undefined && (
                    <small>
                      Estimated delivery: {deliveryQuote.etaMinDays}
                      {deliveryQuote.etaMaxDays && deliveryQuote.etaMaxDays !== deliveryQuote.etaMinDays
                        ? `–${deliveryQuote.etaMaxDays}`
                        : ""} day(s)
                    </small>
                  )}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="deliveryNotes">Delivery notes <span style={{ opacity: 0.55 }}>(optional)</span></label>
                <textarea
                  id="deliveryNotes"
                  name="deliveryNotes"
                  rows="3"
                  value={formData.deliveryNotes}
                  onChange={handleChange}
                  placeholder="Landmark, gate instructions..."
                  disabled={isSubmitting}
                />
              </div>

              <div className="checkout-discount-panel">
                <label htmlFor="checkout-discount-code">Offer code</label>
                <div className="checkout-discount-row">
                  <input
                    id="checkout-discount-code"
                    className="checkout-discount-input"
                    value={discountCode}
                    onChange={(event) => {
                      setDiscountCode(event.target.value.toUpperCase());
                      setDiscountPreview(null);
                      setDiscountError("");
                    }}
                    placeholder="Enter code"
                    autoComplete="off"
                    disabled={isSubmitting || isDiscountLoading}
                  />
                  <button
                    type="button"
                    className="checkout-discount-button"
                    onClick={handleApplyDiscount}
                    disabled={isSubmitting || isDiscountLoading}
                  >
                    {isDiscountLoading ? "Checking…" : "Apply"}
                  </button>
                </div>

                {discountPreview && (
                  <div className="checkout-inline-success">
                    <CheckCircle2 size={16} />
                    {discountPreview.discountCode || discountCode} applied — you save {formatNaira(discountAmount)}.
                  </div>
                )}
                {discountError && <small className="form-error">{discountError}</small>}
              </div>
              {serverError && <div className="checkout-error">{serverError}</div>}

              <button
                type="submit"
                className="btn btn-primary checkout-submit"
                disabled={isSubmitting || isDeliveryLoading}
              >
                <CreditCard size={18} />
                {isSubmitting ? "Opening Paystack..." : `Pay ${formatNaira(total)} securely`}
              </button>

              <div className="checkout-security-note">
                <ShieldCheck size={17} />
                <span>
                  Payment is completed on Paystack's secure checkout. LUMA never receives or stores your card number.
                </span>
              </div>
            </form>

            <aside className="order-summary">
              <p className="eyebrow">Your bag</p>
              <h2>Order summary</h2>

              {(cartItems || []).map((item) => (
                <div className="mini-cart-item" key={`${item.id}-${item.size || "default"}`}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <strong>{formatNaira(Number(item.price) * Number(item.quantity))}</strong>
                </div>
              ))}

              <div className="summary-line" />
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatNaira(subtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Delivery</span>
                <strong>
                  {deliveryQuote?.deliveryFee !== undefined
                    ? displayedDelivery === 0
                      ? "Free"
                      : formatNaira(displayedDelivery)
                    : "—"}
                </strong>
              </div>
              {discountAmount > 0 && (
                <div className="summary-row discount">
                  <span>{discountPreview?.discountCode || discountCode}</span>
                  <strong>-{formatNaira(discountAmount)}</strong>
                </div>
              )}
              <div className="summary-line" />
              <div className="summary-row total">
                <span>Total</span>
                <strong>{formatNaira(total)}</strong>
              </div>

              <div className="checkout-provider-card" style={{ marginTop: 22 }}>
                <LockKeyhole size={18} />
                <div>
                  <strong>Paystack secured</strong>
                  <p style={{ margin: "4px 0 0" }}>Cards and other eligible methods are shown by Paystack based on the business account and customer.</p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
