const pool = require("../config/db");
const abandonedCartService = require("./abandonedCartService");
const { getEmailConfigStatus, getRecentEmailLogs } = require("./emailService");
const supportInboxService = require("./supportInboxService");

function delayMinutes() {
  const value = Number(process.env.ABANDONED_CART_DELAY_MINUTES || 60);
  return Number.isFinite(value) && value > 0 ? value : 60;
}

function maxEmails() {
  const value = Number(process.env.ABANDONED_CART_MAX_EMAILS || 3);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

function cleanUrl(value, fallback) {
  return String(value || fallback).replace(/\/$/, "");
}

function optionalTableError(error) {
  return ["42P01", "42703", "42P10"].includes(error?.code);
}

async function optionalQuery(query, params = [], fallback = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    if (optionalTableError(error)) return fallback;
    throw error;
  }
}

async function getAutomationOverview() {
  const delay = delayMinutes();
  const max = maxEmails();
  const backendUrl = cleanUrl(process.env.BACKEND_URL, "https://website-ikv5.onrender.com");
  const frontendUrl = cleanUrl(process.env.FRONTEND_URL, "https://shopwithluma.com");

  const [cartSummary] = await optionalQuery(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE recovery_status = 'recovered')::int AS recovered,
       COUNT(*) FILTER (WHERE recovery_status IN ('not_contacted','checkout_started','email_sent')
         AND customer_email IS NOT NULL
         AND COALESCE(recovery_email_count, 0) < $2
         AND COALESCE(recovery_email_sent_at, last_activity_at) <= CURRENT_TIMESTAMP - ($1 || ' minutes')::interval
       )::int AS ready_for_email,
       COUNT(*) FILTER (WHERE recovery_status = 'email_sent')::int AS email_sent,
       COUNT(*) FILTER (WHERE recovery_status = 'whatsapp_contacted')::int AS whatsapp_contacted,
       COALESCE(SUM(total_value), 0)::numeric AS estimated_value
     FROM abandoned_carts
     WHERE recovery_status <> 'expired'`,
    [delay, max],
    [{ total: 0, recovered: 0, ready_for_email: 0, email_sent: 0, whatsapp_contacted: 0, estimated_value: 0 }]
  );

  const [emailSummary] = await optionalQuery(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
       COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped
     FROM email_logs
     WHERE type IN ('abandoned_cart_recovery','checkout_recovery')
        OR email_type IN ('abandoned_cart_recovery','checkout_recovery')`,
    [],
    [{ total: 0, sent: 0, failed: 0, skipped: 0 }]
  );

  const [eventSummary] = await optionalQuery(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE event_type IN ('email.delivered','delivered'))::int AS delivered,
       COUNT(*) FILTER (WHERE event_type IN ('email.opened','opened'))::int AS opened,
       COUNT(*) FILTER (WHERE event_type IN ('email.clicked','clicked'))::int AS clicked,
       COUNT(*) FILTER (WHERE event_type IN ('email.bounced','bounced'))::int AS bounced
     FROM email_events`,
    [],
    [{ total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }]
  );

  return {
    settings: {
      delayMinutes: delay,
      maxEmails: max,
      frontendUrl,
      backendUrl,
      cronEndpoint: `${backendUrl}/api/cron/abandoned-carts`,
      cronHealthEndpoint: `${backendUrl}/api/cron/abandoned-carts/health`,
      resendWebhookEndpoint: `${backendUrl}/api/webhooks/resend`,
      resendWebhookSecretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    },
    emailConfig: getEmailConfigStatus(),
    abandonedCarts: {
      total: Number(cartSummary.total || 0),
      recovered: Number(cartSummary.recovered || 0),
      readyForEmail: Number(cartSummary.ready_for_email || 0),
      emailSent: Number(cartSummary.email_sent || 0),
      whatsappContacted: Number(cartSummary.whatsapp_contacted || 0),
      estimatedValue: Number(cartSummary.estimated_value || 0),
    },
    emailLogs: {
      total: Number(emailSummary.total || 0),
      sent: Number(emailSummary.sent || 0),
      failed: Number(emailSummary.failed || 0),
      skipped: Number(emailSummary.skipped || 0),
    },
    emailEvents: {
      total: Number(eventSummary.total || 0),
      delivered: Number(eventSummary.delivered || 0),
      opened: Number(eventSummary.opened || 0),
      clicked: Number(eventSummary.clicked || 0),
      bounced: Number(eventSummary.bounced || 0),
    },
  };
}

async function logCartEmailAttempt(result = {}) {
  if (!result.cartId) return null;
  return optionalQuery(
    `INSERT INTO abandoned_cart_email_logs
       (abandoned_cart_id, email_type, status, provider, provider_message_id, error_message, metadata, sent_at)
     VALUES ($1, 'abandoned_cart_recovery', $2, 'resend', $3, $4, $5::jsonb,
       CASE WHEN $2 IN ('sent','email_sent') THEN CURRENT_TIMESTAMP ELSE NULL END)
     RETURNING id`,
    [
      result.cartId,
      result.status || (result.sent ? "sent" : "failed"),
      result.providerMessageId || result.id || null,
      result.message || result.error || null,
      JSON.stringify(result),
    ],
    []
  );
}

async function runAbandonedCartCheck(payload = {}) {
  const summary = await abandonedCartService.processAbandonedCarts({ limit: payload.limit || 25 });
  const results = Array.isArray(summary.results) ? summary.results : [];
  await Promise.all(results.map(logCartEmailAttempt));
  return { ...summary, delayMinutes: delayMinutes(), maxEmails: maxEmails() };
}

async function listAbandonedCarts(filters = {}) {
  return abandonedCartService.getAdminAbandonedCarts(filters);
}

async function listEmailLogs({ limit = 50 } = {}) {
  return { logs: await getRecentEmailLogs({ limit }) };
}

async function recordEmailEvent(event = {}, context = {}) {
  supportInboxService.verifyResendWebhook({ ...context, body: event });
  const data = event.data || event;
  const eventType = event.type || event.event || event.event_type || "unknown";
  const messageId = data.email_id || data.message_id || data.id || data.provider_message_id || null;
  const recipient = Array.isArray(data.to) ? data.to.join(", ") : data.to || data.recipient || data.email || data.from || null;
  const providerEventId = event.id || data.event_id || data.id || `${eventType}:${messageId || Date.now()}`;

  const rows = await optionalQuery(
    `INSERT INTO email_events
       (provider, provider_event_id, provider_message_id, event_type, recipient_email, subject, payload, occurred_at)
     VALUES ('resend', $1, $2, $3, $4, $5, $6::jsonb, COALESCE($7::timestamptz, CURRENT_TIMESTAMP))
     ON CONFLICT (provider, provider_event_id) DO UPDATE
     SET payload = EXCLUDED.payload, occurred_at = EXCLUDED.occurred_at
     RETURNING id`,
    [providerEventId, messageId, eventType, recipient, data.subject || null, JSON.stringify(event), data.created_at || event.created_at || null],
    []
  );

  if (eventType === "email.received") {
    await supportInboxService.processInboundEmailEvent(event, context);
  }

  return rows[0] || null;
}

async function upsertSupportTicket(data = {}, rawEvent = {}) {
  const fromEmail = data.from || data.sender || data.reply_to || null;
  if (!fromEmail) return null;

  const subject = data.subject || "Customer message";
  const tickets = await optionalQuery(
    `INSERT INTO support_tickets (customer_email, subject, status, source, last_message_at)
     VALUES ($1, $2, 'open', 'resend_inbound', CURRENT_TIMESTAMP)
     ON CONFLICT (customer_email, subject) WHERE status <> 'closed'
     DO UPDATE SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [fromEmail, subject],
    []
  );

  if (!tickets[0]?.id) return null;

  await optionalQuery(
    `INSERT INTO support_messages
       (ticket_id, direction, from_email, to_email, subject, body_text, body_html, provider, provider_message_id, payload)
     VALUES ($1, 'inbound', $2, $3, $4, $5, $6, 'resend', $7, $8::jsonb)`,
    [tickets[0].id, fromEmail, Array.isArray(data.to) ? data.to.join(", ") : data.to || null, subject, data.text || data.text_body || "", data.html || null, data.email_id || data.message_id || data.id || null, JSON.stringify(rawEvent)],
    []
  );

  return tickets[0];
}


async function getAbandonedCartColumns() {
  const rows = await optionalQuery(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'abandoned_carts'`,
    [],
    []
  );
  return new Set(rows.map((row) => row.column_name));
}

async function getRecentCartSyncsDebug() {
  const columns = await getAbandonedCartColumns();
  if (!columns.has("id")) return { carts: [] };

  const valueSources = [
    columns.has("cart_value") ? "cart_value" : null,
    columns.has("total_value") ? "total_value" : null,
    columns.has("cart_total") ? "cart_total" : null,
    "0",
  ].filter(Boolean).join(", ");

  const orderColumn = columns.has("last_activity_at") ? "last_activity_at" : "created_at";
  const rows = await optionalQuery(
    `SELECT
       id,
       ${columns.has("session_id") ? "session_id" : "NULL::text AS session_id"},
       ${columns.has("customer_email") ? "customer_email" : "NULL::text AS customer_email"},
       ${columns.has("customer_id") ? "customer_id::text AS customer_id" : "NULL::text AS customer_id"},
       COALESCE(${valueSources})::numeric AS cart_value,
       ${columns.has("cart_items") ? "jsonb_array_length(CASE WHEN jsonb_typeof(cart_items) = 'array' THEN cart_items ELSE '[]'::jsonb END)" : "0"}::int AS item_count,
       ${columns.has("recovery_status") ? "recovery_status" : columns.has("status") ? "status" : "NULL::text"} AS status,
       ${columns.has("last_activity_at") ? "last_activity_at" : "NULL::timestamptz AS last_activity_at"},
       ${columns.has("created_at") ? "created_at" : "NULL::timestamptz AS created_at"}
     FROM abandoned_carts
     ORDER BY ${orderColumn} DESC NULLS LAST
     LIMIT 10`,
    [],
    []
  );

  return {
    carts: rows.map((row) => ({
      ...row,
      cart_value: Number(row.cart_value || 0),
      item_count: Number(row.item_count || 0),
    })),
  };
}
function getHealth() {
  return {
    ok: true,
    configured: {
      cronSecret: Boolean(process.env.CRON_SECRET),
      resendApiKey: Boolean(process.env.RESEND_API_KEY),
      emailFrom: Boolean(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL),
      frontendUrl: Boolean(process.env.FRONTEND_URL),
    },
    delayMinutes: delayMinutes(),
    maxEmails: maxEmails(),
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getAutomationOverview,
  getHealth,
  getRecentCartSyncsDebug,
  listAbandonedCarts,
  listEmailLogs,
  recordEmailEvent,
  runAbandonedCartCheck,
};




