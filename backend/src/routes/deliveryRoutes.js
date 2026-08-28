const express = require("express");
const {
  calculateDeliveryHandler,
  createPickupLocationHandler,
  createDeliveryZoneHandler,
  getDeliveryEngineOverviewHandler,
  getDeliveryOverviewHandler,
  getDeliveryQuoteHandler,
  getPickupLocationsHandler,
  getShippingStatesHandler,
  recalculateDeliveryRatesHandler,
  resetRouteOverrideHandler,
  setRouteOverrideHandler,
  updateDeliverySettingsHandler,
  updatePricingBandHandler,
  updatePickupLocationHandler,
  updateRegionRuleHandler,
  updateDeliveryZoneHandler,
} = require("../controllers/deliveryController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/quote", getDeliveryQuoteHandler);
router.post("/calculate", calculateDeliveryHandler);
router.get("/states", getShippingStatesHandler);
router.get("/pickup-locations", getPickupLocationsHandler);
router.get("/admin/pickup-locations", protectAdmin, getPickupLocationsHandler);
router.get("/overview", protectAdmin, getDeliveryEngineOverviewHandler);
router.get("/zones", protectAdmin, getDeliveryOverviewHandler);
router.post("/zones", protectAdmin, createDeliveryZoneHandler);
router.patch("/zones/:zoneId", protectAdmin, updateDeliveryZoneHandler);
router.patch("/settings", protectAdmin, updateDeliverySettingsHandler);
router.patch("/pricing-bands/:type/:bandId", protectAdmin, updatePricingBandHandler);
router.patch("/region-rules/:region", protectAdmin, updateRegionRuleHandler);
router.post("/recalculate", protectAdmin, recalculateDeliveryRatesHandler);
router.put("/routes/:routeId/override", protectAdmin, setRouteOverrideHandler);
router.delete("/routes/:routeId/override", protectAdmin, resetRouteOverrideHandler);
router.post("/pickup-locations", protectAdmin, createPickupLocationHandler);
router.patch("/pickup-locations/:locationId", protectAdmin, updatePickupLocationHandler);

module.exports = router;
