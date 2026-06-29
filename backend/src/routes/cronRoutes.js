const express = require("express");
const {
  getCronHealthHandler,
  runAbandonedCartCheckHandler,
} = require("../controllers/emailAutomationController");
const {
  getAutomationWorkerHealth,
  processDueAutomationSteps,
} = require("../services/automationService");

const router = express.Router();

function requireCronSecret(req, res, next) {
  const configuredSecret = process.env.CRON_SECRET;
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!configuredSecret || token !== configuredSecret) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized cron request.",
    });
  }

  return next();
}

router.get("/abandoned-carts/health", getCronHealthHandler);
router.post("/abandoned-carts", requireCronSecret, runAbandonedCartCheckHandler);

router.get("/automation-flows/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Automation flow cron health loaded successfully.",
    data: getAutomationWorkerHealth(),
  });
});

router.post("/automation-flows", requireCronSecret, async (req, res) => {
  try {
    const data = await processDueAutomationSteps(req.body || {});
    return res.status(200).json({
      success: true,
      message: "Due automation flow steps processed.",
      data,
    });
  } catch (error) {
    console.error("Automation cron processing failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process due automation flow steps.",
    });
  }
});

module.exports = router;
