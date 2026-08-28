const {
  createDeliveryZone,
  getDeliveryEngineOverview,
  getDeliveryOverview,
  getDeliveryQuote,
  getPickupLocations,
  getShippingStates,
  recalculateDeliveryRates,
  resetRouteOverride,
  savePickupLocation,
  setRouteOverride,
  updateDeliverySettings,
  updatePricingBand,
  updateDeliveryZone,
  updateRegionRule,
} = require("../services/deliveryService");

async function getDeliveryEngineOverviewHandler(req, res) {
  try {
    const data = await getDeliveryEngineOverview();
    return res.status(200).json({ success: true, message: "Delivery engine loaded.", data });
  } catch (error) {
    console.error("Get delivery engine overview error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to load delivery engine." });
  }
}

async function getShippingStatesHandler(req, res) {
  try {
    const data = await getShippingStates();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load delivery states." });
  }
}

async function getPickupLocationsHandler(req, res) {
  try {
    const data = await getPickupLocations({
      ...(req.query || {}),
      includeInactive: Boolean(req.admin),
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get pickup locations error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to load pickup locations." });
  }
}

async function getDeliveryOverviewHandler(req, res) {
  try {
    const data = await getDeliveryOverview();

    return res.status(200).json({
      success: true,
      message: "Delivery overview loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get delivery overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load delivery overview.",
    });
  }
}

async function getDeliveryQuoteHandler(req, res) {
  try {
    const { country, state, region, area } = req.query;
    const data = await getDeliveryQuote({ country, state, region, area });

    return res.status(200).json({
      success: true,
      message: "Delivery quote loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get delivery quote error:", error);

    return res.status(error.code === "NO_DELIVERY_ZONE" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to load delivery quote.",
    });
  }
}

async function calculateDeliveryHandler(req, res) {
  try {
    const data = await getDeliveryQuote(req.body || {});

    return res.status(200).json({
      success: true,
      message: "Delivery fee calculated successfully.",
      data: {
        deliveryFee: data.deliveryFee,
        zone: data.matchedZone,
        matchedZone: data.matchedZone,
        etaMinDays: data.etaMinDays,
        etaMaxDays: data.etaMaxDays,
        isPickup: data.isPickup,
        pickupLabel: data.pickupLabel,
        migrationApplied: data.migrationApplied,
        deliveryMethod: data.deliveryMethod,
        originState: data.originState,
        destinationState: data.destinationState,
        shipmentWeightGrams: data.shipmentWeightGrams,
        weightBand: data.weightBand,
        route: data.route,
        pricingMode: data.pricingMode,
        formulaVersion: data.formulaVersion,
        calculationBreakdown: data.calculationBreakdown,
        pickupLocation: data.pickupLocation,
      },
    });
  } catch (error) {
    console.error("Calculate delivery fee error:", error);

    return res.status(error.statusCode || (error.code === "NO_DELIVERY_ZONE" ? 404 : 500)).json({
      success: false,
      message: error.message || "Failed to calculate delivery fee.",
    });
  }
}

async function updateDeliverySettingsHandler(req, res) {
  try {
    const data = await updateDeliverySettings(req.body || {}, req.admin?.id || null);
    return res.status(200).json({ success: true, message: "Delivery settings updated and rates recalculated.", data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to update delivery settings." });
  }
}

async function recalculateDeliveryRatesHandler(req, res) {
  try {
    const data = await recalculateDeliveryRates({ adminId: req.admin?.id || null, reason: "admin_request" });
    return res.status(200).json({ success: true, message: "Delivery rates recalculated.", data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to recalculate delivery rates." });
  }
}

async function updatePricingBandHandler(req, res) {
  try {
    await updatePricingBand(req.params.type, req.params.bandId, req.body || {}, req.admin?.id || null);
    return res.status(200).json({ success: true, message: "Pricing band updated and rates recalculated." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to update pricing band." });
  }
}

async function updateRegionRuleHandler(req, res) {
  try {
    await updateRegionRule(req.params.region, req.body || {}, req.admin?.id || null);
    return res.status(200).json({ success: true, message: "Regional rule updated and rates recalculated." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to update regional rule." });
  }
}

async function setRouteOverrideHandler(req, res) {
  try {
    await setRouteOverride(req.params.routeId, req.body || {}, req.admin?.id || null);
    return res.status(200).json({ success: true, message: "Route override saved." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to save route override." });
  }
}

async function resetRouteOverrideHandler(req, res) {
  try {
    await resetRouteOverride(req.params.routeId, req.admin?.id || null);
    return res.status(200).json({ success: true, message: "Route returned to automatic pricing." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to reset route override." });
  }
}

async function createPickupLocationHandler(req, res) {
  try {
    const data = await savePickupLocation(req.body || {}, req.admin?.id || null);
    return res.status(201).json({ success: true, message: "Pickup location created.", data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to create pickup location." });
  }
}

async function updatePickupLocationHandler(req, res) {
  try {
    const data = await savePickupLocation(req.body || {}, req.admin?.id || null, req.params.locationId);
    return res.status(200).json({ success: true, message: "Pickup location updated.", data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to update pickup location." });
  }
}

async function createDeliveryZoneHandler(req, res) {
  try {
    const zone = await createDeliveryZone(req.body);

    return res.status(201).json({
      success: true,
      message: "Delivery zone created successfully.",
      data: zone,
    });
  } catch (error) {
    console.error("Create delivery zone error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create delivery zone.",
    });
  }
}

async function updateDeliveryZoneHandler(req, res) {
  try {
    const zone = await updateDeliveryZone(req.params.zoneId, req.body);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Delivery zone not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery zone updated successfully.",
      data: zone,
    });
  } catch (error) {
    console.error("Update delivery zone error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update delivery zone.",
    });
  }
}

module.exports = {
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
};
