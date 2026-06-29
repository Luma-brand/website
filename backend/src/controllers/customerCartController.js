const customerCartService = require("../services/customerCartService");

async function getCustomerCartHandler(req, res) {
  try {
    const data = await customerCartService.getCustomerCart(req.customer.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get customer cart error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to load saved cart.",
    });
  }
}

async function syncCustomerCartHandler(req, res) {
  try {
    const data = await customerCartService.syncCustomerCart(
      req.customer.id,
      req.body?.cartItems || req.body?.cart_items || []
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Sync customer cart error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to sync cart to your account.",
    });
  }
}

async function clearCustomerCartHandler(req, res) {
  try {
    const data = await customerCartService.clearCustomerCart(req.customer.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Clear customer cart error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to clear saved cart.",
    });
  }
}

module.exports = {
  clearCustomerCartHandler,
  getCustomerCartHandler,
  syncCustomerCartHandler,
};
