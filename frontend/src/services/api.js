function normalizeApiBaseUrl(value) {
  const rawValue = String(value || "http://localhost:5000/api").trim().replace(/\/+$/, "");
  if (!rawValue) return "http://localhost:5000/api";
  return rawValue.endsWith("/api") ? rawValue : `${rawValue}/api`;
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL
);
const getResponseData = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const getFriendlyApiMessage = (response, data) => {
  if (data?.message) return data.message;

  if (response.status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (response.status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (response.status === 404) {
    return import.meta.env.DEV
      ? `API route not found: ${response.url}`
      : "The requested service is not available right now.";
  }

  if (response.status >= 500) {
    return "The server encountered an error. Please try again.";
  }

  return "The request could not be completed.";
};

const handleResponse = async (response) => {
  const data = await getResponseData(response);

  if (!response.ok) {
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/luma-control-room")
    ) {
      localStorage.removeItem("luma_admin_token");
      localStorage.removeItem("luma_admin_user");
      window.dispatchEvent(new CustomEvent("luma-admin-session-expired"));

      if (!window.location.pathname.includes("/luma-control-room/login")) {
        window.location.assign("/luma-control-room/login");
      }
    }

    const error = new Error(getFriendlyApiMessage(response, data));
    error.status = response.status;
    error.data = data;
    error.endpoint = response.url;
    throw error;
  }

  return data;
};

const getAdminToken = () => {
  return localStorage.getItem("luma_admin_token");
};

const getAdminHeaders = (extraHeaders = {}) => {
  const token = getAdminToken();

  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
};

export const submitContactForm = async (formData) => {
  const response = await fetch(`${API_BASE_URL}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  return handleResponse(response);
};

export const submitBookingForm = async (formData) => {
  const response = await fetch(`${API_BASE_URL}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  return handleResponse(response);
};

export const subscribeNewsletter = async (formData) => {
  const response = await fetch(`${API_BASE_URL}/newsletter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  return handleResponse(response);
};

export const loginAdmin = async (formData) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  return handleResponse(response);
};

export const getAdminMe = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

const getCustomerHeaders = (extraHeaders = {}) => {
  const token = localStorage.getItem("luma_customer_token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
};

export const getAdminDashboardStats = async () => {
  const response = await fetch(`${API_BASE_URL}/dashboard`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getAdminAnalytics = async (filters = {}) => {
  const params = new URLSearchParams();

  if (filters.range) params.set("range", filters.range);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  const queryString = params.toString();
  const response = await fetch(`${API_BASE_URL}/analytics${queryString ? `?${queryString}` : ""}`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getGrowthOverview = async () => {
  const response = await fetch(`${API_BASE_URL}/growth/overview`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getAbandonedCarts = async ({ status = "all" } = {}) => {
  const params = new URLSearchParams();

  if (status && status !== "all") {
    params.set("status", status);
  }

  const queryString = params.toString();
  const response = await fetch(
    queryString
      ? `${API_BASE_URL}/abandoned-carts/admin?${queryString}`
      : `${API_BASE_URL}/abandoned-carts/admin`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const runAbandonedCartRecovery = async () => {
  const response = await fetch(`${API_BASE_URL}/abandoned-carts/admin/run-recovery`, {
    method: "POST",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const sendAbandonedCartRecoveryEmail = async (cartId) => {
  const response = await fetch(
    `${API_BASE_URL}/abandoned-carts/admin/${cartId}/send-email`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const markAbandonedCartWhatsappOpened = async (cartId) => {
  const response = await fetch(
    `${API_BASE_URL}/abandoned-carts/admin/${cartId}/whatsapp-opened`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const markAbandonedCartWhatsappContacted = async (cartId) => {
  const response = await fetch(
    `${API_BASE_URL}/abandoned-carts/admin/${cartId}/whatsapp-contacted`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const getAbandonedCheckouts = async ({ status = "all" } = {}) => {
  const params = new URLSearchParams();

  if (status && status !== "all") {
    params.set("status", status);
  }

  const queryString = params.toString();
  const response = await fetch(
    queryString
      ? `${API_BASE_URL}/growth/abandoned-checkouts?${queryString}`
      : `${API_BASE_URL}/growth/abandoned-checkouts`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const sendCheckoutRecoveryEmail = async (checkoutId) => {
  const response = await fetch(
    `${API_BASE_URL}/growth/abandoned-checkouts/${checkoutId}/recovery-email`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const markCheckoutWhatsappContacted = async (checkoutId) => {
  const response = await fetch(
    `${API_BASE_URL}/growth/abandoned-checkouts/${checkoutId}/whatsapp-contacted`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const getBackInStockRequests = async ({ status = "all" } = {}) => {
  const params = new URLSearchParams();

  if (status && status !== "all") {
    params.set("status", status);
  }

  const queryString = params.toString();
  const response = await fetch(
    queryString
      ? `${API_BASE_URL}/growth/back-in-stock?${queryString}`
      : `${API_BASE_URL}/growth/back-in-stock`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const markBackInStockWhatsappContacted = async (requestId) => {
  const response = await fetch(
    `${API_BASE_URL}/growth/back-in-stock/${requestId}/whatsapp-contacted`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const joinProductWaitlist = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/product-waitlists/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const getProductWaitlists = async ({
  status = "all",
  search = "",
  productId = "",
  notified = "all",
} = {}) => {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("search", search);
  if (productId) params.set("productId", productId);
  if (notified && notified !== "all") params.set("notified", notified);

  const queryString = params.toString();
  const response = await fetch(
    queryString
      ? `${API_BASE_URL}/product-waitlists/admin?${queryString}`
      : `${API_BASE_URL}/product-waitlists/admin`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const sendProductWaitlistEmail = async (waitlistId) => {
  const response = await fetch(
    `${API_BASE_URL}/product-waitlists/admin/${waitlistId}/send-email`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const sendProductWaitlistEmailsForProduct = async (productId) => {
  const response = await fetch(
    `${API_BASE_URL}/product-waitlists/admin/product/${productId}/send-emails`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const cancelProductWaitlist = async (waitlistId) => {
  const response = await fetch(
    `${API_BASE_URL}/product-waitlists/admin/${waitlistId}/cancel`,
    {
      method: "PATCH",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const updateProductWaitlistStatus = async (waitlistId, status) => {
  const response = await fetch(
    `${API_BASE_URL}/product-waitlists/admin/${waitlistId}/status`,
    {
      method: "PATCH",
      headers: getAdminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status }),
    }
  );

  return handleResponse(response);
};

export const validateDiscountCode = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/discounts/validate`, {
    method: "POST",
    headers: getCustomerHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const getActivePromotion = async () => {
  const response = await fetch(`${API_BASE_URL}/discounts/promotion`);
  return handleResponse(response);
};

export const getDiscountCodes = async () => {
  const response = await fetch(`${API_BASE_URL}/discounts`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const createDiscountCode = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/discounts`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const updateDiscountCode = async (discountId, payload) => {
  const response = await fetch(`${API_BASE_URL}/discounts/${discountId}`, {
    method: "PATCH",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const disableDiscountCode = async (discountId) => {
  const response = await fetch(`${API_BASE_URL}/discounts/${discountId}/disable`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const enableDiscountCode = async (discountId) => {
  const response = await fetch(`${API_BASE_URL}/discounts/${discountId}/enable`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const deleteDiscountCode = async (discountId) => {
  const response = await fetch(`${API_BASE_URL}/discounts/${discountId}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getDiscountSettings = async () => {
  const response = await fetch(`${API_BASE_URL}/discounts/settings`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const updateFreeShippingThreshold = async (freeShippingThreshold) => {
  const response = await fetch(
    `${API_BASE_URL}/discounts/settings/free-shipping`,
    {
      method: "PATCH",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ freeShippingThreshold }),
    }
  );

  return handleResponse(response);
};

export const getAutomationStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/automation/status`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const triggerAutomationFlow = async (flow, payload = {}) => {
  const response = await fetch(`${API_BASE_URL}/automation/trigger/${flow}`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const getAutomationCronPlan = async () => {
  const response = await fetch(`${API_BASE_URL}/automation/cron-plan`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};


export const getEmailAutomationOverview = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/email-automation/overview`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const runEmailAutomationAbandonedCartCheck = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/email-automation/run-abandoned-cart-check`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ limit: 25 }),
  });

  return handleResponse(response);
};

export const getEmailAutomationAbandonedCarts = async ({ status = "all" } = {}) => {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  const queryString = params.toString();
  const response = await fetch(
    queryString
      ? `${API_BASE_URL}/admin/email-automation/abandoned-carts?${queryString}`
      : `${API_BASE_URL}/admin/email-automation/abandoned-carts`,
    { headers: getAdminHeaders() }
  );

  return handleResponse(response);
};


export const getEmailAutomationRecentCartSyncs = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/email-automation/debug/recent-cart-syncs`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};
export const getEmailAutomationLogs = async ({ limit = 50 } = {}) => {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  const response = await fetch(`${API_BASE_URL}/admin/email-automation/email-logs?${params.toString()}`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};
export const getEmailBroadcasts = async () => {
  const response = await fetch(`${API_BASE_URL}/email-broadcasts`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getEmailBroadcast = async (broadcastId) => {
  const response = await fetch(`${API_BASE_URL}/email-broadcasts/${broadcastId}`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const createEmailBroadcast = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/email-broadcasts`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const updateEmailBroadcast = async (broadcastId, payload) => {
  const response = await fetch(`${API_BASE_URL}/email-broadcasts/${broadcastId}`, {
    method: "PATCH",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const deleteEmailBroadcast = async (broadcastId) => {
  const response = await fetch(`${API_BASE_URL}/email-broadcasts/${broadcastId}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const searchEmailBroadcastRecipients = async (query) => {
  const params = new URLSearchParams();
  if (query) params.set("query", query);

  const response = await fetch(
    `${API_BASE_URL}/email-broadcasts/recipients/search?${params.toString()}`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const resolveEmailBroadcastRecipients = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/email-broadcasts/recipients/resolve`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const previewEmailBroadcast = async (broadcastId, payload = {}) => {
  const response = await fetch(
    `${API_BASE_URL}/email-broadcasts/${broadcastId}/preview`,
    {
      method: "POST",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(response);
};

export const sendEmailBroadcast = async (broadcastId, payload = {}) => {
  const response = await fetch(`${API_BASE_URL}/email-broadcasts/${broadcastId}/send`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const sendEmailBroadcastTest = async (broadcastId, payload = {}) => {
  const response = await fetch(`${API_BASE_URL}/email-broadcasts/${broadcastId}/test-send`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const getEmailStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/email/status`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const sendEmailTest = async (payload = {}) => {
  const response = await fetch(`${API_BASE_URL}/email/test`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const getEmailBroadcastRecipients = async (broadcastId) => {
  const response = await fetch(
    `${API_BASE_URL}/email-broadcasts/${broadcastId}/recipients`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const getIntegrationStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/integrations/status`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getConfigStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/settings/status`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getAdminSecuritySettings = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/admin/settings`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getAdminSessions = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/admin/sessions`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const revokeAdminSession = async (sessionId) => {
  const response = await fetch(
    `${API_BASE_URL}/auth/admin/sessions/${sessionId}/revoke`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const revokeOtherAdminSessions = async () => {
  const response = await fetch(
    `${API_BASE_URL}/auth/admin/sessions/revoke-others`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const revokeAllAdminSessions = async () => {
  const response = await fetch(
    `${API_BASE_URL}/auth/admin/sessions/revoke-all`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const requestAdminPasswordChange = async ({ currentPassword }) => {
  const response = await fetch(
    `${API_BASE_URL}/auth/admin/password/request-change`,
    {
      method: "POST",
      headers: getAdminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ currentPassword }),
    }
  );

  return handleResponse(response);
};

export const verifyAdminPasswordCode = async ({ code }) => {
  const response = await fetch(
    `${API_BASE_URL}/auth/admin/password/verify-code`,
    {
      method: "POST",
      headers: getAdminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ code }),
    }
  );

  return handleResponse(response);
};

export const changeAdminPassword = async ({
  code,
  newPassword,
  confirmPassword,
}) => {
  const response = await fetch(`${API_BASE_URL}/auth/admin/password/change`, {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ code, newPassword, confirmPassword }),
  });

  return handleResponse(response);
};

export const getAdminSecurityEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/admin/security-events`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const updateAdminProfile = async ({ fullName }) => {
  const response = await fetch(`${API_BASE_URL}/auth/admin/profile`, {
    method: "PATCH",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ fullName }),
  });

  return handleResponse(response);
};

export const getCustomers = async ({ search = "", page = 1, limit = 50, tag = "", segment = "", status = "", sort = "last_activity_desc" } = {}) => {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (page) params.set("page", page);
  if (limit) params.set("limit", limit);
  if (tag) params.set("tag", tag);
  if (segment) params.set("segment", segment);
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort);

  const queryString = params.toString();
  const response = await fetch(
    queryString ? `${API_BASE_URL}/admin/customers?${queryString}` : `${API_BASE_URL}/admin/customers`,
    { headers: getAdminHeaders() }
  );

  return handleResponse(response);
};

export const getCustomerAnalyticsOverview = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  });
  const queryString = params.toString();
  const response = await fetch(
    queryString ? `${API_BASE_URL}/admin/customers/analytics/overview?${queryString}` : `${API_BASE_URL}/admin/customers/analytics/overview`,
    { headers: getAdminHeaders() }
  );
  return handleResponse(response);
};

export const getCustomerProfile = async (id) => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/${encodeURIComponent(id)}`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const getCustomerOrders = async (email) => {
  const response = await fetch(
    `${API_BASE_URL}/admin/customers/${encodeURIComponent(email)}/orders`,
    { headers: getAdminHeaders() }
  );
  return handleResponse(response);
};

export const getCustomerTags = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/tags`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const createCustomerTag = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/tags`, {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const updateCustomerTags = async (id, payload) => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/${encodeURIComponent(id)}/tags`, {
    method: "PATCH",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const getCustomerSegments = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/segments`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const createCustomerSegment = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/segments`, {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const updateCustomerSegment = async (id, payload) => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/segments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const deleteCustomerSegment = async (id) => {
  const response = await fetch(`${API_BASE_URL}/admin/customers/segments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const exportCustomersCsv = async ({ search = "", tag = "", segment = "", status = "", sort = "last_activity_desc" } = {}) => {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (tag) params.set("tag", tag);
  if (segment) params.set("segment", segment);
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort);

  const queryString = params.toString();
  const response = await fetch(
    queryString ? `${API_BASE_URL}/admin/customers/export?${queryString}` : `${API_BASE_URL}/admin/customers/export`,
    { headers: getAdminHeaders() }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || "Failed to export customers.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return response.blob();
};
export const getWaitlistUsers = async () => {
  const response = await fetch(`${API_BASE_URL}/newsletter`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const deleteWaitlistUser = async (id) => {
  const response = await fetch(`${API_BASE_URL}/newsletter/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getEnquiries = async () => {
  const response = await fetch(`${API_BASE_URL}/contacts`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const markEnquiryAsRead = async (id) => {
  const response = await fetch(`${API_BASE_URL}/contacts/${id}/read`, {
    method: "PATCH",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const deleteEnquiry = async (id) => {
  const response = await fetch(`${API_BASE_URL}/contacts/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

/**
 * Public products.
 * This returns visible, published products from the backend. Stock state is
 * included so out-of-stock products can still support waitlist flows.
 */
export const getProducts = async () => {
  const response = await fetch(`${API_BASE_URL}/products`);

  return handleResponse(response);
};

/**
 * Admin products.
 * This returns all products, including inactive and out-of-stock products.
 */
export const getAdminProducts = async ({ search = "", status = "all" } = {}) => {
  const params = new URLSearchParams();

  params.set("admin", "true");
  if (search) params.set("search", search);
  if (status && status !== "all") params.set("status", status);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/products?${queryString}`;

  const response = await fetch(url, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getProductById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/products/${id}`);

  return handleResponse(response);
};

export const createProduct = async (formData) => {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: formData,
  });

  return handleResponse(response);
};

export const updateProduct = async (id, formData) => {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: formData,
  });

  return handleResponse(response);
};

export const deleteProduct = async (id) => {
  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getProductSalesRecommendations = async ({
  productId,
  limit = 4,
} = {}) => {
  const params = new URLSearchParams();

  if (productId) params.set("productId", productId);
  if (limit) params.set("limit", String(limit));

  const response = await fetch(
    `${API_BASE_URL}/product-sales/recommendations?${params.toString()}`
  );

  return handleResponse(response);
};

export const getCartSalesRecommendations = async ({
  productIds = [],
  limit = 4,
} = {}) => {
  const params = new URLSearchParams();

  if (productIds.length) params.set("productIds", productIds.join(","));
  if (limit) params.set("limit", String(limit));

  const response = await fetch(
    `${API_BASE_URL}/product-sales/cart?${params.toString()}`
  );

  return handleResponse(response);
};

export const getProductSalesPairings = async () => {
  const response = await fetch(`${API_BASE_URL}/product-sales/admin/pairings`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const createProductSalesPairing = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/product-sales/admin/pairings`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const deleteProductSalesPairing = async (pairingId) => {
  const response = await fetch(
    `${API_BASE_URL}/product-sales/admin/pairings/${pairingId}`,
    {
      method: "DELETE",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const getInventoryOverview = async () => {
  const response = await fetch(`${API_BASE_URL}/inventory/overview`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getInventorySummary = async () => {
  const response = await fetch(`${API_BASE_URL}/inventory/summary`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getInventoryProducts = async ({
  search = "",
  status = "all",
} = {}) => {
  const params = new URLSearchParams();

  if (search) params.set("search", search);
  if (status && status !== "all") params.set("status", status);

  const queryString = params.toString();
  const url = queryString
    ? `${API_BASE_URL}/inventory/products?${queryString}`
    : `${API_BASE_URL}/inventory/products`;

  const response = await fetch(url, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getLowStockProducts = async () => {
  const response = await fetch(`${API_BASE_URL}/inventory/low-stock`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getOutOfStockProducts = async () => {
  const response = await fetch(`${API_BASE_URL}/inventory/out-of-stock`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getStockMovements = async ({ productId = "", limit = 50 } = {}) => {
  const params = new URLSearchParams();

  if (productId) params.set("productId", productId);
  if (limit) params.set("limit", String(limit));

  const response = await fetch(
    `${API_BASE_URL}/inventory/movements?${params.toString()}`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const adjustProductStock = async (productId, stockData) => {
  const response = await fetch(
    `${API_BASE_URL}/inventory/products/${productId}/stock`,
    {
      method: "PATCH",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(stockData),
    }
  );

  return handleResponse(response);
};

export const postProductStockAdjustment = async (productId, stockData) => {
  const response = await fetch(
    `${API_BASE_URL}/inventory/products/${productId}/adjust`,
    {
      method: "POST",
      headers: getAdminHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(stockData),
    }
  );

  return handleResponse(response);
};

export const uploadProductsCsv = async (csvText) => {
  const response = await fetch(`${API_BASE_URL}/inventory/bulk/products-csv`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ csvText }),
  });

  return handleResponse(response);
};

export const bulkUpdateProductPrices = async (updates) => {
  const response = await fetch(`${API_BASE_URL}/inventory/bulk/prices`, {
    method: "PATCH",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ updates }),
  });

  return handleResponse(response);
};

export const bulkUpdateInventoryStock = async (updates) => {
  const response = await fetch(`${API_BASE_URL}/inventory/bulk/stock`, {
    method: "PATCH",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ updates }),
  });

  return handleResponse(response);
};

export const getInventoryForecast = async ({ days = 30 } = {}) => {
  const params = new URLSearchParams();
  params.set("days", String(days));

  const response = await fetch(
    `${API_BASE_URL}/inventory/forecast?${params.toString()}`,
    {
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const getPurchaseOrders = async () => {
  const response = await fetch(`${API_BASE_URL}/inventory/purchase-orders`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const createPurchaseOrder = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/inventory/purchase-orders`, {
    method: "POST",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

export const receivePurchaseOrder = async (purchaseOrderId) => {
  const response = await fetch(
    `${API_BASE_URL}/inventory/purchase-orders/${purchaseOrderId}/receive`,
    {
      method: "POST",
      headers: getAdminHeaders(),
    }
  );

  return handleResponse(response);
};

export const createOrder = async (orderData) => {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
  });

  return handleResponse(response);
};

export const getOrders = async () => {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getOrderById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const updateOrderStatus = async (id, statusData) => {
  const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
    method: "PATCH",
    headers: getAdminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(statusData),
  });

  return handleResponse(response);
};

export const deleteOrder = async (id) => {
  const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });

  return handleResponse(response);
};

export const getPublicOrderById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/orders/public/${id}`);

  return handleResponse(response);
};

export const getPublicCurrencyRates = async () => {
  const response = await fetch(`${API_BASE_URL}/currency/rates`);
  return handleResponse(response);
};

export const getAdminCurrencyRates = async () => {
  const response = await fetch(`${API_BASE_URL}/currency/admin/rates`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const updateAdminCurrencyRate = async (code, payload) => {
  const response = await fetch(`${API_BASE_URL}/currency/admin/rates/${code}`, {
    method: "PATCH",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};






export const getAdminAutomations = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/automations`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const getAdminAutomation = async (automationId) => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/${automationId}`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const createAdminAutomation = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/admin/automations`, {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const updateAdminAutomation = async (automationId, payload) => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/${automationId}`, {
    method: "PATCH",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const deleteAdminAutomation = async (automationId) => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/${automationId}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const enableAdminAutomation = async (automationId) => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/${automationId}/enable`, {
    method: "PATCH",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
  });
  return handleResponse(response);
};

export const disableAdminAutomation = async (automationId) => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/${automationId}/disable`, {
    method: "PATCH",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
  });
  return handleResponse(response);
};

export const getAdminAutomationLogs = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${API_BASE_URL}/admin/automations/logs?${query}` : `${API_BASE_URL}/admin/automations/logs`;
  const response = await fetch(url, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const getAdminAutomationTriggerEvents = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const url = query
    ? `${API_BASE_URL}/admin/automations/trigger-events?${query}`
    : `${API_BASE_URL}/admin/automations/trigger-events`;
  const response = await fetch(url, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const getAdminBrowseAbandonments = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const url = query
    ? `${API_BASE_URL}/admin/automations/browse-abandonments?${query}`
    : `${API_BASE_URL}/admin/automations/browse-abandonments`;
  const response = await fetch(url, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const getAdminBrowseAbandonmentOverview = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/browse-abandonments/overview`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const runAdminBrowseAbandonmentCheck = async (payload = {}) => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/browse-abandonments/run`, {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const sendAdminBrowseAbandonmentEmail = async (browseAbandonmentId) => {
  const response = await fetch(
    `${API_BASE_URL}/admin/automations/browse-abandonments/${browseAbandonmentId}/send-email`,
    {
      method: "POST",
      headers: getAdminHeaders({ "Content-Type": "application/json" }),
    }
  );
  return handleResponse(response);
};

export const runDueAdminAutomations = async (payload = {}) => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/run-due`, {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const getAdminAutomationTemplates = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/templates`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const getAdminAutomationSuppressionList = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/suppression-list`, {
    headers: getAdminHeaders(),
  });
  return handleResponse(response);
};

export const addAdminAutomationSuppression = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/admin/automations/suppression-list`, {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};
