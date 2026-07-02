import { absoluteUrl, SITE_NAME, SITE_SHORT_NAME, SITE_URL } from "./siteSeo";

const logoUrl = absoluteUrl("/assets/logos/luma-logo.svg");

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: SITE_SHORT_NAME,
    url: SITE_URL,
    logo: logoUrl,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: SITE_SHORT_NAME,
    url: SITE_URL,
  };
}

export function breadcrumbJsonLd(items = []) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function productsCollectionJsonLd(products = []) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Shop Brow Products | LUMA Skincare",
    url: `${SITE_URL}/products`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.slice(0, 24).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/products/${encodeURIComponent(product.slug || product.id)}`,
        name: product.name,
      })),
    },
  };
}

export function productJsonLd(product, { canonicalUrl, unavailable = false } = {}) {
  const price = Number(product?.priceValue || product?.price || 0);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product?.name,
    description: product?.meta_description || product?.description,
    image: product?.image ? [absoluteUrl(product.image)] : undefined,
    sku: product?.sku || product?.id,
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: product?.currency || "NGN",
      price: Number.isFinite(price) ? price : undefined,
      availability: unavailable
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

export function faqJsonLd(faqs = []) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
