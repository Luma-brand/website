const crypto = require("crypto");
const pool = require("../config/db");

const RESEND_API_URL = "https://api.resend.com";
const SUPPORT_INBOX_EMAIL = "support@shopwithluma.com";
const HELLO_INBOX_EMAIL = "hello@shopwithluma.com";

function cleanLimit(value, fallback = 25, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function cleanPage(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeEmailAddress(value) {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === "object") {
    return normalizeEmailAddress(raw.email || raw.address || raw.value || raw.text);
  }

  const text = String(raw).trim();
  const match = text.match(/<([^>]+)>/);
  return (match ? match[1] : text).trim().toLowerCase() || null;
}

function extractEmailAddresses(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(extractEmailAddresses).filter(Boolean);
  }
  if (typeof value === "object") {
    return extractEmailAddresses(value.email || value.address || value.value || value.text);
  }

  return String(value)
    .split(",")
    .map((item) => normalizeEmailAddress(item))
    .filter(Boolean);
}

function normalizeAddressList(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "object") return item.email || item.address || item.text || "";
        return String(item || "");
      })
      .filter(Boolean)
      .join(", ");
  }
  return String(value);
}

function normalizeSubject(subject = "Customer message") {
  const value = String(subject || "Customer message").trim();
  return value || "Customer message";
}

function stripReplyPrefix(subject = "") {
  return normalizeSubject(subject).replace(/^(re|fw|fwd):\s*/i, "").trim();
}

function getSupportEmail() {
  return (
    process.env.SUPPORT_EMAIL ||
    process.env.EMAIL_REPLY_TO ||
    SUPPORT_INBOX_EMAIL
  );
}

function getSupportFrom() {
  return (
    process.env.SUPPORT_FROM ||
    process.env.EMAIL_FROM ||
    `LUMA Support <${getSupportEmail()}>`
  );
}

function getHelloEmail() {
  return process.env.HELLO_EMAIL || HELLO_INBOX_EMAIL;
}

function getHelloFrom() {
  return process.env.HELLO_FROM || `LUMA <${getHelloEmail()}>`;
}

function parseFromAddress(value, fallbackEmail, fallbackName) {
  const text = String(value || "").trim();
  const email = normalizeEmailAddress(text) || fallbackEmail;
  const nameMatch = text.match(/^(.+?)\s*<[^>]+>/);
  const name = nameMatch?.[1]?.trim().replace(/^"|"$/g, "") || fallbackName;
  return { email: String(email || "").toLowerCase(), name };
}

function configuredInboxes() {
  const supportFrom = parseFromAddress(getSupportFrom(), getSupportEmail(), "LUMA Support");
  const helloFrom = parseFromAddress(getHelloFrom(), getHelloEmail(), "LUMA");
  const configuredEmails = String(process.env.MAIL_INBOXES || "")
    .split(",")
    .map((item) => normalizeEmailAddress(item))
    .filter(Boolean);
  const defaults = [
    {
      key: "support",
      label: "Support",
      email: normalizeEmailAddress(getSupportEmail()),
      replyFromEmail: supportFrom.email,
      replyFromName: supportFrom.name || "LUMA Support",
    },
    {
      key: "hello",
      label: "Hello",
      email: normalizeEmailAddress(getHelloEmail()),
      replyFromEmail: helloFrom.email,
      replyFromName: helloFrom.name || "LUMA",
    },
  ];
  const inboxes = defaults.filter((inbox) => !configuredEmails.length || configuredEmails.includes(inbox.email));

  for (const email of configuredEmails) {
    if (!inboxes.some((inbox) => inbox.email === email)) {
      inboxes.push({
        key: email.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other",
        label: "Other",
        email,
        replyFromEmail: email,
        replyFromName: "LUMA",
      });
    }
  }

  return inboxes;
}

function getDefaultInbox() {
  const defaultEmail = normalizeEmailAddress(process.env.DEFAULT_MAIL_INBOX || getSupportEmail());
  return configuredInboxes().find((inbox) => inbox.email === defaultEmail) || configuredInboxes()[0];
}

function getAvailableInboxes() {
  return [
    { key: "all", label: "All inboxes", email: null },
    ...configuredInboxes().map((inbox) => ({
      key: inbox.key,
      label: inbox.label,
      email: inbox.email,
      replyFromEmail: inbox.replyFromEmail,
      replyFromName: inbox.replyFromName,
    })),
  ];
}

function resolveInboxByEmail(email) {
  const normalized = normalizeEmailAddress(email);
  const known = configuredInboxes().find((inbox) => inbox.email === normalized);
  if (known) return known;
  if (!normalized) return getDefaultInbox();
  return {
    key: "other",
    label: "Other",
    email: normalized,
    replyFromEmail: getDefaultInbox().replyFromEmail,
    replyFromName: getDefaultInbox().replyFromName,
  };
}

function resolveInboundInbox(source = {}) {
  const candidates = [
    ...extractEmailAddresses(source.to),
    ...extractEmailAddresses(source.toEmail),
    ...extractEmailAddresses(source.recipients),
    ...extractEmailAddresses(source.recipient),
    ...extractEmailAddresses(source.delivered_to),
  ];
  const known = configuredInboxes().find((inbox) => candidates.includes(inbox.email));
  return known || resolveInboxByEmail(candidates[0] || getDefaultInbox().email);
}

function formatFromHeader(name, email) {
  return `${name || "LUMA"} <${email}>`;
}

async function getTableColumns(tableName) {
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function getSupportSchemaColumns() {
  const [ticketColumns, messageColumns] = await Promise.all([
    getTableColumns("support_tickets"),
    getTableColumns("support_messages"),
  ]);
  return { ticketColumns, messageColumns };
}

function formatTicket(ticket = {}) {
  if (!ticket) return ticket;
  const inbox = resolveInboxByEmail(ticket.inbox_email || getDefaultInbox().email);
  return {
    ...ticket,
    inbox_email: ticket.inbox_email || inbox.email,
    inbox_name: ticket.inbox_name || inbox.label,
    source_recipient: ticket.source_recipient || ticket.inbox_email || inbox.email,
    reply_from_email: ticket.reply_from_email || inbox.replyFromEmail,
    reply_from_name: ticket.reply_from_name || inbox.replyFromName,
  };
}

function formatMessage(message = {}, ticket = {}) {
  if (!message) return message;
  const formattedTicket = formatTicket(ticket);
  return {
    ...message,
    inbox_email: message.inbox_email || formattedTicket?.inbox_email || getDefaultInbox().email,
    from_email: message.from_email || null,
    to_email: message.to_email || null,
  };
}

function getEventData(event = {}) {
  return event.data || event.email || event.object || event;
}

function getEventType(event = {}) {
  return event.type || event.event || event.event_type || "unknown";
}

function getReceivedEmailId(event = {}) {
  const data = getEventData(event);
  return (
    data.received_email_id ||
    data.email_id ||
    data.emailId ||
    data.id ||
    data.message_id ||
    data.provider_message_id ||
    null
  );
}

function buildWebhookError(message, statusCode = 401) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyResendWebhook({ headers = {}, rawBody = "", body = {} } = {}) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true;

  const authHeader = headers.authorization || headers.Authorization || "";
  const sharedSecret =
    headers["x-resend-webhook-secret"] ||
    headers["x-webhook-secret"] ||
    (String(authHeader).startsWith("Bearer ") ? String(authHeader).slice(7) : null);

  if (sharedSecret && timingSafeEqualText(sharedSecret, secret)) return true;

  const signature =
    headers["x-resend-signature"] ||
    headers["resend-signature"] ||
    headers["svix-signature"] ||
    "";

  if (signature) {
    const payload = rawBody || JSON.stringify(body || {});
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const candidates = String(signature)
      .split(/[,\s]+/)
      .map((item) => item.replace(/^v\d+=/, "").replace(/^sha256=/, ""))
      .filter(Boolean);

    if (candidates.some((item) => timingSafeEqualText(item, expected))) return true;
  }

  throw buildWebhookError("Invalid Resend webhook signature.", 401);
}

async function resendRequest(path, options = {}) {
  if (!process.env.RESEND_API_KEY) {
    const error = new Error("RESEND_API_KEY is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${RESEND_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Resend request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload.data || payload;
}

async function fetchReceivedEmail(receivedEmailId) {
  if (!receivedEmailId) return null;

  const candidates = [
    `/emails/${encodeURIComponent(receivedEmailId)}`,
    `/emails/received/${encodeURIComponent(receivedEmailId)}`,
    `/received-emails/${encodeURIComponent(receivedEmailId)}`,
  ];

  for (const path of candidates) {
    try {
      return await resendRequest(path);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }

  return null;
}

function normalizeInboundEmail(event = {}, fetchedEmail = null) {
  const data = getEventData(event);
  const source = fetchedEmail || data;

  const headers = source.headers || source.email_headers || data.headers || {};
  const messageIdHeader =
    source.message_id ||
    source.messageId ||
    source.message_id_header ||
    headers["message-id"] ||
    headers["Message-ID"] ||
    null;
  const inReplyToHeader =
    source.in_reply_to ||
    source.inReplyTo ||
    source.in_reply_to_header ||
    headers["in-reply-to"] ||
    headers["In-Reply-To"] ||
    null;

  return {
    receivedEmailId: getReceivedEmailId(event),
    providerMessageId:
      source.email_id ||
      source.id ||
      source.message_id ||
      data.email_id ||
      data.id ||
      null,
    threadId:
      source.thread_id ||
      source.threadId ||
      data.thread_id ||
      data.threadId ||
      null,
    fromEmail: normalizeEmailAddress(source.from || source.sender || data.from),
    toEmail: normalizeAddressList(source.to || data.to || getSupportEmail()),
    subject: normalizeSubject(source.subject || data.subject),
    textBody: source.text || source.text_body || source.body_text || data.text || "",
    htmlBody: source.html || source.html_body || source.body_html || data.html || null,
    cc: normalizeAddressList(source.cc || data.cc),
    bcc: normalizeAddressList(source.bcc || data.bcc),
    messageIdHeader,
    inReplyToHeader,
    rawPayload: {
      event,
      fetchedEmail: fetchedEmail || null,
    },
  };
}

async function findExistingMessage(client, inbound) {
  const result = await client.query(
    `SELECT id, ticket_id
     FROM support_messages
     WHERE ($1::text IS NOT NULL AND provider_received_email_id = $1)
        OR ($2::text IS NOT NULL AND message_id_header = $2)
        OR ($3::text IS NOT NULL AND provider_message_id = $3)
     LIMIT 1`,
    [inbound.receivedEmailId, inbound.messageIdHeader, inbound.providerMessageId]
  );

  return result.rows[0] || null;
}

async function findTicketForInbound(client, inbound) {
  const { ticketColumns } = await getSupportSchemaColumns();
  const inbox = resolveInboundInbox({
    to: inbound.toEmail,
  });

  if (inbound.inReplyToHeader || inbound.threadId) {
    const replyMatch = await client.query(
      `SELECT t.*
       FROM support_tickets t
       JOIN support_messages m ON m.ticket_id = t.id
       WHERE ($1::text IS NOT NULL AND m.message_id_header = $1)
          OR ($2::text IS NOT NULL AND m.provider_thread_id = $2)
       ORDER BY t.last_message_at DESC NULLS LAST
       LIMIT 1`,
      [inbound.inReplyToHeader, inbound.threadId]
    );

    if (replyMatch.rows[0]) return replyMatch.rows[0];
  }

  const subjectRoot = stripReplyPrefix(inbound.subject);
  const openValues = [inbound.fromEmail, subjectRoot];
  const inboxClause = ticketColumns.has("inbox_email")
    ? `AND COALESCE(LOWER(inbox_email), LOWER($${openValues.push(getDefaultInbox().email)})) = LOWER($${openValues.push(inbox.email)})`
    : "";
  const openMatch = await client.query(
    `SELECT *
     FROM support_tickets
     WHERE LOWER(customer_email) = LOWER($1)
       AND status IN ('open', 'pending')
       AND LOWER(REGEXP_REPLACE(subject, '^(re|fw|fwd):\\s*', '', 'i')) = LOWER($2)
       ${inboxClause}
     ORDER BY last_message_at DESC NULLS LAST
     LIMIT 1`,
    openValues
  );

  if (openMatch.rows[0]) return openMatch.rows[0];

  const columns = ["customer_email", "customer_name", "subject", "status", "priority", "source", "last_message_at"];
  const params = [inbound.fromEmail, null, inbound.subject, "open", "normal", "resend_inbound"];
  const placeholders = ["$1", "$2", "$3", "$4", "$5", "$6", "CURRENT_TIMESTAMP"];

  if (ticketColumns.has("inbox_email")) {
    columns.push("inbox_email");
    params.push(inbox.email);
    placeholders.push(`$${params.length}`);
  }
  if (ticketColumns.has("inbox_name")) {
    columns.push("inbox_name");
    params.push(inbox.label);
    placeholders.push(`$${params.length}`);
  }
  if (ticketColumns.has("source_recipient")) {
    columns.push("source_recipient");
    params.push(inbound.toEmail || inbox.email);
    placeholders.push(`$${params.length}`);
  }
  if (ticketColumns.has("reply_from_email")) {
    columns.push("reply_from_email");
    params.push(inbox.replyFromEmail);
    placeholders.push(`$${params.length}`);
  }
  if (ticketColumns.has("reply_from_name")) {
    columns.push("reply_from_name");
    params.push(inbox.replyFromName);
    placeholders.push(`$${params.length}`);
  }

  const created = await client.query(
    `INSERT INTO support_tickets (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING *`,
    params
  );

  return created.rows[0];
}

async function processInboundEmailEvent(event = {}, context = {}) {
  verifyResendWebhook({ ...context, body: event });

  if (getEventType(event) !== "email.received") {
    return { processed: false, reason: "not_email_received" };
  }

  const receivedEmailId = getReceivedEmailId(event);
  const fetchedEmail = await fetchReceivedEmail(receivedEmailId).catch((error) => {
    console.warn("Resend receiving API fetch failed:", error.message);
    return null;
  });
  const inbound = normalizeInboundEmail(event, fetchedEmail);
  const inbox = resolveInboundInbox(inbound);

  if (!inbound.fromEmail) {
    return { processed: false, reason: "missing_from_email" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingMessage = await findExistingMessage(client, inbound);
    if (existingMessage) {
      await client.query("COMMIT");
      return {
        processed: true,
        duplicate: true,
        ticketId: existingMessage.ticket_id,
        messageId: existingMessage.id,
      };
    }

    const ticket = formatTicket(await findTicketForInbound(client, inbound));
    const { messageColumns, ticketColumns } = await getSupportSchemaColumns();
    if (ticketColumns.has("inbox_email")) {
      await client.query(
        `UPDATE support_tickets
         SET inbox_email = COALESCE(inbox_email, $2),
             inbox_name = COALESCE(inbox_name, $3),
             source_recipient = COALESCE(source_recipient, $4),
             reply_from_email = COALESCE(reply_from_email, $5),
             reply_from_name = COALESCE(reply_from_name, $6),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          ticket.id,
          inbox.email,
          inbox.label,
          inbound.toEmail || inbox.email,
          inbox.replyFromEmail,
          inbox.replyFromName,
        ]
      );
    }

    const messageColumnsList = [
      "ticket_id", "direction", "from_email", "to_email", "subject", "text_body", "html_body",
      "body_text", "body_html", "provider", "resend_email_id", "provider_message_id",
      "provider_received_email_id", "provider_thread_id", "message_id_header",
      "in_reply_to_header", "raw_payload", "payload",
    ];
    const messageParams = [
      ticket.id,
      inbound.fromEmail,
      inbound.toEmail,
      inbound.subject,
      inbound.textBody,
      inbound.htmlBody,
      inbound.providerMessageId,
      inbound.providerMessageId,
      inbound.receivedEmailId,
      inbound.threadId,
      inbound.messageIdHeader,
      inbound.inReplyToHeader,
      JSON.stringify(inbound.rawPayload),
    ];

    if (messageColumns.has("inbox_email")) {
      messageColumnsList.push("inbox_email");
      messageParams.push(inbox.email);
    }
    if (messageColumns.has("cc")) {
      messageColumnsList.push("cc");
      messageParams.push(inbound.cc);
    }
    if (messageColumns.has("bcc")) {
      messageColumnsList.push("bcc");
      messageParams.push(inbound.bcc);
    }

    const messagePlaceholders = [
      "$1", "'inbound'", "$2", "$3", "$4", "$5", "$6", "$5", "$6", "'resend'",
      "$7", "$8", "$9", "$10", "$11", "$12", "$13::jsonb", "$13::jsonb",
    ];
    for (let index = 14; index <= messageParams.length; index += 1) {
      messagePlaceholders.push(`$${index}`);
    }
    const inserted = await client.query(
      `INSERT INTO support_messages (${messageColumnsList.join(", ")})
       VALUES (${messagePlaceholders.join(", ")})
       RETURNING id`,
      messageParams
    );

    await client.query(
      `UPDATE support_tickets
       SET status = CASE WHEN status = 'closed' THEN 'open' ELSE status END,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ticket.id]
    );

    await client.query("COMMIT");
    return {
      processed: true,
      duplicate: false,
      ticketId: ticket.id,
      messageId: inserted.rows[0]?.id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listTickets({ status, search, page, limit, inbox = "all" } = {}) {
  const pageNumber = cleanPage(page);
  const pageLimit = cleanLimit(limit);
  const offset = (pageNumber - 1) * pageLimit;
  const values = [];
  const conditions = [];
  const { ticketColumns } = await getSupportSchemaColumns();
  const inboxEmail = normalizeEmailAddress(inbox);

  if (status && status !== "all") {
    values.push(status);
    conditions.push(`t.status = $${values.length}`);
  }

  if (inbox && inbox !== "all") {
    const resolvedInbox = inboxEmail
      ? resolveInboxByEmail(inboxEmail)
      : configuredInboxes().find((item) => item.key === inbox);
    if (resolvedInbox?.email) {
      if (ticketColumns.has("inbox_email")) {
        values.push(getDefaultInbox().email, resolvedInbox.email);
        conditions.push(`COALESCE(LOWER(t.inbox_email), LOWER($${values.length - 1})) = LOWER($${values.length})`);
      } else if (resolvedInbox.email !== getDefaultInbox().email) {
        return {
          tickets: [],
          inboxes: getAvailableInboxes(),
          pagination: { page: pageNumber, limit: pageLimit, total: 0 },
        };
      }
    }
  }

  if (search) {
    values.push(`%${String(search).trim()}%`);
    conditions.push(
      `(t.customer_email ILIKE $${values.length} OR t.customer_name ILIKE $${values.length} OR t.subject ILIKE $${values.length})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const listValues = [...values, pageLimit, offset];
  const rows = await pool.query(
    `SELECT
       t.*,
       COUNT(m.id)::int AS message_count,
       MAX(m.created_at) AS latest_message_at,
       (
         SELECT COALESCE(NULLIF(sm.text_body, ''), NULLIF(sm.body_text, ''), sm.subject, '')
         FROM support_messages sm
         WHERE sm.ticket_id = t.id
         ORDER BY sm.created_at DESC
         LIMIT 1
       ) AS preview
     FROM support_tickets t
     LEFT JOIN support_messages m ON m.ticket_id = t.id
     ${whereClause}
     GROUP BY t.id
     ORDER BY COALESCE(t.last_message_at, t.created_at) DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    listValues
  );

  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM support_tickets t ${whereClause}`,
    values
  );

  return {
    tickets: rows.rows.map(formatTicket),
    inboxes: getAvailableInboxes(),
    pagination: {
      page: pageNumber,
      limit: pageLimit,
      total: Number(count.rows[0]?.total || 0),
    },
  };
}

async function getTicketById(id) {
  const ticketResult = await pool.query(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
  const ticket = formatTicket(ticketResult.rows[0]);

  if (!ticket) {
    const error = new Error("Support ticket not found.");
    error.statusCode = 404;
    throw error;
  }

  const messages = await pool.query(
    `SELECT *
     FROM support_messages
     WHERE ticket_id = $1
     ORDER BY created_at ASC`,
    [id]
  );

  return { ticket, messages: messages.rows.map((message) => formatMessage(message, ticket)), inboxes: getAvailableInboxes() };
}

async function sendSupportReply(ticketId, { message } = {}) {
  const body = String(message || "").trim();
  if (!body) {
    const error = new Error("Reply message is required.");
    error.statusCode = 400;
    throw error;
  }

  const { ticket, messages } = await getTicketById(ticketId);
  const lastMessage = [...messages].reverse().find((item) => item.message_id_header);
  const subject = normalizeSubject(ticket.subject).match(/^re:/i)
    ? normalizeSubject(ticket.subject)
    : `Re: ${normalizeSubject(ticket.subject)}`;
  const html = `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>`;
  const headers = lastMessage?.message_id_header
    ? {
        "In-Reply-To": lastMessage.message_id_header,
        References: lastMessage.message_id_header,
      }
    : undefined;

  const replyFromEmail = normalizeEmailAddress(ticket.reply_from_email) || getDefaultInbox().replyFromEmail;
  const replyFromName = ticket.reply_from_name || getDefaultInbox().replyFromName;
  if (replyFromEmail === normalizeEmailAddress(getHelloEmail()) && !process.env.HELLO_FROM) {
    const error = new Error("Hello inbox sending is not configured. Set HELLO_FROM in the backend environment.");
    error.statusCode = 503;
    throw error;
  }
  const sent = await resendRequest("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: formatFromHeader(replyFromName, replyFromEmail),
      to: [ticket.customer_email],
      reply_to: replyFromEmail,
      subject,
      text: body,
      html,
      ...(headers ? { headers } : {}),
    }),
  });

  const providerMessageId = sent.id || sent.email_id || null;
  const { messageColumns } = await getSupportSchemaColumns();
  const columns = [
    "ticket_id", "direction", "from_email", "to_email", "subject", "text_body", "html_body",
    "body_text", "body_html", "provider", "resend_email_id", "provider_message_id",
    "in_reply_to_header", "raw_payload", "payload",
  ];
  const params = [
    ticket.id,
    replyFromEmail,
    ticket.customer_email,
    subject,
    body,
    html,
    providerMessageId,
    lastMessage?.message_id_header || null,
    JSON.stringify({ sent }),
  ];
  const placeholders = [
    "$1", "'outbound'", "$2", "$3", "$4", "$5", "$6", "$5", "$6", "'resend'",
    "$7", "$7", "$8", "$9::jsonb", "$9::jsonb",
  ];
  if (messageColumns.has("inbox_email")) {
    columns.push("inbox_email");
    params.push(ticket.inbox_email);
    placeholders.push(`$${params.length}`);
  }
  const saved = await pool.query(
    `INSERT INTO support_messages (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING *`,
    params
  );

  await pool.query(
    `UPDATE support_tickets
     SET status = 'pending',
         last_message_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ticket.id]
  );

  return { ticketId: ticket.id, message: formatMessage(saved.rows[0], ticket), providerMessageId };
}

async function updateTicketStatus(id, status) {
  const allowed = new Set(["open", "pending", "closed"]);
  if (!allowed.has(status)) {
    const error = new Error("Invalid ticket status.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `UPDATE support_tickets
     SET status = $2,
         closed_at = CASE WHEN $2 = 'closed' THEN CURRENT_TIMESTAMP ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );

  if (!result.rows[0]) {
    const error = new Error("Support ticket not found.");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

async function updateTicketPriority(id, priority) {
  const normalized = String(priority || "normal").trim().toLowerCase();
  const allowed = new Set(["low", "normal", "high", "urgent"]);
  if (!allowed.has(normalized)) {
    const error = new Error("Invalid ticket priority.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `UPDATE support_tickets
     SET priority = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id, normalized]
  );

  if (!result.rows[0]) {
    const error = new Error("Support ticket not found.");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

module.exports = {
  getAvailableInboxes,
  getHelloEmail,
  getSupportEmail,
  getTicketById,
  listTickets,
  processInboundEmailEvent,
  sendSupportReply,
  updateTicketPriority,
  updateTicketStatus,
  verifyResendWebhook,
};
