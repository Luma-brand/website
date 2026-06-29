const express = require("express");
const {
  createDiscountHandler,
  deleteDiscountHandler,
  disableDiscountHandler,
  enableDiscountHandler,
  getDiscountHandler,
  getDiscountSettingsHandler,
  listDiscountsHandler,
  updateDiscountHandler,
  updateFreeShippingThresholdHandler,
  validateDiscountHandler,
} = require("../controllers/discountController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/validate", validateDiscountHandler);
router.get("/", protectAdmin, listDiscountsHandler);
router.post("/", protectAdmin, createDiscountHandler);
router.get("/settings", protectAdmin, getDiscountSettingsHandler);
router.patch(
  "/settings/free-shipping",
  protectAdmin,
  updateFreeShippingThresholdHandler
);
router.get("/:discountId", protectAdmin, getDiscountHandler);
router.patch("/:discountId", protectAdmin, updateDiscountHandler);
router.patch("/:discountId/disable", protectAdmin, disableDiscountHandler);
router.patch("/:discountId/enable", protectAdmin, enableDiscountHandler);
router.delete("/:discountId", protectAdmin, deleteDiscountHandler);

module.exports = router;
