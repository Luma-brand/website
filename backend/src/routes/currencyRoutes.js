const express = require("express");
const {
  getAdminCurrencyRatesHandler,
  getPublicCurrencyRatesHandler,
  syncCurrencyRatesHandler,
  updateCurrencyRateHandler,
} = require("../controllers/currencyController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/rates", getPublicCurrencyRatesHandler);
router.get("/admin/rates", protectAdmin, getAdminCurrencyRatesHandler);
router.patch("/admin/rates/:code", protectAdmin, updateCurrencyRateHandler);
router.post("/admin/sync", protectAdmin, syncCurrencyRatesHandler);

module.exports = router;
