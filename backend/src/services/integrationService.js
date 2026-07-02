function isConfigured(value) {
  return Boolean(String(value || "").trim());
}

function getIntegrationStatus() {
  const integrations = [
    {
      key: "resend_email",
      label: "Resend email service",
      status: isConfigured(process.env.RESEND_API_KEY) &&
        isConfigured(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL)
        ? "configured"
        : "not_configured",
      requirements: ["RESEND_API_KEY", "EMAIL_FROM"],
      enabledFeatures: [
        "welcome_email",
        "email_verification",
        "password_reset",
        "order_confirmation",
        "abandoned_cart_recovery",
        "email_broadcasts",
      ],
    },
    {
      key: "backend_event_tracking",
      label: "Manual backend event tracking",
      status: "configured",
      requirements: ["POST /api/events or /api/growth/events", "analytics_events table"],
      enabledFeatures: [
        "page_view",
        "product_view",
        "add_to_cart",
        "checkout_started",
        "purchase_completed",
      ],
    },
    {
      key: "abandoned_cart_worker",
      label: "Abandoned cart worker",
      status: isConfigured(process.env.ABANDONED_CART_DELAY_MINUTES)
        ? "configured"
        : "not_configured",
      requirements: ["ABANDONED_CART_DELAY_MINUTES", "admin/manual cron trigger"],
      enabledFeatures: ["cart_activity", "recovery_email", "recovery_status"],
    },
    {
      key: "email_broadcast_service",
      label: "Email broadcast service",
      status: isConfigured(process.env.RESEND_API_KEY) &&
        isConfigured(process.env.ADMIN_TEST_EMAIL || process.env.ADMIN_EMAIL)
        ? "configured"
        : "not_configured",
      requirements: ["RESEND_API_KEY", "ADMIN_TEST_EMAIL"],
      enabledFeatures: ["test_email", "customer_broadcasts", "recipient_logs"],
    },
    {
      key: "flutterwave_verification",
      label: "Flutterwave payment verification",
      status: isConfigured(process.env.FLUTTERWAVE_SECRET_KEY)
        ? "configured"
        : "not_configured",
      requirements: ["FLUTTERWAVE_SECRET_KEY", "FLUTTERWAVE_REDIRECT_URL", "FLUTTERWAVE_WEBHOOK_SECRET_HASH"],
      enabledFeatures: ["multi_currency_checkout", "payment_verify", "paid_order_events"],
    },
    {
      key: "currency_rates",
      label: "Currency/rate system",
      status: "configured",
      requirements: ["currency_rates table or default NGN fallback"],
      enabledFeatures: ["ngn_base_currency", "admin_rates", "customer_display_currency"],
    },
    {
      key: "google_sign_in",
      label: "Google sign-in",
      status: isConfigured(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID)
        ? "configured"
        : "not_configured",
      requirements: ["GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_ID"],
      enabledFeatures: ["customer_google_login"],
    },
    {
      key: "google_maps_autocomplete",
      label: "Google Maps autocomplete",
      status: isConfigured(process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY)
        ? "configured"
        : "not_configured",
      requirements: ["VITE_GOOGLE_MAPS_API_KEY"],
      enabledFeatures: ["delivery_address_autocomplete"],
    },
  ];

  return {
    summary: {
      total: integrations.length,
      configured: integrations.filter((item) => item.status === "configured").length,
      notConfigured: integrations.filter((item) => item.status !== "configured").length,
    },
    sourceOfTruth: "backend_database_resend",
    integrations,
  };
}

module.exports = {
  getIntegrationStatus,
};
