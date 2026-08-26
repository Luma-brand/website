import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, "..");
const publicDirectory = path.join(frontendDirectory, "public");
const defaultSiteUrl = "https://shopwithluma.com";
const defaultApiUrl = "https://website-ikv5.onrender.com/api";
const fallbackProductIdentifiers = ["lamifix", "hybrid-stain"];

async function loadLocalEnv() {
  try {
    const contents = await fs.readFile(path.join(frontendDirectory, ".env"), "utf8");

    contents.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separator = trimmed.indexOf("=");
      if (separator < 1) return;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) process.env[key] = value;
    });
  } catch {
    // A local .env file is optional in CI and production builds.
  }
}

function normalizeSiteUrl(value) {
  try {
    const url = new URL(String(value || defaultSiteUrl));
    const isLocal = ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);

    if (url.protocol !== "https:" || isLocal) return defaultSiteUrl;
    return url.origin.replace(/\/+$/, "");
  } catch {
    return defaultSiteUrl;
  }
}

function normalizeApiUrl(value) {
  const normalized = String(value || defaultApiUrl).trim().replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toDate(value, fallback) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : fallback;
}

function getProductsFromResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.data?.products)) return payload.data.products;
  return [];
}

async function fetchPublicProducts(apiUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const response = await fetch(`${apiUrl}/products`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Product API returned HTTP ${response.status}`);
    }

    return getProductsFromResponse(await response.json()).filter((product) => {
      const status = String(product?.status || "active").toLowerCase();
      return product?.is_active !== false && product?.isActive !== false && status === "active";
    });
  } finally {
    clearTimeout(timeout);
  }
}

function createUrl(siteUrl, pathname) {
  const cleanPath = pathname === "/" ? "/" : `/${String(pathname).replace(/^\/+|\/+$/g, "")}`;
  return `${siteUrl}${cleanPath}`;
}

function renderSitemap(entries) {
  const urls = entries.map((entry) => [
    "  <url>",
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    entry.lastmod ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "",
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    "  </url>",
  ].filter(Boolean).join("\n"));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

function renderRobots(siteUrl) {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /api/",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /luma-control-room",
    "Disallow: /luma-control-room/",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /order-success",
    "Disallow: /payment/",
    "Disallow: /account",
    "Disallow: /complete-profile",
    "Disallow: /settings",
    "Disallow: /wishlist",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /signup",
    "Disallow: /forgot-password",
    "Disallow: /reset-password",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}

await loadLocalEnv();

const siteUrl = normalizeSiteUrl(
  process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.VITE_SITE_URL
);
const configuredApiUrl = normalizeApiUrl(
  process.env.SITEMAP_API_URL ||
    process.env.API_URL ||
    process.env.BACKEND_URL ||
    process.env.VITE_API_URL ||
    process.env.VITE_API_BASE_URL
);
const apiCandidates = Array.from(
  new Set([configuredApiUrl, normalizeApiUrl(defaultApiUrl)])
);
const buildDate = new Date().toISOString().slice(0, 10);

const entries = [
  { path: "/", lastmod: buildDate, changefreq: "weekly", priority: "1.0" },
  { path: "/products", lastmod: buildDate, changefreq: "daily", priority: "0.9" },
  { path: "/about", lastmod: buildDate, changefreq: "monthly", priority: "0.7" },
  { path: "/contact", lastmod: buildDate, changefreq: "monthly", priority: "0.6" },
  { path: "/privacy-policy", lastmod: "2026-06-01", changefreq: "yearly", priority: "0.4" },
  { path: "/terms-and-conditions", lastmod: "2026-06-01", changefreq: "yearly", priority: "0.4" },
].map((entry) => ({ ...entry, loc: createUrl(siteUrl, entry.path) }));

let productCount = 0;
const seenProductPaths = new Set();

function appendProductEntry(identifier, lastmod = buildDate) {
  const value = String(identifier || "").trim();
  if (!value) return;

  const pathName = `/products/${encodeURIComponent(value)}`;
  if (seenProductPaths.has(pathName)) return;
  seenProductPaths.add(pathName);

  entries.push({
    path: pathName,
    loc: createUrl(siteUrl, pathName),
    lastmod,
    changefreq: "weekly",
    priority: "0.8",
  });
  productCount += 1;
}

try {
  let products;
  let lastError;

  for (const apiUrl of apiCandidates) {
    try {
      products = await fetchPublicProducts(apiUrl);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!products) throw lastError || new Error("No public product API was available");
  for (const product of products) {
    const identifier = String(product.slug || product.id || "").trim();
    appendProductEntry(
      identifier,
      toDate(
        product.updated_at || product.updatedAt || product.seo_updated_at || product.created_at,
        buildDate
      )
    );
  }
} catch (error) {
  fallbackProductIdentifiers.forEach((identifier) => appendProductEntry(identifier));
  console.warn(`[sitemap] Product fetch failed; used verified product fallbacks: ${error.message}`);
}

const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.loc, entry])).values());

await fs.mkdir(publicDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(publicDirectory, "sitemap.xml"), renderSitemap(uniqueEntries), "utf8"),
  fs.writeFile(path.join(publicDirectory, "robots.txt"), renderRobots(siteUrl), "utf8"),
]);

console.log(
  `[sitemap] Generated ${uniqueEntries.length} URLs (${productCount} products) for ${siteUrl}`
);
