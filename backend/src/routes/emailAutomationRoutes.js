const express = require("express");
const {
  getOverviewHandler,
  getRecentCartSyncsDebugHandler,
  listAbandonedCartsHandler,
  listEmailLogsHandler,
  runAbandonedCartCheckHandler,
} = require("../controllers/emailAutomationController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protectAdmin);
router.get("/overview", getOverviewHandler);
router.get("/abandoned-carts", listAbandonedCartsHandler);
router.get("/email-logs", listEmailLogsHandler);
router.get("/debug/recent-cart-syncs", getRecentCartSyncsDebugHandler);
router.post("/run-abandoned-cart-check", runAbandonedCartCheckHandler);

module.exports = router;

