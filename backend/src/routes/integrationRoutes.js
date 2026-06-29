const express = require("express");
const {
  getIntegrationStatusHandler,
} = require("../controllers/integrationController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/status", protectAdmin, getIntegrationStatusHandler);

module.exports = router;
