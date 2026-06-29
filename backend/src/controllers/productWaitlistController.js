const {
  buildWaitlistStats,
  cancelWaitlistEntry,
  getProductWaitlistById,
  getProductWaitlists,
  getProductWaitlistsForProduct,
  isMissingWaitlistTable,
  joinProductWaitlist,
  sendBackInStockEmail,
  sendBackInStockEmailsForProduct,
  updateWaitlistStatus,
} = require("../services/productWaitlistService");

function sendSuccess(res, data, message = "OK") {
  return res.status(200).json({ success: true, message, data });
}

function sendError(res, error, fallback = "Request failed") {
  if (isMissingWaitlistTable(error)) {
    return res.status(503).json({
      success: false,
      message:
        "Product waitlist tables are not available yet. Run the Phase 10 product waitlists migration in Neon.",
      code: "PRODUCT_WAITLIST_MIGRATION_REQUIRED",
    });
  }

  return res.status(error.statusCode || error.status || 500).json({
    success: false,
    message: error.message || fallback,
  });
}

async function joinProductWaitlistHandler(req, res) {
  try {
    const data = await joinProductWaitlist({
      ...req.body,
      customer: req.customer || null,
    });

    return res.status(data.alreadyExists ? 200 : 201).json({
      success: true,
      message: data.message,
      data,
    });
  } catch (error) {
    return sendError(res, error, "Failed to join product waitlist.");
  }
}

async function getMyProductWaitlistsHandler(req, res) {
  try {
    const data = await getProductWaitlists({
      search: req.customer.email,
      limit: 100,
    });

    return sendSuccess(res, data, "Product waitlists loaded.");
  } catch (error) {
    return sendError(res, error, "Failed to load product waitlists.");
  }
}

async function listAdminProductWaitlistsHandler(req, res) {
  try {
    const [entries, stats] = await Promise.all([
      getProductWaitlists(req.query),
      buildWaitlistStats(),
    ]);

    return sendSuccess(res, { entries, stats }, "Product waitlists loaded.");
  } catch (error) {
    return sendError(res, error, "Failed to load product waitlists.");
  }
}

async function getAdminProductWaitlistHandler(req, res) {
  try {
    const entry = await getProductWaitlistById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Product waitlist entry was not found.",
      });
    }

    return sendSuccess(res, entry, "Product waitlist entry loaded.");
  } catch (error) {
    return sendError(res, error, "Failed to load product waitlist entry.");
  }
}

async function getAdminProductWaitlistsForProductHandler(req, res) {
  try {
    const entries = await getProductWaitlistsForProduct(req.params.productId);
    return sendSuccess(res, entries, "Product waitlists loaded.");
  } catch (error) {
    return sendError(res, error, "Failed to load product waitlists for product.");
  }
}

async function sendProductWaitlistEmailHandler(req, res) {
  try {
    const data = await sendBackInStockEmail(req.params.id, {
      adminId: req.admin?.id || null,
      force: req.body?.force === true,
    });

    return sendSuccess(res, data, "Back-in-stock email sent.");
  } catch (error) {
    return sendError(res, error, "Failed to send back-in-stock email.");
  }
}

async function sendProductWaitlistEmailsForProductHandler(req, res) {
  try {
    const data = await sendBackInStockEmailsForProduct(req.params.productId, {
      adminId: req.admin?.id || null,
      force: req.body?.force === true,
    });

    return sendSuccess(res, data, "Back-in-stock email send finished.");
  } catch (error) {
    return sendError(res, error, "Failed to send back-in-stock emails.");
  }
}

async function cancelProductWaitlistHandler(req, res) {
  try {
    const data = await cancelWaitlistEntry(req.params.id);
    return sendSuccess(res, data, "Product waitlist entry cancelled.");
  } catch (error) {
    return sendError(res, error, "Failed to cancel product waitlist entry.");
  }
}

async function updateProductWaitlistStatusHandler(req, res) {
  try {
    const data = await updateWaitlistStatus(req.params.id, req.body.status);
    return sendSuccess(res, data, "Product waitlist status updated.");
  } catch (error) {
    return sendError(res, error, "Failed to update product waitlist status.");
  }
}

module.exports = {
  joinProductWaitlistHandler,
  getMyProductWaitlistsHandler,
  listAdminProductWaitlistsHandler,
  getAdminProductWaitlistHandler,
  getAdminProductWaitlistsForProductHandler,
  sendProductWaitlistEmailHandler,
  sendProductWaitlistEmailsForProductHandler,
  cancelProductWaitlistHandler,
  updateProductWaitlistStatusHandler,
};
