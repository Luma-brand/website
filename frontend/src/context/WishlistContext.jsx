import { createContext, useContext, useEffect, useMemo, useState } from "react";

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

  function isInWishlist(productSlug) {
    return wishlistItems.some((item) => item.slug === productSlug);
  }

  function toggleWishlist(product) {
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
          image: product.image,
        },
      ];
    });
  }

  function clearWishlist() {
    setWishlistItems([]);
  }

  const value = useMemo(
    () => ({
      wishlistItems,
      wishlistCount: wishlistItems.length,
      isInWishlist,
      toggleWishlist,
      clearWishlist,
    }),
    [wishlistItems]
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