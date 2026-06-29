const express = require("express");
const {
  checkoutStartedHandler,
  getAdminConfigHandler,
  listAdminCartsHandler,
  markWhatsAppContactedHandler,
  markWhatsAppOpenedHandler,
  recoveredHandler,
  runRecoveryHandler,
  sendRecoveryEmailHandler,
  trackCartHandler,
} = require("../controllers/abandonedCartController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/track", trackCartHandler);
router.post("/checkout-started", checkoutStartedHandler);
router.post("/recovered", recoveredHandler);

router.get("/admin", protectAdmin, listAdminCartsHandler);
router.get("/admin/config", protectAdmin, getAdminConfigHandler);
router.post("/admin/run-recovery", protectAdmin, runRecoveryHandler);
router.post("/admin/:id/send-email", protectAdmin, sendRecoveryEmailHandler);
router.post("/admin/:id/whatsapp-opened", protectAdmin, markWhatsAppOpenedHandler);
router.post("/admin/:id/whatsapp-contacted", protectAdmin, markWhatsAppContactedHandler);

module.exports = router;
