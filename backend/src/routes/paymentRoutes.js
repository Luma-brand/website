const express = require("express");
const { protectCustomer } = require("../middleware/authMiddleware");
const {
  initializeFlutterwavePayment,
  verifyFlutterwavePayment,
} = require("../controllers/flutterwaveController");

const router = express.Router();

router.post("/flutterwave/initialize", protectCustomer, initializeFlutterwavePayment);
router.post("/flutterwave/verify", protectCustomer, verifyFlutterwavePayment);

module.exports = router;
