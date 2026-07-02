const pool = require("../config/db");

const FRONTEND_URL = String(
  process.env.FRONTEND_URL || "https://shopwithluma.com"
).replace(/\/+$/, "");

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function productPath(product) {
  return `/products/${encodeURIComponent(product.slug || product.id)}`;
}

function sitemapDate(value, fallback) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : fallback;
}

async function getPublicProductsForSeo() {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          name,
          description,
          price,
          size,
          image_url,
          stock_quantity,
          slug,
          updated_at
        FROM products
        WHERE COALESCE(is_active, TRUE) = TRUE
          AND status = 'active'
        ORDER BY updated_at DESC
      `
    );

    return result.rows;
  } catch (error) {
    if (error.code !== "42703") {
      throw error;
    }

    const result = await pool.query(
      `
        SELECT
          id,
          name,
          description,
          price,
          size,
          image_url,
          stock_quantity,
          NULL AS slug,
          updated_at
        FROM products
        WHERE COALESCE(is_active, TRUE) = TRUE
          AND status = 'active'
        ORDER BY updated_at DESC
      `
    );

    return result.rows;
  }
}

async function buildSitemapXml() {
  const buildDate = new Date().toISOString().slice(0, 10);
  const staticPaths = [
    { path: "/", lastmod: buildDate, changefreq: "weekly", priority: "1.0" },
    { path: "/products", lastmod: buildDate, changefreq: "daily", priority: "0.9" },
    { path: "/about", lastmod: buildDate, changefreq: "monthly", priority: "0.7" },
    { path: "/contact", lastmod: buildDate, changefreq: "monthly", priority: "0.6" },
    { path: "/privacy-policy", lastmod: "2026-06-01", changefreq: "yearly", priority: "0.4" },
    { path: "/terms-and-conditions", lastmod: "2026-06-01", changefreq: "yearly", priority: "0.4" },
  ];
  const products = await getPublicProductsForSeo();
  const urls = [
    ...staticPaths.map((item) => ({
      loc: `${FRONTEND_URL}${item.path}`,
      lastmod: item.lastmod,
      changefreq: item.changefreq,
      priority: item.priority,
    })),
    ...products.map((product) => ({
      loc: `${FRONTEND_URL}${productPath(product)}`,
      lastmod: product.updated_at,
      changefreq: "weekly",
      priority: "0.8",
    })),
  ];

  const entries = urls
    .map((item) => {
      const lastmod = sitemapDate(item.lastmod, buildDate);

      return `  <url>\n    <loc>${escapeXml(item.loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${item.changefreq}</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function buildRobotsTxt() {
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
    `Sitemap: ${FRONTEND_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

async function buildGoogleMerchantFeedXml() {
  const products = await getPublicProductsForSeo();

  const entries = products
    .map((product) => {
      const availability =
        Number(product.stock_quantity || 0) > 0 ? "in stock" : "out of stock";
      const link = `${FRONTEND_URL}${productPath(product)}`;

      return [
        "  <item>",
        `    <g:id>${escapeXml(product.id)}</g:id>`,
        `    <g:title>${escapeXml(product.name)}</g:title>`,
        `    <g:description>${escapeXml(
          product.description || product.name
        )}</g:description>`,
        `    <g:link>${escapeXml(link)}</g:link>`,
        product.image_url
          ? `    <g:image_link>${escapeXml(product.image_url)}</g:image_link>`
          : "",
        `    <g:availability>${availability}</g:availability>`,
        `    <g:price>${Number(product.price || 0).toFixed(2)} NGN</g:price>`,
        "    <g:condition>new</g:condition>",
        "  </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n  <title>LUMA Skincare Products</title>\n  <link>${escapeXml(
    FRONTEND_URL
  )}</link>\n  <description>LUMA Skincare product feed</description>\n${entries}\n</channel>\n</rss>\n`;
}

module.exports = {
  buildGoogleMerchantFeedXml,
  buildRobotsTxt,
  buildSitemapXml,
};
