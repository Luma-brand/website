import { getProducts } from "./api";

const PRODUCT_CACHE_KEY = "luma_product_catalog_v2";
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function readRawCache() {
  try {
    const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.data)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getCachedProducts({ allowStale = true } = {}) {
  if (typeof window === "undefined") return null;
  const cached = readRawCache();
  if (!cached) return null;

  const age = Date.now() - Number(cached.savedAt || 0);
  if (!allowStale && age > CACHE_MAX_AGE_MS) return null;

  return {
    data: cached.data,
    savedAt: cached.savedAt,
    isStale: age > CACHE_MAX_AGE_MS,
  };
}

export function storeProductCache(products) {
  if (typeof window === "undefined" || !Array.isArray(products)) return;

  try {
    localStorage.setItem(
      PRODUCT_CACHE_KEY,
      JSON.stringify({ data: products, savedAt: Date.now() })
    );
  } catch {
    // Cache is a performance enhancement only; never block the shop.
  }
}

export async function refreshProducts() {
  const response = await getProducts();
  const data = Array.isArray(response?.data) ? response.data : [];
  storeProductCache(data);
  return { ...response, data };
}
