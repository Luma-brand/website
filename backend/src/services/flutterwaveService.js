const crypto = require("crypto");

const FLUTTERWAVE_API_URL = "https://api.flutterwave.com/v3";

function configurationError() {
  const error = new Error("Flutterwave is not configured on the server.");
  error.statusCode = 503;
  error.code = "FLUTTERWAVE_NOT_CONFIGURED";
  return error;
}

function assertFlutterwaveEnabled() {
  if (String(process.env.FLUTTERWAVE_ENABLED || "true").toLowerCase() === "false") {
    throw configurationError();
  }
  if (!process.env.FLUTTERWAVE_SECRET_KEY) throw configurationError();
}

async function flutterwaveRequest(path, options = {}) {
  assertFlutterwaveEnabled();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.FLUTTERWAVE_TIMEOUT_MS || 20000));
  try {
    const response = await fetch(`${FLUTTERWAVE_API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === "error") {
      const error = new Error(data.message || "Flutterwave could not process the request.");
      error.statusCode = response.status >= 500 ? 502 : 400;
      error.code = "FLUTTERWAVE_API_ERROR";
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Flutterwave timed out. Please try again.");
      timeoutError.statusCode = 504;
      timeoutError.code = "FLUTTERWAVE_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function initializePayment(payload) {
  const result = await flutterwaveRequest("/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.data?.link) {
    const error = new Error("Flutterwave did not return a checkout link.");
    error.statusCode = 502;
    error.code = "FLUTTERWAVE_CHECKOUT_LINK_MISSING";
    throw error;
  }
  return result;
}

async function verifyTransaction(transactionId) {
  if (!transactionId) {
    const error = new Error("Flutterwave transaction ID is required.");
    error.statusCode = 400;
    error.code = "TRANSACTION_ID_REQUIRED";
    throw error;
  }
  return flutterwaveRequest(`/transactions/${encodeURIComponent(transactionId)}/verify`, { method: "GET" });
}

function isValidWebhook(rawBody, headers = {}) {
  const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  if (!secret) return false;
  const legacyHash = headers["verif-hash"];
  if (legacyHash) {
    const left = Buffer.from(String(legacyHash));
    const right = Buffer.from(String(secret));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }
  const signature = headers["flutterwave-signature"];
  if (!signature || !rawBody) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const left = Buffer.from(String(signature));
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = { initializePayment, verifyTransaction, isValidWebhook };
