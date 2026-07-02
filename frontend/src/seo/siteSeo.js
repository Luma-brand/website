export const SITE_URL = "https://shopwithluma.com";
export const SITE_NAME = "LUMA Skincare";
export const SITE_SHORT_NAME = "LUMA";
export const DEFAULT_OG_IMAGE = "/assets/images/hero-closeup.jpg";

export const DEFAULT_SEO = {
  title: "LUMA Skincare | Brow Products for Effortless Beauty",
  description:
    "Shop LUMA Skincare for premium brow products designed for soft, natural, polished, everyday beauty.",
  canonical: `${SITE_URL}/`,
  robots: "index, follow, max-image-preview:large",
  ogType: "website",
  image: DEFAULT_OG_IMAGE,
};

export const NOINDEX_ROBOTS = "noindex, nofollow, noarchive";

export function createCanonical(pathname = "/") {
  const cleanPath = pathname === "/" ? "/" : `/${String(pathname).replace(/^\/+/, "")}`;
  return `${SITE_URL}${cleanPath}`;
}

export function absoluteUrl(value = DEFAULT_OG_IMAGE) {
  if (!value) return `${SITE_URL}${DEFAULT_OG_IMAGE}`;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${SITE_URL}${value}`;
  return `${SITE_URL}/${value}`;
}

export function cleanDescription(value, fallback = DEFAULT_SEO.description) {
  const text = String(value || fallback).replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157).trim()}...` : text;
}
