const DEFAULT_FRONTEND_URL = "https://shopwithluma.com";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(html = "") {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMoney(amount, currency = "NGN") {
  const numeric = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toLocaleString()}`;
  }
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/$/, "");
}

function baseEmailTemplate({
  previewText = "A note from LUMA Skincare.",
  title = "LUMA Skincare",
  body = "",
  buttonText,
  buttonUrl,
  footerText = "LUMA Skincare - soft, intentional beauty essentials.",
} = {}) {
  const safeTitle = escapeHtml(title);
  const safePreview = escapeHtml(previewText);
  const buttonHtml = buttonText && buttonUrl
    ? `<div style="margin-top: 28px;"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:#2b1d14;color:#fff8ee;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;">${escapeHtml(buttonText)}</a></div>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6efe6;color:#261b14;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6efe6;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffaf3;border:1px solid #eadfD2;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(43,29,20,0.08);">
            <tr>
              <td style="padding:32px 28px 10px;">
                <p style="margin:0 0 14px;letter-spacing:0.22em;text-transform:uppercase;color:#8a6b4f;font-size:12px;font-weight:700;">LUMA Skincare</p>
                <h1 style="margin:0;color:#211711;font-size:28px;line-height:1.18;">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 32px;color:#4f4035;font-size:16px;line-height:1.7;">
                ${body}
                ${buttonHtml}
                <p style="margin:32px 0 0;color:#8a6b4f;font-size:13px;line-height:1.6;">${escapeHtml(footerText)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function lineItemRows(items = []) {
  if (!items.length) {
    return `<tr><td colspan="3" style="padding:14px 0;color:#7c6a5b;">No item details were available.</td></tr>`;
  }

  return items.map((item) => {
    const name = item.product_name || item.productName || item.name || "LUMA product";
    const quantity = Number(item.quantity || 1);
    const price = Number(item.price || item.unit_price || item.unitPrice || 0);
    const image = item.product_image || item.image || item.image_url || "";
    const total = price * quantity;
    const imageHtml = image
      ? `<img src="${escapeHtml(image)}" alt="" width="44" height="44" style="width:44px;height:44px;object-fit:cover;border-radius:12px;margin-right:12px;vertical-align:middle;" />`
      : "";

    return `<tr>
      <td style="padding:14px 0;border-bottom:1px solid #eee4d8;">${imageHtml}<span style="vertical-align:middle;font-weight:700;color:#2b1d14;">${escapeHtml(name)}</span></td>
      <td style="padding:14px 0;border-bottom:1px solid #eee4d8;text-align:center;color:#6c5a4d;">${quantity}</td>
      <td style="padding:14px 0;border-bottom:1px solid #eee4d8;text-align:right;color:#2b1d14;font-weight:700;">${formatMoney(total)}</td>
    </tr>`;
  }).join("");
}

function itemsTable(items = []) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:20px;">
    <thead>
      <tr>
        <th align="left" style="padding-bottom:10px;color:#7c6a5b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Product</th>
        <th align="center" style="padding-bottom:10px;color:#7c6a5b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Qty</th>
        <th align="right" style="padding-bottom:10px;color:#7c6a5b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Total</th>
      </tr>
    </thead>
    <tbody>${lineItemRows(items)}</tbody>
  </table>`;
}

function testEmailTemplate() {
  const html = baseEmailTemplate({
    previewText: "Your LUMA Resend setup accepted a test email.",
    title: "LUMA email test",
    body: `<p style="margin:0;">Your LUMA backend successfully reached Resend using the configured sender. If this message arrived, the core email foundation is working.</p>`,
    buttonText: "Visit LUMA",
    buttonUrl: getFrontendUrl(),
  });
  return { subject: "LUMA email test", html, text: stripHtml(html) };
}

function welcomeEmailTemplate(user = {}) {
  const name = user.full_name || user.name || "there";
  const html = baseEmailTemplate({
    previewText: "Welcome to LUMA Skincare.",
    title: "Welcome to LUMA",
    body: `<p style="margin:0 0 16px;">Hi ${escapeHtml(name)}, welcome to LUMA. Your account is ready, and your skincare experience is now easier to revisit whenever you need it.</p><p style="margin:0;">We are glad to have you here.</p>`,
    buttonText: "Visit LUMA",
    buttonUrl: getFrontendUrl(),
  });
  return { subject: "Welcome to LUMA", html, text: stripHtml(html) };
}

function orderConfirmationTemplate(order = {}) {
  const name = order.customer_name || order.customerName || "there";
  const reference = order.paystack_reference || order.payment_reference || order.reference || String(order.id || "").slice(0, 8).toUpperCase();
  const total = order.final_amount || order.total_amount || order.total || 0;
  const delivery = [order.delivery_address, order.city, order.state, order.country].filter(Boolean).join(", ");
  const html = baseEmailTemplate({
    previewText: `Your LUMA order ${reference || ""} is confirmed.`,
    title: "Your LUMA order is confirmed",
    body: `<p style="margin:0 0 16px;">Hi ${escapeHtml(name)}, thank you for shopping with LUMA. Your payment has been confirmed and we are preparing your order with care.</p>
      <div style="background:#f2e7d8;border-radius:18px;padding:18px;margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Order reference:</strong> ${escapeHtml(reference || "-")}</p>
        <p style="margin:0 0 8px;"><strong>Payment status:</strong> ${escapeHtml(order.payment_status || "paid")}</p>
        <p style="margin:0 0 8px;"><strong>Order status:</strong> ${escapeHtml(order.status || "processing")}</p>
        <p style="margin:0;"><strong>Total:</strong> ${formatMoney(total)}</p>
        ${delivery ? `<p style="margin:8px 0 0;"><strong>Delivery:</strong> ${escapeHtml(delivery)}</p>` : ""}
      </div>
      ${itemsTable(order.items || order.order_items || [])}`,
    buttonText: "Return to shop",
    buttonUrl: `${getFrontendUrl()}/products`,
  });
  return { subject: "Your LUMA order is confirmed", html, text: stripHtml(html) };
}

function adminOrderNotificationTemplate(order = {}) {
  const reference = order.paystack_reference || order.payment_reference || order.reference || String(order.id || "").slice(0, 8).toUpperCase();
  const total = order.final_amount || order.total_amount || order.total || 0;
  const delivery = [order.delivery_address, order.city, order.state, order.country].filter(Boolean).join(", ");
  const html = baseEmailTemplate({
    previewText: "A new paid LUMA order needs review.",
    title: "New LUMA order received",
    body: `<div style="background:#f2e7d8;border-radius:18px;padding:18px;margin:0 0 22px;">
        <p style="margin:0 0 8px;"><strong>Customer:</strong> ${escapeHtml(order.customer_name || "-")}</p>
        <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(order.customer_email || "-")}</p>
        <p style="margin:0 0 8px;"><strong>Phone:</strong> ${escapeHtml(order.customer_phone || "-")}</p>
        <p style="margin:0 0 8px;"><strong>Payment reference:</strong> ${escapeHtml(reference || "-")}</p>
        <p style="margin:0 0 8px;"><strong>Total:</strong> ${formatMoney(total)}</p>
        ${delivery ? `<p style="margin:0;"><strong>Delivery:</strong> ${escapeHtml(delivery)}</p>` : ""}
      </div>
      ${itemsTable(order.items || order.order_items || [])}`,
    buttonText: "Open admin orders",
    buttonUrl: `${getFrontendUrl()}/luma-control-room/orders`,
  });
  return { subject: "New LUMA order received", html, text: stripHtml(html) };
}

function newsletterConfirmationTemplate(data = {}) {
  const label = data.name || data.full_name || data.email || "there";
  const html = baseEmailTemplate({
    previewText: "You are on the LUMA list.",
    title: "You are on the LUMA list",
    body: `<p style="margin:0;">Hi ${escapeHtml(label)}, thank you for joining LUMA. We will send thoughtful skincare notes, launch updates, and useful shop news.</p>`,
    buttonText: "Visit LUMA",
    buttonUrl: getFrontendUrl(),
  });
  return { subject: "You are on the LUMA list", html, text: stripHtml(html) };
}

function waitlistConfirmationTemplate(data = {}) {
  const label = data.name || data.full_name || data.email || "there";
  const html = baseEmailTemplate({
    previewText: "You are on the LUMA waitlist.",
    title: "You are on the LUMA waitlist",
    body: `<p style="margin:0;">Hi ${escapeHtml(label)}, thank you for joining the LUMA waitlist. We will keep you close for product news and availability updates.</p>`,
    buttonText: "Visit LUMA",
    buttonUrl: getFrontendUrl(),
  });
  return { subject: "You are on the LUMA waitlist", html, text: stripHtml(html) };
}

function abandonedCartTemplate(cart = {}) {
  const name = cart.customer_name || cart.name || "there";
  const total = cart.total_value || cart.cart_total || cart.subtotal || 0;
  const html = baseEmailTemplate({
    previewText: "Your LUMA cart is still waiting.",
    title: "You left something glowing behind",
    body: `<p style="margin:0 0 16px;">Hi ${escapeHtml(name)}, your LUMA skincare picks are still waiting in your cart.</p>
      <div style="background:#f2e7d8;border-radius:18px;padding:18px;margin:22px 0;"><strong>Cart total:</strong> ${formatMoney(total)}</div>
      ${itemsTable(cart.cart_items || cart.items || [])}`,
    buttonText: "Return to cart",
    buttonUrl: `${getFrontendUrl()}/cart`,
  });
  return { subject: "You left something glowing behind", html, text: stripHtml(html) };
}

function broadcastTemplate({ subject = "LUMA update", html, text, message, body } = {}) {
  const content = html || `<p style="margin:0;white-space:pre-line;">${escapeHtml(message || body || text || "")}</p>`;
  const wrapped = baseEmailTemplate({
    previewText: stripHtml(content).slice(0, 140) || "A LUMA update.",
    title: subject,
    body: content,
    buttonText: undefined,
    buttonUrl: undefined,
  });
  return { subject, html: wrapped, text: text || stripHtml(wrapped) };
}

module.exports = {
  abandonedCartTemplate,
  adminOrderNotificationTemplate,
  baseEmailTemplate,
  broadcastTemplate,
  escapeHtml,
  formatMoney,
  getFrontendUrl,
  newsletterConfirmationTemplate,
  orderConfirmationTemplate,
  stripHtml,
  testEmailTemplate,
  waitlistConfirmationTemplate,
  welcomeEmailTemplate,
};
