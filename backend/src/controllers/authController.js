const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const {
  sendCustomerPasswordResetEmail,
  sendWelcomeEmail,
} = require("../services/emailService");
const { enrollCustomerInFlow } = require("../services/automationService");
const {
  logSecurityEvent,
  recordAdminLogin,
} = require("../services/adminSecurityService");

const RESET_CODE_TTL_MINUTES = 15;

const createToken = (admin) => {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

const createCustomerToken = (customer) => {
  return jwt.sign(
    {
      id: customer.id,
      email: customer.email,
      role: "customer",
      type: "customer",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

let customerAuthTableReady = false;

const ensureCustomerAuthTable = async () => {
  if (customerAuthTableReady) return;

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS customer_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(160) UNIQUE NOT NULL,
      phone VARCHAR(40),
      password_hash TEXT,
            role VARCHAR(30) DEFAULT 'customer',
      auth_provider VARCHAR(30) DEFAULT 'email',
      google_sub VARCHAR(160),
      avatar_url TEXT,
      customer_type VARCHAR(40),
      luma_use_case TEXT,
      referral_source VARCHAR(160),
      phone_country_name TEXT,
      phone_country_iso2 VARCHAR(5),
      phone_country_code VARCHAR(10),
      phone_e164 VARCHAR(40),
      whatsapp_number VARCHAR(40),
      whatsapp_e164 VARCHAR(40),
      whatsapp_country_name TEXT,
      whatsapp_country_iso2 VARCHAR(5),
      whatsapp_country_code VARCHAR(10),
      whatsapp_is_account_phone BOOLEAN DEFAULT FALSE,
      onboarding_completed BOOLEAN DEFAULT FALSE,
      why_luma TEXT,
      first_time_luma VARCHAR(40),
      brow_goal TEXT,
      referral_source_other TEXT,
      onboarding_completed_at TIMESTAMP,
      profile_completed BOOLEAN DEFAULT FALSE,
      marketing_opt_in BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP
    );

    ALTER TABLE customer_accounts
      ADD COLUMN IF NOT EXISTS password_hash TEXT;

    ALTER TABLE customer_accounts
      ALTER COLUMN password_hash DROP NOT NULL;

    ALTER TABLE customer_accounts
      ADD COLUMN IF NOT EXISTS phone VARCHAR(40),
            ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'customer',
      ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(30) DEFAULT 'email',
      ADD COLUMN IF NOT EXISTS google_sub VARCHAR(160),
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS customer_type VARCHAR(40),
      ADD COLUMN IF NOT EXISTS luma_use_case TEXT,
      ADD COLUMN IF NOT EXISTS referral_source VARCHAR(160),
      ADD COLUMN IF NOT EXISTS phone_country_name TEXT,
      ADD COLUMN IF NOT EXISTS phone_country_iso2 VARCHAR(5),
      ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS phone_e164 VARCHAR(40),
      ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(40),
      ADD COLUMN IF NOT EXISTS whatsapp_e164 VARCHAR(40),
      ADD COLUMN IF NOT EXISTS whatsapp_country_name TEXT,
      ADD COLUMN IF NOT EXISTS whatsapp_country_iso2 VARCHAR(5),
      ADD COLUMN IF NOT EXISTS whatsapp_country_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS whatsapp_is_account_phone BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS why_luma TEXT,
      ADD COLUMN IF NOT EXISTS first_time_luma VARCHAR(40),
      ADD COLUMN IF NOT EXISTS brow_goal TEXT,
      ADD COLUMN IF NOT EXISTS referral_source_other TEXT,
      ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    CREATE TABLE IF NOT EXISTS customer_password_reset_codes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      customer_id UUID REFERENCES customer_accounts(id) ON DELETE CASCADE,
      email VARCHAR(160) NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_customer_accounts_email_lower
      ON customer_accounts (LOWER(email));

    CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_google_sub
      ON customer_accounts (google_sub)
      WHERE google_sub IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_customer_password_reset_codes_email
      ON customer_password_reset_codes (LOWER(email), created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_customer_password_reset_codes_customer
      ON customer_password_reset_codes (customer_id, used_at, expires_at);
  `);

  customerAuthTableReady = true;
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizeText = (value) => String(value || "").trim();

const normalizeCustomerType = (value) => {
  const normalized = normalizeText(value).toLowerCase().replace(/\s+/g, "_");
  const allowed = ["vendor", "retailer", "regular_customer"];
  return allowed.includes(normalized) ? normalized : "";
};

const isProfileComplete = (customer) => {
  return Boolean(
    normalizeText(customer?.full_name) &&
      normalizeText(customer?.email) &&
      normalizeText(customer?.phone) &&
      normalizeText(customer?.why_luma) &&
      normalizeText(customer?.first_time_luma) &&
      normalizeText(customer?.brow_goal) &&
      normalizeText(customer?.referral_source) &&
      (customer?.onboarding_completed === true ||
        customer?.onboarding_completed === "true" ||
        customer?.onboarding_completed_at)
  );
};

const formatCustomer = (customer) => {
  if (!customer) return null;

  const fullName = customer.full_name || customer.name || "";
  const profileCompleted =
    customer.profile_completed === true || isProfileComplete(customer);

  return {
    id: customer.id,
    full_name: fullName,
    name: fullName,
    email: customer.email,
            role: customer.role || "customer",
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

const sendWelcomeEmailWithoutBlocking = async (customer) => {
  try {
    const result = await sendWelcomeEmail(customer);

    if (!result?.success) {
      console.warn(
        "Welcome email was not sent:",
        result?.reason || result?.error || result?.message || "Unknown email error"
      );
    }
  } catch (error) {
    console.error("Welcome email error:", error.message);
  }
};


const enrollCustomerAutomationWithoutBlocking = async (triggerEvent, customer, metadata = {}) => {
  try {
    const result = await enrollCustomerInFlow(triggerEvent, {
      customer,
      customerId: customer?.id,
      email: customer?.email,
      name: customer?.full_name || customer?.name,
      phone: customer?.phone,
      ...metadata,
    });

    if (result?.status && result.status !== "unsupported_trigger" && result.status !== "missing_email") {
      console.log("Customer automation enrollment:", result.status, result.enrolled || 0);
    }
  } catch (error) {
    console.error("Customer automation enrollment error:", error.message);
  }
};
const getCustomerReturnFields = `
  id,
  full_name,
  email,
  role,
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
`;

const hashResetCode = (email, code) => {
  return crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${code}`)
    .digest("hex");
};

const createResetCode = () => {
  return String(crypto.randomInt(100000, 1000000));
};

const registerAdmin = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existingAdmin = await pool.query(
      "SELECT id FROM admins WHERE email = $1",
      [email]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Admin with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO admins (full_name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email, role, created_at
      `,
      [fullName, email, passwordHash, "admin"]
    );

    const admin = result.rows[0];
    const token = createToken(admin);

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      token,
      admin,
    });
  } catch (error) {
    console.error("Register admin error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while registering admin",
    });
  }
};

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await pool.query(
      `
      SELECT id, full_name, email, password_hash, role, created_at
      FROM admins
      WHERE LOWER(email) = LOWER($1)
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      await logSecurityEvent({
        eventType: "login_failed",
        req,
        metadata: { email: normalizedEmail, reason: "admin_not_found" },
      }).catch(() => {});

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const admin = result.rows[0];
    const isPasswordCorrect = await bcrypt.compare(password, admin.password_hash);

    if (!isPasswordCorrect) {
      await logSecurityEvent({
        adminId: admin.id,
        eventType: "login_failed",
        req,
        metadata: { email: normalizedEmail, reason: "invalid_password" },
      }).catch(() => {});

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const safeAdmin = {
      id: admin.id,
      full_name: admin.full_name,
      email: admin.email,
      role: admin.role,
      created_at: admin.created_at,
    };

    const token = createToken(safeAdmin);

    await recordAdminLogin({ admin: safeAdmin, token, req }).catch((error) => {
      console.error("Admin session tracking error:", error.message);
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      admin: safeAdmin,
    });
  } catch (error) {
    console.error("Login admin error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while logging in",
    });
  }
};

const registerCustomer = async (req, res) => {
  try {
    await ensureCustomerAuthTable();

    const {
      fullName,
      name,
      email,
phone,
      phoneCountryName,
      phone_country_name,
      phoneCountryIso2,
      phone_country_iso2,
      phoneCountryCode,
      phone_country_code,
      phoneE164,
      phone_e164,
      password,
      confirmPassword,
      marketingOptIn = true,
    } = req.body;

    const resolvedName = normalizeText(fullName || name);
    const normalizedEmail = normalizeEmail(email);
    const resolvedPhone = normalizeText(phone);
    const resolvedPhoneCountryName = normalizeText(phoneCountryName || phone_country_name);
    const resolvedPhoneCountryIso2 = normalizeText(phoneCountryIso2 || phone_country_iso2).toUpperCase();
    const resolvedPhoneCountryCode = normalizeText(phoneCountryCode || phone_country_code);
    const resolvedPhoneE164 = normalizeText(phoneE164 || phone_e164 || phone);

    if (!resolvedName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required.",
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const existingCustomer = await pool.query(
      "SELECT id FROM customer_accounts WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail]
    );

    if (existingCustomer.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A customer account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
        INSERT INTO customer_accounts (
          full_name,
          email,
phone,
          phone_country_name,
          phone_country_iso2,
          phone_country_code,
          phone_e164,
          password_hash,
          auth_provider,
          customer_type,
          profile_completed,
          onboarding_completed,
          marketing_opt_in
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'email', 'regular_customer', FALSE, FALSE, $9)
        RETURNING
          ${getCustomerReturnFields}
      `,
      [
        resolvedName,
        normalizedEmail,
        resolvedPhone,
        resolvedPhoneCountryName,
        resolvedPhoneCountryIso2,
        resolvedPhoneCountryCode,
        resolvedPhoneE164,
        passwordHash,
        marketingOptIn !== false,
      ]
    );

    const customer = formatCustomer(result.rows[0]);
    const token = createCustomerToken(customer);

    sendWelcomeEmailWithoutBlocking(customer);
    enrollCustomerAutomationWithoutBlocking("customer_signup", customer, { source: "customer_register" });

    return res.status(201).json({
      success: true,
      message: "Customer account created successfully.",
      token,
      customer,
      user: customer,
    });
  } catch (error) {
    console.error("Register customer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while registering customer.",
    });
  }
};

const loginCustomer = async (req, res) => {
  try {
    await ensureCustomerAuthTable();

    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const result = await pool.query(
      `
        SELECT
          ${getCustomerReturnFields},
          password_hash
        FROM customer_accounts
        WHERE LOWER(email) = LOWER($1)
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const customerRecord = result.rows[0];

    if (!customerRecord.password_hash) {
      return res.status(401).json({
        success: false,
        message: "Set a password with Forgot password, then sign in again.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      customerRecord.password_hash
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const updatedCustomer = await pool.query(
      `
        UPDATE customer_accounts
        SET
          last_login_at = CURRENT_TIMESTAMP,
          profile_completed = $2
        WHERE id = $1
        RETURNING
          ${getCustomerReturnFields}
      `,
      [customerRecord.id, isProfileComplete(customerRecord)]
    );

    const customer = formatCustomer(updatedCustomer.rows[0]);
    const token = createCustomerToken(customer);

    return res.status(200).json({
      success: true,
      message: "Customer login successful.",
      token,
      customer,
      user: customer,
    });
  } catch (error) {
    console.error("Login customer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while logging in customer.",
    });
  }
};

const getCustomerMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    customer: req.customer,
    user: req.customer,
  });
};

const updateCustomerMe = async (req, res) => {
  try {
    const {
      fullName,
      name,
      phone,
      phoneCountryName,
      phone_country_name,
      phoneCountryIso2,
      phone_country_iso2,
      phoneCountryCode,
      phone_country_code,
      phoneE164,
      phone_e164,
      whatsappNumber,
      whatsapp_number,
      whatsappE164,
      whatsapp_e164,
      whatsappCountryName,
      whatsapp_country_name,
      whatsappCountryIso2,
      whatsapp_country_iso2,
      whatsappCountryCode,
      whatsapp_country_code,
      whatsappIsAccountPhone,
      whatsapp_is_account_phone,
      customerType,
      customer_type,
      whyLuma,
      why_luma,
      firstTimeLuma,
      first_time_luma,
      browGoal,
      brow_goal,
      referralSource,
      referral_source,
      referralSourceOther,
      referral_source_other,
      marketingOptIn,
    } = req.body;

    const nextName =
      fullName !== undefined || name !== undefined
        ? normalizeText(fullName || name)
        : req.customer.full_name;
    const nextPhone =
      phone !== undefined ? normalizeText(phone) : req.customer.phone || "";
    const nextPhoneCountryName =
      phoneCountryName !== undefined || phone_country_name !== undefined
        ? normalizeText(phoneCountryName || phone_country_name)
        : req.customer.phone_country_name || "";
    const nextPhoneCountryIso2 =
      phoneCountryIso2 !== undefined || phone_country_iso2 !== undefined
        ? normalizeText(phoneCountryIso2 || phone_country_iso2).toUpperCase()
        : req.customer.phone_country_iso2 || "";
    const nextPhoneCountryCode =
      phoneCountryCode !== undefined || phone_country_code !== undefined
        ? normalizeText(phoneCountryCode || phone_country_code)
        : req.customer.phone_country_code || "";
    const nextPhoneE164 =
      phoneE164 !== undefined || phone_e164 !== undefined
        ? normalizeText(phoneE164 || phone_e164)
        : req.customer.phone_e164 || nextPhone;
    const useAccountPhone =
      whatsappIsAccountPhone !== undefined || whatsapp_is_account_phone !== undefined
        ? Boolean(whatsappIsAccountPhone ?? whatsapp_is_account_phone)
        : req.customer.whatsapp_is_account_phone === true;
    const nextWhatsappNumber = useAccountPhone
      ? nextPhone
      : normalizeText(whatsappNumber || whatsapp_number || req.customer.whatsapp_number || "");
    const nextWhatsappE164 = useAccountPhone
      ? nextPhoneE164
      : normalizeText(whatsappE164 || whatsapp_e164 || req.customer.whatsapp_e164 || nextWhatsappNumber);
    const nextWhatsappCountryName = useAccountPhone
      ? nextPhoneCountryName
      : normalizeText(
          whatsappCountryName ||
            whatsapp_country_name ||
            req.customer.whatsapp_country_name ||
            ""
        );
    const nextWhatsappCountryIso2 = useAccountPhone
      ? nextPhoneCountryIso2
      : normalizeText(
          whatsappCountryIso2 ||
            whatsapp_country_iso2 ||
            req.customer.whatsapp_country_iso2 ||
            ""
        ).toUpperCase();
    const nextWhatsappCountryCode = useAccountPhone
      ? nextPhoneCountryCode
      : normalizeText(
          whatsappCountryCode ||
            whatsapp_country_code ||
            req.customer.whatsapp_country_code ||
            ""
        );
    const nextCustomerType =
      customerType !== undefined || customer_type !== undefined
        ? normalizeCustomerType(customerType || customer_type)
        : req.customer.customer_type || "";
    const nextWhyLuma =
      whyLuma !== undefined || why_luma !== undefined
        ? normalizeText(whyLuma || why_luma)
        : req.customer.why_luma || "";
    const nextFirstTimeLuma =
      firstTimeLuma !== undefined || first_time_luma !== undefined
        ? normalizeText(firstTimeLuma || first_time_luma)
        : req.customer.first_time_luma || "";
    const nextBrowGoal =
      browGoal !== undefined || brow_goal !== undefined
        ? normalizeText(browGoal || brow_goal)
        : req.customer.brow_goal || "";
    const nextReferralSource =
      referralSource !== undefined || referral_source !== undefined
        ? normalizeText(referralSource || referral_source)
        : req.customer.referral_source || "";
    const nextReferralSourceOther =
      referralSourceOther !== undefined || referral_source_other !== undefined
        ? normalizeText(referralSourceOther || referral_source_other)
        : req.customer.referral_source_other || "";

    if (!nextName) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    if (!nextPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    if (!nextWhyLuma || !nextFirstTimeLuma || !nextBrowGoal || !nextReferralSource) {
      return res.status(400).json({
        success: false,
        message: "Please complete the onboarding questions.",
      });
    }

    const nextMarketingOptIn =
      marketingOptIn === undefined
        ? req.customer.marketing_opt_in !== false
        : marketingOptIn !== false;

    const result = await pool.query(
      `
        UPDATE customer_accounts
        SET
          full_name = $1,
          phone = $2,
          phone_country_name = $3,
          phone_country_iso2 = $4,
          phone_country_code = $5,
          phone_e164 = $6,
          customer_type = $7,
          why_luma = $8,
          first_time_luma = $9,
          brow_goal = $10,
          referral_source = $11,
          referral_source_other = $12,
          whatsapp_number = $13,
          whatsapp_e164 = $14,
          whatsapp_country_name = $15,
          whatsapp_country_iso2 = $16,
          whatsapp_country_code = $17,
          whatsapp_is_account_phone = $18,
          onboarding_completed = TRUE,
          onboarding_completed_at = COALESCE(onboarding_completed_at, CURRENT_TIMESTAMP),
          profile_completed = TRUE,
          marketing_opt_in = $19,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $20
        RETURNING
          ${getCustomerReturnFields}
      `,
      [
        nextName,
        nextPhone,
        nextPhoneCountryName,
        nextPhoneCountryIso2,
        nextPhoneCountryCode,
        nextPhoneE164,
        nextCustomerType,
        nextWhyLuma,
        nextFirstTimeLuma,
        nextBrowGoal,
        nextReferralSource,
        nextReferralSourceOther,
        nextWhatsappNumber,
        nextWhatsappE164,
        nextWhatsappCountryName,
        nextWhatsappCountryIso2,
        nextWhatsappCountryCode,
        useAccountPhone,
        nextMarketingOptIn,
        req.customer.id,
      ]
    );

    const customer = formatCustomer(result.rows[0]);

    return res.status(200).json({
      success: true,
      message: "Customer profile updated successfully.",
      customer,
      user: customer,
    });
  } catch (error) {
    console.error("Update customer profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while updating customer profile.",
    });
  }
};

const forgotCustomerPassword = async (req, res) => {
  try {
    await ensureCustomerAuthTable();

    if (!process.env.RESEND_API_KEY || !(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL)) {
      return res.status(503).json({
        success: false,
        message: "Password reset email is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
      });
    }

    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const customerResult = await pool.query(
      `
        SELECT id, full_name, email
        FROM customer_accounts
        WHERE LOWER(email) = LOWER($1)
      `,
      [normalizedEmail]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No LUMA customer account was found for that email.",
      });
    }

    const customer = customerResult.rows[0];
    const code = createResetCode();
    const codeHash = hashResetCode(normalizedEmail, code);

    await pool.query(
      `
        INSERT INTO customer_password_reset_codes (
          customer_id,
          email,
code_hash,
          expires_at
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP + ($4 || ' minutes')::interval)
      `,
      [customer.id, normalizedEmail, codeHash, RESET_CODE_TTL_MINUTES]
    );

    await sendCustomerPasswordResetEmail({
      email: normalizedEmail,
      fullName: customer.full_name,
      code,
    });

    return res.status(200).json({
      success: true,
      message: "A password reset code has been sent to your email.",
    });
  } catch (error) {
    console.error("Forgot customer password error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error while sending reset code.",
    });
  }
};

const verifyCustomerResetCode = async (req, res) => {
  try {
    await ensureCustomerAuthTable();

    const normalizedEmail = normalizeEmail(req.body.email);
    const code = normalizeText(req.body.code);

    if (!normalizedEmail || !code) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required.",
      });
    }

    const codeHash = hashResetCode(normalizedEmail, code);
    const result = await pool.query(
      `
        SELECT id
        FROM customer_password_reset_codes
        WHERE LOWER(email) = LOWER($1)
          AND code_hash = $2
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [normalizedEmail, codeHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The reset code is invalid or expired.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reset code verified.",
    });
  } catch (error) {
    console.error("Verify reset code error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while verifying reset code.",
    });
  }
};

const resetCustomerPassword = async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureCustomerAuthTable();

    const normalizedEmail = normalizeEmail(req.body.email);
    const code = normalizeText(req.body.code);
    const { password, newPassword, confirmPassword } = req.body;
    const resolvedPassword = password || newPassword;

    if (!normalizedEmail || !code || !resolvedPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, verification code, and new password are required.",
      });
    }

    if (confirmPassword !== undefined && resolvedPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (resolvedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const codeHash = hashResetCode(normalizedEmail, code);

    await client.query("BEGIN");

    const resetResult = await client.query(
      `
        SELECT id, customer_id
        FROM customer_password_reset_codes
        WHERE LOWER(email) = LOWER($1)
          AND code_hash = $2
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [normalizedEmail, codeHash]
    );

    if (resetResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "The reset code is invalid or expired.",
      });
    }

    const passwordHash = await bcrypt.hash(resolvedPassword, 12);
    const resetCode = resetResult.rows[0];

    await client.query(
      `
        UPDATE customer_accounts
        SET
          password_hash = $1,
          auth_provider = 'email',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [passwordHash, resetCode.customer_id]
    );

    await client.query(
      `
        UPDATE customer_password_reset_codes
        SET used_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [resetCode.id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Reset customer password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while resetting password.",
    });
  } finally {
    client.release();
  }
};

const logoutCustomer = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Customer logged out.",
  });
};

const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    admin: req.admin,
  });
};

module.exports = {
  registerAdmin,
  loginAdmin,
  registerCustomer,
  loginCustomer,
  getCustomerMe,
  updateCustomerMe,
  forgotCustomerPassword,
  verifyCustomerResetCode,
  resetCustomerPassword,
  logoutCustomer,
  getMe,
  formatCustomer,
};



