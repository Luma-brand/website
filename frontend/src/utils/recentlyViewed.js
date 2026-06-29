const RECENTLY_VIEWED_KEY = "luma_recently_viewed_products";
const MAX_RECENT_PRODUCTS = 8;

export function getRecentlyViewedProducts() {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveRecentlyViewedProduct(product) {
  if (!product?.id) return [];

  const snapshot = {
    id: product.id,
    slug: product.slug || product.id,
    name: product.name,
    size: product.size || "",
    price: product.priceValue ?? product.price ?? 0,
    priceValue: Number(product.priceValue ?? product.price ?? 0),
    image: product.image || product.image_url || "",
    image_url: product.image || product.image_url || "",
    stock_quantity: product.stock_quantity ?? product.stockQuantity ?? 0,
    stockQuantity: product.stock_quantity ?? product.stockQuantity ?? 0,
    stock_status: product.stock_status || product.stockStatus || "in_stock",
    is_active: product.is_active !== false,
    status: product.status || "active",
    can_purchase: product.can_purchase !== false,
  };

  const nextProducts = [
    snapshot,
    ...getRecentlyViewedProducts().filter((item) => item.id !== product.id),
  ].slice(0, MAX_RECENT_PRODUCTS);

  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(nextProducts));

  return nextProducts;
}
