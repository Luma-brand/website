const FALLBACK_API_URL = "http://localhost:5000/api";

function getApiOrigin() {
  const apiUrl = import.meta.env.VITE_API_URL || FALLBACK_API_URL;

  try {
    const url = new URL(apiUrl);
    return url.origin;
  } catch {
    return "";
  }
}

export function getImageUrl(value) {
  if (!value || typeof value !== "string") return "";

  const image = value.trim();
  if (!image) return "";

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:") ||
    image.startsWith("blob:")
  ) {
    return image;
  }

  if (image.startsWith("/assets/")) return image;

  const origin = getApiOrigin();
  if (!origin) return image;

  if (image.startsWith("/")) return `${origin}${image}`;
  return `${origin}/${image}`;
}

export function getProductImage(product) {
  return getImageUrl(product?.image || product?.image_url || "");
}
