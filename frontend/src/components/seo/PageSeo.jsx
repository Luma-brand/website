import { useEffect } from "react";

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

export function PageSeo({ title, description, canonical, jsonLd }) {
  useEffect(() => {
    const nextTitle = title || "LUMA Skincare";
    const nextDescription =
      description ||
      "Shop LUMA Skincare beauty essentials for refined everyday rituals.";

    document.title = nextTitle;

    upsertMeta('meta[name="description"]', {
      name: "description",
      content: nextDescription,
    });
    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: nextTitle,
    });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: nextDescription,
    });

    if (canonical) {
      upsertCanonical(canonical);
      upsertMeta('meta[property="og:url"]', {
        property: "og:url",
        content: canonical,
      });
    }

    let script;

    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      if (script) {
        script.remove();
      }
    };
  }, [canonical, description, jsonLd, title]);

  return null;
}
