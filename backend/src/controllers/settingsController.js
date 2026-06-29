const { getConfigStatus } = require("../services/settingsService");

async function getConfigStatusHandler(req, res) {
  try {
    return res.status(200).json({
      success: true,
      message: "Configuration status loaded successfully.",
      data: getConfigStatus(),
    });
  } catch (error) {
    console.error("Get config status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load configuration status.",
    });
  }
}

module.exports = {
  getConfigStatusHandler,
};
