import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { syncCustomerCart } from "../services/authApi";
import { recordAnalyticsEvent, saveAbandonedCart } from "../services/growthApi";
import { getProductImage } from "../utils/images";

const CartContext = createContext(null);

const CART_STORAGE_KEY = "luma_cart";

function getStoredCart() {
  try {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    return storedCart ? JSON.parse(storedCart) : [];
  } catch {
    return [];
  }
}

function getProductStock(product) {
  const stockQuantity = Number(product.stock_quantity ?? product.stockQuantity ?? 0);
  return Number.isFinite(stockQuantity) ? stockQuantity : 0;
}

function isProductAvailable(product) {
  const isActive = product.is_active !== false;
  const canPurchase = product.can_purchase !== false;
  const isAvailable = product.is_available !== false;
  const stockQuantity = getProductStock(product);

  return isActive && canPurchase && isAvailable && stockQuantity > 0;
}

function normalizeCartItem(product) {
  const stockQuantity = getProductStock(product);

  return {
    id: product.id,
    slug: product.slug || product.id,
    name: product.name,
    size: product.size || "",
    price: Number(product.priceValue ?? product.price ?? 0),
    image: getProductImage(product),
    quantity: 1,
    stockQuantity,
    stockStatus: product.stock_status || product.stockStatus || "in_stock",
    isActive: product.is_active !== false,
  };
}

function trackAddToCart(product, user) {
  const value = Number(product.priceValue ?? product.price ?? 0);


  void recordAnalyticsEvent({
    eventType: "add_to_cart",
    productId: product.id,
    customerId: user?.id || null,
    customerEmail: user?.email || null,
    value,
    metadata: {
      name: product.name,
      quantity: 1,
    },
  }).catch(() => {});
}

export function CartProvider({ children }) {
  const { session, user } = useAuth();
  const [cartItems, setCartItems] = useState(getStoredCart);
  const syncedTokenRef = useRef("");
  const cartItemsRef = useRef(cartItems);

  useEffect(() => {
    cartItemsRef.current = cartItems;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (!session?.token || syncedTokenRef.current === session.token) return;

    syncedTokenRef.current = session.token;

    void syncCustomerCart({ cartItems: cartItemsRef.current }, session.token)
      .then((response) => {
        const syncedItems = response.data?.cartItems;

        if (Array.isArray(syncedItems)) {
          setCartItems(syncedItems);
        }
      })
      .catch((error) => {
        console.warn("Customer cart sync failed:", error.message);
      });
  }, [session?.token]);

  const addToCart = useCallback((product) => {
    if (!product?.id) {
      return {
        success: false,
        message: "Product is invalid.",
      };
    }

    if (!isProductAvailable(product)) {
      return {
        success: false,
        message: "This product is currently unavailable.",
      };
    }

    const stockQuantity = getProductStock(product);
    const existingItem = cartItems.find((item) => item.id === product.id);

    if (existingItem?.quantity >= stockQuantity) {
      return {
        success: false,
        message: `${product.name} has only ${stockQuantity} item(s) available.`,
      };
    }

    setCartItems((currentItems) => {
      if (existingItem) {
        return currentItems.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                stockQuantity,
                stockStatus: product.stock_status || item.stockStatus,
                isActive: product.is_active !== false,
              }
            : item
        );
      }

      return [...currentItems, normalizeCartItem(product)];
    });

    trackAddToCart(product, user);

    return {
      success: true,
      message: "Product added to cart.",
    };
  }, [cartItems, user]);

  const removeFromCart = useCallback((productId) => {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.id !== productId)
    );
  }, []);

  const increaseQuantity = useCallback((productId) => {
    const currentItem = cartItems.find((item) => item.id === productId);
    const stockQuantity = Number(
      currentItem?.stockQuantity ?? currentItem?.stock_quantity ?? 0
    );

    if (!currentItem) {
      return {
        success: false,
        message: "Product is not in your cart.",
      };
    }

    if (currentItem.isActive === false || stockQuantity <= 0) {
      return {
        success: false,
        message: `${currentItem.name} is currently unavailable.`,
      };
    }

    if (currentItem.quantity >= stockQuantity) {
      return {
        success: false,
        message: `${currentItem.name} has only ${stockQuantity} item(s) available.`,
      };
    }

    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );

    return {
      success: true,
      message: "Quantity updated.",
    };
  }, [cartItems]);

  const decreaseQuantity = useCallback((productId) => {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(item.quantity - 1, 0) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const updateCartItemStock = useCallback((productId, stockQuantity) => {
    setCartItems((currentItems) =>
      currentItems
        .map((item) => {
          if (item.id !== productId) {
            return item;
          }

          const nextStock = Number(stockQuantity || 0);

          return {
            ...item,
            stockQuantity: nextStock,
            quantity: Math.min(item.quantity, nextStock),
          };
        })
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const validateCartStock = useCallback(() => {
    const issues = [];

    for (const item of cartItems) {
      const stockQuantity = Number(item.stockQuantity ?? 0);

      if (item.isActive === false) {
        issues.push({
          productId: item.id,
          productName: item.name,
          message: `${item.name} is currently unavailable.`,
        });

        continue;
      }

      if (stockQuantity <= 0) {
        issues.push({
          productId: item.id,
          productName: item.name,
          message: `${item.name} is out of stock.`,
        });

        continue;
      }

      if (item.quantity > stockQuantity) {
        issues.push({
          productId: item.id,
          productName: item.name,
          availableStock: stockQuantity,
          requestedQuantity: item.quantity,
          message: `${item.name} has only ${stockQuantity} item(s) available.`,
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }, [cartItems]);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const subtotal = cartItems.reduce(
    (total, item) => total + Number(item.price || 0) * item.quantity,
    0
  );

  const cartFingerprint = useMemo(
    () =>
      cartItems
        .map((item) => `${item.id}:${item.quantity}:${item.price}`)
        .join("|"),
    [cartItems]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveAbandonedCart({
        customerId: user?.id,
        customerEmail: user?.email,
        customerPhone: user?.phone || user?.customer_phone,
        whatsappNumber: user?.whatsapp_e164 || user?.whatsapp_number,
        cartItems,
        totalValue: subtotal,
      }).catch(() => {});
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    cartFingerprint,
    cartItems,
    subtotal,
    user?.customer_phone,
    user?.email,
    user?.id,
    user?.phone,
    user?.whatsapp_e164,
    user?.whatsapp_number,
  ]);

  const value = useMemo(
    () => ({
      cartItems,
      cartCount,
      subtotal,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      updateCartItemStock,
      validateCartStock,
      clearCart,
    }),
    [
      cartItems,
      cartCount,
      subtotal,
      addToCart,
      removeFromCart,
      increaseQuantity,
      decreaseQuantity,
      updateCartItemStock,
      validateCartStock,
      clearCart,
    ]
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


