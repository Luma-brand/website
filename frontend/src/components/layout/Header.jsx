import { Heart, Menu, ShoppingBag, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { navLinks } from "../../data/siteContent";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useWishlist } from "../../context/WishlistContext";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { cartCount } = useCart();
  const { isAuthenticated } = useAuth();
  const { wishlistCount } = useWishlist();

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 20);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <header className={`site-header ${hasScrolled ? "is-scrolled" : ""}`}>
      <Link to="/" className="brand-logo-image-link" aria-label="LUMA homepage">
        <img src="/assets/logos/luma-logo.svg" alt="LUMA" className="brand-logo-image" />
      </Link>

      <nav className="desktop-nav" aria-label="Main navigation">
        {navLinks.map((link) => (
          <Link key={link.label} to={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="header-actions">
        <Link to="/wishlist" className="header-icon-link" aria-label="Wishlist">
          <Heart size={18} />
          {wishlistCount > 0 && <span className="cart-count">{wishlistCount}</span>}
        </Link>

        <Link to="/account" className="header-icon-link" aria-label="Account">
          <User size={18} />
          {isAuthenticated && <span className="status-dot" />}
        </Link>

        <Link to="/cart" className="header-icon-link cart-link" aria-label="Cart">
          <ShoppingBag size={18} />
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </Link>

        <Link to="/products" className="header-cta">
          Shop
        </Link>
      </div>

      <button
        className="mobile-menu-btn"
        type="button"
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {isOpen && (
        <div className="mobile-nav">
          {navLinks.map((link) => (
            <Link key={link.label} to={link.href} onClick={() => setIsOpen(false)}>
              {link.label}
            </Link>
          ))}

          <Link to="/wishlist" onClick={() => setIsOpen(false)}>
            Wishlist {wishlistCount > 0 ? `(${wishlistCount})` : ""}
          </Link>

          <Link to="/account" onClick={() => setIsOpen(false)}>
            Account
          </Link>

          <Link to="/cart" onClick={() => setIsOpen(false)}>
            Cart {cartCount > 0 ? `(${cartCount})` : ""}
          </Link>

          <Link to="/products" onClick={() => setIsOpen(false)}>
            Shop the system
          </Link>
        </div>
      )}
    </header>
  );
}