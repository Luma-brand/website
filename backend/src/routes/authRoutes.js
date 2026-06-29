const express = require("express");
const {
  registerAdmin,
  loginAdmin,
  registerCustomer,
  loginCustomer,
  loginCustomerWithGoogle,
  getCustomerMe,
  updateCustomerMe,
  forgotCustomerPassword,
  verifyCustomerResetCode,
  resetCustomerPassword,
  logoutCustomer,
  getMe,
} = require("../controllers/authController");
const {
  changeAdminPasswordHandler,
  getAdminSecurityOverview,
  listAdminSecurityEventsHandler,
  listAdminSessionsHandler,
  requestAdminPasswordChangeHandler,
  revokeAdminSessionHandler,
  revokeAllAdminSessionsHandler,
  revokeOtherAdminSessionsHandler,
  updateAdminProfileHandler,
  verifyAdminPasswordCodeHandler,
} = require("../controllers/adminSecurityController");

const { protectAdmin, protectCustomer } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/customer/register", registerCustomer);
router.post("/customer/login", loginCustomer);
router.post("/customer/google", loginCustomerWithGoogle);
router.get("/customer/me", protectCustomer, getCustomerMe);
router.patch("/customer/me", protectCustomer, updateCustomerMe);
router.post("/customer/complete-profile", protectCustomer, updateCustomerMe);
router.post("/customer/logout", protectCustomer, logoutCustomer);
router.post("/customer/forgot-password", forgotCustomerPassword);
router.post("/customer/verify-reset-code", verifyCustomerResetCode);
router.post("/customer/reset-password", resetCustomerPassword);

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/me", protectAdmin, getMe);
router.get("/admin/settings", protectAdmin, getAdminSecurityOverview);
router.patch("/admin/profile", protectAdmin, updateAdminProfileHandler);
router.get("/admin/sessions", protectAdmin, listAdminSessionsHandler);
router.post(
  "/admin/sessions/revoke-others",
  protectAdmin,
  revokeOtherAdminSessionsHandler
);
router.post(
  "/admin/sessions/revoke-all",
  protectAdmin,
  revokeAllAdminSessionsHandler
);
router.post(
  "/admin/sessions/:sessionId/revoke",
  protectAdmin,
  revokeAdminSessionHandler
);
router.post(
  "/admin/password/request-change",
  protectAdmin,
  requestAdminPasswordChangeHandler
);
router.post(
  "/admin/password/verify-code",
  protectAdmin,
  verifyAdminPasswordCodeHandler
);
router.post(
  "/admin/password/change",
  protectAdmin,
  changeAdminPasswordHandler
);
router.get(
  "/admin/security-events",
  protectAdmin,
  listAdminSecurityEventsHandler
);

module.exports = router;
