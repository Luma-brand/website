const crypto = require("crypto");

const PAYSTACK_API_BASE = "https://api.paystack.co";

function getSecretKey() {
  const key = String(process.env.PAYSTACK_SECRET_KEY || "").trim();

  if (!key) {
    const error = new Error("Paystack is not configured yet.");
    error.statusCode = 503;
    error.code = "PAYSTACK_NOT_CONFIGURED";
    throw error;
  }

  return key;
}

async function paystackRequest(path, options = {}) {
  const response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.status === false) {
    const error = new Error(data.message || "Paystack could not complete the request.");
    error.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
    error.code = "PAYSTACK_API_ERROR";
    error.data = data;
    throw error;
  }

  return data;
}

async function initializeTransaction(payload) {
  return paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function verifyTransaction(reference) {
  if (!reference) {
    const error = new Error("Payment reference is required.");
    error.statusCode = 400;
    error.code = "PAYMENT_REFERENCE_REQUIRED";
    throw error;
  }

  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  });
}

function isValidWebhook(rawBody, headers = {}) {
  const signature = String(headers["x-paystack-signature"] || "").trim();
  if (!signature) return false;

  let secret;
  try {
    secret = getSecretKey();
  } catch {
    return false;
  }

  const payload = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || {});
  const hash = crypto.createHmac("sha512", secret).update(payload).digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const hashBuffer = Buffer.from(hash);
  return signatureBuffer.length === hashBuffer.length && crypto.timingSafeEqual(signatureBuffer, hashBuffer);
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  isValidWebhook,
};
