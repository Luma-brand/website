const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const contactRoutes = require("./routes/contactRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_2,
  "https://luma-beta-eight.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

const vercelPreviewRegex = /^https:\/\/.*\.vercel\.app$/;

app.use(
  cors({
    origin(origin, callback) {
      // Allows Postman, curl, server health checks, and direct browser visits
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allows Vercel preview deployments while testing
      if (vercelPreviewRegex.test(origin)) {
        return callback(null, true);
      }

      console.log("Blocked by CORS:", origin);

      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options(/.*/, cors());

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LUMA backend API is running",
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    environment: process.env.NODE_ENV || "development",
    frontendUrl: process.env.FRONTEND_URL || null,
    allowedOrigins,
  });
});

app.use("/api/contacts", contactRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (error.message && error.message.includes("Not allowed by CORS")) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message || "Internal server error",
  });
});

module.exports = app;