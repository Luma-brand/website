const express = require("express");
const {
  getTicketHandler,
  listInboxesHandler,
  listTicketsHandler,
  replyToTicketHandler,
  updateTicketPriorityHandler,
  updateTicketStatusHandler,
} = require("../controllers/mailController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protectAdmin);

router.get("/inboxes", listInboxesHandler);
router.get("/tickets", listTicketsHandler);
router.get("/tickets/:id", getTicketHandler);
router.post("/tickets/:id/reply", replyToTicketHandler);
router.patch("/tickets/:id/status", updateTicketStatusHandler);
router.patch("/tickets/:id/priority", updateTicketPriorityHandler);

module.exports = router;
