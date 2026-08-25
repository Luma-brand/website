const express = require("express");
const { handlePaystackWebhook } = require("../controllers/paystackController");

const router = express.Router();

router.post("/", handlePaystackWebhook);

module.exports = router;
