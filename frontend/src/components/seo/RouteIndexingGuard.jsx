import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DEFAULT_SEO, NOINDEX_ROBOTS } from "../../seo/siteSeo";

const INDEXABLE_STATIC_PATHS = new Set([
  "/",
  "/products",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms-and-conditions",
]);

function isIndexablePath(pathname) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (INDEXABLE_STATIC_PATHS.has(normalized)) return true;
  return /^\/products\/[^/]+$/.test(normalized);
}

function upsertRobotsMeta(name, content) {
  let element = document.head.querySelector(`meta[name="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

export function RouteIndexingGuard() {
  const { pathname } = useLocation();

  useEffect(() => {
    const indexable = isIndexablePath(pathname);
    const directive = indexable
      ? DEFAULT_SEO.robots
      : NOINDEX_ROBOTS;

    upsertRobotsMeta("robots", directive);
    upsertRobotsMeta("googlebot", directive);

    if (!indexable) {
      document.head.querySelector('link[rel="canonical"]')?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
    }
  }, [pathname]);

  return null;
}
