const {
  addSuppression,
  createAutomationFlow,
  createEmailTemplate,
  deleteAutomationFlow,
  getAutomationCronPlan,
  getAutomationFlow,
  getAutomationStatus,
  getAutomationWorkerHealth,
  listAutomationFlows,
  listAutomationLogs,
  listEmailTemplates,
  listSuppressionList,
  processDueAutomationSteps,
  setAutomationFlowStatus,
  triggerAutomationFlow,
  updateAutomationFlow,
  updateEmailTemplate,
} = require("../services/automationService");
const {
  listAutomationTriggerEvents,
} = require("../services/automationEventBridge");
const {
  getAdminBrowseAbandonments,
  getBrowseAbandonmentOverview,
  sendBrowseAbandonmentEmail,
  sendDueBrowseAbandonmentEmails,
} = require("../services/browseAbandonmentService");

function sendSuccess(res, data, message = "Automation request completed.") {
  return res.status(200).json({ success: true, message, data });
}

function sendError(res, error, fallback = "Automation request failed.") {
  console.error(fallback, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallback,
  });
}

async function getAutomationStatusHandler(req, res) {
  try {
    return sendSuccess(res, await getAutomationStatus(), "Automation status loaded successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to load automation status.");
  }
}

async function triggerAutomationFlowHandler(req, res) {
  try {
    const data = await triggerAutomationFlow(req.params.flow, req.body || {});
    const statusCode = data.status === "not_configured" ? 503 : data.status === "not_found" || data.status === "missing_email" ? 400 : 200;
    return res.status(statusCode).json({
      success: data.sent !== false && data.success !== false,
      message: "Automation trigger processed.",
      data,
    });
  } catch (error) {
    return sendError(res, error, "Failed to trigger automation flow.");
  }
}

async function getAutomationCronPlanHandler(req, res) {
  try {
    return sendSuccess(res, getAutomationCronPlan(), "Automation cron plan loaded successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to load automation cron plan.");
  }
}

async function listAutomationFlowsHandler(req, res) {
  try {
    return sendSuccess(res, await listAutomationFlows(), "Automation flows loaded successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to load automation flows.");
  }
}

async function getAutomationFlowHandler(req, res) {
  try {
    const data = await getAutomationFlow(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Automation flow not found." });
    return sendSuccess(res, data, "Automation flow loaded successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to load automation flow.");
  }
}

async function createAutomationFlowHandler(req, res) {
  try {
    const data = await createAutomationFlow(req.body || {});
    return res.status(201).json({ success: true, message: "Automation flow created successfully.", data });
  } catch (error) {
    return sendError(res, error, "Failed to create automation flow.");
  }
}

async function updateAutomationFlowHandler(req, res) {
  try {
    const data = await updateAutomationFlow(req.params.id, req.body || {});
    if (!data) return res.status(404).json({ success: false, message: "Automation flow not found." });
    return sendSuccess(res, data, "Automation flow updated successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to update automation flow.");
  }
}

async function deleteAutomationFlowHandler(req, res) {
  try {
    const data = await deleteAutomationFlow(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Automation flow not found." });
    return sendSuccess(res, data, "Automation flow deleted successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to delete automation flow.");
  }
}

async function enableAutomationFlowHandler(req, res) {
  try {
    const data = await setAutomationFlowStatus(req.params.id, "active");
    if (!data) return res.status(404).json({ success: false, message: "Automation flow not found." });
    return sendSuccess(res, data, "Automation flow enabled successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to enable automation flow.");
  }
}

async function disableAutomationFlowHandler(req, res) {
  try {
    const data = await setAutomationFlowStatus(req.params.id, "paused");
    if (!data) return res.status(404).json({ success: false, message: "Automation flow not found." });
    return sendSuccess(res, data, "Automation flow disabled successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to disable automation flow.");
  }
}

async function listAutomationLogsHandler(req, res) {
  try {
    return sendSuccess(res, await listAutomationLogs(req.query || {}), "Automation logs loaded successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to load automation logs.");
  }
}

async function listAutomationTriggerEventsHandler(req, res) {
  try {
    return sendSuccess(
      res,
      await listAutomationTriggerEvents(req.query || {}),
      "Automation trigger events loaded successfully."
    );
  } catch (error) {
    return sendError(res, error, "Failed to load automation trigger events.");
  }
}

async function listBrowseAbandonmentsHandler(req, res) {
  try {
    return sendSuccess(
      res,
      await getAdminBrowseAbandonments(req.query || {}),
      "Browse abandonments loaded successfully."
    );
  } catch (error) {
    return sendError(res, error, "Failed to load browse abandonments.");
  }
}

async function getBrowseAbandonmentOverviewHandler(req, res) {
  try {
    return sendSuccess(
      res,
      await getBrowseAbandonmentOverview(),
      "Browse abandonment overview loaded successfully."
    );
  } catch (error) {
    return sendError(res, error, "Failed to load browse abandonment overview.");
  }
}

async function runBrowseAbandonmentHandler(req, res) {
  try {
    return sendSuccess(
      res,
      await sendDueBrowseAbandonmentEmails(req.body || {}),
      "Browse abandonment check completed."
    );
  } catch (error) {
    return sendError(res, error, "Failed to run browse abandonment check.");
  }
}

async function sendBrowseAbandonmentEmailHandler(req, res) {
  try {
    const data = await sendBrowseAbandonmentEmail(req.params.id, { manual: true });
    const statusCode = data.sent
      ? 200
      : data.status === "not_found"
        ? 404
        : 400;

    return res.status(statusCode).json({
      success: data.sent,
      message: data.message || "Browse abandonment email sent successfully.",
      data,
    });
  } catch (error) {
    return sendError(res, error, "Failed to send browse abandonment email.");
  }
}

async function runDueAutomationsHandler(req, res) {
  try {
    return sendSuccess(res, await processDueAutomationSteps(req.body || {}), "Due automation steps processed.");
  } catch (error) {
    return sendError(res, error, "Failed to process due automation steps.");
  }
}

async function getAutomationHealthHandler(req, res) {
  try {
    return sendSuccess(res, getAutomationWorkerHealth(), "Automation worker health loaded successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to load automation worker health.");
  }
}

async function listEmailTemplatesHandler(req, res) {
  try {
    return sendSuccess(res, await listEmailTemplates(), "Automation templates loaded successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to load automation templates.");
  }
}

async function createEmailTemplateHandler(req, res) {
  try {
    const data = await createEmailTemplate(req.body || {});
    return res.status(201).json({ success: true, message: "Automation template created successfully.", data });
  } catch (error) {
    return sendError(res, error, "Failed to create automation template.");
  }
}

async function updateEmailTemplateHandler(req, res) {
  try {
    const data = await updateEmailTemplate(req.params.id, req.body || {});
    if (!data) return res.status(404).json({ success: false, message: "Automation template not found." });
    return sendSuccess(res, data, "Automation template updated successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to update automation template.");
  }
}

async function listSuppressionListHandler(req, res) {
  try {
    return sendSuccess(res, await listSuppressionList(req.query || {}), "Suppression list loaded successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to load suppression list.");
  }
}

async function addSuppressionHandler(req, res) {
  try {
    const data = await addSuppression(req.body || {});
    return res.status(201).json({ success: true, message: "Email suppression saved successfully.", data });
  } catch (error) {
    return sendError(res, error, "Failed to save email suppression.");
  }
}

module.exports = {
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
};

