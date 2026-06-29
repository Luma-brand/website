const express = require("express");
const {
  createBackInStockRequestHandler,
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
} = require("../controllers/growthController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/overview", protectAdmin, getGrowthOverviewHandler);
router.get("/abandoned-carts", protectAdmin, listAbandonedCartsHandler);
router.get("/abandoned-checkouts", protectAdmin, listAbandonedCheckoutsHandler);
router.get("/back-in-stock", protectAdmin, listBackInStockRequestsHandler);
router.post(
  "/abandoned-carts/send-due",
  protectAdmin,
  sendDueAbandonedCartRecoveryEmailsHandler
);
router.post(
  "/abandoned-checkouts/send-due",
  protectAdmin,
  sendDueCheckoutRecoveryEmailsHandler
);
router.post(
  "/abandoned-carts/:cartId/recovery-email",
  protectAdmin,
  sendAbandonedCartRecoveryEmailHandler
);
router.post(
  "/abandoned-checkouts/:checkoutId/recovery-email",
  protectAdmin,
  sendCheckoutRecoveryEmailHandler
);
router.patch(
  "/abandoned-carts/:cartId/whatsapp-contacted",
  protectAdmin,
  markWhatsappContactedHandler
);
router.patch(
  "/abandoned-checkouts/:checkoutId/whatsapp-contacted",
  protectAdmin,
  markCheckoutWhatsappContactedHandler
);
router.patch(
  "/back-in-stock/:requestId/whatsapp-contacted",
  protectAdmin,
  markBackInStockWhatsappContactedHandler
);

router.post("/events", recordAnalyticsEventHandler);
router.post("/product-views", recordProductViewHandler);
router.post("/abandoned-carts/recovered", markAbandonedCartRecoveredHandler);
router.post("/abandoned-carts", saveAbandonedCartHandler);
router.post("/checkout-starts", saveCheckoutStartHandler);
router.post("/back-in-stock", createBackInStockRequestHandler);

module.exports = router;
