import { useState } from "react";
import { ArrowUpRight, Headphones, Instagram, PackageSearch, Sparkles, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { submitContactForm } from "../../services/api";
import "../../styles/contactExperience.css";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  subject: "Product enquiry",
  message: "",
};

const enquiryTopics = [
  { icon: PackageSearch, title: "Products", note: "Questions about LUMA brow essentials." },
  { icon: Truck, title: "Orders & delivery", note: "Help with an order, address or delivery." },
  { icon: Sparkles, title: "Retail & partnerships", note: "Stockists, collaborations and business enquiries." },
  { icon: Headphones, title: "Customer care", note: "Anything else you need help resolving." },
];

export function ContactSection({ detailed = false }) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (status.message) setStatus({ type: "", message: "" });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.message.trim()) {
      setStatus({ type: "error", message: "Name, email, phone and inquiry details are required." });
      return;
    }

    try {
      setSubmitting(true);
      setStatus({ type: "", message: "" });
      await submitContactForm({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject,
        message: form.message.trim(),
        sourcePage: window.location.href,
        browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
      });
      setForm(initialForm);
      setStatus({
        type: "success",
        message: "Your enquiry has been received. We’ll get back to you as soon as possible.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "We could not send your enquiry. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!detailed) {
    return (
      <section id="contact" className="luma-contact-compact">
        <motion.div
          className="luma-contact-compact-card"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <p className="eyebrow">Need LUMA?</p>
            <h2>Questions, stockist interest or customer care.</h2>
          </div>
          <Link to="/contact" className="btn btn-primary">
            Contact LUMA <ArrowUpRight size={18} />
          </Link>
        </motion.div>
      </section>
    );
  }

  return (
    <section id="contact" className="luma-contact-shell">
      <div className="luma-contact-grid">
        <motion.div
          className="luma-contact-panel"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow">How can we help?</p>
          <h2>One place for every LUMA enquiry.</h2>
          <p>
            Send the team the details once. Product questions, delivery issues,
            retail interest and customer-care messages all enter the same LUMA
            enquiry system for review.
          </p>

          <div className="luma-contact-topics">
            {enquiryTopics.map(({ icon: Icon, title, note }) => (
              <div className="luma-contact-topic" key={title}>
                <div className="luma-contact-topic-icon"><Icon size={19} /></div>
                <div><strong>{title}</strong><span>{note}</span></div>
              </div>
            ))}
          </div>
          <a href="https://www.instagram.com/lumalabs_?utm_source=qr" target="_blank" rel="noreferrer" className="btn btn-secondary">
            <Instagram size={18} /> Follow @lumalabs_
          </a>
        </motion.div>

        <motion.div
          className="luma-enquiry-panel"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow">Send an enquiry</p>
          <h2>Tell us what you need.</h2>
          <p>Share a few details so the right person on our team can help.</p>

          <form className="luma-enquiry-form" onSubmit={handleSubmit} noValidate>
            <div className="luma-enquiry-row">
              <div className="luma-enquiry-field">
                <label htmlFor="contact-full-name">Full name</label>
                <input id="contact-full-name" name="fullName" value={form.fullName} onChange={handleChange} placeholder="Your name" autoComplete="name" disabled={submitting} />
              </div>
              <div className="luma-enquiry-field">
                <label htmlFor="contact-email">Email</label>
                <input id="contact-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" disabled={submitting} />
              </div>
            </div>

            <div className="luma-enquiry-row">
              <div className="luma-enquiry-field">
                <label htmlFor="contact-phone">Phone</label>
                <input id="contact-phone" name="phone" value={form.phone} onChange={handleChange} placeholder="Phone number" autoComplete="tel" disabled={submitting} />
              </div>
              <div className="luma-enquiry-field">
                <label htmlFor="contact-subject">Enquiry type</label>
                <select id="contact-subject" name="subject" value={form.subject} onChange={handleChange} disabled={submitting}>
                  <option>Product enquiry</option>
                  <option>Order support</option>
                  <option>Delivery support</option>
                  <option>Retail / stockist</option>
                  <option>Partnership / collaboration</option>
                  <option>Customer care</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="luma-enquiry-field">
              <label htmlFor="contact-message">Message</label>
              <textarea id="contact-message" name="message" value={form.message} onChange={handleChange} placeholder="Tell us what happened, what you need, or what you would like to discuss…" disabled={submitting} />
            </div>

            {status.message && <div className={`luma-enquiry-status ${status.type}`} role="status">{status.message}</div>}

            <button type="submit" className="luma-enquiry-submit" disabled={submitting}>
              {submitting ? "Sending enquiry…" : "Send enquiry"}
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
