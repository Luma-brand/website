export function getOrderProgress(order) {
  const isPickup = ["PICKUP", "GIG_PICKUP", "STUDIO_PICKUP"].includes(order?.delivery_method);
  const steps = ["Payment confirmed", "Preparing your order", isPickup ? "Ready for collection" : "On the way", isPickup ? "Collected" : "Delivered"];
  const paid = order?.payment_status === "paid";
  const status = String(order?.status || "pending").toLowerCase();

  if (["cancelled", "canceled", "refunded"].includes(status) || order?.payment_status === "refunded") {
    return { isPickup, closed: true, steps: [], current: -1, title: order?.payment_status === "refunded" || status === "refunded" ? "Payment refunded" : "Order cancelled", message: "Contact LUMA if you need help with this order." };
  }
  if (!paid) return { isPickup, steps, current: -1, title: "Awaiting payment confirmation", message: "We’ll start preparing your order once payment is confirmed." };
  if (status === "stock_issue") return { isPickup, steps, current: 0, title: "Payment received — order under review", message: "We’ve received your payment. LUMA is reviewing item availability and will contact you." };

  const current = ["delivered", "completed", "collected"].includes(status) ? 3
    : ["shipped", "out_for_delivery", "ready_for_pickup"].includes(status) ? 2
      : status === "processing" ? 1 : 0;
  const messages = [
    "We’ve received your payment and your order is in the queue.",
    "We’re preparing your order. Check back here for updates.",
    isPickup ? "Your order is ready for collection." : "Your order is on the way.",
    isPickup ? "Your order has been collected. Thank you for shopping with LUMA." : "Your order has been delivered. Thank you for shopping with LUMA.",
  ];
  return { isPickup, steps, current, title: steps[current], message: messages[current] };
}
