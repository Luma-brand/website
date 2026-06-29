const express = require("express");
const { getConfigStatusHandler } = require("../controllers/settingsController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/status", protectAdmin, getConfigStatusHandler);

module.exports = router;
