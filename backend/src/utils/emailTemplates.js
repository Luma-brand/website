const DEFAULT_FRONTEND_URL = "https://shopwithluma.com";

const BRAND = {
  ink: "#161616",
  muted: "#66645f",
  silver: "#bab9b6",
  cream: "#fff6d6",
  yellow: "#fff19f",
  soft: "#fffaf0",
  white: "#ffffff",
  line: "#e7e1d3",
};

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

function renderButton(buttonText, buttonUrl) {
  if (!buttonText || !buttonUrl) return "";

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:30px;">
      <tr>
        <td style="border-radius:999px;background:${BRAND.ink};">
          <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:15px 24px;color:${BRAND.cream};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:-0.01em;">
            ${escapeHtml(buttonText)} &nbsp;→
          </a>
        </td>
      </tr>
    </table>`;
}

function baseEmailTemplate({
  previewText = "A note from LUMA.",
  eyebrow = "LUMA",
  title = "LUMA",
  body = "",
  buttonText,
  buttonUrl,
  footerText = "LUMA — brows, but better.",
} = {}) {
  const safeTitle = escapeHtml(title);
  const safePreview = escapeHtml(previewText);
  const buttonHtml = renderButton(buttonText, buttonUrl);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.soft};color:${BRAND.ink};font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreview}</div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${BRAND.soft};">
      <tr>
        <td align="center" style="padding:32px 14px 40px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;">
            <tr>
              <td style="padding:0 4px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:900;letter-spacing:-0.08em;color:${BRAND.silver};">
                      LUMA<span style="color:${BRAND.ink};">.</span>
                    </td>
                    <td align="right" style="font-family:Georgia,'Times New Roman',serif;font-size:12px;color:${BRAND.muted};">soft luxury beauty</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="overflow:hidden;border:1px solid ${BRAND.line};border-radius:30px;background:${BRAND.cream};box-shadow:0 22px 70px rgba(22,22,22,0.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:38px 34px 12px;background:linear-gradient(135deg,${BRAND.cream} 0%,${BRAND.yellow} 100%);">
                      <span style="display:inline-block;padding:8px 12px;border-radius:999px;background:${BRAND.soft};font-family:Georgia,'Times New Roman',serif;font-size:12px;color:${BRAND.ink};">${escapeHtml(eyebrow)}</span>
                      <h1 style="margin:18px 0 0;max-width:540px;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.05;letter-spacing:-0.045em;font-weight:700;color:${BRAND.ink};">${safeTitle}</h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 34px 36px;background:${BRAND.cream};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:${BRAND.muted};">
                      ${body}
                      ${buttonHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:22px 20px 0;font-family:Arial,Helvetica,sans-serif;color:${BRAND.muted};font-size:11px;line-height:1.65;">
                <strong style="color:${BRAND.ink};">${escapeHtml(footerText)}</strong><br />
                You received this email because you interacted with LUMA or placed an order with us.<br />
                <a href="${getFrontendUrl()}" style="color:${BRAND.ink};font-weight:700;text-decoration:none;">shopwithluma.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function infoPanel(rows = []) {
  const content = rows
    .filter((row) => row && row.label)
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 0;color:${BRAND.muted};font-size:13px;">${escapeHtml(row.label)}</td>
          <td align="right" style="padding:8px 0;color:${BRAND.ink};font-size:13px;font-weight:800;">${escapeHtml(row.value ?? "-")}</td>
        </tr>`
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0;padding:14px 18px;border:1px solid ${BRAND.line};border-radius:18px;background:${BRAND.soft};">
      ${content}
    </table>`;
}

function lineItemRows(items = []) {
  if (!items.length) {
    return `<tr><td colspan="3" style="padding:15px 0;color:${BRAND.muted};font-size:13px;">No item details were available.</td></tr>`;
  }

  return items
    .map((item) => {
      const name = item.product_name || item.productName || item.name || "LUMA product";
      const quantity = Number(item.quantity || 1);
      const price = Number(item.price || item.unit_price || item.unitPrice || 0);
      const image = item.product_image || item.image || item.image_url || "";
      const total = price * quantity;
      const imageHtml = image
        ? `<img src="${escapeHtml(image)}" alt="" width="50" height="50" style="width:50px;height:50px;object-fit:cover;border-radius:14px;margin-right:12px;vertical-align:middle;background:${BRAND.yellow};" />`
        : `<span style="display:inline-block;width:50px;height:50px;margin-right:12px;border-radius:14px;background:${BRAND.yellow};vertical-align:middle;"></span>`;

      return `<tr>
        <td style="padding:14px 0;border-bottom:1px solid ${BRAND.line};">${imageHtml}<span style="vertical-align:middle;font-weight:800;color:${BRAND.ink};font-size:13px;">${escapeHtml(name)}</span></td>
        <td style="padding:14px 0;border-bottom:1px solid ${BRAND.line};text-align:center;color:${BRAND.muted};font-size:13px;">${quantity}</td>
        <td style="padding:14px 0;border-bottom:1px solid ${BRAND.line};text-align:right;color:${BRAND.ink};font-size:13px;font-weight:800;">${formatMoney(total)}</td>
      </tr>`;
    })
    .join("");
}

function itemsTable(items = []) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin-top:24px;">
      <thead>
        <tr>
          <th align="left" style="padding-bottom:10px;color:${BRAND.muted};font-size:10px;text-transform:uppercase;letter-spacing:0.11em;">Product</th>
          <th align="center" style="padding-bottom:10px;color:${BRAND.muted};font-size:10px;text-transform:uppercase;letter-spacing:0.11em;">Qty</th>
          <th align="right" style="padding-bottom:10px;color:${BRAND.muted};font-size:10px;text-transform:uppercase;letter-spacing:0.11em;">Total</th>
        </tr>
      </thead>
      <tbody>${lineItemRows(items)}</tbody>
    </table>`;
}

function testEmailTemplate() {
  const html = baseEmailTemplate({
    previewText: "Your LUMA email service is connected.",
    eyebrow: "System check",
    title: "Your LUMA email is alive.",
    body: `<p style="margin:0;">This is a clean test from the LUMA backend. If this landed in your inbox, transactional email delivery is connected and ready.</p>`,
    buttonText: "Open LUMA",
    buttonUrl: getFrontendUrl(),
  });
  return { subject: "LUMA email test", html, text: stripHtml(html) };
}

function welcomeEmailTemplate(user = {}) {
  const name = user.full_name || user.name || "there";
  const html = baseEmailTemplate({
    previewText: "Welcome to LUMA — your first ritual is closer.",
    eyebrow: "Welcome to LUMA",
    title: "Your brows just found their place.",
    body: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)}, welcome in. Your LUMA account is ready — simple, lightweight, and made to keep shopping easy.</p>
      <p style="margin:0 0 18px;">As a little welcome, use <strong style="color:${BRAND.ink};">WELCOME10</strong> for 10% off your first order.</p>
      <div style="display:inline-block;padding:12px 16px;border:1px dashed ${BRAND.silver};border-radius:16px;background:${BRAND.soft};color:${BRAND.ink};font-weight:900;letter-spacing:0.08em;">WELCOME10</div>`,
    buttonText: "Shop the collection",
    buttonUrl: `${getFrontendUrl()}/products`,
  });
  return { subject: "Welcome to LUMA — 10% off your first ritual", html, text: stripHtml(html) };
}

function orderConfirmationTemplate(order = {}) {
  const name = order.customer_name || order.customerName || "there";
  const reference = order.payment_reference || order.paystack_reference || order.reference || String(order.id || "").slice(0, 8).toUpperCase();
  const total = order.final_amount || order.total_amount || order.total || 0;
  const delivery = [order.delivery_address, order.city, order.state, order.country].filter(Boolean).join(", ");
  const html = baseEmailTemplate({
    previewText: `Your LUMA order ${reference || ""} is confirmed.`,
    eyebrow: "Order confirmed",
    title: "Your LUMA is on its way to becoming yours.",
    body: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)}, payment confirmed. We have your order and will prepare it with care.</p>
      ${infoPanel([
        { label: "Order reference", value: reference || "-" },
        { label: "Payment", value: order.payment_status || "Paid" },
        { label: "Order status", value: order.status || "Processing" },
        { label: "Total", value: formatMoney(total) },
        ...(delivery ? [{ label: "Delivery", value: delivery }] : []),
      ])}
      ${itemsTable(order.items || order.order_items || [])}`,
    buttonText: "Keep shopping",
    buttonUrl: `${getFrontendUrl()}/products`,
  });
  return { subject: "Your LUMA order is confirmed", html, text: stripHtml(html) };
}

function adminOrderNotificationTemplate(order = {}) {
  const reference = order.payment_reference || order.paystack_reference || order.reference || String(order.id || "").slice(0, 8).toUpperCase();
  const total = order.final_amount || order.total_amount || order.total || 0;
  const delivery = [order.delivery_address, order.city, order.state, order.country].filter(Boolean).join(", ");
  const html = baseEmailTemplate({
    previewText: "A new paid LUMA order needs review.",
    eyebrow: "Control room",
    title: "New paid order received.",
    body: `
      ${infoPanel([
        { label: "Customer", value: order.customer_name || "-" },
        { label: "Email", value: order.customer_email || "-" },
        { label: "Phone", value: order.customer_phone || "-" },
        { label: "Reference", value: reference || "-" },
        { label: "Total", value: formatMoney(total) },
        ...(delivery ? [{ label: "Delivery", value: delivery }] : []),
      ])}
      ${itemsTable(order.items || order.order_items || [])}`,
    buttonText: "Open orders",
    buttonUrl: `${getFrontendUrl()}/luma-control-room/orders`,
  });
  return { subject: "New LUMA order received", html, text: stripHtml(html) };
}

function newsletterConfirmationTemplate(data = {}) {
  const label = data.name || data.full_name || data.email || "there";
  const html = baseEmailTemplate({
    previewText: "You're on the LUMA list.",
    eyebrow: "LUMA notes",
    title: "You're on the list.",
    body: `<p style="margin:0;">Hi ${escapeHtml(label)}, you're in. Expect thoughtful product notes, launches, restocks and the occasional little reason to treat your brows.</p>`,
    buttonText: "Explore LUMA",
    buttonUrl: `${getFrontendUrl()}/products`,
  });
  return { subject: "You're on the LUMA list", html, text: stripHtml(html) };
}

function waitlistConfirmationTemplate(data = {}) {
  const label = data.name || data.full_name || data.email || "there";
  const productName = data.product_name || data.productName || "your LUMA pick";
  const html = baseEmailTemplate({
    previewText: "We'll tell you when your LUMA pick is back.",
    eyebrow: "Restock watch",
    title: "We'll keep an eye on it for you.",
    body: `<p style="margin:0;">Hi ${escapeHtml(label)}, you're on the waitlist for <strong style="color:${BRAND.ink};">${escapeHtml(productName)}</strong>. We'll let you know when it's ready again.</p>`,
    buttonText: "Browse LUMA",
    buttonUrl: `${getFrontendUrl()}/products`,
  });
  return { subject: "You're on the LUMA waitlist", html, text: stripHtml(html) };
}

function abandonedCartTemplate(cart = {}) {
  const name = cart.customer_name || cart.name || "there";
  const total = cart.total_value || cart.cart_total || cart.subtotal || 0;
  const html = baseEmailTemplate({
    previewText: "Your LUMA bag is still waiting.",
    eyebrow: "Saved for you",
    title: "Your bag didn't forget you.",
    body: `
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)}, your LUMA picks are still sitting pretty in your bag. No pressure — just a small reminder before they wander out of stock.</p>
      ${infoPanel([{ label: "Bag value", value: formatMoney(total) }])}
      ${itemsTable(cart.cart_items || cart.items || [])}`,
    buttonText: "Return to your bag",
    buttonUrl: `${getFrontendUrl()}/cart`,
  });
  return { subject: "Your LUMA bag is still waiting", html, text: stripHtml(html) };
}

function broadcastTemplate({ subject = "A note from LUMA", html, text, message, body } = {}) {
  const content = html || `<p style="margin:0;white-space:pre-line;">${escapeHtml(message || body || text || "")}</p>`;
  const wrapped = baseEmailTemplate({
    previewText: stripHtml(content).slice(0, 140) || "A LUMA update.",
    eyebrow: "LUMA note",
    title: subject,
    body: content,
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
