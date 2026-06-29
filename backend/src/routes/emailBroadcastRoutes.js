const express = require("express");
const {
  createBroadcastHandler,
  deleteBroadcastHandler,
  getBroadcastHandler,
  getBroadcastRecipientsHandler,
  getRecipientSourcesHandler,
  listBroadcastsHandler,
  previewBroadcastHandler,
  resolveRecipientsHandler,
  searchRecipientsHandler,
  sendBroadcastHandler,
  sendBroadcastTestHandler,
  updateBroadcastHandler,
} = require("../controllers/emailBroadcastController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protectAdmin);

router.get("/", listBroadcastsHandler);
router.post("/", createBroadcastHandler);
router.get("/recipients/sources", getRecipientSourcesHandler);
router.get("/recipients/search", searchRecipientsHandler);
router.post("/recipients/resolve", resolveRecipientsHandler);
router.get("/:id", getBroadcastHandler);
router.patch("/:id", updateBroadcastHandler);
router.delete("/:id", deleteBroadcastHandler);
router.get("/:id/recipients", getBroadcastRecipientsHandler);
router.post("/:id/preview", previewBroadcastHandler);
router.post("/:id/test-send", sendBroadcastTestHandler);
router.post("/:id/send", sendBroadcastHandler);

module.exports = router;
