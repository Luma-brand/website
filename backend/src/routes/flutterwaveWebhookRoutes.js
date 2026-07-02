const express = require("express");
const { handleFlutterwaveWebhook } = require("../controllers/flutterwaveController");

const router = express.Router();
router.post("/", handleFlutterwaveWebhook);

module.exports = router;
