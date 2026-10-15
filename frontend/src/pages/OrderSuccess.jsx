import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, Check, CheckCircle2, Package, RefreshCw } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { formatNaira } from "../utils/currency";
import { getPublicOrderById } from "../services/api";
import { useCart } from "../context/CartContext";
import { markAbandonedCartRecovered } from "../services/growthApi";
import { getOrderProgress } from "../utils/orderProgress";
import "../styles/order-status.css";

export function OrderSuccess({ tracking = false }) {
  const { orderId } = useParams();
  const [orderRecord, setOrder] = useState(null);
  const order = orderRecord?.id === orderId ? orderRecord : null;
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastChecked, setLastChecked] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const handledOrder = useRef(null);
  const { clearCart } = useCart();

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function loadOrder() {
      setRefreshing(true);
      try {
        const response = await getPublicOrderById(orderId, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setOrder(response.data);
        setError("");
        setLastChecked(new Date());
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(error.message || "We couldn’t load your order. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setRefreshing(false);
          timer = window.setTimeout(loadOrder, 20000);
        }
      }
    }
    void loadOrder();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [orderId, refresh]);

  const paid = order?.payment_status === "paid";
  const customerEmail = order?.customer_email;
  useEffect(() => {
    if (!paid || tracking || handledOrder.current === orderId) return;
    handledOrder.current = orderId;
    const key = `luma_paid_cart_cleared_${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "true");
    } catch { /* Payment confirmation still works when browser storage is unavailable. */ }
    clearCart();
    void markAbandonedCartRecovered({ orderId, customerEmail }).catch(() => {});
  }, [clearCart, customerEmail, orderId, paid, tracking]);

  const progress = getOrderProgress(order);
  const reference = order?.payment_reference || order?.paystack_reference;

  return (
    <main className="page-shell inner-page">
      <Header />
      <section className="commerce-page order-result-page">
        {isLoading ? (
          <div className="success-panel"><Package size={38} /><h1>Opening your order.</h1><p>Please wait a moment.</p></div>
        ) : !order ? (
          <div className="success-panel" role="alert">
            <AlertCircle size={38} /><h1>We couldn’t load your order.</h1>
            <p>{error || "Please check your order link."}</p>
            <button className="btn btn-primary" type="button" disabled={refreshing} onClick={() => setRefresh((n) => n + 1)}>Try again</button>
          </div>
        ) : (
          <>
            <div className="success-panel order-result-hero">
              <div className={`order-result-icon${paid ? " is-paid" : ""}`}>
                {paid ? <CheckCircle2 size={34} /> : <AlertCircle size={34} />}
              </div>
              <p className="eyebrow">{tracking ? "Order tracking" : progress.closed ? "Order update" : paid ? "Payment successful" : "Payment status"}</p>
              <h1>{progress.closed ? progress.title : tracking ? "Your order, at a glance." : paid ? "Payment received. Thank you." : "Payment isn’t confirmed yet."}</h1>
              <p>{progress.closed ? progress.message : paid ? `Thank you, ${order.customer_name}. ${progress.message}`
                : "Your order is saved. If you’ve already paid, check your payment status before trying another payment."}</p>
              <div className="order-actions">
                {!tracking && <Link to={`/track-order/${order.id}`} className="btn btn-primary">Track order <Package size={18} /></Link>}
                <Link to="/products" className={`btn ${tracking ? "btn-primary" : "btn-secondary"}`}>Continue shopping</Link>
                <a href="mailto:hello@shopwithluma.com" className="order-support-link">Contact LUMA</a>
              </div>
            </div>

            <div className="order-result-grid">
              <section className="order-tracking-card" aria-labelledby="tracking-title">
                <div className="order-tracking-heading">
                  <div><p className="eyebrow">Order #{order.id.slice(0, 8).toUpperCase()}</p><h2 id="tracking-title">{progress.title}</h2></div>
                  <button type="button" className="order-refresh" disabled={refreshing} onClick={() => setRefresh((n) => n + 1)} aria-label="Refresh order status"><RefreshCw size={18} className={refreshing ? "payment-spinner" : ""} /></button>
                </div>
                <p className="order-status-note" role="status">{progress.message}</p>
                {error && <p className="order-refresh-error" role="alert">{error} Showing the last saved status.</p>}
                <ol className="order-timeline">
                  {progress.steps.map((step, index) => (
                    <li key={step} className={index < progress.current ? "is-complete" : index === progress.current ? "is-current" : ""} aria-current={index === progress.current ? "step" : undefined}>
                      <span className="order-step-marker">{index < progress.current ? <Check size={16} /> : index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="order-update-time">{lastChecked && `Last checked ${lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. `}Updates automatically.</p>
                {progress.isPickup && order.pickup_branch_name_snapshot && (
                  <div className="order-pickup"><strong>{order.pickup_branch_name_snapshot}</strong><span>{order.pickup_address_snapshot}</span></div>
                )}
                {!paid && !progress.closed && reference && <Link className="btn btn-secondary" to={`/payment/paystack/callback?reference=${encodeURIComponent(reference)}`}>Check payment status</Link>}
                <p className="order-save-link">Save this page’s link to check your order anytime.</p>
              </section>

              <section className="order-summary order-result-summary" aria-labelledby="summary-title">
                <h2 id="summary-title">Order summary</h2>
                <div className="summary-row"><span>Email</span><strong>{order.customer_email}</strong></div>
                <div className="summary-row"><span>Payment</span><strong className={paid ? "order-paid-label" : ""}>{paid ? "Paid" : order.payment_status || "Pending"}</strong></div>
                {reference && <div className="summary-row"><span>Reference</span><strong>{reference}</strong></div>}
                <div className="summary-line" />
                {(order.items || []).map((item, index) => (
                  <div className="mini-cart-item" key={`${item.product_name}-${index}`}>
                    <span>{item.product_name} × {item.quantity}</span>
                    <strong>{formatNaira(Number(item.price) * Number(item.quantity))}</strong>
                  </div>
                ))}
                {order.delivery_fee != null && <div className="summary-row"><span>{progress.isPickup ? "Collection" : "Delivery"}</span><strong>{Number(order.delivery_fee) === 0 ? "Free" : formatNaira(order.delivery_fee)}</strong></div>}
                {Number(order.discount_amount) > 0 && <div className="summary-row discount"><span>{order.discount_code || "Discount"}</span><strong>−{formatNaira(order.discount_amount)}</strong></div>}
                <div className="summary-line" />
                <div className="summary-row total"><span>Total</span><strong>{formatNaira(order.total_amount)}</strong></div>
              </section>
            </div>
          </>
        )}
      </section>
      <Footer />
    </main>
  );
}
