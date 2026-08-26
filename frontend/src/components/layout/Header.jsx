import { Heart, Menu, ShoppingCart, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { navLinks } from "../../data/siteContent";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useWishlist } from "../../context/WishlistContext";
import { getPublicCurrencyRates } from "../../services/api";
import { getStoredCurrency, setStoredCurrency, setStoredCurrencyRates } from "../../utils/currency";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [currencyRates, setCurrencyRates] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(getStoredCurrency);

  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    let isMounted = true;

    getPublicCurrencyRates()
      .then((response) => {
        if (!isMounted) return;

        const rates = response.data?.rates || [];
        setCurrencyRates(rates);
        setStoredCurrencyRates(rates);

        const storedCurrency = getStoredCurrency();
        const hasStoredCurrency = rates.some((rate) => rate.code === storedCurrency);

        if (rates.length > 0 && !hasStoredCurrency) {
          setStoredCurrency("NGN");
          setSelectedCurrency("NGN");
        } else {
          setSelectedCurrency(storedCurrency);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  function handleCurrencyChange(event) {
    const nextCurrency = event.target.value;
    setSelectedCurrency(nextCurrency);
    setStoredCurrency(nextCurrency);
    window.location.reload();
  }
  function handleSectionNavigation(event, href) {
    if (!href.startsWith("/#")) return;

    event.preventDefault();

    const sectionId = href.replace("/#", "");

    setIsOpen(false);

    if (location.pathname !== "/") {
      navigate(`/#${sectionId}`);

      window.setTimeout(() => {
        const section = document.getElementById(sectionId);
     if (section) {
  const headerOffset = 105;
  const sectionTop = section.getBoundingClientRect().top + window.scrollY;
  const scrollToPosition = sectionTop - headerOffset;

  window.scrollTo({
    top: scrollToPosition,
    behavior: "smooth",
  });
}
      }, 120);

      return;
    }

    const section = document.getElementById(sectionId);
    if (section) {
  const headerOffset = 105;
  const sectionTop = section.getBoundingClientRect().top + window.scrollY;
  const scrollToPosition = sectionTop - headerOffset;

  window.scrollTo({
    top: scrollToPosition,
    behavior: "smooth",
  });
}
    window.history.pushState(null, "", `/#${sectionId}`);
  }

  return (
    <header className={`site-header ${hasScrolled ? "is-scrolled" : ""}`}>
      <Link to="/" className="brand-logo-image-link" aria-label="LUMA homepage">
        <img
          src="/assets/logos/luma-logo.svg"
          alt="LUMA"
          className="brand-logo-image"
        />
      </Link>

      <nav className="desktop-nav" aria-label="Main navigation">
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            onClick={(event) => handleSectionNavigation(event, link.href)}
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        {currencyRates.length > 1 && (
          <label className="currency-selector" aria-label="Display currency">
            <span>Currency</span>
            <select value={selectedCurrency} onChange={handleCurrencyChange}>
              {currencyRates.map((rate) => (
                <option key={rate.code} value={rate.code}>
                  {rate.symbol} {rate.code}
                </option>
              ))}
            </select>
          </label>
        )}
        <Link to="/wishlist" className="header-icon-link" aria-label="Wishlist">
          <Heart size={18} />
          {wishlistCount > 0 && <span className="cart-count">{wishlistCount}</span>}
        </Link>

        <Link to="/account" className="header-icon-link" aria-label="Account">
          <User size={18} />
          {isAuthenticated && <span className="status-dot" />}
        </Link>

        <Link to="/cart" className="header-icon-link cart-link" aria-label="Cart">
          <ShoppingCart size={18} />
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </Link>

        <Link to="/products" className="header-cta">
          Shop the system
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
          {currencyRates.length > 1 && (
            <label className="mobile-currency-selector">
              <span>Display currency</span>
              <select
                value={selectedCurrency}
                onChange={handleCurrencyChange}
                aria-label="Display currency"
              >
                {currencyRates.map((rate) => (
                  <option key={rate.code} value={rate.code}>
                    {rate.symbol} {rate.code}
                  </option>
                ))}
              </select>
            </label>
          )}

          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(event) => handleSectionNavigation(event, link.href)}
            >
              {link.label}
            </a>
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


