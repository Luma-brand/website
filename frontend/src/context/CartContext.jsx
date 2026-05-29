import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);

const CART_STORAGE_KEY = "luma_cart";
const ORDERS_STORAGE_KEY = "luma_orders";

function getStoredCart() {
  try {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    return storedCart ? JSON.parse(storedCart) : [];
  } catch {
    return [];
  }
}

function getStoredOrders() {
  try {
    const storedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
    return storedOrders ? JSON.parse(storedOrders) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(getStoredCart);
  const [orders, setOrders] = useState(getStoredOrders);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  function addToCart(product) {
    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.name === product.name);

      if (existingItem) {
        return currentItems.map((item) =>
          item.name === product.name
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...currentItems,
        {
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          price: product.numericPrice || 0,
          image: product.image,
          quantity: 1,
        },
      ];
    });
  }

  function removeFromCart(productName) {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.name !== productName)
    );
  }

  function increaseQuantity(productName) {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.name === productName
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  function decreaseQuantity(productName) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.name === productName
            ? { ...item, quantity: Math.max(item.quantity - 1, 0) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  function createOrder({ customer, paymentMethod, subtotal, delivery, total }) {
    const newOrder = {
      id: `LUMA-${Date.now()}`,
      customer,
      paymentMethod,
      items: cartItems,
      subtotal,
      delivery,
      total,
      status: "Received",
      createdAt: new Date().toISOString(),
    };

    setOrders((currentOrders) => [newOrder, ...currentOrders]);
    return newOrder;
  }

  function clearOrders() {
    setOrders([]);
  }

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const subtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const value = useMemo(
    () => ({
      cartItems,
      cartCount,
      subtotal,
      orders,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      clearCart,
      createOrder,
      clearOrders,
    }),
    [cartItems, cartCount, subtotal, orders]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}