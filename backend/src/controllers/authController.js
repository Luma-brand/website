const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

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
      WHERE email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const admin = result.rows[0];

    const isPasswordCorrect = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!isPasswordCorrect) {
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

const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    admin: req.admin,
  });
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getMe,
};