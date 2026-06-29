const emailBroadcastService = require("../services/emailBroadcastService");

function sendSuccess(res, statusCode, data, message = "OK") {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function sendError(res, statusCode, message, details) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
}

async function listBroadcastsHandler(req, res) {
  try {
    const broadcasts = await emailBroadcastService.getBroadcasts();
    return sendSuccess(res, 200, broadcasts, "Broadcasts loaded.");
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load broadcasts.");
  }
}

async function getBroadcastHandler(req, res) {
  try {
    const broadcast = await emailBroadcastService.getBroadcastById(req.params.id);
    if (!broadcast) return sendError(res, 404, "Broadcast not found.");
    return sendSuccess(res, 200, broadcast, "Broadcast loaded.");
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load broadcast.");
  }
}

async function getBroadcastRecipientsHandler(req, res) {
  try {
    const recipients = await emailBroadcastService.getBroadcastRecipients(req.params.id);
    return sendSuccess(res, 200, recipients, "Broadcast recipients loaded.");
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load recipients.");
  }
}

async function createBroadcastHandler(req, res) {
  try {
    const broadcast = await emailBroadcastService.createBroadcast(
      req.body || {},
      req.admin?.id || null
    );
    return sendSuccess(res, 201, broadcast, "Broadcast draft created.");
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to create broadcast.");
  }
}

async function updateBroadcastHandler(req, res) {
  try {
    const broadcast = await emailBroadcastService.updateBroadcast(
      req.params.id,
      req.body || {}
    );
    return sendSuccess(res, 200, broadcast, "Broadcast updated.");
  } catch (error) {
    return sendError(res, error.statusCode || 400, error.message || "Failed to update broadcast.", { fields: Object.keys(req.body || {}) });
  }
}

async function deleteBroadcastHandler(req, res) {
  try {
    const broadcast = await emailBroadcastService.deleteDraftBroadcast(req.params.id);
    return sendSuccess(res, 200, broadcast, "Broadcast draft deleted.");
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to delete broadcast.");
  }
}

async function searchRecipientsHandler(req, res) {
  try {
    const recipients = await emailBroadcastService.searchRecipients(req.query.query || "");
    return sendSuccess(res, 200, recipients, "Recipients loaded.");
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to search recipients.");
  }
}

async function resolveRecipientsHandler(req, res) {
  try {
    const recipients = await emailBroadcastService.resolveBroadcastRecipients(req.body || {});
    return sendSuccess(
      res,
      200,
      {
        count: recipients.length,
        recipients,
      },
      "Recipients resolved."
    );
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to resolve recipients.");
  }
}

async function previewBroadcastHandler(req, res) {
  try {
    const preview = await emailBroadcastService.previewBroadcast(
      Object.keys(req.body || {}).length ? req.body : req.params.id
    );
    return sendSuccess(res, 200, preview, "Broadcast preview generated.");
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to preview broadcast.");
  }
}

async function sendBroadcastHandler(req, res) {
  try {
    const result = await emailBroadcastService.sendBroadcast(req.params.id, req.body || {});
    const anySent = Number(result.sentCount || 0) > 0;
    const message = anySent
      ? result.failedCount > 0
        ? "Broadcast send completed with some failed recipients."
        : "Broadcast send completed."
      : "Broadcast send attempted, but no recipients were accepted by Resend.";

    return res.status(200).json({
      success: anySent,
      message,
      data: result,
    });
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to send broadcast.", {
      providerError: error.providerError || undefined,
    });
  }
}

async function sendBroadcastTestHandler(req, res) {
  try {
    const result = await emailBroadcastService.sendBroadcastTest(req.params.id, req.body || {});
    return sendSuccess(res, 200, result, "Broadcast test email accepted by Resend.");
  } catch (error) {
    return sendError(res, 400, error.message || "Failed to send broadcast test email.", {
      providerError: error.providerError || undefined,
    });
  }
}

async function getRecipientSourcesHandler(req, res) {
  try {
    const data = await emailBroadcastService.getRecipientSources();
    return sendSuccess(res, 200, data, "Recipient sources loaded.");
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load recipient sources.");
  }
}

module.exports = {
  createBroadcastHandler,
  deleteBroadcastHandler,
  getBroadcastHandler,
  getBroadcastRecipientsHandler,
  getRecipientSourcesHandler,
  listBroadcastsHandler,
  previewBroadcastHandler,
  resolveRecipientsHandler,
  searchRecipientsHandler,
  sendBroadcastHandler,
  sendBroadcastTestHandler,
  updateBroadcastHandler,
};

