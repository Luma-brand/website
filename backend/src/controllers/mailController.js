const supportInboxService = require("../services/supportInboxService");

function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function fail(res, error, fallback) {
  return res.status(error.statusCode || error.status || 500).json({
    success: false,
    message: error.message || fallback,
  });
}

async function listTicketsHandler(req, res) {
  try {
    return ok(res, await supportInboxService.listTickets(req.query || {}));
  } catch (error) {
    return fail(res, error, "Failed to load support tickets.");
  }
}

async function listInboxesHandler(req, res) {
  try {
    return ok(res, supportInboxService.getAvailableInboxes());
  } catch (error) {
    return fail(res, error, "Failed to load mail inboxes.");
  }
}

async function getTicketHandler(req, res) {
  try {
    return ok(res, await supportInboxService.getTicketById(req.params.id));
  } catch (error) {
    return fail(res, error, "Failed to load support ticket.");
  }
}

async function replyToTicketHandler(req, res) {
  try {
    return ok(
      res,
      await supportInboxService.sendSupportReply(req.params.id, req.body || {}),
      201
    );
  } catch (error) {
    return fail(res, error, "Failed to send support reply.");
  }
}

async function updateTicketStatusHandler(req, res) {
  try {
    return ok(
      res,
      await supportInboxService.updateTicketStatus(req.params.id, req.body?.status)
    );
  } catch (error) {
    return fail(res, error, "Failed to update ticket status.");
  }
}

async function updateTicketPriorityHandler(req, res) {
  try {
    return ok(
      res,
      await supportInboxService.updateTicketPriority(req.params.id, req.body?.priority)
    );
  } catch (error) {
    return fail(res, error, "Failed to update ticket priority.");
  }
}

module.exports = {
  getTicketHandler,
  listInboxesHandler,
  listTicketsHandler,
  replyToTicketHandler,
  updateTicketPriorityHandler,
  updateTicketStatusHandler,
};
