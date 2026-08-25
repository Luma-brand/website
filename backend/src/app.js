const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const whatsappRoutes = require("./routes/whatsappRoutes");

const contactRoutes = require("./routes/contactRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const authRoutes = require("./routes/authRoutes");
const customerAuthRoutes = require("./routes/customerAuthRoutes");
const productRoutes = require("./routes/productRoutes");
const productSalesRoutes = require("./routes/productSalesRoutes");
const productWaitlistRoutes = require("./routes/productWaitlistRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const customerRoutes = require("./routes/customerRoutes");
const customerCartRoutes = require("./routes/customerCartRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const eventRoutes = require("./routes/eventRoutes");
const growthRoutes = require("./routes/growthRoutes");
const abandonedCartRoutes = require("./routes/abandonedCartRoutes");
const discountRoutes = require("./routes/discountRoutes");
const currencyRoutes = require("./routes/currencyRoutes");
const automationRoutes = require("./routes/automationRoutes");
const emailBroadcastRoutes = require("./routes/emailBroadcastRoutes");
const emailCompatibilityRoutes = require("./routes/emailCompatibilityRoutes");
const emailAutomationRoutes = require("./routes/emailAutomationRoutes");
const resendWebhookRoutes = require("./routes/resendWebhookRoutes");
const paystackWebhookRoutes = require("./routes/paystackWebhookRoutes");
const cartRoutes = require("./routes/cartRoutes");
const adminAbandonedCartRoutes = require("./routes/adminAbandonedCartRoutes");
const cronRoutes = require("./routes/cronRoutes");
const integrationRoutes = require("./routes/integrationRoutes");
const seoRoutes = require("./routes/seoRoutes");

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_2,
  "https://shopwithluma.com",
  "https://website-umber-xi-40.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
].filter(Boolean);

const vercelPreviewRegex = /^https:\/\/.*\.vercel\.app$/;

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (vercelPreviewRegex.test(origin)) {
      return callback(null, true);
    }

    console.log("Blocked by CORS:", origin);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buffer) => {
      if (
        req.originalUrl &&
        (req.originalUrl.startsWith("/api/webhooks/resend") ||
          req.originalUrl.startsWith("/api/webhooks/paystack"))
      ) {
        req.rawBody = buffer.toString("utf8");
      }
    },
  })
);
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
  const abandonedCartDelayMinutes = Number(
    process.env.ABANDONED_CART_DELAY_MINUTES || 60
  );

  res.status(200).json({
    ok: true,
    success: true,
    environment: process.env.NODE_ENV || "development",
    frontendUrl: process.env.FRONTEND_URL || null,
    allowedOrigins,
    paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
    resendConfigured: Boolean(
      process.env.RESEND_API_KEY &&
        (process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL)
    ),
    googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    cloudinaryConfigured: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    ),
    abandonedCartDelayMinutes: Number.isFinite(abandonedCartDelayMinutes)
      ? abandonedCartDelayMinutes
      : 60,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/contacts", contactRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/auth/customer", customerAuthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/product-sales", productSalesRoutes);
app.use("/api/product-waitlists", productWaitlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/admin/customers", customerRoutes);
app.use("/api/customer-cart", customerCartRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin/analytics", analyticsRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/growth", growthRoutes);
app.use("/api/abandoned-carts", abandonedCartRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/admin/abandoned-carts", adminAbandonedCartRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/currency", currencyRoutes);
app.use("/api/automation", automationRoutes);
app.use("/api/admin/automations", automationRoutes);
app.use("/api/email-broadcasts", emailBroadcastRoutes);
app.use("/api/email", emailCompatibilityRoutes);
app.use("/api/admin/email", emailCompatibilityRoutes);
app.use("/api/admin/email-automation", emailAutomationRoutes);
app.use("/api/webhooks/resend", resendWebhookRoutes);
app.use("/api/webhooks/paystack", paystackWebhookRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/", seoRoutes);
app.use("/api/whatsapp", whatsappRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND",
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (error.message && error.message.includes("Not allowed by CORS")) {
    return res.status(403).json({
      success: false,
      message: error.message,
      code: "CORS_NOT_ALLOWED",
    });
  }

  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message || "Internal server error",
    code: error.code || "INTERNAL_SERVER_ERROR",
  });
});

module.exports = app;
