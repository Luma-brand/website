import { ArrowRight, Instagram } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { subscribeNewsletter } from "../../services/api";

export function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleNewsletterSubmit(event) {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setStatus({ type: "error", message: "Enter a valid email address." });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "", message: "" });
      await subscribeNewsletter({
        email: normalizedEmail,
        interest: "LUMA newsletter",
      });
      setEmail("");
      setStatus({ type: "success", message: "You’re on the LUMA list." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "We could not add you right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <footer className="site-footer">
      <div className="footer-brand-area">
        <Link to="/" className="footer-logo-image-link" aria-label="LUMA homepage">
          <img src="/assets/logos/luma-logo.svg" alt="LUMA" className="footer-logo-image" />
        </Link>
        <p>Professional brow essentials, made simple.</p>
        <div className="footer-socials">
          <a href="https://www.instagram.com/lumalabs_?utm_source=qr" target="_blank" rel="noreferrer" aria-label="Follow LUMA on Instagram">
            <Instagram size={19} />
          </a>
        </div>

        <form className="footer-newsletter" onSubmit={handleNewsletterSubmit} noValidate>
          <label htmlFor="footer-newsletter-email">Join the LUMA list</label>
          <div className="footer-newsletter-row">
            <input
              id="footer-newsletter-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (status.message) setStatus({ type: "", message: "" });
              }}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isSubmitting}
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Joining…" : "Join"} <ArrowRight size={16} />
            </button>
          </div>
          {status.message && (
            <small className={`footer-newsletter-status ${status.type}`} role="status">
              {status.message}
            </small>
          )}
        </form>
      </div>

      <div className="footer-columns">
        <section className="footer-column">
          <h2>Shop</h2>
          <Link to="/products">Products</Link>
          <Link to="/cart">Cart</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/account">Account</Link>
        </section>

        <section className="footer-column">
          <h2>Help</h2>
          <Link to="/contact">Contact</Link>
          <Link to="/contact">Order support</Link>
          <Link to="/terms-and-conditions">Delivery & returns</Link>
        </section>

        <section className="footer-column">
          <h2>Company</h2>
          <Link to="/about">About LUMA</Link>
          <Link to="/privacy-policy">Privacy policy</Link>
          <Link to="/terms-and-conditions">Terms & conditions</Link>
        </section>

        <section className="footer-column">
          <h2>Contact</h2>
          <p>Use the enquiry form for product, delivery, retail or partnership support.</p>
          <Link to="/contact" className="footer-contact-link">
            Send an enquiry <ArrowRight size={15} />
          </Link>
          <a href="https://www.instagram.com/lumalabs_?utm_source=qr" target="_blank" rel="noreferrer" className="footer-contact-link">
            Instagram @lumalabs_ <Instagram size={15} />
          </a>
        </section>
      </div>

      <div className="footer-bottom">
        <p>© 2026 LUMA. All rights reserved.</p>
        <p>Secure checkout powered by Paystack.</p>
      </div>
    </footer>
  );
}
