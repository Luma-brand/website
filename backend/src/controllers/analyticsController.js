const { getAdminAnalytics, getAdminAnalyticsEvents } = require("../services/analyticsService");

function sendSuccess(res, message, data) {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
}

function sendFailure(res, error, message) {
  console.error(`${message}:`, error);

  return res.status(500).json({
    success: false,
    message,
  });
}

async function getAdminAnalyticsHandler(req, res) {
  try {
    const data = await getAdminAnalytics(req.query || {});
    return sendSuccess(res, "Admin analytics loaded successfully.", data);
  } catch (error) {
    return sendFailure(res, error, "Failed to load admin analytics.");
  }
}

async function getAdminAnalyticsOverviewHandler(req, res) {
  try {
    const data = await getAdminAnalytics(req.query || {});
    return sendSuccess(res, "Analytics overview loaded successfully.", {
      summary: data.summary,
      cartAbandonment: data.cartAbandonment,
      filters: data.filters,
    });
  } catch (error) {
    return sendFailure(res, error, "Failed to load analytics overview.");
  }
}

async function getAdminAnalyticsConversionsHandler(req, res) {
  try {
    const data = await getAdminAnalytics(req.query || {});
    return sendSuccess(res, "Analytics conversions loaded successfully.", {
      summary: data.summary,
      conversionFunnel: data.conversionFunnel,
      bestSellingProducts: data.bestSellingProducts,
      cartAbandonment: data.cartAbandonment,
      filters: data.filters,
    });
  } catch (error) {
    return sendFailure(res, error, "Failed to load analytics conversions.");
  }
}

async function getAdminAnalyticsTrafficSourcesHandler(req, res) {
  try {
    const data = await getAdminAnalytics(req.query || {});
    return sendSuccess(res, "Analytics traffic sources loaded successfully.", {
      trafficSources: data.trafficSources,
      referralSources: data.referralSources,
      filters: data.filters,
    });
  } catch (error) {
    return sendFailure(res, error, "Failed to load analytics traffic sources.");
  }
}

async function getAdminAnalyticsEventsHandler(req, res) {
  try {
    const data = await getAdminAnalyticsEvents(req.query || {});
    return sendSuccess(res, "Analytics events loaded successfully.", data);
  } catch (error) {
    return sendFailure(res, error, "Failed to load analytics events.");
  }
}

module.exports = {
  getAdminAnalyticsHandler,
  getAdminAnalyticsOverviewHandler,
  getAdminAnalyticsConversionsHandler,
  getAdminAnalyticsTrafficSourcesHandler,
  getAdminAnalyticsEventsHandler,
};