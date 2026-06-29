const express = require("express");
const {
  clearCustomerCartHandler,
  getCustomerCartHandler,
  syncCustomerCartHandler,
} = require("../controllers/customerCartController");
const { protectCustomer } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me", protectCustomer, getCustomerCartHandler);
router.post("/sync", protectCustomer, syncCustomerCartHandler);
router.delete("/me", protectCustomer, clearCustomerCartHandler);
router.delete("/clear", protectCustomer, clearCustomerCartHandler);

module.exports = router;
