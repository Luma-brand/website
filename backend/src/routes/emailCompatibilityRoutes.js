const express = require("express");
const {
  createBroadcastHandler,
  previewBroadcastHandler,
} = require("../controllers/emailBroadcastController");
const {
  getEmailStatusHandler,
  sendBroadcastEmailHandler,
  sendBroadcastTestEmailHandler,
  sendEmailTestHandler,
} = require("../controllers/emailController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protectAdmin);
router.get("/status", getEmailStatusHandler);
router.post("/test", sendEmailTestHandler);
router.post("/broadcast/test", sendBroadcastTestEmailHandler);
router.post("/broadcast/send", sendBroadcastEmailHandler);

// Compatibility endpoints used by older admin UI flows.
router.post("/broadcast", createBroadcastHandler);
router.post("/preview", previewBroadcastHandler);

module.exports = router;
