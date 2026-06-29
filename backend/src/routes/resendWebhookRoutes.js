const express = require("express");
const { resendWebhookHandler } = require("../controllers/emailAutomationController");

const router = express.Router();

router.post("/", resendWebhookHandler);

module.exports = router;
