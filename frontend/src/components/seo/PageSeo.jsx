import { useEffect } from "react";
import {
  absoluteUrl,
  cleanDescription,
  DEFAULT_SEO,
  SITE_NAME,
} from "../../seo/siteSeo";

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function upsertCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

function upsertLink(selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function removeManagedJsonLd() {
  document.head
    .querySelectorAll('script[type="application/ld+json"][data-luma-seo="true"]')
    .forEach((element) => element.remove());
}

export function PageSeo({
  title,
  description,
  canonical,
  robots = DEFAULT_SEO.robots,
  ogTitle,
  ogDescription,
  ogImage,
  ogUrl,
  ogType = DEFAULT_SEO.ogType,
  twitterCard = "summary_large_image",
  twitterTitle,
  twitterDescription,
  twitterImage,
  jsonLd,
  structuredData,
}) {
  useEffect(() => {
    const nextTitle = title || DEFAULT_SEO.title;
    const nextDescription = cleanDescription(description);
    const nextImage = absoluteUrl(ogImage || twitterImage || DEFAULT_SEO.image);
    const nextCanonical = canonical || DEFAULT_SEO.canonical;
    const nextOgUrl = ogUrl || nextCanonical;

    document.title = nextTitle;

    upsertMeta('meta[name="description"]', {
      name: "description",
      content: nextDescription,
    });
    upsertMeta('meta[name="author"]', {
      name: "author",
      content: SITE_NAME,
    });
    upsertMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: SITE_NAME,
    });
    upsertMeta('meta[property="og:type"]', {
      property: "og:type",
      content: ogType,
    });
    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: ogTitle || nextTitle,
    });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: cleanDescription(ogDescription || nextDescription),
    });
    upsertMeta('meta[property="og:image"]', {
      property: "og:image",
      content: nextImage,
    });
    upsertMeta('meta[property="og:url"]', {
      property: "og:url",
      content: nextOgUrl,
    });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: robots,
    });
    upsertMeta('meta[name="googlebot"]', {
      name: "googlebot",
      content: robots,
    });
    upsertMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: twitterCard,
    });
    upsertMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: twitterTitle || ogTitle || nextTitle,
    });
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: cleanDescription(twitterDescription || ogDescription || nextDescription),
    });
    upsertMeta('meta[name="twitter:image"]', {
      name: "twitter:image",
      content: absoluteUrl(twitterImage || ogImage || DEFAULT_SEO.image),
    });

    upsertCanonical(nextCanonical);
    upsertLink('link[rel="alternate"][hreflang="en"]', {
      rel: "alternate",
      hreflang: "en",
      href: nextCanonical,
    });

    removeManagedJsonLd();

    const jsonLdBlocks = [
      ...(Array.isArray(structuredData) ? structuredData : structuredData ? [structuredData] : []),
      ...(Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []),
    ].filter(Boolean);

    jsonLdBlocks.forEach((block) => {
      if (!block) return;
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.lumaSeo = "true";
      script.text = JSON.stringify(block);
      document.head.appendChild(script);
    });

    return () => {
      removeManagedJsonLd();
    };
  }, [
    canonical,
    description,
    jsonLd,
    ogDescription,
    ogImage,
    ogTitle,
    ogType,
    ogUrl,
    robots,
    structuredData,
    title,
    twitterCard,
    twitterDescription,
    twitterImage,
    twitterTitle,
  ]);

  return null;
}
