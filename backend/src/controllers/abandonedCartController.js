const abandonedCartService = require("../services/abandonedCartService");

function sendSuccess(res, statusCode, data) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}


function getRecoveryDelayMinutes() {
  const delay = Number(process.env.ABANDONED_CART_DELAY_MINUTES);
  return Number.isFinite(delay) && delay > 0 ? delay : 60;
}

async function getAdminConfigHandler(req, res) {
  return sendSuccess(res, 200, {
    delayMinutes: getRecoveryDelayMinutes(),
    emailConfigured: Boolean(process.env.RESEND_API_KEY && (process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL)),
    whatsappManualConfigured: Boolean(process.env.WHATSAPP_NUMBER),
  });
}
async function trackCartHandler(req, res) {
  try {
    const data = await abandonedCartService.trackCart(req.body || {});
    return sendSuccess(res, data.stored ? 201 : 202, data);
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to track abandoned cart.");
  }
}

async function checkoutStartedHandler(req, res) {
  try {
    const data = await abandonedCartService.markCheckoutStarted(req.body || {});
    return sendSuccess(res, data.stored ? 201 : 202, data);
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to mark checkout start.");
  }
}

async function recoveredHandler(req, res) {
  try {
    const data = await abandonedCartService.markRecovered(req.body || {});
    return sendSuccess(res, 200, data);
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to mark cart recovered.");
  }
}

async function listAdminCartsHandler(req, res) {
  try {
    const data = await abandonedCartService.getAdminAbandonedCarts(req.query || {});
    return sendSuccess(res, 200, data);
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load abandoned carts.");
  }
}

async function runRecoveryHandler(req, res) {
  try {
    const data = await abandonedCartService.runRecovery(req.body || {});
    return sendSuccess(res, 200, data);
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to run abandoned cart recovery.");
  }
}

async function sendRecoveryEmailHandler(req, res) {
  try {
    const data = await abandonedCartService.sendRecoveryEmail(req.params.id);
    const statusCode = data.sent === false && data.status === "not_found" ? 404 : 200;
    return sendSuccess(res, statusCode, data);
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to send recovery email.");
  }
}

async function markWhatsAppOpenedHandler(req, res) {
  try {
    const data = await abandonedCartService.markWhatsAppOpened(req.params.id);
    const statusCode = data.status === "not_found" ? 404 : 200;
    return sendSuccess(res, statusCode, data);
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to mark WhatsApp follow-up opened.");
  }
}

async function markWhatsAppContactedHandler(req, res) {
  try {
    const data = await abandonedCartService.markWhatsAppContacted(req.params.id);
    const statusCode = data.updated ? 200 : 404;
    return sendSuccess(res, statusCode, data);
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to mark WhatsApp follow-up contacted.");
  }
}

module.exports = {
  checkoutStartedHandler,
  getAdminConfigHandler,
  listAdminCartsHandler,
  markWhatsAppContactedHandler,
  markWhatsAppOpenedHandler,
  recoveredHandler,
  runRecoveryHandler,
  sendRecoveryEmailHandler,
  trackCartHandler,
};
