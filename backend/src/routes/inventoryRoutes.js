const express = require("express");
const {
  getInventorySummaryHandler,
  getInventoryOverviewHandler,
  getInventoryProductsHandler,
  getLowStockProductsHandler,
  getOutOfStockProductsHandler,
  getStockMovementHistoryHandler,
  bulkProductCsvUploadHandler,
  bulkPriceUpdateHandler,
  bulkInventoryUpdateHandler,
  listPurchaseOrdersHandler,
  createPurchaseOrderHandler,
  receivePurchaseOrderHandler,
  getInventoryForecastHandler,
  adjustProductStockHandler,
  setProductStockHandler,
} = require("../controllers/inventoryController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/summary", protectAdmin, getInventorySummaryHandler);
router.get("/overview", protectAdmin, getInventoryOverviewHandler);
router.get("/products", protectAdmin, getInventoryProductsHandler);
router.get("/low-stock", protectAdmin, getLowStockProductsHandler);
router.get("/out-of-stock", protectAdmin, getOutOfStockProductsHandler);
router.get("/movements", protectAdmin, getStockMovementHistoryHandler);
router.get("/forecast", protectAdmin, getInventoryForecastHandler);
router.post("/bulk/products-csv", protectAdmin, bulkProductCsvUploadHandler);
router.patch("/bulk/prices", protectAdmin, bulkPriceUpdateHandler);
router.patch("/bulk/stock", protectAdmin, bulkInventoryUpdateHandler);
router.get("/purchase-orders", protectAdmin, listPurchaseOrdersHandler);
router.post("/purchase-orders", protectAdmin, createPurchaseOrderHandler);
router.post(
  "/purchase-orders/:purchaseOrderId/receive",
  protectAdmin,
  receivePurchaseOrderHandler
);
router.patch("/products/:productId/stock", protectAdmin, setProductStockHandler);
router.post("/products/:productId/adjust", protectAdmin, adjustProductStockHandler);

module.exports = router;
