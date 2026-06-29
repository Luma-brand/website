const {
  getInventorySummary,
  getInventoryOverview,
  getInventoryProducts,
  getLowStockProducts,
  getOutOfStockProducts,
  getStockMovementHistory,
  bulkImportProductsFromCsv,
  bulkUpdateProductPrices,
  bulkUpdateInventory,
  listPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  getInventoryForecast,
  adjustProductStock,
  setProductStock,
} = require("../services/inventoryService");

function getCreatedBy(req) {
  return req.admin?.email || req.admin?.name || req.user?.email || "admin";
}

async function getInventorySummaryHandler(req, res) {
  try {
    const data = await getInventorySummary();

    return res.status(200).json({
      success: true,
      message: "Inventory summary loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get inventory summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load inventory summary.",
    });
  }
}

async function getInventoryOverviewHandler(req, res) {
  try {
    const data = await getInventoryOverview();

    return res.status(200).json({
      success: true,
      message: "Inventory overview loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get inventory overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load inventory overview.",
    });
  }
}

async function getLowStockProductsHandler(req, res) {
  try {
    const data = await getLowStockProducts();

    return res.status(200).json({
      success: true,
      message: "Low-stock products loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get low-stock products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load low-stock products.",
    });
  }
}

async function getOutOfStockProductsHandler(req, res) {
  try {
    const data = await getOutOfStockProducts();

    return res.status(200).json({
      success: true,
      message: "Out-of-stock products loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get out-of-stock products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load out-of-stock products.",
    });
  }
}

async function getInventoryProductsHandler(req, res) {
  try {
    const { search = "", status = "all" } = req.query;

    const data = await getInventoryProducts({
      search,
      status,
    });

    return res.status(200).json({
      success: true,
      message: "Inventory products loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get inventory products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load inventory products.",
    });
  }
}

async function getStockMovementHistoryHandler(req, res) {
  try {
    const { productId, limit } = req.query;

    const data = await getStockMovementHistory({
      productId,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "Stock movement history loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get stock movement history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load stock movement history.",
    });
  }
}

async function adjustProductStockHandler(req, res) {
  try {
    const { productId } = req.params;
    const { quantity, movementType, reason } = req.body;

    const createdBy =
      req.admin?.email ||
      req.admin?.name ||
      req.user?.email ||
      "admin";

    const data = await adjustProductStock({
      productId,
      quantity,
      movementType,
      reason,
      createdBy,
    });

    return res.status(200).json({
      success: true,
      message: "Product stock updated successfully.",
      data,
    });
  } catch (error) {
    console.error("Adjust product stock error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update product stock.",
    });
  }
}

async function setProductStockHandler(req, res) {
  try {
    const { productId } = req.params;
    const {
      stockQuantity,
      stock_quantity: stockQuantitySnake,
      stock,
      quantity,
      movementType,
      reason,
    } = req.body;

    const createdBy =
      req.admin?.email ||
      req.admin?.name ||
      req.user?.email ||
      "admin";

    if (
      stockQuantity !== undefined ||
      stockQuantitySnake !== undefined ||
      stock !== undefined
    ) {
      const data = await setProductStock(
        productId,
        stockQuantity ?? stockQuantitySnake ?? stock,
        {
          reason,
          createdBy,
        }
      );

      return res.status(200).json({
        success: true,
        message: "Product stock set successfully.",
        data,
      });
    }

    const data = await adjustProductStock({
      productId,
      quantity,
      movementType,
      reason,
      createdBy,
    });

    return res.status(200).json({
      success: true,
      message: "Product stock adjusted successfully.",
      data,
    });
  } catch (error) {
    console.error("Set product stock error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to set product stock.",
    });
  }
}

async function bulkProductCsvUploadHandler(req, res) {
  try {
    const { csvText } = req.body;
    const data = await bulkImportProductsFromCsv({
      csvText,
      createdBy: getCreatedBy(req),
    });

    return res.status(200).json({
      success: true,
      message: "Bulk product CSV upload processed.",
      data,
    });
  } catch (error) {
    console.error("Bulk product CSV upload error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to process product CSV.",
    });
  }
}

async function bulkPriceUpdateHandler(req, res) {
  try {
    const data = await bulkUpdateProductPrices({
      updates: req.body?.updates || [],
      createdBy: getCreatedBy(req),
    });

    return res.status(200).json({
      success: true,
      message: "Bulk price update processed.",
      data,
    });
  } catch (error) {
    console.error("Bulk price update error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to process bulk price update.",
    });
  }
}

async function bulkInventoryUpdateHandler(req, res) {
  try {
    const data = await bulkUpdateInventory({
      updates: req.body?.updates || [],
      createdBy: getCreatedBy(req),
    });

    return res.status(200).json({
      success: true,
      message: "Bulk inventory update processed.",
      data,
    });
  } catch (error) {
    console.error("Bulk inventory update error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to process bulk inventory update.",
    });
  }
}

async function listPurchaseOrdersHandler(req, res) {
  try {
    const data = await listPurchaseOrders();

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("List purchase orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load purchase orders.",
    });
  }
}

async function createPurchaseOrderHandler(req, res) {
  try {
    const data = await createPurchaseOrder({
      ...req.body,
      createdBy: getCreatedBy(req),
    });

    return res.status(201).json({
      success: true,
      message: "Purchase order created successfully.",
      data,
    });
  } catch (error) {
    console.error("Create purchase order error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create purchase order.",
    });
  }
}

async function receivePurchaseOrderHandler(req, res) {
  try {
    const data = await receivePurchaseOrder(req.params.purchaseOrderId, {
      createdBy: getCreatedBy(req),
    });

    return res.status(200).json({
      success: true,
      message: "Purchase order received successfully.",
      data,
    });
  } catch (error) {
    console.error("Receive purchase order error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to receive purchase order.",
    });
  }
}

async function getInventoryForecastHandler(req, res) {
  try {
    const data = await getInventoryForecast({
      days: req.query.days,
    });

    return res.status(200).json({
      success: true,
      message: "Inventory forecast loaded successfully.",
      data,
    });
  } catch (error) {
    console.error("Get inventory forecast error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load inventory forecast.",
    });
  }
}

module.exports = {
  getInventorySummaryHandler,
  getInventoryOverviewHandler,
  getInventoryProductsHandler,
  getLowStockProductsHandler,
  getOutOfStockProductsHandler,
  getStockMovementHistoryHandler,
  adjustProductStockHandler,
  setProductStockHandler,
  bulkProductCsvUploadHandler,
  bulkPriceUpdateHandler,
  bulkInventoryUpdateHandler,
  listPurchaseOrdersHandler,
  createPurchaseOrderHandler,
  receivePurchaseOrderHandler,
  getInventoryForecastHandler,
};
