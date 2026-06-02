const express = require("express");
const {
  createBooking,
  getBookings,
} = require("../controllers/bookingController");

const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", createBooking);

// Protected admin route
router.get("/", protectAdmin, getBookings);

module.exports = router;