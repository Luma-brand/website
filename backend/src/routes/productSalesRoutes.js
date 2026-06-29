const express = require("express");
const {
  createAdminPairingHandler,
  deleteAdminPairingHandler,
  getCartRecommendationsHandler,
  getProductRecommendationsHandler,
  listAdminPairingsHandler,
} = require("../controllers/productSalesController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/recommendations", getProductRecommendationsHandler);
router.get("/cart", getCartRecommendationsHandler);

router.get("/admin/pairings", protectAdmin, listAdminPairingsHandler);
router.post("/admin/pairings", protectAdmin, createAdminPairingHandler);
router.delete("/admin/pairings/:id", protectAdmin, deleteAdminPairingHandler);

module.exports = router;
