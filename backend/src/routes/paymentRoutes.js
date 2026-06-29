const express = require("express");
const {
  initializePaystackPayment,
  verifyPaystackPayment,
  handlePaystackWebhook,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/initialize", initializePaystackPayment);
router.get("/verify/:reference", verifyPaystackPayment);
router.post("/verify", (req, res, next) => {
  req.params.reference = req.body?.reference || req.query?.reference;
  return verifyPaystackPayment(req, res, next);
});
router.post("/paystack/initialize", initializePaystackPayment);
router.get("/paystack/verify/:reference", verifyPaystackPayment);
router.post("/paystack/webhook", handlePaystackWebhook);

module.exports = router;