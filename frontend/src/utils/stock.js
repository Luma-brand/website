export const DEFAULT_LOW_STOCK_THRESHOLD = 20;

export function isOutOfStock(product) {
  return Number(product?.stock_quantity || 0) <= 0;
}

export function isProductUnavailable(product) {
  return (
    product?.is_active === false ||
    product?.is_available === false ||
    product?.can_purchase === false ||
    isOutOfStock(product)
  );
}

export function isLowStock(product) {
  const stockQuantity = Number(product?.stock_quantity || 0);
  const threshold = Number(
    product?.low_stock_threshold || DEFAULT_LOW_STOCK_THRESHOLD
  );

  return stockQuantity > 0 && stockQuantity <= threshold;
}

export function getStockMessage(product) {
  if (product?.is_active === false || product?.is_available === false) {
    return "This product is currently unavailable.";
  }

  if (isOutOfStock(product)) {
    return "This product is currently out of stock.";
  }

  if (isLowStock(product)) {
    return `Only ${Number(product?.stock_quantity || 0)} left.`;
  }

  return `${Number(product?.stock_quantity || 0)} in stock.`;
}
