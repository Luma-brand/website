import { Facebook, Instagram, Music2, Twitter } from "lucide-react";
import { Link } from "react-router-dom";

// Replace these placeholder URLs with LUMA's live social profiles before launch.
const socialLinks = [
  { label: "Instagram", href: "https://instagram.com/", icon: Instagram },
  { label: "Facebook", href: "https://facebook.com/", icon: Facebook },
  { label: "TikTok", href: "https://tiktok.com/", icon: Music2 },
  { label: "X", href: "https://x.com/", icon: Twitter },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Link to="/" className="footer-logo-image-link" aria-label="LUMA homepage">
          <img src="/assets/logos/luma-logo.svg" alt="LUMA" className="footer-logo-image" />
        </Link>
        <p>
          Functional brow essentials for clean, consistent results and a polished
          finish made for daily life.
        </p>
        <div className="footer-socials" aria-label="LUMA social media">
          {socialLinks.map(({ label, href, icon: Icon }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
              <Icon size={17} />
            </a>
          ))}
        </div>
      </div>

      <div className="footer-links">
        <a href="/#products">Products</a>
        <Link to="/wishlist">Wishlist</Link>
        <Link to="/cart">Cart</Link>
        <Link to="/account">Account</Link>
        <Link to="/privacy-policy">Privacy Policy</Link>
        <Link to="/terms-and-conditions">Terms & Conditions</Link>
      </div>

      <div className="footer-small">
        <p>© 2026 LUMA. All rights reserved.</p>
        <p>Great brows. No appointment. No stress.</p>
      </div>
    </footer>
  );
}
