export const seoKeywordMap = {
  "/": {
    page: "Homepage",
    primary: [
      "LUMA Skincare",
      "brow products",
      "premium brow products",
      "natural brow beauty",
    ],
    secondary: [
      "everyday brow styling",
      "clean beauty brows",
      "soft glam brows",
      "polished brows",
    ],
    intent: "Brand discovery and premium brow product introduction.",
  },
  "/products": {
    page: "Products",
    primary: [
      "shop brow products",
      "buy brow products online",
      "brow essentials",
    ],
    secondary: [
      "brow grooming products",
      "brow styling products",
      "eyebrow products",
      "natural-looking brows",
    ],
    intent: "Commercial shopping page for the LUMA brow collection.",
  },
  "/products/:slug": {
    page: "Product details",
    primary: [
      "LUMA brow product",
      "brow product for natural-looking brows",
      "product name",
    ],
    secondary: [
      "defined brows",
      "polished brows",
      "everyday brow routine",
      "premium brow finish",
    ],
    intent: "Product-specific organic landing page using live backend product data.",
  },
  "/about": {
    page: "About",
    primary: ["LUMA Skincare", "brow beauty brand", "beauty made simple"],
    secondary: ["premium brow care", "effortless beauty", "soft luxury beauty"],
    intent: "Brand trust and positioning.",
  },
  "/contact": {
    page: "Contact",
    primary: ["LUMA customer support", "brow product support"],
    secondary: ["order support", "product enquiry", "beauty order support"],
    intent: "Support and customer-care discovery.",
  },
  "/privacy-policy": {
    page: "Privacy policy",
    primary: ["LUMA privacy policy", "customer data protection"],
    secondary: ["beauty order privacy", "secure beauty checkout"],
    intent: "Legal trust page.",
  },
  "/terms-and-conditions": {
    page: "Terms and conditions",
    primary: ["LUMA terms and conditions", "LUMA website terms"],
    secondary: ["brow product orders", "beauty product delivery terms"],
    intent: "Legal and order-policy trust page.",
  },
};

export const noindexRouteGroups = {
  transactional: ["/cart", "/checkout", "/order-success", "/payment/paystack/callback"],
  privateCustomer: [
    "/account",
    "/login",
    "/register",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/complete-profile",
    "/settings",
    "/wishlist",
  ],
  system: ["/admin", "/admin/*", "/luma-control-room", "/luma-control-room/*"],
};
