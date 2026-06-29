const express = require("express");
const {
  registerCustomer,
  loginCustomer,
  getCurrentCustomer,
} = require("../controllers/customerAuthController");
const { protectCustomer } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.get("/me", protectCustomer, getCurrentCustomer);

module.exports = router;