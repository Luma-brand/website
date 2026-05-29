import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, PackageCheck } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";
import { formatCurrency, formatOrderDate, getOrderById } from "../utils/orderUtils";

export function OrderSuccess() {
  const { orderId } = useParams();
  const { orders } = useCart();

  const order = getOrderById(orders, orderId);

  if (!order) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="empty-state">
            <PackageCheck size={30} />
            <h2>Receipt not found.</h2>
            <p>
              This order receipt could not be found in this browser. It may have
              been cleared from local storage.
            </p>

            <Link to="/products" className="btn btn-primary">
              Continue shopping
              <ArrowRight size={18} />
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

      <section className="receipt-page">
        <div className="receipt-hero">
          <CheckCircle2 size={38} />

          <p className="eyebrow">Order received</p>
          <h1>Your LUMA order is prepared.</h1>
          <p>
            This is your frontend receipt. When backend/payment is connected,
            this page will be powered by real order records and email
            confirmations.
          </p>
        </div>

        <div className="receipt-layout">
          <div className="receipt-card">
            <div className="receipt-card-header">
              <div>
                <span>Order number</span>
                <h2>{order.id}</h2>
              </div>

              <strong>{order.status}</strong>
            </div>

            <div className="receipt-meta-grid">
              <div>
                <span>Date</span>
                <strong>{formatOrderDate(order.createdAt)}</strong>
              </div>

              <div>
                <span>Payment</span>
                <strong>{order.paymentMethod}</strong>
              </div>

              <div>
                <span>Total</span>
                <strong>{formatCurrency(order.total)}</strong>
              </div>
            </div>

            <div className="receipt-section">
              <h3>Items</h3>

              <div className="receipt-items">
                {order.items.map((item) => (
                  <div className="receipt-item" key={`${order.id}-${item.name}`}>
                    <img src={item.image} alt={item.name} />

                    <div>
                      <h4>{item.name}</h4>
                      <p>
                        {item.category} · Qty {item.quantity}
                      </p>
                    </div>

                    <strong>{formatCurrency(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="receipt-summary">
            <h2>Customer details</h2>

            <div className="receipt-details-list">
              <div>
                <span>Name</span>
                <strong>{order.customer.fullName}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{order.customer.email}</strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>{order.customer.phone}</strong>
              </div>

              <div>
                <span>Delivery</span>
                <strong>
                  {order.customer.address}, {order.customer.city},{" "}
                  {order.customer.country}
                </strong>
              </div>
            </div>

            <div className="summary-line" />

            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{formatCurrency(order.subtotal)}</strong>
            </div>

            <div className="summary-row">
              <span>Delivery</span>
              <strong>{formatCurrency(order.delivery)}</strong>
            </div>

            <div className="summary-row total">
              <span>Total</span>
              <strong>{formatCurrency(order.total)}</strong>
            </div>

            <Link to="/account" className="btn btn-primary summary-button">
              View account
              <ArrowRight size={18} />
            </Link>

            <Link to="/products" className="receipt-secondary-link">
              Continue shopping
            </Link>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}