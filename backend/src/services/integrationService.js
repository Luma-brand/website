function isConfigured(value) {
  return Boolean(String(value || "").trim());
}

function getIntegrationStatus() {
  const integrations = [
    {
      key: "resend_email",
      label: "Resend email service",
      status:
        isConfigured(process.env.RESEND_API_KEY) &&
        isConfigured(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL)
          ? "configured"
          : "not_configured",
      requirements: ["RESEND_API_KEY", "EMAIL_FROM"],
      enabledFeatures: [
        "welcome_email",
        "password_reset",
        "order_confirmation",
        "abandoned_cart_recovery",
        "post_purchase_email",
        "winback_email",
        "review_requests",
        "email_broadcasts",
      ],
    },
    {
      key: "backend_event_tracking",
      label: "LUMA behaviour tracking",
      status: "configured",
      requirements: [],
      enabledFeatures: [
        "page_view",
        "product_view",
        "add_to_cart",
        "checkout_started",
        "purchase_completed",
        "browse_abandonment",
        "conversion_tracking",
      ],
    },
    {
      key: "abandoned_cart_worker",
      label: "Abandoned cart recovery worker",
      status: isConfigured(process.env.ABANDONED_CART_DELAY_MINUTES)
        ? "configured"
        : "not_configured",
      requirements: ["ABANDONED_CART_DELAY_MINUTES"],
      enabledFeatures: [
        "cart_activity",
        "recovery_email",
        "manual_whatsapp_followup",
        "recovery_status",
      ],
    },
    {
      key: "email_broadcast_service",
      label: "Email broadcast service",
      status: isConfigured(process.env.RESEND_API_KEY)
        ? "configured"
        : "not_configured",
      requirements: ["RESEND_API_KEY"],
      enabledFeatures: [
        "test_email",
        "customer_broadcasts",
        "segmented_recipients",
        "recipient_logs",
      ],
    },
    {
      key: "paystack_payments",
      label: "Paystack payments",
      status: isConfigured(process.env.PAYSTACK_SECRET_KEY)
        ? "configured"
        : "not_configured",
      requirements: ["PAYSTACK_SECRET_KEY", "Paystack webhook URL"],
      enabledFeatures: [
        "hosted_checkout",
        "server_verification",
        "signed_webhooks",
        "paid_order_events",
        "international_cards_when_enabled_by_paystack",
      ],
    },
    {
      key: "currency_rates",
      label: "Currency display system",
      status: "configured",
      requirements: [],
      enabledFeatures: [
        "ngn_base_currency",
        "admin_rates",
        "customer_display_currency",
      ],
    },
    {
      key: "google_maps_autocomplete",
      label: "Google Maps autocomplete",
      status: isConfigured(
        process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
      )
        ? "configured"
        : "not_configured",
      requirements: ["VITE_GOOGLE_MAPS_API_KEY"],
      enabledFeatures: ["delivery_address_autocomplete"],
    },
    {
      key: "whatsapp_followup",
      label: "WhatsApp recovery follow-up",
      status: isConfigured(process.env.WHATSAPP_NUMBER)
        ? "partial"
        : "not_configured",
      requirements: [
        "WHATSAPP_NUMBER for manual recovery links",
        "Approved WhatsApp provider/API for fully automatic delivery",
      ],
      enabledFeatures: ["manual_recovery_links", "contact_tracking"],
    },
  ];

  return {
    summary: {
      total: integrations.length,
      configured: integrations.filter((item) => item.status === "configured")
        .length,
      partial: integrations.filter((item) => item.status === "partial").length,
      notConfigured: integrations.filter(
        (item) => !["configured", "partial"].includes(item.status)
      ).length,
    },
    sourceOfTruth: "luma_backend_database",
    integrations,
  };
}

module.exports = {
  getIntegrationStatus,
};
