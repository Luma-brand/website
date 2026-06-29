const express = require("express");
const {
  cancelProductWaitlistHandler,
  getAdminProductWaitlistHandler,
  getAdminProductWaitlistsForProductHandler,
  getMyProductWaitlistsHandler,
  joinProductWaitlistHandler,
  listAdminProductWaitlistsHandler,
  sendProductWaitlistEmailHandler,
  sendProductWaitlistEmailsForProductHandler,
  updateProductWaitlistStatusHandler,
} = require("../controllers/productWaitlistController");
const { protectAdmin, protectCustomer } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/join", joinProductWaitlistHandler);
router.get("/me", protectCustomer, getMyProductWaitlistsHandler);

router.get("/admin", protectAdmin, listAdminProductWaitlistsHandler);
router.get(
  "/admin/product/:productId",
  protectAdmin,
  getAdminProductWaitlistsForProductHandler
);
router.get("/admin/:id", protectAdmin, getAdminProductWaitlistHandler);
router.post(
  "/admin/:id/send-email",
  protectAdmin,
  sendProductWaitlistEmailHandler
);
router.post(
  "/admin/product/:productId/send-emails",
  protectAdmin,
  sendProductWaitlistEmailsForProductHandler
);
router.patch("/admin/:id/cancel", protectAdmin, cancelProductWaitlistHandler);
router.patch(
  "/admin/:id/status",
  protectAdmin,
  updateProductWaitlistStatusHandler
);

module.exports = router;
