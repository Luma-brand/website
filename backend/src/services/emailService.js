const { Resend } = require("resend");
const pool = require("../config/db");
const {
  abandonedCartTemplate,
  adminOrderNotificationTemplate,
  broadcastTemplate,
  escapeHtml,
  formatMoney,
  getFrontendUrl,
  newsletterConfirmationTemplate,
  orderConfirmationTemplate,
  testEmailTemplate,
  waitlistConfirmationTemplate,
  welcomeEmailTemplate,
  baseEmailTemplate,
  stripHtml,
} = require("../utils/emailTemplates");

let resendClient = null;
let emailLogsReady = false;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "";
}

function getReplyTo() {
  return process.env.EMAIL_REPLY_TO || process.env.ADMIN_EMAIL || undefined;
}

function getAdminNotificationEmail() {
  return process.env.ADMIN_EMAIL || process.env.LUMA_ADMIN_EMAIL || process.env.ADMIN_TEST_EMAIL || "";
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function maskEmail(email = "") {
  const value = String(email || "").trim();
  const [local, domain] = value.replace(/^.*<([^>]+)>.*$/, "$1").split("@");
  if (!local || !domain) return value ? "configured" : "";
  return `${local.slice(0, 1)}***@${domain}`;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function getDelayMinutes() {
  const minutes = Number(process.env.ABANDONED_CART_DELAY_MINUTES || 60);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
}

function getEmailConfigStatus() {
  const fromEmail = getFromEmail();
  const adminEmail = getAdminNotificationEmail();
  const frontendUrl = getFrontendUrl();

  return {
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    fromEmailConfigured: Boolean(fromEmail),
    emailFromConfigured: Boolean(fromEmail),
    replyToConfigured: Boolean(process.env.EMAIL_REPLY_TO),
    adminEmailConfigured: Boolean(adminEmail),
    testEmailConfigured: Boolean(process.env.ADMIN_TEST_EMAIL),
    adminTestEmailConfigured: Boolean(process.env.ADMIN_TEST_EMAIL),
    frontendUrl,
    backendUrlConfigured: Boolean(process.env.BACKEND_URL),
    abandonedCartEnabled: parseBoolean(process.env.ABANDONED_CART_EMAIL_ENABLED, true),
    abandonedCartDelayMinutes: getDelayMinutes(),
    maskedFromEmail: maskEmail(fromEmail),
    maskedAdminEmail: maskEmail(adminEmail),
    maskedTestEmail: maskEmail(process.env.ADMIN_TEST_EMAIL),
  };
}

async function ensureEmailLogsTable() {
  if (emailLogsReady) return;

  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      type VARCHAR(100) NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT,
      status VARCHAR(50) NOT NULL,
      provider VARCHAR(50) DEFAULT 'resend',
      provider_message_id TEXT,
      error_message TEXT,
      related_order_id UUID NULL,
      related_user_id UUID NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS email_type VARCHAR(100) NOT NULL DEFAULT 'general'`);
  await pool.query(`ALTER TABLE email_logs ALTER COLUMN email_type SET DEFAULT 'general'`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255)`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS type VARCHAR(100) NOT NULL DEFAULT 'general'`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient TEXT NOT NULL DEFAULT 'unknown'`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS subject TEXT`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'unknown'`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'resend'`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error_message TEXT`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS related_order_id UUID NULL`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS related_user_id UUID NULL`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
  await pool.query(`ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(LOWER(recipient_email))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(LOWER(recipient))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_logs_related_order_id ON email_logs(related_order_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC)`);
  await pool.query(`
    UPDATE email_logs
    SET
      email_type = COALESCE(NULLIF(email_type, ''), NULLIF(type, ''), 'general'),
      recipient_email = COALESCE(NULLIF(recipient_email, ''), NULLIF(recipient, ''), 'unknown@example.com'),
      type = COALESCE(NULLIF(type, ''), NULLIF(email_type, ''), 'general'),
      recipient = COALESCE(NULLIF(recipient, ''), NULLIF(recipient_email, ''), 'unknown')
    WHERE email_type IS NULL
       OR recipient_email IS NULL
       OR type IS NULL
       OR recipient IS NULL
       OR email_type = ''
       OR recipient_email = ''
       OR type = ''
       OR recipient = ''
  `);

  emailLogsReady = true;
}

async function logEmail({
  type = "general",
  recipient,
  subject,
  status,
  provider = "resend",
  providerMessageId,
  errorMessage,
  relatedOrderId,
  relatedUserId,
  metadata = {},
} = {}) {
  try {
    if (!recipient) return null;
    await ensureEmailLogsTable();
    const result = await pool.query(
      `
        INSERT INTO email_logs (
          email_type,
          recipient_email,
          type,
          recipient,
          subject,
          status,
          provider,
          provider_message_id,
          error_message,
          related_order_id,
          related_user_id,
          metadata,
          sent_at
        )
        VALUES ($1::varchar, $2::varchar, $1::varchar, $2::text, $3, $4::varchar, $5, $6, $7, $8::uuid, $9::uuid, $10::jsonb, CASE WHEN $4::varchar = 'sent' THEN NOW() ELSE NULL END)
        RETURNING *
      `,
      [
        type,
        recipient,
        subject || null,
        status || "unknown",
        provider,
        providerMessageId || null,
        errorMessage || null,
        relatedOrderId || null,
        relatedUserId || null,
        JSON.stringify(metadata || {}),
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Email log write failed:", pool.describeError ? pool.describeError(error) : error.message);
    return null;
  }
}

async function hasSuccessfulEmailLog(type, relatedOrderId) {
  if (!type || !relatedOrderId) return false;
  try {
    await ensureEmailLogsTable();
    const result = await pool.query(
      `
        SELECT id
        FROM email_logs
        WHERE (type = $1 OR email_type = $1)
          AND related_order_id = $2
          AND status = 'sent'
        LIMIT 1
      `,
      [type, relatedOrderId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error("Email duplicate check failed:", pool.describeError ? pool.describeError(error) : error.message);
    return false;
  }
}

function skippedResult(reason, extra = {}) {
  return {
    success: false,
    sent: false,
    skipped: true,
    reason,
    message: reason,
    status: "skipped",
    ...extra,
  };
}

async function sendEmail({ to, subject, html, text, replyTo, metadata = {}, type = "general" } = {}) {
  const recipients = toArray(to);
  const recipient = recipients[0];

  if (!recipient) {
    return skippedResult("Recipient email is missing");
  }

  if (!subject) {
    return skippedResult("Email subject is missing", { recipient });
  }

  if (!html && !text) {
    return skippedResult("Email body is missing", { recipient, subject });
  }

  const from = getFromEmail();
  const client = getResendClient();

  if (!client || !from) {
    const result = skippedResult("Email environment variables are missing", { recipient, subject });
    await logEmail({
      type,
      recipient,
      subject,
      status: "skipped",
      errorMessage: result.reason,
      metadata,
    });
    return result;
  }

  try {
    const response = await client.emails.send({
      from,
      to: recipients,
      subject,
      html,
      text,
      reply_to: replyTo || getReplyTo(),
    });

    if (response?.error) {
      const errorMessage = response.error.message || response.error.name || JSON.stringify(response.error);
      await logEmail({
        type,
        recipient,
        subject,
        status: "failed",
        errorMessage,
        metadata,
      });
      return { success: false, sent: false, error: errorMessage, providerError: response.error, status: "failed" };
    }

    const id = response?.data?.id || response?.id || response?.message_id || response?.messageId || null;
    await logEmail({
      type,
      recipient,
      subject,
      status: "sent",
      providerMessageId: id,
      relatedOrderId: metadata.relatedOrderId,
      relatedUserId: metadata.relatedUserId,
      metadata,
    });

    return {
      success: true,
      sent: true,
      status: "sent",
      provider: "resend",
      id,
      providerMessageId: id,
      data: response?.data || { id },
    };
  } catch (error) {
    const errorMessage = error.message || "Email provider error";
    await logEmail({
      type,
      recipient,
      subject,
      status: "failed",
      errorMessage,
      metadata,
    });
    if (process.env.NODE_ENV !== "production") {
      console.error("Resend email send failed:", errorMessage);
    }
    return {
      success: false,
      sent: false,
      status: "failed",
      error: errorMessage,
      provider: "resend",
      providerError: error.providerError || undefined,
    };
  }
}

async function getOrderWithItems(orderId) {
  const orderResult = await pool.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (orderResult.rows.length === 0) return null;

  const itemsResult = await pool.query(
    `SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId]
  ).catch(() => ({ rows: [] }));

  return {
    ...orderResult.rows[0],
    items: itemsResult.rows,
  };
}

async function sendTestEmail(to) {
  const template = testEmailTemplate();
  return sendEmail({
    to,
    ...template,
    type: "test_email",
    metadata: { source: "admin_test" },
  });
}

async function sendAdminTestEmail(to = process.env.ADMIN_TEST_EMAIL) {
  if (!to) {
    return skippedResult("ADMIN_TEST_EMAIL is missing. Provide a recipient or set ADMIN_TEST_EMAIL in backend environment variables.");
  }
  return sendTestEmail(to);
}

async function sendWelcomeEmail(userData = {}) {
  const template = welcomeEmailTemplate(userData);
  return sendEmail({
    to: userData.email,
    ...template,
    type: "welcome_email",
    metadata: { relatedUserId: userData.id || null, source: "customer_signup" },
  });
}

async function sendOrderConfirmationEmail(orderData = {}) {
  const template = orderConfirmationTemplate(orderData);
  return sendEmail({
    to: orderData.customer_email || orderData.email,
    ...template,
    type: "order_confirmation",
    metadata: { relatedOrderId: orderData.id || null, source: "paid_order" },
  });
}

async function sendAdminOrderNotificationEmail(orderData = {}) {
  const to = getAdminNotificationEmail();
  if (!to) {
    return skippedResult("ADMIN_EMAIL is missing", { subject: "New LUMA order received" });
  }
  const template = adminOrderNotificationTemplate(orderData);
  return sendEmail({
    to,
    ...template,
    type: "admin_order_notification",
    metadata: { relatedOrderId: orderData.id || null, source: "paid_order" },
  });
}

async function sendNewsletterConfirmationEmail(data = {}) {
  const template = newsletterConfirmationTemplate(data);
  return sendEmail({
    to: data.email,
    ...template,
    type: "newsletter_confirmation",
    metadata: { source: data.source || "newsletter_signup" },
  });
}

async function sendWaitlistConfirmationEmail(data = {}) {
  const template = waitlistConfirmationTemplate(data);
  return sendEmail({
    to: data.email || data.customer_email,
    ...template,
    type: "waitlist_confirmation",
    metadata: { source: data.source || "waitlist_signup" },
  });
}

async function sendAbandonedCartEmail(cartData = {}) {
  const template = abandonedCartTemplate(cartData);
  return sendEmail({
    to: cartData.customer_email || cartData.email,
    ...template,
    type: "abandoned_cart_recovery",
    metadata: { cartId: cartData.id || null, source: "abandoned_cart" },
  });
}

async function sendAbandonedCartRecoveryEmail(cartData = {}) {
  return sendAbandonedCartEmail(cartData);
}

async function sendCheckoutRecoveryEmail(checkoutData = {}) {
  const cartLike = {
    ...checkoutData,
    total_value: checkoutData.total_amount || checkoutData.total_value,
  };
  const template = abandonedCartTemplate(cartLike);
  return sendEmail({
    to: checkoutData.customer_email || checkoutData.email,
    subject: "Complete your LUMA checkout",
    html: template.html.replace("You left something glowing behind", "Your LUMA checkout is waiting"),
    text: template.text,
    type: "checkout_recovery",
    metadata: { checkoutId: checkoutData.id || null, source: "checkout_recovery" },
  });
}

async function sendBroadcastTestEmail({ to, subject, html, text, message } = {}) {
  const template = broadcastTemplate({ subject: subject || "LUMA broadcast test", html, text, message });
  return sendEmail({
    to,
    ...template,
    type: "broadcast_test",
    metadata: { source: "admin_broadcast_test" },
  });
}

async function sendBroadcastEmail({ recipients, to, subject, html, text, message } = {}) {
  const recipientList = recipients || toArray(to);
  const template = broadcastTemplate({ subject: subject || "LUMA update", html, text, message });

  if (!Array.isArray(recipientList)) {
    return sendEmail({ to: recipientList, ...template, type: "broadcast" });
  }

  const results = [];
  for (const recipient of recipientList) {
    const email = typeof recipient === "string" ? recipient : recipient.email || recipient.recipient_email;
    const result = await sendEmail({
      to: email,
      ...template,
      type: "broadcast",
      metadata: { source: "admin_broadcast" },
    });
    results.push({ email, ...result });
  }

  if (recipientList.length === 1) return results[0];

  return {
    success: results.some((result) => result.success),
    sent: results.some((result) => result.success),
    sentCount: results.filter((result) => result.success).length,
    failedCount: results.filter((result) => !result.success).length,
    results,
  };
}

async function sendBackInStockEmail({ product, request } = {}) {
  const productUrl = `${getFrontendUrl()}/products/${product?.slug || product?.id || ""}`;
  const html = baseEmailTemplate({
    previewText: `${product?.name || "A LUMA product"} is back in stock.`,
    title: `${product?.name || "Your LUMA product"} is back`,
    body: `<p style="margin:0 0 16px;">Good news: the LUMA product you asked about is available again.</p><div style="background:#f2e7d8;border-radius:18px;padding:18px;margin:22px 0;"><strong>Product:</strong> ${escapeHtml(product?.name || "LUMA product")}<br/><strong>Price:</strong> ${formatMoney(product?.price)}</div>`,
    buttonText: "View product",
    buttonUrl: productUrl,
  });

  return sendEmail({
    to: request?.customer_email || request?.email,
    subject: `${product?.name || "A LUMA product"} is back in stock`,
    html,
    text: stripHtml(html),
    type: "back_in_stock_alert",
    metadata: { productId: product?.id || null, requestId: request?.id || null },
  });
}

async function sendCustomerPasswordResetEmail({ email, fullName, code } = {}) {
  const html = baseEmailTemplate({
    previewText: "Reset your LUMA password.",
    title: "Reset your LUMA password",
    body: `<p style="margin:0 0 18px;">Hi ${escapeHtml(fullName || "there")}, use this verification code to reset your password.</p><div style="background:#f2e7d8;border-radius:18px;padding:22px;margin:22px 0;text-align:center;"><span style="display:block;color:#8a6b4f;font-size:13px;">Verification code</span><strong style="display:block;font-size:34px;letter-spacing:0.18em;color:#2b1d14;margin-top:8px;">${escapeHtml(code)}</strong></div><p style="margin:0;color:#7a6a5d;font-size:14px;">This code expires soon. If you did not request it, you can ignore this email.</p>`,
  });
  return sendEmail({
    to: email,
    subject: "Reset your LUMA password",
    html,
    text: stripHtml(html),
    type: "password_reset",
    metadata: { source: "customer_password_reset" },
  });
}

async function sendAdminPasswordVerificationEmail({ email, fullName, code, expiresInMinutes = 10 } = {}) {
  const html = baseEmailTemplate({
    previewText: "Your LUMA admin verification code.",
    title: "Your LUMA admin verification code",
    body: `<p style="margin:0 0 18px;">Hi ${escapeHtml(fullName || "there")}, use this code to continue your admin security action.</p><div style="background:#f2e7d8;border-radius:18px;padding:22px;margin:22px 0;text-align:center;"><span style="display:block;color:#8a6b4f;font-size:13px;">Verification code</span><strong style="display:block;font-size:34px;letter-spacing:0.18em;color:#2b1d14;margin-top:8px;">${escapeHtml(code)}</strong></div><p style="margin:0;color:#7a6a5d;font-size:14px;">This code expires in ${escapeHtml(expiresInMinutes)} minutes.</p>`,
  });
  return sendEmail({
    to: email,
    subject: "Your LUMA admin verification code",
    html,
    text: stripHtml(html),
    type: "admin_password_verification",
    metadata: { source: "admin_security" },
  });
}

async function sendLifecycleEmail({ eventType, customer, order } = {}) {
  const copy = {
    post_purchase_followup: ["How is your LUMA order feeling?", "A quick check-in after your order."],
    review_request: ["Share your LUMA skincare experience", "Tell us how your order worked for you."],
    reorder_reminder: ["Time to restock your LUMA essentials?", "Your skincare shelf may be ready for a refill."],
    winback_email: ["We saved a soft return to LUMA for you", "Your LUMA routine is still here."],
  }[eventType] || ["A note from LUMA", "Your LUMA update"];

  const recipient = customer?.email || order?.customer_email || order?.email;
  const html = baseEmailTemplate({
    previewText: copy[0],
    title: copy[1],
    body: `<p style="margin:0;">Hi ${escapeHtml(customer?.full_name || customer?.name || order?.customer_name || "there")}, ${escapeHtml(copy[0])}</p>`,
    buttonText: "Visit LUMA",
    buttonUrl: `${getFrontendUrl()}/products`,
  });

  return sendEmail({
    to: recipient,
    subject: copy[0],
    html,
    text: stripHtml(html),
    type: eventType || "lifecycle_email",
    metadata: { relatedOrderId: order?.id || null, relatedUserId: customer?.id || null },
  });
}

async function sendOrderConfirmationEmails(orderId) {
  try {
    const order = await getOrderWithItems(orderId);
    if (!order) {
      return { sent: false, success: false, status: "not_found", message: "Order not found." };
    }

    const results = [];

    if (await hasSuccessfulEmailLog("order_confirmation", order.id)) {
      results.push({ type: "order_confirmation", skipped: true, status: "duplicate", message: "Customer order email already sent." });
    } else {
      results.push({ type: "order_confirmation", ...(await sendOrderConfirmationEmail(order)) });
    }

    if (await hasSuccessfulEmailLog("admin_order_notification", order.id)) {
      results.push({ type: "admin_order_notification", skipped: true, status: "duplicate", message: "Admin order email already sent." });
    } else {
      results.push({ type: "admin_order_notification", ...(await sendAdminOrderNotificationEmail(order)) });
    }

    const sent = results.some((result) => result.success || result.sent || result.status === "duplicate");
    const failed = results.some((result) => result.status === "failed");

    return {
      success: sent && !failed,
      sent,
      status: failed ? (sent ? "partial" : "failed") : "sent",
      results,
    };
  } catch (error) {
    console.error("Send order emails error:", error.message);
    return {
      success: false,
      sent: false,
      status: "failed",
      message: error.message,
    };
  }
}

async function getRecentEmailLogs({ limit = 25 } = {}) {
  try {
    await ensureEmailLogsTable();
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const result = await pool.query(
      `
        SELECT id, type, recipient, subject, status, provider, provider_message_id, error_message, related_order_id, related_user_id, metadata, created_at
        FROM email_logs
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [safeLimit]
    );
    return result.rows;
  } catch (error) {
    console.error("Load email logs failed:", pool.describeError ? pool.describeError(error) : error.message);
    return [];
  }
}

module.exports = {
  ensureEmailLogsTable,
  getEmailConfigStatus,
  getOrderWithItems,
  getRecentEmailLogs,
  logEmail,
  sendEmail,
  sendTestEmail,
  sendAdminTestEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendAdminOrderNotificationEmail,
  sendNewsletterConfirmationEmail,
  sendWaitlistConfirmationEmail,
  sendAbandonedCartEmail,
  sendAbandonedCartRecoveryEmail,
  sendBroadcastTestEmail,
  sendBroadcastEmail,
  sendBackInStockEmail,
  sendCheckoutRecoveryEmail,
  sendCustomerPasswordResetEmail,
  sendAdminPasswordVerificationEmail,
  sendLifecycleEmail,
  sendOrderConfirmationEmails,
};
