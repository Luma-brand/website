const express = require("express");
const {
  getAdminAnalyticsHandler,
  getAdminAnalyticsOverviewHandler,
  getAdminAnalyticsConversionsHandler,
  getAdminAnalyticsTrafficSourcesHandler,
  getAdminAnalyticsEventsHandler,
} = require("../controllers/analyticsController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protectAdmin, getAdminAnalyticsHandler);
router.get("/overview", protectAdmin, getAdminAnalyticsOverviewHandler);
router.get("/events", protectAdmin, getAdminAnalyticsEventsHandler);
router.get("/conversions", protectAdmin, getAdminAnalyticsConversionsHandler);
router.get("/traffic-sources", protectAdmin, getAdminAnalyticsTrafficSourcesHandler);

module.exports = router;