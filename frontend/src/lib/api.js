import axios from "axios";

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000/api",
  timeout: 12000,
});

function normalizeApiError(error) {
  const data = error.response?.data;
  const message =
    data?.message ||
    (error.code === "ECONNABORTED"
      ? "The request timed out. Please try again."
      : error.message) ||
    "The request could not be completed.";

  const normalized = new Error(message);
  normalized.status = error.response?.status;
  normalized.data = data;
  normalized.endpoint = error.config?.url;
  return normalized;
}

api.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(normalizeApiError(error)),
);
