const { getIntegrationStatus } = require("../services/integrationService");

async function getIntegrationStatusHandler(req, res) {
  try {
    const data = getIntegrationStatus();

    return res.status(200).json({
      success: true,
      message: "Integration status loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get integration status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load integration status.",
    });
  }
}

module.exports = {
  getIntegrationStatusHandler,
};
