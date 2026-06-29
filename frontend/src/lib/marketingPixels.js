const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

let initialized = false;

function appendScript(src, id) {
  if (
    typeof document === "undefined" ||
    !src ||
    document.getElementById(id)
  ) {
    return;
  }

  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function initializeGa4() {
  if (!gaMeasurementId || window.gtag) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  appendScript(
    `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`,
    "ga4"
  );
  window.gtag("js", new Date());
  window.gtag("config", gaMeasurementId, { send_page_view: false });
}

export function initMarketingPixels() {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initializeGa4();
  initialized = true;
}

function getContentIds(payload = {}) {
  if (Array.isArray(payload.content_ids)) return payload.content_ids;
  if (Array.isArray(payload.items)) {
    return payload.items.map((item) => item.item_id || item.id).filter(Boolean);
  }
  if (payload.productId) return [payload.productId];
  return [];
}

function getGaItems(eventName, payload = {}) {
  if (Array.isArray(payload.items)) return payload.items;

  return getContentIds(payload).map((id) => ({
    item_id: id,
    item_name: payload.content_name || payload.name || eventName,
    quantity: payload.quantity || 1,
    price: payload.value || payload.price || 0,
  }));
}

function buildCommonPayload(eventName, payload = {}) {
  const currency = payload.currency || "NGN";
  const value = Number(payload.value || payload.total || payload.price || 0);

  return {
    ...payload,
    currency,
    value,
    content_ids: getContentIds(payload),
    content_type: payload.content_type || "product",
  };
}

function getGaEventName(eventName) {
  const map = {
    PageView: "page_view",
    ViewContent: "view_item",
    AddToCart: "add_to_cart",
    InitiateCheckout: "begin_checkout",
    Purchase: "purchase",
  };

  return map[eventName] || eventName;
}

function trackGa4Event(eventName, payload = {}) {
  if (!window.gtag || !gaMeasurementId) return;

  const commonPayload = buildCommonPayload(eventName, payload);

  if (eventName === "PageView") {
    window.gtag("event", "page_view", {
      page_path: payload.page_path || window.location.pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
    return;
  }

  window.gtag("event", getGaEventName(eventName), {
    currency: commonPayload.currency,
    value: commonPayload.value,
    transaction_id:
      payload.transaction_id || payload.orderId || payload.order_id || undefined,
    items: getGaItems(eventName, commonPayload),
  });
}

export function trackCommerceEvent(eventName, payload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  trackGa4Event(eventName, payload);
}

export function getMarketingIntegrationStatus() {
  return {
    internalAnalytics: true,
    ga4: Boolean(gaMeasurementId),
    externalSocialPixels: false,
  };
}