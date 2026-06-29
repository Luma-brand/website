const { getAdminDashboardStats } = require("../services/dashboardService");

async function getAdminDashboardStatsHandler(req, res) {
  try {
    const data = await getAdminDashboardStats();

    return res.status(200).json({
      success: true,
      message: "Admin dashboard stats loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get admin dashboard stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load admin dashboard stats.",
    });
  }
}

module.exports = {
  getAdminDashboardStatsHandler,
};
