const pool = require("../config/db");
const { sendBroadcastEmail } = require("./emailService");

const VALID_GROUPS = new Set([
  "all_customers",
  "newsletter_subscribers",
  "abandoned_cart_customers",
  "selected_customers",
  "selected_emails",
  "all_available_contacts",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let tableReady = false;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isMissingSchemaError(error) {
  return ["42P01", "42703", "42P07"].includes(error.code);
}

async function ensureBroadcastTables() {
  if (tableReady) return;

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS email_broadcasts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      preheader TEXT NULL,
      image_url TEXT NULL,
      cta_label TEXT NULL,
      cta_url TEXT NULL,
      recipient_group VARCHAR(80) NOT NULL,
      selection_payload JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(40) DEFAULT 'draft',
      total_recipients INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_by UUID NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP NULL
    );

    CREATE TABLE IF NOT EXISTS email_broadcast_recipients (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      broadcast_id UUID REFERENCES email_broadcasts(id) ON DELETE CASCADE,
      recipient_email VARCHAR(160) NOT NULL,
      recipient_name TEXT NULL,
      recipient_source VARCHAR(80) NULL,
      customer_id UUID NULL,
      status VARCHAR(40) DEFAULT 'pending',
      provider_message_id TEXT NULL,
      error_message TEXT NULL,
      sent_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE email_broadcasts
      ADD COLUMN IF NOT EXISTS selection_payload JSONB DEFAULT '{}'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_email_broadcasts_status
      ON email_broadcasts(status);
    CREATE INDEX IF NOT EXISTS idx_email_broadcasts_created_at
      ON email_broadcasts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_email_broadcast_recipients_broadcast_id
      ON email_broadcast_recipients(broadcast_id);
    CREATE INDEX IF NOT EXISTS idx_email_broadcast_recipients_email
      ON email_broadcast_recipients(LOWER(recipient_email));
    CREATE INDEX IF NOT EXISTS idx_email_broadcast_recipients_status
      ON email_broadcast_recipients(status);
  `);

  tableReady = true;
}

async function runOptionalQuery(query, params = [], fallback = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    if (isMissingSchemaError(error)) return fallback;
    throw error;
  }
}

function addRecipient(recipients, recipient) {
  const email = normalizeEmail(recipient.email || recipient.recipient_email);

  if (!EMAIL_REGEX.test(email)) return;

  const existing = recipients.get(email);
  const next = {
    email,
    name: normalizeText(recipient.name || recipient.recipient_name),
    source: recipient.source || recipient.recipient_source || "manual",
    customerId: recipient.customerId || recipient.customer_id || null,
  };

  if (!existing || next.source === "customer_accounts") {
    recipients.set(email, {
      ...existing,
      ...next,
      name: next.name || existing?.name || "",
      customerId: next.customerId || existing?.customerId || null,
    });
  }
}

async function getCustomers() {
  return runOptionalQuery(
    `
      SELECT id, full_name AS name, email, phone
      FROM customer_accounts
      WHERE email IS NOT NULL
      ORDER BY created_at DESC
    `,
    [],
    []
  );
}

async function getNewsletterSubscribers() {
  return runOptionalQuery(
    `
      SELECT full_name AS name, email
      FROM newsletter_subscribers
      WHERE email IS NOT NULL
      ORDER BY created_at DESC
    `,
    [],
    []
  );
}

async function getAbandonedCartContacts() {
  return runOptionalQuery(
    `
      SELECT
        customer_id,
        customer_name AS name,
        COALESCE(email, customer_email) AS email
      FROM abandoned_carts
      WHERE COALESCE(email, customer_email) IS NOT NULL
      ORDER BY last_activity_at DESC NULLS LAST, created_at DESC NULLS LAST
    `,
    [],
    []
  );
}

async function getRecipientSources() {
  const [customers, newsletter, abandoned] = await Promise.all([
    getCustomers(),
    getNewsletterSubscribers(),
    getAbandonedCartContacts(),
  ]);

  return {
    customerCount: customers.length,
    newsletterCount: newsletter.length,
    abandonedCartCount: abandoned.length,
    groups: Array.from(VALID_GROUPS),
  };
}

async function searchRecipients(query = "") {
  const search = normalizeText(query);

  if (search.length < 2) return [];

  const like = `%${search}%`;
  const [customers, newsletter] = await Promise.all([
    runOptionalQuery(
      `
        SELECT
          id AS customer_id,
          full_name AS name,
          email,
          phone,
          'customer_accounts' AS source
        FROM customer_accounts
        WHERE email IS NOT NULL
          AND (
            full_name ILIKE $1
            OR email ILIKE $1
            OR phone ILIKE $1
          )
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [like],
      []
    ),
    runOptionalQuery(
      `
        SELECT
          NULL::uuid AS customer_id,
          full_name AS name,
          email,
          NULL::text AS phone,
          'newsletter_subscribers' AS source
        FROM newsletter_subscribers
        WHERE email IS NOT NULL
          AND (full_name ILIKE $1 OR email ILIKE $1)
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [like],
      []
    ),
  ]);
  const recipients = new Map();

  [...customers, ...newsletter].forEach((recipient) => addRecipient(recipients, recipient));

  return Array.from(recipients.values());
}

async function getCustomersByIds(customerIds = []) {
  if (!Array.isArray(customerIds) || customerIds.length === 0) return [];

  return runOptionalQuery(
    `
      SELECT id, full_name AS name, email, 'customer_accounts' AS source
      FROM customer_accounts
      WHERE id = ANY($1::uuid[])
        AND email IS NOT NULL
    `,
    [customerIds],
    []
  );
}

async function resolveBroadcastRecipients(options = {}) {
  const group = options.recipientGroup || options.recipient_group;

  if (!VALID_GROUPS.has(group)) {
    throw new Error("Choose a valid recipient group.");
  }

  const recipients = new Map();

  if (group === "all_customers" || group === "all_available_contacts") {
    (await getCustomers()).forEach((customer) =>
      addRecipient(recipients, {
        ...customer,
        source: "customer_accounts",
        customerId: customer.id,
      })
    );
  }

  if (group === "newsletter_subscribers" || group === "all_available_contacts") {
    (await getNewsletterSubscribers()).forEach((subscriber) =>
      addRecipient(recipients, {
        ...subscriber,
        source: "newsletter_subscribers",
      })
    );
  }

  if (group === "abandoned_cart_customers" || group === "all_available_contacts") {
    (await getAbandonedCartContacts()).forEach((cart) =>
      addRecipient(recipients, {
        ...cart,
        source: "abandoned_carts",
        customerId: cart.customer_id,
      })
    );
  }

  if (group === "selected_customers") {
    (await getCustomersByIds(options.customerIds || options.customer_ids || [])).forEach(
      (customer) =>
        addRecipient(recipients, {
          ...customer,
          source: "customer_accounts",
          customerId: customer.id,
        })
    );
  }

  if (group === "selected_emails") {
    (options.emails || options.selectedEmails || []).forEach((email) =>
      addRecipient(recipients, {
        email,
        name: "",
        source: "manual",
      })
    );
  }

  return Array.from(recipients.values());
}

function validateBroadcastPayload(data = {}, { partial = false } = {}) {
  const title = normalizeText(data.title);
  const subject = normalizeText(data.subject);
  const body = normalizeText(data.body);
  const group = data.recipientGroup || data.recipient_group;

  if (!partial || title) {
    if (!title) throw new Error("Campaign title is required.");
  }
  if (!partial || subject) {
    if (!subject) throw new Error("Email subject is required.");
  }
  if (!partial || body) {
    if (!body) throw new Error("Email body is required.");
  }
  if (!partial || group) {
    if (!VALID_GROUPS.has(group)) throw new Error("Choose a valid recipient group.");
  }

  return {
    title,
    subject,
    body,
    preheader: normalizeText(data.preheader),
    imageUrl: normalizeText(data.imageUrl || data.image_url),
    ctaLabel: normalizeText(data.ctaLabel || data.cta_label),
    ctaUrl: normalizeText(data.ctaUrl || data.cta_url),
    recipientGroup: group,
  };
}

async function createBroadcast(data = {}, adminId = null) {
  await ensureBroadcastTables();
  const payload = validateBroadcastPayload(data);
  const recipients = await resolveBroadcastRecipients({
    ...data,
    recipientGroup: payload.recipientGroup,
  });
  const result = await pool.query(
    `
      INSERT INTO email_broadcasts (
        title, subject, body, preheader, image_url, cta_label, cta_url,
        recipient_group, selection_payload, total_recipients, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      payload.title,
      payload.subject,
      payload.body,
      payload.preheader,
      payload.imageUrl,
      payload.ctaLabel,
      payload.ctaUrl,
      payload.recipientGroup,
      JSON.stringify({
        customerIds: data.customerIds || data.customer_ids || [],
        emails: data.emails || data.selectedEmails || [],
      }),
      recipients.length,
      adminId,
    ]
  );

  return result.rows[0];
}

async function updateBroadcast(id, data = {}) {
  await ensureBroadcastTables();
  const payload = validateBroadcastPayload(data, { partial: true });
  const existing = await getBroadcastById(id);

  if (!existing) throw new Error("Broadcast not found.");
  if (existing.status !== "draft") throw new Error("Only draft broadcasts can be edited.");

  const next = {
    title: payload.title || existing.title,
    subject: payload.subject || existing.subject,
    body: payload.body || existing.body,
    preheader: payload.preheader || existing.preheader || "",
    imageUrl: payload.imageUrl || existing.image_url || "",
    ctaLabel: payload.ctaLabel || existing.cta_label || "",
    ctaUrl: payload.ctaUrl || existing.cta_url || "",
    recipientGroup: payload.recipientGroup || existing.recipient_group,
  };
  const recipientCount = Number(
    data.recipientCount ?? data.recipient_count ?? data.totalRecipients ?? existing.total_recipients ?? 0
  );
  const result = await pool.query(
    `
      UPDATE email_broadcasts
      SET
        title = $1,
        subject = $2,
        body = $3,
        preheader = $4,
        image_url = $5,
        cta_label = $6,
        cta_url = $7,
        recipient_group = $8,
        selection_payload = $9,
        total_recipients = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `,
    [
      next.title,
      next.subject,
      next.body,
      next.preheader,
      next.imageUrl,
      next.ctaLabel,
      next.ctaUrl,
      next.recipientGroup,
      JSON.stringify({
        customerIds:
          data.customerIds || data.customer_ids || existing.selection_payload?.customerIds || [],
        emails:
          data.emails || data.selectedEmails || existing.selection_payload?.emails || [],
      }),
      Math.max(recipientCount, 0),
      id,
    ]
  );

  return result.rows[0];
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBroadcastHtml(broadcast = {}, recipient = {}) {
  const bodyHtml = escapeHtml(broadcast.body).replace(/\n/g, "<br />");
  const imageHtml = broadcast.image_url
    ? `<img src="${escapeHtml(broadcast.image_url)}" alt="" style="width: 100%; max-height: 320px; object-fit: cover; border-radius: 22px; margin: 20px 0;" />`
    : "";
  const ctaHtml =
    broadcast.cta_label && broadcast.cta_url
      ? `<a href="${escapeHtml(broadcast.cta_url)}" style="display: inline-block; background: #2b1d14; color: #fff8ee; text-decoration: none; padding: 14px 22px; border-radius: 999px; margin-top: 22px;">${escapeHtml(broadcast.cta_label)}</a>`
      : "";

  return `
    <div style="font-family: Arial, sans-serif; background: #f7efe4; padding: 32px;">
      <div style="max-width: 660px; margin: 0 auto; background: #fffaf3; border-radius: 26px; padding: 34px; color: #241911;">
        <p style="letter-spacing: 0.22em; text-transform: uppercase; color: #8a6b4f; font-size: 12px; margin: 0 0 14px;">LUMA Skincare</p>
        <h1 style="margin: 0 0 12px; font-size: 30px; line-height: 1.2;">${escapeHtml(broadcast.subject)}</h1>
        ${broadcast.preheader ? `<p style="color: #6f5a49; line-height: 1.6;">${escapeHtml(broadcast.preheader)}</p>` : ""}
        ${imageHtml}
        <div style="font-size: 16px; line-height: 1.75;">${bodyHtml}</div>
        ${ctaHtml}
        <p style="color: #8a6b4f; font-size: 13px; margin-top: 34px;">
          Sent to ${escapeHtml(recipient.name || recipient.email || "you")} by LUMA.
        </p>
      </div>
    </div>
  `;
}

function buildBroadcastText(broadcast = {}) {
  return [
    "LUMA Skincare",
    broadcast.subject,
    broadcast.preheader,
    broadcast.body,
    broadcast.cta_label && broadcast.cta_url
      ? `${broadcast.cta_label}: ${broadcast.cta_url}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function previewBroadcast(input) {
  const broadcast =
    typeof input === "string" ? await getBroadcastById(input) : validateBroadcastPayload(input);

  if (!broadcast) throw new Error("Broadcast not found.");

  const normalized = {
    ...broadcast,
    image_url: broadcast.image_url || broadcast.imageUrl,
    cta_label: broadcast.cta_label || broadcast.ctaLabel,
    cta_url: broadcast.cta_url || broadcast.ctaUrl,
  };

  return {
    subject: normalized.subject,
    html: buildBroadcastHtml(normalized, { email: "preview@luma.local" }),
    text: buildBroadcastText(normalized),
  };
}

async function getBroadcasts() {
  await ensureBroadcastTables();
  return runOptionalQuery(
    `
      SELECT *
      FROM email_broadcasts
      ORDER BY created_at DESC
    `,
    [],
    []
  );
}

async function getBroadcastById(id) {
  await ensureBroadcastTables();
  const rows = await runOptionalQuery(
    `
      SELECT *
      FROM email_broadcasts
      WHERE id = $1
    `,
    [id],
    []
  );

  return rows[0] || null;
}

async function getBroadcastRecipients(id) {
  await ensureBroadcastTables();
  return runOptionalQuery(
    `
      SELECT *
      FROM email_broadcast_recipients
      WHERE broadcast_id = $1
      ORDER BY created_at DESC
    `,
    [id],
    []
  );
}

async function resetRecipientsForBroadcast(client, broadcastId, recipients) {
  await client.query("DELETE FROM email_broadcast_recipients WHERE broadcast_id = $1", [
    broadcastId,
  ]);

  for (const recipient of recipients) {
    await client.query(
      `
        INSERT INTO email_broadcast_recipients (
          broadcast_id, recipient_email, recipient_name, recipient_source, customer_id
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        broadcastId,
        recipient.email,
        recipient.name || null,
        recipient.source || null,
        recipient.customerId || null,
      ]
    );
  }
}

async function sendBroadcastToRecipient(broadcast, recipient) {
  const html = buildBroadcastHtml(broadcast, recipient);
  const text = buildBroadcastText(broadcast);
  const result = await sendBroadcastEmail({
    to: recipient.recipient_email || recipient.email,
    subject: broadcast.subject,
    html,
    text,
  });

  if (!result?.success) {
    const error = new Error(result?.reason || result?.error || result?.message || "Broadcast email was not accepted by Resend.");
    error.providerError = result?.providerError;
    throw error;
  }

  return result?.providerMessageId || result?.data?.id || result?.id || null;
}

async function sendBroadcast(id, options = {}) {
  const startedAt = Date.now();
  await ensureBroadcastTables();
  const broadcast = await getBroadcastById(id);
  if (!broadcast) throw new Error("Broadcast not found.");
  if (!broadcast.subject || !broadcast.body) {
    throw new Error("Subject and body are required before sending.");
  }

  const recipients = await resolveBroadcastRecipients({
    recipientGroup: broadcast.recipient_group,
    customerIds:
      options.customerIds ||
      options.customer_ids ||
      broadcast.selection_payload?.customerIds ||
      [],
    emails:
      options.emails ||
      options.selectedEmails ||
      broadcast.selection_payload?.emails ||
      [],
  });

  if (recipients.length === 0) {
    throw new Error("No valid recipients found for this broadcast.");
  }

  console.log("Email broadcast send started:", {
    broadcastId: id,
    recipientGroup: broadcast.recipient_group,
    resolvedRecipientCount: recipients.length,
    sampleRecipients:
      process.env.NODE_ENV === "production"
        ? undefined
        : recipients.slice(0, 5).map((recipient) => recipient.email),
  });

  const client = await pool.connect();
  let recipientRows = [];

  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE email_broadcasts
        SET status = 'sending', total_recipients = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [id, recipients.length]
    );
    await resetRecipientsForBroadcast(client, id, recipients);
    const result = await client.query(
      `
        SELECT *
        FROM email_broadcast_recipients
        WHERE broadcast_id = $1
        ORDER BY created_at ASC
      `,
      [id]
    );
    recipientRows = result.rows;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  let sentCount = 0;
  let failedCount = 0;
  const skippedCount = 0;
  const results = [];
  const providerErrors = [];

  for (const recipient of recipientRows) {
    try {
      const providerMessageId = await sendBroadcastToRecipient(broadcast, recipient);
      sentCount += 1;
      await pool.query(
        `
          UPDATE email_broadcast_recipients
          SET
            status = 'sent',
            provider_message_id = $2,
            sent_at = CURRENT_TIMESTAMP,
            error_message = NULL
          WHERE id = $1
        `,
        [recipient.id, providerMessageId]
      );
      console.log("Email broadcast recipient sent:", {
        broadcastId: id,
        email: recipient.recipient_email,
        providerMessageId,
      });
      results.push({
        email: recipient.recipient_email,
        status: "sent",
        providerMessageId,
      });
    } catch (error) {
      const providerError = error.providerError || error.message || error;
      failedCount += 1;
      providerErrors.push({
        email: recipient.recipient_email,
        error: error.message || "Email provider send failed.",
        providerError,
      });
      await pool.query(
        `
          UPDATE email_broadcast_recipients
          SET status = 'failed', error_message = $2
          WHERE id = $1
        `,
        [recipient.id, error.message || "Email provider send failed."]
      );
      console.error("Email broadcast recipient failed:", {
        broadcastId: id,
        email: recipient.recipient_email,
        error: error.message,
        providerError,
      });
      results.push({
        email: recipient.recipient_email,
        status: "failed",
        error: error.message,
      });
    }
  }

  const status =
    sentCount === recipientRows.length
      ? "sent"
      : sentCount > 0
        ? "partially_failed"
        : "failed";

  const update = await pool.query(
    `
      UPDATE email_broadcasts
      SET
        status = $2,
        sent_count = $3,
        failed_count = $4,
        sent_at = CASE WHEN $3 > 0 THEN CURRENT_TIMESTAMP ELSE sent_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [id, status, sentCount, failedCount]
  );

  const durationMs = Date.now() - startedAt;
  console.log("Email broadcast send completed:", {
    broadcastId: id,
    status,
    totalRecipients: recipientRows.length,
    sentCount,
    failedCount,
    skippedCount,
    durationMs,
  });

  return {
    broadcastId: id,
    broadcast: update.rows[0],
    status,
    totalRecipients: recipientRows.length,
    sentCount,
    failedCount,
    skippedCount,
    providerErrors,
    durationMs,
    results,
  };
}

async function sendBroadcastTest(id, options = {}) {
  await ensureBroadcastTables();

  const testRecipient = String(options.to || process.env.ADMIN_TEST_EMAIL || "").trim();

  if (!testRecipient) {
    throw new Error("ADMIN_TEST_EMAIL is missing. Provide a recipient or set ADMIN_TEST_EMAIL in backend environment variables.");
  }

  const broadcast = await getBroadcastById(id);
  if (!broadcast) throw new Error("Broadcast not found.");
  if (!broadcast.subject || !broadcast.body) {
    throw new Error("Subject and body are required before sending a test email.");
  }

  const providerMessageId = await sendBroadcastToRecipient(broadcast, {
    email: testRecipient,
    recipient_email: testRecipient,
    name: "Admin test recipient",
  });

  console.log("Email broadcast test sent:", {
    broadcastId: id,
    to: testRecipient,
    providerMessageId,
  });

  return {
    broadcastId: id,
    to: testRecipient,
    provider: "resend",
    providerMessageId,
  };
}
async function deleteDraftBroadcast(id) {
  await ensureBroadcastTables();
  const result = await pool.query(
    `
      DELETE FROM email_broadcasts
      WHERE id = $1
        AND status = 'draft'
      RETURNING *
    `,
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error("Only draft broadcasts can be deleted.");
  }

  return result.rows[0];
}

module.exports = {
  createBroadcast,
  deleteDraftBroadcast,
  getBroadcastById,
  getBroadcastRecipients,
  getBroadcasts,
  getRecipientSources,
  previewBroadcast,
  resolveBroadcastRecipients,
  searchRecipients,
  sendBroadcast,
  sendBroadcastTest,
  sendBroadcastToRecipient,
  updateBroadcast,
};


