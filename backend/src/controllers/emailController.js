const {
  getEmailConfigStatus,
  getRecentEmailLogs,
  sendAdminTestEmail,
  sendBroadcastTestEmail,
} = require("../services/emailService");
const emailBroadcastService = require("../services/emailBroadcastService");

function sendSuccess(res, statusCode, data, message = "OK") {
  return res.status(statusCode).json({ success: true, message, data });
}

function sendError(res, statusCode, message, details) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
}

async function getEmailStatusHandler(req, res) {
  const [logs, recipientSources] = await Promise.all([
    getRecentEmailLogs({ limit: 20 }),
    emailBroadcastService.getRecipientSources().catch(() => null),
  ]);

  return sendSuccess(
    res,
    200,
    {
      ...getEmailConfigStatus(),
      recentLogs: logs,
      recipientSources,
    },
    "Email configuration status loaded."
  );
}

async function sendEmailTestHandler(req, res) {
  try {
    const requestedRecipient = String(req.body?.to || "").trim();
    const recipient = requestedRecipient || process.env.ADMIN_TEST_EMAIL || "";

    if (!recipient) {
      return sendError(
        res,
        400,
        "ADMIN_TEST_EMAIL is missing. Provide a recipient or set ADMIN_TEST_EMAIL in backend environment variables."
      );
    }

    const result = await sendAdminTestEmail(recipient);
    const statusCode = result.success ? 200 : result.skipped ? 400 : 502;

    return res.status(statusCode).json({
      success: Boolean(result.success),
      message: result.success
        ? "Test email accepted by Resend."
        : result.reason || result.error || result.message || "Failed to send test email.",
      data: {
        to: recipient,
        ...result,
      },
    });
  } catch (error) {
    console.error("Send email test error:", error.providerError || error.message || error);
    return sendError(res, 400, error.message || "Failed to send test email.", {
      provider: error.provider || "resend",
      providerError: error.providerError || undefined,
    });
  }
}

async function sendBroadcastTestEmailHandler(req, res) {
  try {
    const recipient = String(req.body?.to || process.env.ADMIN_TEST_EMAIL || "").trim();
    if (!recipient) {
      return sendError(
        res,
        400,
        "ADMIN_TEST_EMAIL is missing. Provide a recipient or set ADMIN_TEST_EMAIL in backend environment variables."
      );
    }

    const result = await sendBroadcastTestEmail({
      to: recipient,
      subject: req.body?.subject || "LUMA broadcast test",
      message: req.body?.message || req.body?.body || "This is a LUMA broadcast test email.",
      html: req.body?.html,
      text: req.body?.text,
    });
    const statusCode = result.success ? 200 : result.skipped ? 400 : 502;

    return res.status(statusCode).json({
      success: Boolean(result.success),
      message: result.success
        ? "Broadcast test email accepted by Resend."
        : result.reason || result.error || result.message || "Failed to send broadcast test email.",
      data: {
        to: recipient,
        ...result,
      },
    });
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to send broadcast test email.", {
      providerError: error.providerError || undefined,
    });
  }
}

async function sendBroadcastEmailHandler(req, res) {
  try {
    if (req.body?.confirm !== true) {
      return sendError(res, 400, "Broadcast send requires confirm: true.");
    }

    const recipients = await emailBroadcastService.resolveBroadcastRecipients({
      recipientGroup: req.body?.audience === "newsletter" ? "newsletter_subscribers" : req.body?.recipientGroup,
      emails: req.body?.emails,
      customerIds: req.body?.customerIds,
    });

    if (!recipients.length) {
      return sendError(res, 400, "No valid recipients found for this broadcast.");
    }

    const { sendBroadcastEmail } = require("../services/emailService");
    const result = await sendBroadcastEmail({
      recipients,
      subject: req.body?.subject,
      message: req.body?.message || req.body?.body,
      html: req.body?.html,
      text: req.body?.text,
    });

    return sendSuccess(res, 200, result, "Broadcast send completed.");
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to send broadcast.");
  }
}

module.exports = {
  getEmailStatusHandler,
  sendBroadcastEmailHandler,
  sendBroadcastTestEmailHandler,
  sendEmailTestHandler,
};
