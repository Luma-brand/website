import { MailCheck, MousePointerClick, Send, ShoppingCart } from "lucide-react";
import { formatNaira } from "../../../utils/currency";

export function EmailAutomationOverview({ overview }) {
  const carts = overview?.abandonedCarts || {};
  const logs = overview?.emailLogs || {};
  const events = overview?.emailEvents || {};

  const cards = [
    { label: "Tracked carts", value: carts.total || 0, icon: ShoppingCart },
    { label: "Ready for email", value: carts.readyForEmail || 0, icon: Send },
    { label: "Recovery emails sent", value: logs.sent || 0, icon: MailCheck },
    { label: "Email clicks", value: events.clicked || 0, icon: MousePointerClick },
  ];

  return (
    <div className="admin-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div className="admin-card stat-card" key={card.label}>
            <small>{card.label}</small>
            <strong>{card.value}</strong>
            <Icon size={20} />
          </div>
        );
      })}
      <div className="admin-card stat-card">
        <small>Estimated cart value</small>
        <strong>{formatNaira(carts.estimatedValue || 0)}</strong>
      </div>
    </div>
  );
}
