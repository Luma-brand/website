const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};

const getAdminToken = () => {
  return localStorage.getItem("luma_admin_token");
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
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};

export const getWaitlistUsers = async () => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/newsletter`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};

export const getEnquiries = async () => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/contacts`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};
export const deleteWaitlistUser = async (id) => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/newsletter/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};

export const markEnquiryAsRead = async (id) => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/contacts/${id}/read`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};

export const deleteEnquiry = async (id) => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/contacts/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};

export const getProducts = async () => {
  const response = await fetch(`${API_BASE_URL}/products`);

  return handleResponse(response);
};

export const createProduct = async (formData) => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return handleResponse(response);
};

export const updateProduct = async (id, formData) => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return handleResponse(response);
};

export const deleteProduct = async (id) => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};
export const getProductById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/products/${id}`);

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
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/orders`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};

export const getOrderById = async (id) => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};

export const updateOrderStatus = async (id, statusData) => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(statusData),
  });

  return handleResponse(response);
};

export const deleteOrder = async (id) => {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
};

export const getPublicOrderById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/orders/public/${id}`);

  return handleResponse(response);
};
export const initializePaystackPayment = async (paymentData) => {
  const response = await fetch(`${API_BASE_URL}/payments/paystack/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paymentData),
  });

  return handleResponse(response);
};

export const verifyPaystackPayment = async (reference) => {
  const response = await fetch(
    `${API_BASE_URL}/payments/paystack/verify/${reference}`
  );

  return handleResponse(response);
};