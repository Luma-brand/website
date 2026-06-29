import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getProductImage } from "../utils/images";

const WishlistContext = createContext(null);

const WISHLIST_STORAGE_KEY = "luma_wishlist";

function getStoredWishlist() {
  try {
    const storedWishlist = localStorage.getItem(WISHLIST_STORAGE_KEY);
    return storedWishlist ? JSON.parse(storedWishlist) : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }) {
  const [wishlistItems, setWishlistItems] = useState(getStoredWishlist);

  useEffect(() => {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistItems));
  }, [wishlistItems]);

  const isInWishlist = useCallback((productSlug) => {
    return wishlistItems.some((item) => item.slug === productSlug);
  }, [wishlistItems]);

  const toggleWishlist = useCallback((product) => {
    setWishlistItems((currentItems) => {
      const alreadySaved = currentItems.some((item) => item.slug === product.slug);

      if (alreadySaved) {
        return currentItems.filter((item) => item.slug !== product.slug);
      }

      return [
        ...currentItems,
        {
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          price: product.price,
          numericPrice: product.numericPrice,
          description: product.description,
          image: getProductImage(product),
        },
      ];
    });
  }, []);

  const clearWishlist = useCallback(() => {
    setWishlistItems([]);
  }, []);

  const value = useMemo(
    () => ({
      wishlistItems,
      wishlistCount: wishlistItems.length,
      isInWishlist,
      toggleWishlist,
      clearWishlist,
    }),
    [wishlistItems, isInWishlist, toggleWishlist, clearWishlist]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error("useWishlist must be used inside WishlistProvider");
  }

  return context;
}
