const { Resend } = require("resend");
const pool = require("../config/db");

const resend = new Resend(process.env.RESEND_API_KEY);

const formatNaira = (amount) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
};

const getOrderWithItems = async (orderId) => {
  const orderResult = await pool.query(
    `
    SELECT *
    FROM orders
    WHERE id = $1
    `,
    [orderId]
  );

  if (orderResult.rows.length === 0) {
    return null;
  }

  const itemsResult = await pool.query(
    `
    SELECT *
    FROM order_items
    WHERE order_id = $1
    ORDER BY created_at ASC
    `,
    [orderId]
  );

  return {
    ...orderResult.rows[0],
    items: itemsResult.rows,
  };
};

const buildOrderItemsHtml = (items = []) => {
  return items
    .map((item) => {
      const itemTotal = Number(item.price) * Number(item.quantity);

      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
            <strong>${item.product_name}</strong>
            <br />
            <span style="color: #7a6a5d;">Size: ${item.size || "—"}</span>
          </td>

          <td style="padding: 12px 0; border-bottom: 1px solid #eee; text-align: center;">
            ${item.quantity}
          </td>

          <td style="padding: 12px 0; border-bottom: 1px solid #eee; text-align: right;">
            ${formatNaira(itemTotal)}
          </td>
        </tr>
      `;
    })
    .join("");
};

const sendCustomerOrderEmail = async (order) => {
  const orderItemsHtml = buildOrderItemsHtml(order.items);

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: [order.customer_email],
    subject: "Your LUMA order has been confirmed",
    html: `
      <div style="font-family: Arial, sans-serif; background: #f7efe4; padding: 32px;">
        <div style="max-width: 640px; margin: 0 auto; background: #fffaf3; border-radius: 24px; padding: 32px; color: #221912;">
          <p style="letter-spacing: 0.22em; text-transform: uppercase; color: #8a6b4f; font-size: 12px;">
            LUMA Order Confirmation
          </p>

          <h1 style="margin: 0 0 12px; font-size: 28px;">
            Your LUMA order has been confirmed.
          </h1>

          <p style="font-size: 16px; line-height: 1.6;">
            Hello ${order.customer_name}, thank you for shopping with LUMA.
            We truly appreciate your order and we’re preparing it with care.
          </p>

          <div style="background: #f2e7d8; border-radius: 18px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px;">
              <strong>Order total:</strong> ${formatNaira(order.total_amount)}
            </p>

            <p style="margin: 0 0 8px;">
              <strong>Status:</strong> Processing
            </p>

            <p style="margin: 0;">
              <strong>Order ID:</strong> ${String(order.id).slice(0, 8).toUpperCase()}
            </p>
          </div>

          <h2 style="font-size: 18px; margin-top: 28px;">Order items</h2>

          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align: left; padding-bottom: 10px;">Product</th>
                <th style="text-align: center; padding-bottom: 10px;">Qty</th>
                <th style="text-align: right; padding-bottom: 10px;">Total</th>
              </tr>
            </thead>

            <tbody>
              ${orderItemsHtml}
            </tbody>
          </table>

          <p style="font-size: 15px; line-height: 1.6; margin-top: 28px;">
            We’ll contact you if we need any extra delivery details. Thank you for choosing LUMA.
          </p>

          <p style="color: #8a6b4f; font-size: 13px; margin-top: 32px;">
            LUMA Beauty
          </p>
        </div>
      </div>
    `,
  });
};

const sendAdminOrderEmail = async (order) => {
  const orderItemsHtml = buildOrderItemsHtml(order.items);

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: [process.env.LUMA_ADMIN_EMAIL || "support@luma.com"],
    subject: `New paid LUMA order - ${formatNaira(order.total_amount)}`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f7efe4; padding: 32px;">
        <div style="max-width: 680px; margin: 0 auto; background: #fffaf3; border-radius: 24px; padding: 32px; color: #221912;">
          <p style="letter-spacing: 0.22em; text-transform: uppercase; color: #8a6b4f; font-size: 12px;">
            New Paid Order
          </p>

          <h1 style="margin: 0 0 12px; font-size: 28px;">
            A new LUMA order has been paid.
          </h1>

          <div style="background: #f2e7d8; border-radius: 18px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px;">
              <strong>Customer:</strong> ${order.customer_name}
            </p>

            <p style="margin: 0 0 8px;">
              <strong>Email:</strong> ${order.customer_email}
            </p>

            <p style="margin: 0 0 8px;">
              <strong>Phone:</strong> ${order.customer_phone || "—"}
            </p>

            <p style="margin: 0 0 8px;">
              <strong>Total:</strong> ${formatNaira(order.total_amount)}
            </p>

            <p style="margin: 0 0 8px;">
              <strong>Payment reference:</strong> ${order.paystack_reference || "—"}
            </p>

            <p style="margin: 0;">
              <strong>Delivery:</strong> ${order.delivery_address || "—"}, ${order.city || "—"}, ${order.country || "—"}
            </p>
          </div>

          <h2 style="font-size: 18px; margin-top: 28px;">Order items</h2>

          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align: left; padding-bottom: 10px;">Product</th>
                <th style="text-align: center; padding-bottom: 10px;">Qty</th>
                <th style="text-align: right; padding-bottom: 10px;">Total</th>
              </tr>
            </thead>

            <tbody>
              ${orderItemsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `,
  });
};

const sendOrderConfirmationEmails = async (orderId) => {
  try {
    console.log("Trying to send order emails for order:", orderId);

    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is missing. Skipping order emails.");
      return;
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      console.warn("RESEND_FROM_EMAIL is missing. Skipping order emails.");
      return;
    }

    const order = await getOrderWithItems(orderId);

    if (!order) {
      console.warn("Order not found. Skipping order emails.");
      return;
    }

    console.log("Order found for email:", {
      orderId: order.id,
      customerEmail: order.customer_email,
      adminEmail: process.env.LUMA_ADMIN_EMAIL,
      total: order.total_amount,
    });

    const results = await Promise.allSettled([
      sendCustomerOrderEmail(order),
      sendAdminOrderEmail(order),
    ]);

    console.log("Email send results:", results);

    results.forEach((result, index) => {
      const label = index === 0 ? "Customer email" : "Admin email";

      if (result.status === "fulfilled") {
        console.log(`${label} sent:`, result.value);
      }

      if (result.status === "rejected") {
        console.error(
          `${label} failed:`,
          result.reason?.message || result.reason
        );
      }
    });
  } catch (error) {
    console.error("Send order emails error:", error.message);
  }
};

module.exports = {
  sendOrderConfirmationEmails,
};