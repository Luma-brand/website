const express = require("express");
const {
  createContactMessage,
  getContactMessages,
  markContactAsRead,
  deleteContactMessage,
} = require("../controllers/contactController");

const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", createContactMessage);
router.get("/", protectAdmin, getContactMessages);
router.patch("/:id/read", protectAdmin, markContactAsRead);
router.delete("/:id", protectAdmin, deleteContactMessage);

module.exports = router;