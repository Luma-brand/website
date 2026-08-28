const express = require("express");
const {
  subscribeNewsletter,
  getNewsletterSubscribers,
  deleteNewsletterSubscriber,
  updateNewsletterSubscriber,
} = require("../controllers/newsletterController");

const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", subscribeNewsletter);
router.get("/", protectAdmin, getNewsletterSubscribers);
router.patch("/:id", protectAdmin, updateNewsletterSubscriber);
router.delete("/:id", protectAdmin, deleteNewsletterSubscriber);

module.exports = router;
