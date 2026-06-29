const emailAutomationService = require("../services/emailAutomationService");

function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function fail(res, error, fallback) {
  return res.status(error.statusCode || error.status || 500).json({
    success: false,
    message: error.message || fallback,
  });
}

async function getOverviewHandler(req, res) {
  try {
    return ok(res, await emailAutomationService.getAutomationOverview());
  } catch (error) {
    return fail(res, error, "Failed to load email automation overview.");
  }
}

async function runAbandonedCartCheckHandler(req, res) {
  try {
    return ok(res, await emailAutomationService.runAbandonedCartCheck(req.body || {}));
  } catch (error) {
    return fail(res, error, "Failed to run abandoned cart automation.");
  }
}

async function listAbandonedCartsHandler(req, res) {
  try {
    return ok(res, await emailAutomationService.listAbandonedCarts(req.query || {}));
  } catch (error) {
    return fail(res, error, "Failed to load abandoned carts.");
  }
}

async function listEmailLogsHandler(req, res) {
  try {
    return ok(res, await emailAutomationService.listEmailLogs(req.query || {}));
  } catch (error) {
    return fail(res, error, "Failed to load email logs.");
  }
}


async function getRecentCartSyncsDebugHandler(req, res) {
  try {
    return ok(res, await emailAutomationService.getRecentCartSyncsDebug());
  } catch (error) {
    return fail(res, error, "Failed to load recent cart sync debug records.");
  }
}
async function getCronHealthHandler(req, res) {
  return ok(res, emailAutomationService.getHealth());
}

async function resendWebhookHandler(req, res) {
  try {
    const event = await emailAutomationService.recordEmailEvent(req.body || {}, { headers: req.headers, rawBody: req.rawBody });
    return ok(res, { received: true, event });
  } catch (error) {
    return fail(res, error, "Failed to record Resend webhook event.");
  }
}

module.exports = {
  getCronHealthHandler,
  getOverviewHandler,
  getRecentCartSyncsDebugHandler,
  listAbandonedCartsHandler,
  listEmailLogsHandler,
  resendWebhookHandler,
  runAbandonedCartCheckHandler,
};


