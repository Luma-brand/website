import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { formatNaira } from "../utils/currency";
import { getPublicOrderById, verifyPaystackPayment } from "../services/api";
import { useCart } from "../context/CartContext";
import { markAbandonedCartRecovered } from "../services/growthApi";

export function OrderSuccess() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();

  const reference = searchParams.get("reference");

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { clearCart } = useCart();

  useEffect(() => {
    async function loadOrder() {
      try {
        setIsLoading(true);
        setError("");

        if (reference) {
          await verifyPaystackPayment(reference);
        }

        const response = await getPublicOrderById(orderId);
        setOrder(response.data);

        if (response.data?.payment_status === "paid") {
          const purchaseTrackingKey = `luma_purchase_tracked_${response.data.id}`;

          if (!sessionStorage.getItem(purchaseTrackingKey)) {
            sessionStorage.setItem(purchaseTrackingKey, "true");
          }

          clearCart();
          void markAbandonedCartRecovered({
            orderId,
            customerEmail: response.data.customer_email,
          }).catch(() => {});
        }
      } catch (error) {
        setError(error.message || "Failed to load order.");
      } finally {
        setIsLoading(false);
      }
    }

    loadOrder();
  }, [clearCart, orderId, reference]);

  if (isLoading) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="empty-state">
            <h2>Loading order...</h2>
            <p>Please wait while we confirm your LUMA order.</p>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="empty-state">
            <h2>Order not found.</h2>
            <p>{error || "We could not find this order."}</p>

            <Link to="/products" className="btn btn-primary">
              Continue shopping
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
        <div className="success-panel">
          <CheckCircle2 size={38} />

          <p className="eyebrow">Order received</p>
          <h1>Your LUMA order is confirmed.</h1>

          <p>
            Thank you, {order.customer_name}. Your order has been saved and is
            now awaiting processing.
          </p>

          <div className="order-summary" style={{ marginTop: 24 }}>
            <h2>Order summary</h2>

            <div className="summary-row">
              <span>Order ID</span>
              <strong>{order.id?.slice(0, 8).toUpperCase()}</strong>
            </div>

            <div className="summary-row">
              <span>Email</span>
              <strong>{order.customer_email}</strong>
            </div>

            <div className="summary-row">
              <span>Status</span>
              <strong>{order.status || "pending"}</strong>
            </div>

            <div className="summary-row">
              <span>Payment</span>
              <strong>{order.payment_status || "unpaid"}</strong>
            </div>

            {reference && (
              <div className="summary-row">
                <span>Reference</span>
                <strong>{reference}</strong>
              </div>
            )}

            <div className="summary-line" />

            {(order.items || []).map((item) => (
              <div className="mini-cart-item" key={item.product_name}>
                <span>
                  {item.product_name} × {item.quantity}
                </span>

                <strong>
                  {formatNaira(Number(item.price) * Number(item.quantity))}
                </strong>
              </div>
            ))}

            {order.delivery_fee !== undefined && order.delivery_fee !== null && (
              <div className="summary-row">
                <span>Delivery</span>
                <strong>{formatNaira(order.delivery_fee)}</strong>
              </div>
            )}

            {Number(order.discount_amount || 0) > 0 && (
              <div className="summary-row discount">
                <span>{order.discount_code || "Discount"}</span>
                <strong>-{formatNaira(order.discount_amount)}</strong>
              </div>
            )}

            <div className="summary-line" />

            <div className="summary-row total">
              <span>Total</span>
              <strong>{formatNaira(order.total_amount)}</strong>
            </div>
          </div>

          <Link
            to="/products"
            className="btn btn-primary"
            style={{ marginTop: 24 }}
          >
            Continue shopping
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

