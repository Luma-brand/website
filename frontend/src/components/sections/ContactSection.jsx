import { ArrowUpRight, Mail } from "lucide-react";
import { motion } from "framer-motion";

export function ContactSection() {
  return (
    <section id="contact" className="contact-section">
      <motion.div
        className="contact-card"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="contact-content">
          <p className="eyebrow">Stockists & enquiries</p>
          <h2>Bring LUMA into your beauty shelf, studio, or store.</h2>
          <p>
            For product enquiries, partnerships, retail interest, or launch
            updates, reach out to the LUMA team.
          </p>
        </div>

        <div className="contact-actions">
          <a href="mailto:hello@luma.com" className="contact-email">
            <Mail size={18} />
            hello@luma.com
          </a>

          <a href="mailto:hello@luma.com?subject=LUMA%20Enquiry" className="btn btn-primary">
            Send enquiry
            <ArrowUpRight size={18} />
          </a>
        </div>
      </motion.div>
    </section>
  );
}