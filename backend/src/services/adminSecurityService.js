const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { sendAdminPasswordVerificationEmail } = require("./emailService");

const CODE_TTL_MINUTES = 10;
const SESSION_UPDATE_WINDOW_MINUTES = 5;

const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const normalizeName = (name) => String(name || "").trim().replace(/\s+/g, " ");

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "";
};

const parseUserAgent = (userAgent = "") => {
  const value = String(userAgent || "");
  const browser = /Edg\//.test(value)
    ? "Microsoft Edge"
    : /OPR\//.test(value)
      ? "Opera"
      : /Chrome\//.test(value)
        ? "Chrome"
        : /Safari\//.test(value)
          ? "Safari"
          : /Firefox\//.test(value)
            ? "Firefox"
            : "Unknown browser";

  const os = /Windows/i.test(value)
    ? "Windows"
    : /Mac OS X/i.test(value)
      ? "macOS"
      : /Android/i.test(value)
        ? "Android"
        : /iPhone|iPad/i.test(value)
          ? "iOS"
          : /Linux/i.test(value)
            ? "Linux"
            : "Unknown OS";

  const deviceType = /Mobile|Android|iPhone/i.test(value) ? "Mobile" : "Desktop";

  return {
    browser,
    os,
    deviceLabel: `${browser} on ${os} (${deviceType})`,
  };
};

const isMissingSecurityTablesError = (error) =>
  error?.code === "42P01" ||
  (error?.code === "42703" &&
    /updated_at|last_login_at|password_changed_at/i.test(error?.message || "")) ||
  /admin_sessions|admin_password_verification_codes|admin_security_events/i.test(
    error?.message || ""
  );

const getTokenFromRequest = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.split(" ")[1] || "";
};

const getTokenExpiry = (token) => {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) return null;
  return new Date(decoded.exp * 1000);
};

async function logSecurityEvent({
  adminId = null,
  eventType,
  req,
  metadata = {},
}) {
  if (!eventType) return null;

  try {
    const result = await pool.query(
      `
        INSERT INTO admin_security_events (
          admin_id,
          event_type,
          ip_address,
          user_agent,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        adminId,
        eventType,
        req ? getClientIp(req) : null,
        req?.headers?.["user-agent"] || null,
        metadata,
      ]
    );

    return result.rows[0] || null;
  } catch (error) {
    if (isMissingSecurityTablesError(error)) return null;
    throw error;
  }
}

async function recordAdminLogin({ admin, token, req }) {
  const tokenHash = hashValue(token);
  const userAgent = req?.headers?.["user-agent"] || "";
  const parsed = parseUserAgent(userAgent);

  try {
    await pool.query(
      `
        UPDATE admins
        SET last_login_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [admin.id]
    );
  } catch (error) {
    if (error?.code !== "42703") throw error;
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO admin_sessions (
          admin_id,
          token_hash,
          device_label,
          user_agent,
          browser,
          os,
          ip_address,
          is_current,
          last_active_at,
          created_at,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)
        RETURNING id
      `,
      [
        admin.id,
        tokenHash,
        parsed.deviceLabel,
        userAgent || null,
        parsed.browser,
        parsed.os,
        req ? getClientIp(req) : null,
        getTokenExpiry(token),
      ]
    );

    await logSecurityEvent({
      adminId: admin.id,
      eventType: "login_success",
      req,
      metadata: { sessionId: result.rows[0]?.id || null },
    });

    return result.rows[0] || null;
  } catch (error) {
    if (isMissingSecurityTablesError(error)) {
      await logSecurityEvent({
        adminId: admin.id,
        eventType: "login_success",
        req,
      }).catch(() => {});
      return null;
    }

    throw error;
  }
}

async function validateAdminSession({ adminId, token, req }) {
  const tokenHash = hashValue(token);

  try {
    const result = await pool.query(
      `
        SELECT id, admin_id, revoked_at, expires_at, last_active_at
        FROM admin_sessions
        WHERE admin_id = $1
          AND token_hash = $2
        LIMIT 1
      `,
      [adminId, tokenHash]
    );

    if (result.rows.length === 0) {
      return { status: "not_tracked", session: null };
    }

    const session = result.rows[0];

    if (session.revoked_at) {
      return { status: "revoked", session };
    }

    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      return { status: "expired", session };
    }

    const lastActiveAt = session.last_active_at
      ? new Date(session.last_active_at)
      : null;
    const shouldTouch =
      !lastActiveAt ||
      Date.now() - lastActiveAt.getTime() >
        SESSION_UPDATE_WINDOW_MINUTES * 60 * 1000;

    if (shouldTouch) {
      await pool.query(
        `
          UPDATE admin_sessions
          SET last_active_at = CURRENT_TIMESTAMP,
              ip_address = COALESCE($3, ip_address)
          WHERE admin_id = $1
            AND token_hash = $2
            AND revoked_at IS NULL
        `,
        [adminId, tokenHash, req ? getClientIp(req) : null]
      );
    }

    return { status: "active", session };
  } catch (error) {
    if (isMissingSecurityTablesError(error)) {
      return { status: "tables_missing", session: null };
    }

    throw error;
  }
}

const formatSession = (session, currentTokenHash) => ({
  id: session.id,
  device_label: session.device_label || "Unknown device",
  browser: session.browser || "Unknown browser",
  os: session.os || "Unknown OS",
  ip_address: session.ip_address || "",
  location_hint: session.location_hint || "",
  is_current: session.token_hash === currentTokenHash,
  is_revoked: Boolean(session.revoked_at),
  revoked_at: session.revoked_at,
  last_active_at: session.last_active_at,
  created_at: session.created_at,
  expires_at: session.expires_at,
});

async function listAdminSessions({ adminId, token }) {
  const currentTokenHash = hashValue(token);
  const result = await pool.query(
    `
      SELECT
        id,
        token_hash,
        device_label,
        browser,
        os,
        ip_address,
        location_hint,
        revoked_at,
        last_active_at,
        created_at,
        expires_at
      FROM admin_sessions
      WHERE admin_id = $1
      ORDER BY revoked_at NULLS FIRST, last_active_at DESC NULLS LAST, created_at DESC
      LIMIT 50
    `,
    [adminId]
  );

  return result.rows.map((session) => formatSession(session, currentTokenHash));
}

async function revokeSession({ adminId, sessionId, req }) {
  const result = await pool.query(
    `
      UPDATE admin_sessions
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
      WHERE id = $1
        AND admin_id = $2
      RETURNING id
    `,
    [sessionId, adminId]
  );

  if (result.rows.length > 0) {
    await logSecurityEvent({
      adminId,
      eventType: "session_revoked",
      req,
      metadata: { sessionId },
    });
  }

  return result.rows[0] || null;
}

async function revokeOtherSessions({ adminId, token, req }) {
  const currentTokenHash = hashValue(token);
  const result = await pool.query(
    `
      UPDATE admin_sessions
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
      WHERE admin_id = $1
        AND token_hash <> $2
        AND revoked_at IS NULL
      RETURNING id
    `,
    [adminId, currentTokenHash]
  );

  await logSecurityEvent({
    adminId,
    eventType: "all_sessions_revoked",
    req,
    metadata: { scope: "others", revokedCount: result.rowCount },
  });

  return result.rowCount;
}

async function revokeAllSessions({ adminId, req }) {
  const result = await pool.query(
    `
      UPDATE admin_sessions
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
      WHERE admin_id = $1
        AND revoked_at IS NULL
      RETURNING id
    `,
    [adminId]
  );

  await logSecurityEvent({
    adminId,
    eventType: "all_sessions_revoked",
    req,
    metadata: { scope: "all", revokedCount: result.rowCount },
  });

  return result.rowCount;
}

async function getAdminProfile(adminId) {
  const result = await pool.query(
    `
      SELECT
        id,
        full_name,
        email,
        role,
        created_at,
        updated_at,
        last_login_at,
        password_changed_at
      FROM admins
      WHERE id = $1
    `,
    [adminId]
  );

  return result.rows[0] || null;
}

async function updateAdminProfile({ adminId, fullName, req }) {
  const normalizedFullName = normalizeName(fullName);

  if (!normalizedFullName) {
    const error = new Error("Full name is required.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      UPDATE admins
      SET full_name = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, full_name, email, role, created_at, updated_at, last_login_at, password_changed_at
    `,
    [normalizedFullName, adminId]
  );

  await logSecurityEvent({
    adminId,
    eventType: "profile_updated",
    req,
  });

  return result.rows[0] || null;
}

async function requestPasswordChange({ adminId, currentPassword, req }) {
  if (!currentPassword) {
    const error = new Error("Current password is required.");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      SELECT id, full_name, email, password_hash
      FROM admins
      WHERE id = $1
    `,
    [adminId]
  );

  const admin = result.rows[0];
  if (!admin) {
    const error = new Error("Admin account not found.");
    error.statusCode = 404;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(
    currentPassword,
    admin.password_hash
  );

  if (!passwordMatches) {
    await logSecurityEvent({
      adminId,
      eventType: "password_change_failed",
      req,
      metadata: { reason: "current_password_invalid" },
    });

    const error = new Error("Current password is incorrect.");
    error.statusCode = 401;
    throw error;
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const email = normalizeEmail(admin.email);
  const codeHash = hashValue(`${email}:password_change:${code}`);

  await pool.query(
    `
      INSERT INTO admin_password_verification_codes (
        admin_id,
        email,
        code_hash,
        purpose,
        expires_at
      )
      VALUES ($1, $2, $3, 'password_change', CURRENT_TIMESTAMP + ($4 || ' minutes')::interval)
    `,
    [admin.id, email, codeHash, CODE_TTL_MINUTES]
  );

  await sendAdminPasswordVerificationEmail({
    email,
    fullName: admin.full_name,
    code,
    expiresInMinutes: CODE_TTL_MINUTES,
  });

  await logSecurityEvent({
    adminId,
    eventType: "password_change_requested",
    req,
  });

  return { email, expiresInMinutes: CODE_TTL_MINUTES };
}

async function verifyPasswordChangeCode({ adminId, code, req }) {
  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) {
    const error = new Error("Verification code is required.");
    error.statusCode = 400;
    throw error;
  }

  const adminResult = await pool.query(
    "SELECT id, email FROM admins WHERE id = $1",
    [adminId]
  );
  const admin = adminResult.rows[0];

  if (!admin) {
    const error = new Error("Admin account not found.");
    error.statusCode = 404;
    throw error;
  }

  const codeHash = hashValue(
    `${normalizeEmail(admin.email)}:password_change:${normalizedCode}`
  );

  const result = await pool.query(
    `
      SELECT id, expires_at, used_at
      FROM admin_password_verification_codes
      WHERE admin_id = $1
        AND code_hash = $2
        AND purpose = 'password_change'
        AND used_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [adminId, codeHash]
  );

  const isValid = result.rows.length > 0;

  await logSecurityEvent({
    adminId,
    eventType: isValid ? "password_change_verified" : "password_change_failed",
    req,
    metadata: isValid ? {} : { reason: "verification_code_invalid" },
  });

  if (!isValid) {
    const error = new Error("The verification code is invalid or expired.");
    error.statusCode = 400;
    throw error;
  }

  return { verified: true };
}

function validateNewPassword(newPassword, confirmPassword) {
  if (!newPassword || !confirmPassword) {
    const error = new Error("New password and confirmation are required.");
    error.statusCode = 400;
    throw error;
  }

  if (newPassword !== confirmPassword) {
    const error = new Error("New password and confirmation do not match.");
    error.statusCode = 400;
    throw error;
  }

  if (newPassword.length < 8) {
    const error = new Error("Password must be at least 8 characters.");
    error.statusCode = 400;
    throw error;
  }
}

async function changeAdminPassword({
  adminId,
  code,
  newPassword,
  confirmPassword,
  token,
  req,
}) {
  validateNewPassword(newPassword, confirmPassword);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const adminResult = await client.query(
      "SELECT id, email FROM admins WHERE id = $1",
      [adminId]
    );
    const admin = adminResult.rows[0];

    if (!admin) {
      const error = new Error("Admin account not found.");
      error.statusCode = 404;
      throw error;
    }

    const codeHash = hashValue(
      `${normalizeEmail(admin.email)}:password_change:${String(code || "").trim()}`
    );

    const codeResult = await client.query(
      `
        SELECT id
        FROM admin_password_verification_codes
        WHERE admin_id = $1
          AND code_hash = $2
          AND purpose = 'password_change'
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [adminId, codeHash]
    );

    if (codeResult.rows.length === 0) {
      const error = new Error("The verification code is invalid or expired.");
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await client.query(
      `
        UPDATE admins
        SET password_hash = $1,
            password_changed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [passwordHash, adminId]
    );

    await client.query(
      `
        UPDATE admin_password_verification_codes
        SET used_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [codeResult.rows[0].id]
    );

    const currentTokenHash = hashValue(token);
    await client.query(
      `
        UPDATE admin_sessions
        SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
        WHERE admin_id = $1
          AND token_hash <> $2
          AND revoked_at IS NULL
      `,
      [adminId, currentTokenHash]
    );

    await client.query("COMMIT");

    await logSecurityEvent({
      adminId,
      eventType: "password_changed",
      req,
      metadata: { revokedOtherSessions: true },
    });

    return { passwordChanged: true, otherSessionsRevoked: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    if (!error.statusCode) {
      await logSecurityEvent({
        adminId,
        eventType: "password_change_failed",
        req,
        metadata: { reason: error.message },
      }).catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

async function listSecurityEvents(adminId) {
  const result = await pool.query(
    `
      SELECT id, event_type, ip_address, user_agent, metadata, created_at
      FROM admin_security_events
      WHERE admin_id = $1 OR admin_id IS NULL
      ORDER BY created_at DESC
      LIMIT 80
    `,
    [adminId]
  );

  return result.rows;
}

module.exports = {
  getClientIp,
  getTokenFromRequest,
  hashValue,
  isMissingSecurityTablesError,
  logSecurityEvent,
  recordAdminLogin,
  validateAdminSession,
  listAdminSessions,
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,
  getAdminProfile,
  updateAdminProfile,
  requestPasswordChange,
  verifyPasswordChangeCode,
  changeAdminPassword,
  listSecurityEvents,
};
