const pool = require("../config/db");
const {
  sendInquiryAdminNotificationEmail,
  sendInquiryConfirmationEmail,
  sendInquiryResponseEmail,
} = require("../services/emailService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, maxLength = 1000) {
  return String(value || "").trim().slice(0, maxLength);
}

function getRequestMetadata(req) {
  const forwardedFor = clean(req.headers["x-forwarded-for"], 300);
  return {
    sourcePage: clean(req.body?.sourcePage, 500) || clean(req.headers.referer, 500) || null,
    browserTimezone: clean(req.body?.browserTimezone, 100) || null,
    locale: clean(req.body?.locale, 80) || clean(req.headers["accept-language"], 200) || null,
    userAgent: clean(req.headers["user-agent"], 500) || null,
    ipAddress: forwardedFor.split(",")[0]?.trim() || clean(req.ip, 100) || null,
  };
}

async function createContactMessage(req, res) {
  try {
    const fullName = clean(req.body?.fullName, 120);
    const email = clean(req.body?.email, 160).toLowerCase();
    const phone = clean(req.body?.phone, 40);
    const subject = clean(req.body?.subject, 200) || "General enquiry";
    const message = clean(req.body?.message, 5000);

    if (!fullName || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, phone, and enquiry details are required.",
      });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }

    const metadata = getRequestMetadata(req);
    const result = await pool.query(
      `INSERT INTO contacts (full_name, email, phone, subject, message, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
       RETURNING id, full_name, email, phone, subject, message, status, metadata, created_at, updated_at`,
      [fullName, email, phone, subject, message, JSON.stringify(metadata)]
    );

    const inquiry = result.rows[0];
    const adminEmailResult = await sendInquiryAdminNotificationEmail(inquiry);
    const customerEmailResult = await sendInquiryConfirmationEmail(inquiry);
    if (adminEmailResult?.success) {
      await pool.query(
        `UPDATE contacts
         SET admin_notification_email_id=$2, admin_notified_at=NOW(), updated_at=NOW()
         WHERE id=$1`,
        [inquiry.id, adminEmailResult.providerMessageId || adminEmailResult.id || null]
      );
    }

    return res.status(201).json({
      success: true,
      message: "Your enquiry has been received. LUMA will respond by email.",
      data: {
        id: inquiry.id,
        status: inquiry.status,
        created_at: inquiry.created_at,
        confirmation_email_sent: Boolean(customerEmailResult?.success),
      },
    });
  } catch (error) {
    console.error("Create contact error:", error.message);
    return res.status(500).json({
      success: false,
      message: "We could not submit your enquiry. Please try again.",
    });
  }
}

async function getContactMessages(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         contact.id, contact.full_name, contact.email, contact.phone, contact.subject,
         contact.message, contact.status, contact.metadata, contact.admin_notified_at,
         contact.replied_at, contact.created_at, contact.updated_at,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', reply.id,
               'message', reply.message,
               'status', reply.status,
               'error_message', reply.error_message,
               'sent_at', reply.sent_at,
               'created_at', reply.created_at
             ) ORDER BY reply.created_at ASC
           ) FILTER (WHERE reply.id IS NOT NULL),
           '[]'::jsonb
         ) AS replies
       FROM contacts contact
       LEFT JOIN contact_replies reply ON reply.contact_id = contact.id
       GROUP BY contact.id
       ORDER BY contact.created_at DESC`
    );
    return res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error("Get contacts error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load enquiries." });
  }
}

async function markContactAsRead(req, res) {
  try {
    const result = await pool.query(
      `UPDATE contacts
       SET status = CASE WHEN status='new' THEN 'read' ELSE status END, updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "Enquiry not found." });
    return res.status(200).json({ success: true, message: "Enquiry marked as read.", data: result.rows[0] });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to update enquiry." });
  }
}

async function replyToContactMessage(req, res) {
  const message = clean(req.body?.message, 5000);
  if (!message) return res.status(400).json({ success: false, message: "Reply message is required." });

  try {
    const inquiryResult = await pool.query("SELECT * FROM contacts WHERE id=$1", [req.params.id]);
    const inquiry = inquiryResult.rows[0];
    if (!inquiry) return res.status(404).json({ success: false, message: "Enquiry not found." });

    const replyResult = await pool.query(
      `INSERT INTO contact_replies (contact_id, admin_id, message, recipient_email)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [inquiry.id, req.admin?.id || null, message, inquiry.email]
    );
    const reply = replyResult.rows[0];
    const emailResult = await sendInquiryResponseEmail({ inquiry, replyMessage: message });

    if (!emailResult?.success) {
      await pool.query(
        "UPDATE contact_replies SET status='failed', error_message=$2 WHERE id=$1",
        [reply.id, emailResult?.error || emailResult?.reason || "Email delivery failed"]
      );
      return res.status(502).json({
        success: false,
        message: "The reply was saved, but the email could not be delivered. You can retry.",
      });
    }

    const updatedReply = await pool.query(
      `UPDATE contact_replies
       SET status='sent', provider_message_id=$2, sent_at=NOW()
       WHERE id=$1 RETURNING *`,
      [reply.id, emailResult.providerMessageId || emailResult.id || null]
    );
    await pool.query(
      "UPDATE contacts SET status='replied', replied_at=NOW(), updated_at=NOW() WHERE id=$1",
      [inquiry.id]
    );
    return res.status(201).json({
      success: true,
      message: "Inquiry response sent successfully.",
      data: updatedReply.rows[0],
    });
  } catch (error) {
    console.error("Reply to enquiry error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to send enquiry response." });
  }
}

async function deleteContactMessage(req, res) {
  try {
    const result = await pool.query(
      "DELETE FROM contacts WHERE id=$1 RETURNING id, email",
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "Enquiry not found." });
    return res.status(200).json({ success: true, message: "Enquiry deleted successfully.", data: result.rows[0] });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to delete enquiry." });
  }
}

module.exports = {
  createContactMessage,
  deleteContactMessage,
  getContactMessages,
  markContactAsRead,
  replyToContactMessage,
};
