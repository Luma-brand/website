const express = require("express");
const service = require("../services/affiliateService");
const { protectCustomer, optionalCustomer, protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
const handle = (fn, status = 200) => async (req, res) => {
  try {
    const data = await fn(req);
    res.status(status).json({ success: true, data });
  } catch (error) {
    const duplicate = error.code === "23505";
    if (!error.statusCode && !duplicate) console.error("Affiliate request failed:", error.message);
    res.status(error.statusCode || (duplicate ? 409 : 500)).json({
      success: false,
      message: error.statusCode ? error.message : duplicate ? "This record or transfer reference already exists." : "The affiliate service could not complete your request. Please try again.",
      code: error.statusCode ? error.code : "AFFILIATE_REQUEST_FAILED",
    });
  }
};

router.get("/program", handle(() => service.publicSettings()));
router.post("/track", optionalCustomer, handle((req) => service.track(req.body, req.customer)));
router.get("/me", protectCustomer, handle((req) => service.dashboard(req.customer)));
router.post("/apply", protectCustomer, handle((req) => service.apply(req.customer, req.body), 201));
router.patch("/me/bank", protectCustomer, handle((req) => service.saveBank(req.customer, req.body)));
router.post("/me/payouts", protectCustomer, handle((req) => service.requestPayout(req.customer, req.body), 201));

router.use("/admin", protectAdmin);
router.get("/admin", handle((req) => service.adminDashboard(req.query)));
router.patch("/admin/settings", handle((req) => service.updateSettings(req.admin.id, req.body)));
router.patch("/admin/accounts/:id", handle((req) => service.updateAccount(req.admin.id, req.params.id, req.body)));
router.patch("/admin/payouts/:id", handle((req) => service.reviewPayout(req.admin.id, req.params.id, req.body)));

module.exports = router;
