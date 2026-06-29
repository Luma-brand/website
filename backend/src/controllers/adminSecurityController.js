const {
  changeAdminPassword,
  getAdminProfile,
  getTokenFromRequest,
  isMissingSecurityTablesError,
  listAdminSessions,
  listSecurityEvents,
  requestPasswordChange,
  revokeAllSessions,
  revokeOtherSessions,
  revokeSession,
  updateAdminProfile,
  verifyPasswordChangeCode,
} = require("../services/adminSecurityService");
const { getConfigStatus } = require("../services/settingsService");

const sendSuccess = (res, data, message = "Success") =>
  res.status(200).json({ success: true, message, data });

const sendError = (res, error, fallback = "Request failed") => {
  if (isMissingSecurityTablesError(error)) {
    return res.status(503).json({
      success: false,
      message:
        "Admin security tables are not available yet. Run the Phase 9 admin security migration in Neon, then redeploy or restart the backend.",
      code: "ADMIN_SECURITY_MIGRATION_REQUIRED",
    });
  }

  const status = error.statusCode || error.status || 500;
  return res.status(status).json({
    success: false,
    message: error.message || fallback,
  });
};

const getAdminSecurityOverview = async (req, res) => {
  try {
    const token = getTokenFromRequest(req);
    const [profile, sessions, events, configStatus] = await Promise.all([
      getAdminProfile(req.admin.id),
      listAdminSessions({ adminId: req.admin.id, token }),
      listSecurityEvents(req.admin.id),
      getConfigStatus(),
    ]);

    return sendSuccess(res, {
      profile,
      sessions,
      securityEvents: events,
      configStatus,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load admin security settings.");
  }
};

const listAdminSessionsHandler = async (req, res) => {
  try {
    const sessions = await listAdminSessions({
      adminId: req.admin.id,
      token: getTokenFromRequest(req),
    });

    return sendSuccess(res, sessions);
  } catch (error) {
    return sendError(res, error, "Failed to load admin sessions.");
  }
};

const revokeAdminSessionHandler = async (req, res) => {
  try {
    const revokedSession = await revokeSession({
      adminId: req.admin.id,
      sessionId: req.params.sessionId,
      req,
    });

    if (!revokedSession) {
      return res.status(404).json({
        success: false,
        message: "Session was not found.",
      });
    }

    return sendSuccess(res, revokedSession, "Session revoked.");
  } catch (error) {
    return sendError(res, error, "Failed to revoke session.");
  }
};

const revokeOtherAdminSessionsHandler = async (req, res) => {
  try {
    const revokedCount = await revokeOtherSessions({
      adminId: req.admin.id,
      token: getTokenFromRequest(req),
      req,
    });

    return sendSuccess(
      res,
      { revokedCount },
      "Other admin sessions were revoked."
    );
  } catch (error) {
    return sendError(res, error, "Failed to revoke other sessions.");
  }
};

const revokeAllAdminSessionsHandler = async (req, res) => {
  try {
    const revokedCount = await revokeAllSessions({
      adminId: req.admin.id,
      req,
    });

    return sendSuccess(res, { revokedCount }, "All admin sessions were revoked.");
  } catch (error) {
    return sendError(res, error, "Failed to revoke sessions.");
  }
};

const requestAdminPasswordChangeHandler = async (req, res) => {
  try {
    const result = await requestPasswordChange({
      adminId: req.admin.id,
      currentPassword: req.body.currentPassword,
      req,
    });

    return sendSuccess(
      res,
      result,
      "Verification code sent to the admin email address."
    );
  } catch (error) {
    return sendError(res, error, "Failed to send verification code.");
  }
};

const verifyAdminPasswordCodeHandler = async (req, res) => {
  try {
    const result = await verifyPasswordChangeCode({
      adminId: req.admin.id,
      code: req.body.code,
      req,
    });

    return sendSuccess(res, result, "Verification code confirmed.");
  } catch (error) {
    return sendError(res, error, "Failed to verify password code.");
  }
};

const changeAdminPasswordHandler = async (req, res) => {
  try {
    const result = await changeAdminPassword({
      adminId: req.admin.id,
      code: req.body.code,
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword,
      token: getTokenFromRequest(req),
      req,
    });

    return sendSuccess(res, result, "Admin password changed successfully.");
  } catch (error) {
    return sendError(res, error, "Failed to change password.");
  }
};

const listAdminSecurityEventsHandler = async (req, res) => {
  try {
    const events = await listSecurityEvents(req.admin.id);
    return sendSuccess(res, events);
  } catch (error) {
    return sendError(res, error, "Failed to load security activity.");
  }
};

const updateAdminProfileHandler = async (req, res) => {
  try {
    const profile = await updateAdminProfile({
      adminId: req.admin.id,
      fullName: req.body.fullName || req.body.full_name,
      req,
    });

    return sendSuccess(res, profile, "Admin profile updated.");
  } catch (error) {
    return sendError(res, error, "Failed to update admin profile.");
  }
};

module.exports = {
  getAdminSecurityOverview,
  listAdminSessionsHandler,
  revokeAdminSessionHandler,
  revokeOtherAdminSessionsHandler,
  revokeAllAdminSessionsHandler,
  requestAdminPasswordChangeHandler,
  verifyAdminPasswordCodeHandler,
  changeAdminPasswordHandler,
  listAdminSecurityEventsHandler,
  updateAdminProfileHandler,
};
