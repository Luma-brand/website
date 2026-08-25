function normalizeApiBaseUrl(value) {
  const rawValue = String(value || "http://localhost:5000/api")
    .trim()
    .replace(/\/+$/, "");
  if (!rawValue) return "http://localhost:5000/api";
  return rawValue.endsWith("/api") ? rawValue : `${rawValue}/api`;
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL
);

function getCustomerHeaders(extraHeaders = {}) {
  const token = localStorage.getItem("luma_customer_token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

async function handleResponse(response) {
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error(
      data.message ||
        (response.status === 401
          ? "Your session has expired. Please sign in again."
          : "Payment could not be completed.")
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function initializePaystackPayment(paymentData) {
  const response = await fetch(`${API_BASE_URL}/payments/paystack/initialize`, {
    method: "POST",
    headers: getCustomerHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(paymentData),
  });

  return handleResponse(response);
}

export async function verifyPaystackPayment(reference) {
  const response = await fetch(`${API_BASE_URL}/payments/paystack/verify`, {
    method: "POST",
    headers: getCustomerHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reference }),
  });

  return handleResponse(response);
}
