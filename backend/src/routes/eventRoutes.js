const express = require("express");
const { recordAnalyticsEventHandler } = require("../controllers/growthController");

const router = express.Router();

router.post("/", recordAnalyticsEventHandler);
router.post("/track", recordAnalyticsEventHandler);

module.exports = router;