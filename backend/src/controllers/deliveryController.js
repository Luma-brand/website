const {
  createDeliveryZone,
  getDeliveryOverview,
  getDeliveryQuote,
  updateDeliveryZone,
} = require("../services/deliveryService");

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
    const { address, country, state, region, area } = req.body || {};
    const data = await getDeliveryQuote({ country, state, region, area, address });

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
      },
    });
  } catch (error) {
    console.error("Calculate delivery fee error:", error);

    return res.status(error.code === "NO_DELIVERY_ZONE" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to calculate delivery fee.",
    });
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
  createDeliveryZoneHandler,
  getDeliveryOverviewHandler,
  getDeliveryQuoteHandler,
  updateDeliveryZoneHandler,
};
