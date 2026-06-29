const express = require("express");
const {
  listAdminCartsHandler,
  sendRecoveryEmailHandler,
  markWhatsAppContactedHandler,
  markWhatsAppOpenedHandler,
} = require("../controllers/abandonedCartController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protectAdmin);
router.get("/", listAdminCartsHandler);
router.post("/:id/send-email", sendRecoveryEmailHandler);
router.post("/:id/whatsapp-opened", markWhatsAppOpenedHandler);
router.post("/:id/whatsapp-contacted", markWhatsAppContactedHandler);

module.exports = router;
