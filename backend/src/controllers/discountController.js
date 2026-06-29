const {
  calculateOrderPricing,
  createDiscountCode,
  deleteDiscountCode,
  disableDiscountCode,
  enableDiscountCode,
  getFreeShippingThreshold,
  getDiscountCodeById,
  getDiscountCodes,
  setFreeShippingThreshold,
  updateDiscountCode,
  validateDiscountCode,
} = require("../services/discountService");
const { getDeliveryQuote } = require("../services/deliveryService");

function sendError(res, error, fallbackMessage) {
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

async function validateDiscountHandler(req, res) {
  try {
    const { items, code, discountCode, subtotal, country, state, city } = req.body;
    const requestedCode = discountCode || code;

    if ((!Array.isArray(items) || items.length === 0) && subtotal === undefined) {
      return res.status(400).json({
        success: false,
        message: "Cart items or subtotal are required before applying a discount.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      const validation = await validateDiscountCode({
        code: requestedCode,
        subtotal,
      });
      const finalSubtotal = Math.max(
        0,
        Number(subtotal || 0) - validation.discountAmount
      );

      return res.status(200).json({
        success: true,
        message: "Discount applied successfully.",
        data: {
          subtotalAmount: Number(subtotal || 0),
          discountCode: validation.discountCode,
          discountAmount: validation.discountAmount,
          finalSubtotal,
          totalAmount: finalSubtotal,
        },
      });
    }

    const deliveryState = state || city;
    const deliveryQuote = await getDeliveryQuote({
      country,
      state: deliveryState,
      region: city,
    });
    const pricing = await calculateOrderPricing({
      items,
      deliveryFee: deliveryQuote.deliveryFee,
      discountCode: requestedCode,
    });

    if (!pricing.isValid) {
      return res.status(409).json({
        success: false,
        message: "Some products in your cart are no longer available.",
        issues: pricing.issues,
      });
    }

    return res.status(200).json({
      success: true,
      message: pricing.discountCode
        ? "Discount applied successfully."
        : "Checkout pricing calculated.",
      data: {
        subtotalAmount: pricing.subtotalAmount,
        deliveryFee: pricing.deliveryFee,
        discountCode: pricing.discountCode,
        discountAmount: pricing.discountAmount,
        totalAmount: pricing.totalAmount,
        freeShipping: pricing.freeShipping,
        freeShippingThreshold: pricing.freeShippingThreshold,
      },
    });
  } catch (error) {
    return sendError(res, error, "Failed to validate discount code.");
  }
}

async function listDiscountsHandler(req, res) {
  try {
    const discounts = await getDiscountCodes();

    return res.status(200).json({
      success: true,
      data: discounts,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load discount codes.");
  }
}

async function getDiscountHandler(req, res) {
  try {
    const discount = await getDiscountCodeById(req.params.discountId);

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Discount code not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: discount,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load discount code.");
  }
}

async function createDiscountHandler(req, res) {
  try {
    const discount = await createDiscountCode(req.body);

    return res.status(201).json({
      success: true,
      message: "Discount code created.",
      data: discount,
    });
  } catch (error) {
    return sendError(res, error, "Failed to create discount code.");
  }
}

async function updateDiscountHandler(req, res) {
  try {
    const discount = await updateDiscountCode(req.params.discountId, req.body);

    return res.status(200).json({
      success: true,
      message: "Discount code updated.",
      data: discount,
    });
  } catch (error) {
    return sendError(res, error, "Failed to update discount code.");
  }
}

async function disableDiscountHandler(req, res) {
  try {
    const discount = await disableDiscountCode(req.params.discountId);

    return res.status(200).json({
      success: true,
      message: "Discount code disabled.",
      data: discount,
    });
  } catch (error) {
    return sendError(res, error, "Failed to disable discount code.");
  }
}

async function enableDiscountHandler(req, res) {
  try {
    const discount = await enableDiscountCode(req.params.discountId);

    return res.status(200).json({
      success: true,
      message: "Discount code enabled.",
      data: discount,
    });
  } catch (error) {
    return sendError(res, error, "Failed to enable discount code.");
  }
}

async function deleteDiscountHandler(req, res) {
  try {
    const discount = await deleteDiscountCode(req.params.discountId);

    return res.status(200).json({
      success: true,
      message:
        Number(discount?.usedCount || 0) > 0
          ? "Discount code has order history and was disabled instead."
          : "Discount code deleted.",
      data: discount,
    });
  } catch (error) {
    return sendError(res, error, "Failed to delete discount code.");
  }
}

async function getDiscountSettingsHandler(req, res) {
  try {
    const freeShippingThreshold = await getFreeShippingThreshold();

    return res.status(200).json({
      success: true,
      data: {
        freeShippingThreshold,
      },
    });
  } catch (error) {
    return sendError(res, error, "Failed to load discount settings.");
  }
}

async function updateFreeShippingThresholdHandler(req, res) {
  try {
    const freeShippingThreshold = await setFreeShippingThreshold(
      req.body.freeShippingThreshold
    );

    return res.status(200).json({
      success: true,
      message: "Free shipping threshold updated.",
      data: {
        freeShippingThreshold,
      },
    });
  } catch (error) {
    return sendError(res, error, "Failed to update free shipping threshold.");
  }
}

module.exports = {
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
};
