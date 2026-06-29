function normalizeApiBaseUrl(value) {
  const rawValue = String(value || "").trim() || "http://localhost:5000/api";
  const withoutTrailingSlash = rawValue.replace(/\/+$/, "");

  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL
);

const CUSTOMER_TOKEN_KEY = "luma_customer_token";

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

function getFriendlyAuthMessage(response, data) {
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
      : "The account service is not available right now.";
  }

  if (response.status >= 500) {
    return "The server encountered an error. Please try again.";
  }

  return "The request could not be completed.";
}

async function handleResponse(response) {
  const data = await getResponseData(response);

  if (!response.ok) {
    const error = new Error(getFriendlyAuthMessage(response, data));
    error.status = response.status;
    error.data = data;
    error.endpoint = response.url;
    throw error;
  }

  return data;
}

function getAuthHeaders(token, extraHeaders = {}) {
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}

export function getStoredCustomerToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function storeCustomerToken(token) {
  if (token) {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  }
}

export function clearStoredCustomerToken() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

export async function registerCustomer(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/customer/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function loginCustomer(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/customer/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function loginCustomerWithGoogle(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/customer/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function getCustomerMe(token) {
  const response = await fetch(`${API_BASE_URL}/auth/customer/me`, {
    headers: getAuthHeaders(token),
  });

  return handleResponse(response);
}

export async function updateCustomerProfile(payload, token) {
  const response = await fetch(`${API_BASE_URL}/auth/customer/me`, {
    method: "PATCH",
    headers: getAuthHeaders(token, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function completeCustomerProfile(payload, token) {
  const response = await fetch(`${API_BASE_URL}/auth/customer/complete-profile`, {
    method: "POST",
    headers: getAuthHeaders(token, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function logoutCustomer(token) {
  if (!token) {
    return { success: true };
  }

  const response = await fetch(`${API_BASE_URL}/auth/customer/logout`, {
    method: "POST",
    headers: getAuthHeaders(token),
  });

  return handleResponse(response);
}

export async function requestPasswordReset(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/customer/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function verifyResetCode(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/customer/verify-reset-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function resetCustomerPassword(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/customer/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function getCustomerCart(token) {
  const response = await fetch(`${API_BASE_URL}/customer-cart/me`, {
    headers: getAuthHeaders(token),
  });

  return handleResponse(response);
}

export async function syncCustomerCart(payload, token) {
  const response = await fetch(`${API_BASE_URL}/customer-cart/sync`, {
    method: "POST",
    headers: getAuthHeaders(token, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function clearCustomerCart(token) {
  const response = await fetch(`${API_BASE_URL}/customer-cart/me`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
  });

  return handleResponse(response);
}
