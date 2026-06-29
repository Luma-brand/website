const express = require("express");
const {
  addSuppressionHandler,
  createAutomationFlowHandler,
  createEmailTemplateHandler,
  deleteAutomationFlowHandler,
  disableAutomationFlowHandler,
  enableAutomationFlowHandler,
  getAutomationCronPlanHandler,
  getAutomationFlowHandler,
  getAutomationHealthHandler,
  getAutomationStatusHandler,
  getBrowseAbandonmentOverviewHandler,
  listAutomationFlowsHandler,
  listAutomationLogsHandler,
  listBrowseAbandonmentsHandler,
  listAutomationTriggerEventsHandler,
  listEmailTemplatesHandler,
  listSuppressionListHandler,
  runDueAutomationsHandler,
  runBrowseAbandonmentHandler,
  sendBrowseAbandonmentEmailHandler,
  triggerAutomationFlowHandler,
  updateAutomationFlowHandler,
  updateEmailTemplateHandler,
} = require("../controllers/automationController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/status", protectAdmin, getAutomationStatusHandler);
router.get("/cron-plan", protectAdmin, getAutomationCronPlanHandler);
router.get("/health", protectAdmin, getAutomationHealthHandler);
router.post("/trigger/:flow", protectAdmin, triggerAutomationFlowHandler);

router.get("/logs", protectAdmin, listAutomationLogsHandler);
router.get("/trigger-events", protectAdmin, listAutomationTriggerEventsHandler);
router.get("/browse-abandonments", protectAdmin, listBrowseAbandonmentsHandler);
router.get("/browse-abandonments/overview", protectAdmin, getBrowseAbandonmentOverviewHandler);
router.post("/browse-abandonments/run", protectAdmin, runBrowseAbandonmentHandler);
router.post("/browse-abandonments/:id/send-email", protectAdmin, sendBrowseAbandonmentEmailHandler);
router.post("/run-due", protectAdmin, runDueAutomationsHandler);

router.get("/templates", protectAdmin, listEmailTemplatesHandler);
router.post("/templates", protectAdmin, createEmailTemplateHandler);
router.patch("/templates/:id", protectAdmin, updateEmailTemplateHandler);

router.get("/suppression-list", protectAdmin, listSuppressionListHandler);
router.post("/suppression-list", protectAdmin, addSuppressionHandler);

router.get("/", protectAdmin, listAutomationFlowsHandler);
router.post("/", protectAdmin, createAutomationFlowHandler);
router.get("/:id", protectAdmin, getAutomationFlowHandler);
router.patch("/:id", protectAdmin, updateAutomationFlowHandler);
router.delete("/:id", protectAdmin, deleteAutomationFlowHandler);
router.patch("/:id/enable", protectAdmin, enableAutomationFlowHandler);
router.patch("/:id/disable", protectAdmin, disableAutomationFlowHandler);

module.exports = router;

