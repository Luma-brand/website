const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const {
  validateAdminSession,
} = require("../services/adminSecurityService");

const formatCustomer = (customer) => {
  if (!customer) return null;

  const fullName = customer.full_name || "";
  const profileCompleted = Boolean(
    customer.profile_completed ||
      (customer.phone &&
        customer.why_luma &&
        customer.first_time_luma &&
        customer.brow_goal &&
        customer.referral_source &&
        customer.onboarding_completed)
  );

  return {
    id: customer.id,
    full_name: fullName,
    name: fullName,
    email: customer.email,
    phone: customer.phone || "",
    phone_country_name: customer.phone_country_name || "",
    phone_country_iso2: customer.phone_country_iso2 || "",
    phone_country_code: customer.phone_country_code || "",
    phone_e164: customer.phone_e164 || customer.phone || "",
    whatsapp_number: customer.whatsapp_number || "",
    whatsapp_e164: customer.whatsapp_e164 || "",
    whatsapp_country_name: customer.whatsapp_country_name || "",
    whatsapp_country_iso2: customer.whatsapp_country_iso2 || "",
    whatsapp_country_code: customer.whatsapp_country_code || "",
    whatsapp_is_account_phone: customer.whatsapp_is_account_phone === true,
    auth_provider: customer.auth_provider || "email",
    avatar_url: customer.avatar_url || null,
    customer_type: customer.customer_type || "",
    luma_use_case: customer.luma_use_case || "",
    referral_source: customer.referral_source || "",
    referral_source_other: customer.referral_source_other || "",
    onboarding_completed: customer.onboarding_completed === true || profileCompleted,
    why_luma: customer.why_luma || "",
    first_time_luma: customer.first_time_luma || "",
    brow_goal: customer.brow_goal || "",
    onboarding_completed_at: customer.onboarding_completed_at || null,
    profile_completed: profileCompleted,
    marketing_opt_in: customer.marketing_opt_in !== false,
    created_at: customer.created_at,
    updated_at: customer.updated_at,
    last_login_at: customer.last_login_at,
    user_metadata: {
      name: fullName,
      full_name: fullName,
      phone: customer.phone || "",
      phone_e164: customer.phone_e164 || customer.phone || "",
    },
  };
};

const protectAdmin = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === "customer" || (decoded.role && decoded.role !== "admin")) {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    const result = await pool.query(
      `
      SELECT id, full_name, email, role, created_at
      FROM admins
      WHERE id = $1
      `,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Admin account no longer exists",
      });
    }

    const sessionStatus = await validateAdminSession({
      adminId: decoded.id,
      token,
      req,
    });

    if (
      sessionStatus.status === "revoked" ||
      sessionStatus.status === "expired"
    ) {
      return res.status(401).json({
        success: false,
        message: "This admin session has expired or was revoked.",
      });
    }

    req.admin = result.rows[0];
    req.adminSession = sessionStatus.session || null;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Invalid or expired token.",
    });
  }
};

const protectCustomer = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "customer") {
      return res.status(401).json({
        success: false,
        message: "Not authorized for customer account access.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        phone,
        phone_country_name,
        phone_country_iso2,
        phone_country_code,
        phone_e164,
        whatsapp_number,
        whatsapp_e164,
        whatsapp_country_name,
        whatsapp_country_iso2,
        whatsapp_country_code,
        whatsapp_is_account_phone,
        auth_provider,
        google_sub,
        avatar_url,
        customer_type,
        luma_use_case,
        referral_source,
        referral_source_other,
        onboarding_completed,
        why_luma,
        first_time_luma,
        brow_goal,
        onboarding_completed_at,
        profile_completed,
        marketing_opt_in,
        created_at,
        updated_at,
        last_login_at
      FROM customer_accounts
      WHERE id = $1
      `,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Customer account no longer exists",
      });
    }

    req.customer = formatCustomer(result.rows[0]);

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Invalid or expired token.",
    });
  }
};

module.exports = {
  protectAdmin,
  protectCustomer,
};
