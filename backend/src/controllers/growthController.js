const {
  createBackInStockRequest,
  getGrowthOverview,
  listBackInStockRequests,
  listAbandonedCarts,
  listAbandonedCheckouts,
  markAbandonedCartRecovered,
  markBackInStockWhatsappContacted,
  markCheckoutWhatsappContacted,
  markWhatsappContacted,
  recordAnalyticsEvent,
  recordProductView,
  saveAbandonedCart,
  saveCheckoutStart,
  sendDueAbandonedCartRecoveryEmails,
  sendDueCheckoutRecoveryEmails,
  sendRecoveryEmailForCart,
  sendRecoveryEmailForCheckout,
} = require("../services/growthService");
const { emitProductViewed } = require("../services/automationEventBridge");
const {
  createOrUpdateBrowseAbandonmentFromProductView,
  markBrowseAbandonmentConverted,
} = require("../services/browseAbandonmentService");

async function getGrowthOverviewHandler(req, res) {
  try {
    const data = await getGrowthOverview();

    return res.status(200).json({
      success: true,
      message: "Growth overview loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get growth overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load growth overview.",
    });
  }
}

async function recordAnalyticsEventHandler(req, res) {
  try {
    const data = await recordAnalyticsEvent(req.body || {});
    if (req.body?.eventType === "add_to_cart") {
      markBrowseAbandonmentConverted({
        ...req.body,
        productIds: [req.body.productId || req.body.product_id].filter(Boolean),
        source: "add_to_cart",
      }).catch((conversionError) => {
        console.error("Browse abandonment add-to-cart conversion error:", conversionError.message);
      });
    }

    return res.status(data.stored ? 201 : 202).json({
      success: true,
      message: data.message || "Analytics event processed.",
      data,
    });
  } catch (error) {
    console.error("Record analytics event error:", error);

    return res.status(202).json({
      success: true,
      message: "Analytics event was accepted but not stored because the database is temporarily unavailable.",
      data: { stored: false, status: "deferred", reason: error.message },
    });
  }
}

async function recordProductViewHandler(req, res) {
  try {
    const payload = req.body || {};
    const data = await recordProductView(payload);
    await createOrUpdateBrowseAbandonmentFromProductView(payload);
    await emitProductViewed({ ...payload, analyticsAlreadyRecorded: true });

    return res.status(data.stored ? 201 : 202).json({
      success: true,
      message: data.message || "Product view processed.",
      data,
    });
  } catch (error) {
    console.error("Record product view error:", error);

    return res.status(202).json({
      success: true,
      message: "Product view was accepted but not stored because the database is temporarily unavailable.",
      data: { stored: false, status: "deferred", reason: error.message },
    });
  }
}

async function saveAbandonedCartHandler(req, res) {
  try {
    const data = await saveAbandonedCart(req.body || {});

    return res.status(data.stored ? 201 : 202).json({
      success: true,
      message: data.message || "Abandoned cart processed.",
      data,
    });
  } catch (error) {
    console.error("Save abandoned cart error:", error);

    return res.status(202).json({
      success: true,
      message: "Abandoned cart event was accepted but not stored because the database is temporarily unavailable.",
      data: { stored: false, status: "deferred", reason: error.message },
    });
  }
}

async function saveCheckoutStartHandler(req, res) {
  try {
    const data = await saveCheckoutStart(req.body || {});

    return res.status(data.stored ? 201 : 202).json({
      success: true,
      message: data.message || "Checkout start processed.",
      data,
    });
  } catch (error) {
    console.error("Save checkout start error:", error);

    return res.status(202).json({
      success: true,
      message: "Checkout start event was accepted but not stored because the database is temporarily unavailable.",
      data: { stored: false, status: "deferred", reason: error.message },
    });
  }
}

async function listAbandonedCartsHandler(req, res) {
  try {
    const data = await listAbandonedCarts(req.query || {});

    return res.status(200).json({
      success: true,
      message: "Abandoned carts loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("List abandoned carts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load abandoned carts.",
    });
  }
}

async function sendAbandonedCartRecoveryEmailHandler(req, res) {
  try {
    const data = await sendRecoveryEmailForCart(req.params.cartId);
    const statusCode = data.sent ? 200 : data.status === "not_found" ? 404 : 400;

    return res.status(statusCode).json({
      success: data.sent,
      message: data.message || "Recovery email sent successfully.",
      data,
    });
  } catch (error) {
    console.error("Send abandoned cart recovery email error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send recovery email.",
    });
  }
}

async function sendDueAbandonedCartRecoveryEmailsHandler(req, res) {
  try {
    const data = await sendDueAbandonedCartRecoveryEmails(req.body || {});

    return res.status(200).json({
      success: true,
      message: "Due abandoned cart recovery emails processed.",
      data,
    });
  } catch (error) {
    console.error("Send due abandoned cart emails error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process due recovery emails.",
    });
  }
}

async function listAbandonedCheckoutsHandler(req, res) {
  try {
    const data = await listAbandonedCheckouts(req.query || {});

    return res.status(200).json({
      success: true,
      message: "Abandoned checkouts loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("List abandoned checkouts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load abandoned checkouts.",
    });
  }
}

async function sendCheckoutRecoveryEmailHandler(req, res) {
  try {
    const data = await sendRecoveryEmailForCheckout(req.params.checkoutId);
    const statusCode = data.sent
      ? 200
      : data.status === "not_found"
        ? 404
        : 400;

    return res.status(statusCode).json({
      success: data.sent,
      message: data.message || "Checkout recovery email sent successfully.",
      data,
    });
  } catch (error) {
    console.error("Send checkout recovery email error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send checkout recovery email.",
    });
  }
}

async function sendDueCheckoutRecoveryEmailsHandler(req, res) {
  try {
    const data = await sendDueCheckoutRecoveryEmails(req.body || {});

    return res.status(200).json({
      success: true,
      message: "Due checkout recovery emails processed.",
      data,
    });
  } catch (error) {
    console.error("Send due checkout recovery emails error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process due checkout emails.",
    });
  }
}

async function markCheckoutWhatsappContactedHandler(req, res) {
  try {
    const data = await markCheckoutWhatsappContacted(req.params.checkoutId);
    const statusCode = data.updated ? 200 : data.status === "not_found" ? 404 : 400;

    return res.status(statusCode).json({
      success: data.updated,
      message: data.message || "Checkout WhatsApp follow-up marked successfully.",
      data,
    });
  } catch (error) {
    console.error("Mark checkout WhatsApp contacted error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark checkout WhatsApp follow-up.",
    });
  }
}

async function listBackInStockRequestsHandler(req, res) {
  try {
    const data = await listBackInStockRequests(req.query || {});

    return res.status(200).json({
      success: true,
      message: "Back-in-stock requests loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("List back-in-stock requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load back-in-stock requests.",
    });
  }
}

async function markBackInStockWhatsappContactedHandler(req, res) {
  try {
    const data = await markBackInStockWhatsappContacted(req.params.requestId);
    const statusCode = data.updated ? 200 : 404;

    return res.status(statusCode).json({
      success: data.updated,
      message: data.message || "Back-in-stock WhatsApp follow-up marked.",
      data,
    });
  } catch (error) {
    console.error("Mark back-in-stock WhatsApp contacted error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark WhatsApp follow-up.",
    });
  }
}

async function markWhatsappContactedHandler(req, res) {
  try {
    const data = await markWhatsappContacted(req.params.cartId);
    const statusCode = data.updated ? 200 : 404;

    return res.status(statusCode).json({
      success: data.updated,
      message: data.message || "WhatsApp follow-up marked successfully.",
      data,
    });
  } catch (error) {
    console.error("Mark WhatsApp contacted error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark WhatsApp follow-up.",
    });
  }
}

async function markAbandonedCartRecoveredHandler(req, res) {
  try {
    const data = await markAbandonedCartRecovered(req.body || {});

    return res.status(200).json({
      success: true,
      message: "Abandoned cart recovery status processed.",
      data,
    });
  } catch (error) {
    console.error("Mark abandoned cart recovered error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark abandoned cart recovered.",
    });
  }
}

async function createBackInStockRequestHandler(req, res) {
  try {
    const data = await createBackInStockRequest(req.body || {});

    const statusCode =
      data.status === "invalid_request" || data.status === "invalid_product"
        ? 400
        : data.stored
          ? 201
          : 202;

    return res.status(statusCode).json({
      success: statusCode < 400,
      message: data.message || "Back-in-stock request processed.",
      data,
    });
  } catch (error) {
    console.error("Create back-in-stock request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process back-in-stock request.",
    });
  }
}

module.exports = {
  getGrowthOverviewHandler,
  listBackInStockRequestsHandler,
  listAbandonedCartsHandler,
  listAbandonedCheckoutsHandler,
  markAbandonedCartRecoveredHandler,
  markBackInStockWhatsappContactedHandler,
  markCheckoutWhatsappContactedHandler,
  markWhatsappContactedHandler,
  recordAnalyticsEventHandler,
  recordProductViewHandler,
  saveAbandonedCartHandler,
  saveCheckoutStartHandler,
  sendAbandonedCartRecoveryEmailHandler,
  sendCheckoutRecoveryEmailHandler,
  sendDueAbandonedCartRecoveryEmailsHandler,
  sendDueCheckoutRecoveryEmailsHandler,
  createBackInStockRequestHandler,
};

