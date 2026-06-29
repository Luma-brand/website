const CURRENCY_STORAGE_KEY = "luma_display_currency";
const CURRENCY_RATES_STORAGE_KEY = "luma_currency_rates";

const SYMBOLS = {
  NGN: "\u20a6",
  USD: "$",
  GBP: "\u00a3",
  EUR: "\u20ac",
};

function isAdminRoute() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/luma-control-room");
}

export function getStoredCurrency() {
  if (typeof window === "undefined") return "NGN";
  return localStorage.getItem(CURRENCY_STORAGE_KEY) || "NGN";
}

export function setStoredCurrency(code) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CURRENCY_STORAGE_KEY, String(code || "NGN").toUpperCase());
}

export function setStoredCurrencyRates(rates = []) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CURRENCY_RATES_STORAGE_KEY, JSON.stringify(rates));
}

export function getStoredCurrencyRates() {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(localStorage.getItem(CURRENCY_RATES_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getCurrencyRate(code = "NGN") {
  const normalized = String(code || "NGN").toUpperCase();
  return getStoredCurrencyRates().find((rate) => rate.code === normalized) || {
    code: "NGN",
    symbol: "\u20a6",
    rateToNgn: 1,
    isActive: true,
    isDefault: true,
  };
}

export function convertFromNgn(amount, code = getStoredCurrency()) {
  const rate = getCurrencyRate(code);
  const rateToNgn = Number(rate.rateToNgn || 1);

  if (!Number.isFinite(rateToNgn) || rateToNgn <= 0) {
    return Number(amount || 0);
  }

  return Number(amount || 0) / rateToNgn;
}

export function formatMoney(amount, code = getStoredCurrency()) {
  const normalized = isAdminRoute() ? "NGN" : String(code || "NGN").toUpperCase();
  const value = normalized === "NGN" ? Number(amount || 0) : convertFromNgn(amount, normalized);

  try {
    return new Intl.NumberFormat(normalized === "NGN" ? "en-NG" : "en-US", {
      style: "currency",
      currency: normalized,
      maximumFractionDigits: normalized === "NGN" ? 0 : 2,
    }).format(value);
  } catch {
    return `${SYMBOLS[normalized] || normalized} ${value.toLocaleString()}`;
  }
}

export const formatNaira = (amount) => formatMoney(amount);