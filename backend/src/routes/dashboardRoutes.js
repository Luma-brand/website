const express = require("express");
const { getAdminDashboardStatsHandler } = require("../controllers/dashboardController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protectAdmin, getAdminDashboardStatsHandler);

module.exports = router;
