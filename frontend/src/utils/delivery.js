export const DEFAULT_DELIVERY_FEE = 3000;

export function getDeliveryFee(cartItems = [], deliveryQuote = null) {
  if (cartItems.length === 0) {
    return 0;
  }

  return Number(deliveryQuote?.deliveryFee ?? DEFAULT_DELIVERY_FEE);
}
