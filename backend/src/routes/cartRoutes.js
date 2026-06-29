const express = require("express");
const {
  checkoutStartedHandler,
  recoveredHandler,
  trackCartHandler,
} = require("../controllers/abandonedCartController");

const router = express.Router();

router.post("/sync", trackCartHandler);
router.post("/checkout-started", checkoutStartedHandler);
router.post("/mark-recovered", recoveredHandler);

module.exports = router;

