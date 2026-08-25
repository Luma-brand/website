const express = require("express");
const { protectCustomer } = require("../middleware/authMiddleware");
const {
  initializePaystackPayment,
  verifyPaystackPayment,
} = require("../controllers/paystackController");

const router = express.Router();

router.post("/paystack/initialize", protectCustomer, initializePaystackPayment);
router.post("/paystack/verify", protectCustomer, verifyPaystackPayment);

module.exports = router;
