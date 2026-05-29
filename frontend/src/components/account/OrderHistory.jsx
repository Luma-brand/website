import { PackageCheck } from "lucide-react";
import { useCart } from "../../context/CartContext";

export function OrderHistory() {
  const { orders, clearOrders } = useCart();

  if (orders.length === 0) {
    return (
      <div className="order-history-card">
        <div className="order-history-empty">
          <PackageCheck size={26} />
          <h3>No orders yet.</h3>
          <p>
            Completed frontend checkout orders will appear here until a real
            backend order system is connected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="order-history-card">
      <div className="order-history-header">
        <div>
          <p className="eyebrow">Order history</p>
          <h2>Saved frontend orders</h2>
        </div>

        <button type="button" onClick={clearOrders}>
          Clear history
        </button>
      </div>

      <div className="order-history-list">
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-card-top">
              <div>
                <span>{order.id}</span>
                <h3>{order.status}</h3>
              </div>

              <strong>${order.total.toFixed(2)}</strong>
            </div>

            <div className="order-card-meta">
              <p>
                {new Date(order.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p>{order.paymentMethod}</p>
              <p>{order.items.length} item type(s)</p>
            </div>

            <div className="order-items">
              {order.items.map((item) => (
                <div key={`${order.id}-${item.name}`}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <strong>${(item.price * item.quantity).toFixed(2)}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}