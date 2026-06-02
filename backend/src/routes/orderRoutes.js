const express = require("express");
const {
  createOrder,
  getOrders,
  getSingleOrder,
  getPublicOrder,
  updateOrderStatus,
  deleteOrder,
} = require("../controllers/orderController");

const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", createOrder);

// Public order success page route
router.get("/public/:id", getPublicOrder);

// Admin routes
router.get("/", protectAdmin, getOrders);
router.get("/:id", protectAdmin, getSingleOrder);
router.patch("/:id", protectAdmin, updateOrderStatus);
router.delete("/:id", protectAdmin, deleteOrder);

module.exports = router;