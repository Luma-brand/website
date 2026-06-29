const pool = require("../config/db");

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://shopwithluma.com";

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function productPath(product) {
  return `/products/${product.slug || product.id}`;
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
  const staticPaths = ["/", "/products", "/about", "/contact"];
  const products = await getPublicProductsForSeo();
  const urls = [
    ...staticPaths.map((path) => ({
      loc: `${FRONTEND_URL}${path}`,
      lastmod: null,
    })),
    ...products.map((product) => ({
      loc: `${FRONTEND_URL}${productPath(product)}`,
      lastmod: product.updated_at,
    })),
  ];

  const entries = urls
    .map((item) => {
      const lastmod = item.lastmod
        ? `\n    <lastmod>${new Date(item.lastmod).toISOString()}</lastmod>`
        : "";

      return `  <url>\n    <loc>${escapeXml(item.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function buildRobotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /luma-control-room/",
    "Disallow: /admin/",
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
