function normalizeApiBaseUrl(value) {
  const rawValue = String(value || "http://localhost:5000/api").trim().replace(/\/+$/, "");
  if (!rawValue) return "http://localhost:5000/api";
  return rawValue.endsWith("/api") ? rawValue : `${rawValue}/api`;
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL
);
const SESSION_STORAGE_KEY = "luma_growth_session_id";
const UTM_STORAGE_KEY = "luma_utm_params";
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

function createSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `luma-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getGrowthSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);

    if (existing) {
      return existing;
    }

    const sessionId = createSessionId();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    return createSessionId();
  }
}

export function saveUtmParams(params = {}) {
  const nextParams = UTM_KEYS.reduce((values, key) => {
    const value = params[key];

    if (value) {
      values[key] = value;
    }

    return values;
  }, {});

  if (Object.keys(nextParams).length === 0) return;

  try {
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(nextParams));
  } catch {
    // Attribution should never block shopping.
  }
}

export function getStoredUtmParams() {
  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function withTrackingContext(payload = {}) {
  return {
    sessionId: getGrowthSessionId(),
    utm: payload.utm || getStoredUtmParams(),
    ...payload,
  };
}

async function getResponseData(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function postGrowthEvent(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await getResponseData(response);

  if (!response.ok) {
    const error = new Error(
      data.message || "Customer activity could not be recorded."
    );
    error.status = response.status;
    error.data = data;
    error.endpoint = response.url;
    throw error;
  }

  return data;
}

export function recordAnalyticsEvent(payload) {
  return postGrowthEvent("/events/track", withTrackingContext(payload));
}

export function recordProductView(payload) {
  return postGrowthEvent("/growth/product-views", withTrackingContext(payload));
}

export function saveAbandonedCart(payload) {
  return postGrowthEvent("/cart/sync", withTrackingContext(payload));
}

export function saveCheckoutStart(payload) {
  return postGrowthEvent("/cart/checkout-started", withTrackingContext(payload));
}

export function markAbandonedCartRecovered(payload = {}) {
  return postGrowthEvent(
    "/cart/mark-recovered",
    withTrackingContext(payload)
  );
}

export function createBackInStockRequest(payload) {
  return postGrowthEvent("/growth/back-in-stock", payload);
}


