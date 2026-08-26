const express = require("express");
const { optionalCustomer } = require("../middleware/authMiddleware");
const {
  initializePaystackPayment,
  verifyPaystackPayment,
} = require("../controllers/paystackController");

const router = express.Router();

router.post("/paystack/initialize", optionalCustomer, initializePaystackPayment);
router.post("/paystack/verify", optionalCustomer, verifyPaystackPayment);

module.exports = router;
