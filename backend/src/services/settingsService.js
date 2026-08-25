function isConfigured(value) {
  return Boolean(String(value || "").trim());
}

function getSafeUrl(value) {
  return isConfigured(value) ? value : null;
}

function getConfigStatus() {
  const groups = [
    {
      key: "server",
      label: "Server",
      items: [
        {
          key: "nodeEnv",
          label: "Node environment",
          configured: isConfigured(process.env.NODE_ENV),
          value: process.env.NODE_ENV || "development",
        },
        {
          key: "port",
          label: "Port",
          configured: isConfigured(process.env.PORT),
          value: process.env.PORT || "default",
        },
        {
          key: "frontendUrl",
          label: "Frontend URL",
          configured: isConfigured(process.env.FRONTEND_URL),
          value: getSafeUrl(process.env.FRONTEND_URL),
        },
      ],
    },
    {
      key: "database",
      label: "Database",
      items: [
        {
          key: "databaseUrl",
          label: "Database URL",
          configured: isConfigured(process.env.DATABASE_URL),
        },
      ],
    },
    {
      key: "auth",
      label: "Customer authentication",
      items: [
        {
          key: "jwtSecret",
          label: "JWT secret",
          configured: isConfigured(process.env.JWT_SECRET),
        },
        {
          key: "jwtExpiresIn",
          label: "Session expiry",
          configured: isConfigured(process.env.JWT_EXPIRES_IN),
          value: process.env.JWT_EXPIRES_IN || "7d",
        },
        {
          key: "authMode",
          label: "Customer sign-in",
          configured: true,
          value: "Email + password",
        },
      ],
    },
    {
      key: "payments",
      label: "Paystack",
      items: [
        {
          key: "paystackSecretKey",
          label: "Secret key",
          configured: isConfigured(process.env.PAYSTACK_SECRET_KEY),
        },
        {
          key: "paystackCallbackUrl",
          label: "Callback URL",
          configured: true,
          value:
            getSafeUrl(process.env.PAYSTACK_CALLBACK_URL) ||
            `${String(process.env.FRONTEND_URL || "https://shopwithluma.com").replace(/\/$/, "")}/payment/paystack/callback`,
        },
        {
          key: "paystackWebhook",
          label: "Webhook endpoint",
          configured: true,
          value: `${String(process.env.BACKEND_URL || "https://website-ikv5.onrender.com").replace(/\/$/, "")}/api/webhooks/paystack`,
        },
      ],
    },
    {
      key: "images",
      label: "Cloudinary",
      items: [
        {
          key: "cloudinaryCloudName",
          label: "Cloud name",
          configured: isConfigured(process.env.CLOUDINARY_CLOUD_NAME),
        },
        {
          key: "cloudinaryApiKey",
          label: "API key",
          configured: isConfigured(process.env.CLOUDINARY_API_KEY),
        },
        {
          key: "cloudinaryApiSecret",
          label: "API secret",
          configured: isConfigured(process.env.CLOUDINARY_API_SECRET),
        },
        {
          key: "cloudinaryFolder",
          label: "Upload folder",
          configured: isConfigured(process.env.CLOUDINARY_FOLDER),
          value: process.env.CLOUDINARY_FOLDER || "luma/products",
        },
      ],
    },
    {
      key: "email",
      label: "Email automation & broadcasts",
      items: [
        {
          key: "resendApiKey",
          label: "Resend API key",
          configured: isConfigured(process.env.RESEND_API_KEY),
        },
        {
          key: "fromEmail",
          label: "From email",
          configured: isConfigured(
            process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM
          ),
          value: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || null,
        },
        {
          key: "adminEmail",
          label: "Admin notification email",
          configured: isConfigured(
            process.env.LUMA_ADMIN_EMAIL || process.env.ADMIN_EMAIL
          ),
          value: process.env.LUMA_ADMIN_EMAIL || process.env.ADMIN_EMAIL || null,
        },
      ],
    },
    {
      key: "marketingAutomation",
      label: "Growth automation",
      items: [
        {
          key: "abandonedCartDelayMinutes",
          label: "Abandoned cart delay minutes",
          configured: isConfigured(process.env.ABANDONED_CART_DELAY_MINUTES),
          value: process.env.ABANDONED_CART_DELAY_MINUTES || "60",
        },
        {
          key: "whatsappNumber",
          label: "WhatsApp recovery number",
          configured: isConfigured(process.env.WHATSAPP_NUMBER),
        },
        {
          key: "backendEventTracking",
          label: "Behaviour / conversion tracking",
          configured: true,
        },
        {
          key: "emailBroadcasts",
          label: "Email broadcasts",
          configured: isConfigured(process.env.RESEND_API_KEY),
        },
      ],
    },
  ];

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const configuredItems = groups.reduce(
    (sum, group) =>
      sum + group.items.filter((item) => item.configured === true).length,
    0
  );

  return {
    summary: {
      totalItems,
      configuredItems,
      missingItems: totalItems - configuredItems,
      ready: configuredItems === totalItems,
    },
    groups,
  };
}

module.exports = {
  getConfigStatus,
};
