const express = require("express");
const {
  createCustomerSegmentHandler,
  createCustomerTagHandler,
  deleteCustomerSegmentHandler,
  exportCustomersCsvHandler,
  getCustomerAnalyticsOverviewHandler,
  getCustomerOrdersHandler,
  getCustomerProfileHandler,
  getCustomersHandler,
  listCustomerSegmentsHandler,
  listCustomerTagsHandler,
  updateCustomerSegmentHandler,
  updateCustomerTagsHandler,
} = require("../controllers/customerController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protectAdmin, getCustomersHandler);
router.get("/analytics/overview", protectAdmin, getCustomerAnalyticsOverviewHandler);
router.get("/tags", protectAdmin, listCustomerTagsHandler);
router.post("/tags", protectAdmin, createCustomerTagHandler);
router.get("/segments", protectAdmin, listCustomerSegmentsHandler);
router.post("/segments", protectAdmin, createCustomerSegmentHandler);
router.patch("/segments/:id", protectAdmin, updateCustomerSegmentHandler);
router.delete("/segments/:id", protectAdmin, deleteCustomerSegmentHandler);
router.get("/export", protectAdmin, exportCustomersCsvHandler);
router.get("/export.csv", protectAdmin, exportCustomersCsvHandler);
router.get("/:email/orders", protectAdmin, getCustomerOrdersHandler);
router.patch("/:id/tags", protectAdmin, updateCustomerTagsHandler);
router.get("/:id", protectAdmin, getCustomerProfileHandler);

module.exports = router;