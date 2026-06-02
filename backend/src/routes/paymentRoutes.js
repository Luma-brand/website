const express = require("express");
const {
  initializePaystackPayment,
  verifyPaystackPayment,
  handlePaystackWebhook,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/paystack/initialize", initializePaystackPayment);
router.get("/paystack/verify/:reference", verifyPaystackPayment);
router.post("/paystack/webhook", handlePaystackWebhook);

module.exports = router;