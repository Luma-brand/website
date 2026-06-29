import { MessageCircle } from "lucide-react";
import { formatNaira } from "../../../utils/currency";

function getCustomer(cart) {
  return cart.customer_name || cart.customer_email || cart.customer_phone || "Guest customer";
}

function getItems(cart) {
  const items = Array.isArray(cart.cart_items) ? cart.cart_items : [];
  if (!items.length) return "No items saved";
  return items.slice(0, 3).map((item) => `${item.name || "Product"} x ${item.quantity || 1}`).join(", ");
}

export function AbandonedCartsTable({ carts = [], isLoading }) {
  if (isLoading) return <div className="admin-empty">Loading abandoned carts...</div>;
  if (!carts.length) return <div className="admin-empty">No abandoned carts are waiting for recovery.</div>;

  return (
    <div className="admin-card admin-table-card">
      <div className="admin-table-header">
        <h2>Abandoned cart queue</h2>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table abandoned-cart-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Last activity</th>
              <th>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {carts.map((cart) => (
              <tr key={cart.id}>
                <td>
                  <strong>{getCustomer(cart)}</strong>
                  <small>{cart.customer_email || "No email captured"}</small>
                </td>
                <td>{getItems(cart)}</td>
                <td>{formatNaira(cart.total_value || cart.cart_total || 0)}</td>
                <td><span className="admin-badge">{String(cart.recovery_status || cart.status || "active").replaceAll("_", " ")}</span></td>
                <td>{cart.last_activity_at ? new Date(cart.last_activity_at).toLocaleString() : "-"}</td>
                <td>
                  {cart.whatsapp_link ? (
                    <a className="admin-button secondary" href={cart.whatsapp_link} target="_blank" rel="noreferrer">
                      <MessageCircle size={15} /> Open
                    </a>
                  ) : (
                    <span className="admin-muted">No phone</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
