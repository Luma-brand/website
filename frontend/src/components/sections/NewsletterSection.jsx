import { motion } from "framer-motion";
import { WaitlistForm } from "../forms/WaitlistForm";

export function NewsletterSection() {
  return (
    <section className="newsletter-section">
      <motion.div
        className="newsletter-card newsletter-card-large"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <p className="eyebrow">Join the LUMA list</p>
          <h2>Brow details, product drops, and soft rituals.</h2>
          <p className="newsletter-copy">
            Be first to know when LUMA launches new essentials for polished,
            beautifully groomed brows.
          </p>
        </div>

        <WaitlistForm />
      </motion.div>
    </section>
  );
}
