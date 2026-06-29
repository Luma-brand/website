const {
  createAdminPairing,
  deleteAdminPairing,
  getCartRecommendations,
  getProductRecommendations,
  listAdminPairings,
} = require("../services/productSalesService");

async function getProductRecommendationsHandler(req, res) {
  try {
    const { productId, limit } = req.query;

    const data = await getProductRecommendations(productId, {
      limit: Number(limit || 4),
    });

    return res.status(200).json({
      success: true,
      message: "Product recommendations loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get product recommendations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load product recommendations.",
    });
  }
}

async function getCartRecommendationsHandler(req, res) {
  try {
    const { productIds = "", limit } = req.query;

    const data = await getCartRecommendations({
      cartProductIds: productIds,
      limit: Number(limit || 4),
    });

    return res.status(200).json({
      success: true,
      message: "Cart recommendations loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get cart recommendations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load cart recommendations.",
    });
  }
}

async function listAdminPairingsHandler(req, res) {
  try {
    const data = await listAdminPairings();

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
      configured: data.length > 0,
    });
  } catch (error) {
    console.error("List product sales pairings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load product sales pairings.",
    });
  }
}

async function createAdminPairingHandler(req, res) {
  try {
    const data = await createAdminPairing(req.body || {});

    return res.status(201).json({
      success: true,
      message: "Product sales pairing saved successfully.",
      data,
    });
  } catch (error) {
    console.error("Create product sales pairing error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to save product sales pairing.",
    });
  }
}

async function deleteAdminPairingHandler(req, res) {
  try {
    const data = await deleteAdminPairing(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Product sales pairing not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product sales pairing deleted successfully.",
      data,
    });
  } catch (error) {
    console.error("Delete product sales pairing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product sales pairing.",
    });
  }
}

module.exports = {
  createAdminPairingHandler,
  deleteAdminPairingHandler,
  getCartRecommendationsHandler,
  getProductRecommendationsHandler,
  listAdminPairingsHandler,
};
