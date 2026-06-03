import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Link to="/" className="footer-logo-image-link">
          <img
            src="/assets/logos/luma-logo.svg"
            alt="LUMA"
            className="footer-logo-image"
          />
        </Link>

        <p>
          Functional beauty essentials for brows, lashes, and edges. Clean,
          consistent results made for daily life.
        </p>
      </div>

      <div className="footer-links">
        <a href="/#products">Products</a>
        <Link to="/wishlist">Wishlist</Link>
        <Link to="/cart">Cart</Link>
        <Link to="/account">Account</Link>
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
<Route path="/terms-and-conditions" element={<TermsConditions />} />
      </div>

      <div className="footer-small">
        <p>© 2026 LUMA. All rights reserved.</p>
        <p>Great brows. No appointment. No stress.</p>
      </div>
    </footer>
  );
}