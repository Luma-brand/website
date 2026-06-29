const express = require("express");
const {
  calculateDeliveryHandler,
  createDeliveryZoneHandler,
  getDeliveryOverviewHandler,
  getDeliveryQuoteHandler,
  updateDeliveryZoneHandler,
} = require("../controllers/deliveryController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/quote", getDeliveryQuoteHandler);
router.post("/calculate", calculateDeliveryHandler);
router.get("/overview", protectAdmin, getDeliveryOverviewHandler);
router.get("/zones", protectAdmin, getDeliveryOverviewHandler);
router.post("/zones", protectAdmin, createDeliveryZoneHandler);
router.patch("/zones/:zoneId", protectAdmin, updateDeliveryZoneHandler);

module.exports = router;
