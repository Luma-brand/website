import { motion } from "framer-motion";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { NewsletterSection } from "../components/sections/NewsletterSection";
import { TrustStrip } from "../components/sections/TrustStrip";
import { ContactSection } from "../components/sections/ContactSection";
import { HomeProductSlider } from "../components/product/HomeProductSlider";
import { PageSeo } from "../components/seo/PageSeo";
import { benefits, faqs, ritualSteps } from "../data/siteContent";

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

export function Home() {
  const siteOrigin =
    import.meta.env.VITE_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <main id="main-content" className="page-shell">
      <PageSeo
        title="LUMA Skincare | Soft Luxury Beauty Rituals"
        description="Shop LUMA Skincare beauty essentials for refined everyday rituals, clean product routines, and secure checkout."
        canonical={siteOrigin}
      />
      <Header />

      <section className="hero-section">
        <div className="hero-bg-orb hero-bg-orb-one" />
        <div className="hero-bg-orb hero-bg-orb-two" />

        <motion.div
          className="hero-content"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.p className="eyebrow" variants={fadeUp}>
            Functional beauty for brows
          </motion.p>

          <motion.h1 variants={fadeUp}>
            Obsessively<br />Well Made.
          </motion.h1>

          <motion.p className="hero-copy" variants={fadeUp}>
            LUMA turns treatment expertise into simple daily essentials —
            delivering clean, consistent results with soft luxury precision.
          </motion.p>

          <motion.div className="hero-actions" variants={fadeUp}>
            <a href="#products" className="btn btn-primary">
              Explore products
              <ArrowUpRight size={18} />
            </a>

            <a href="#ritual" className="btn btn-secondary">
              See the ritual
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
        >
          <div className="hero-image-card">
            <img
              src="/assets/images/hero-closeup.jpg"
              alt="Close-up beauty image highlighting polished brows"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />

            <div className="image-fallback" aria-hidden="true" />
          </div>

          <div className="floating-product-card">
            <span>Clean finish</span>
            <strong>No appointment.</strong>
          </div>

          <div className="hero-product-strip">
            <span>LamiFix</span>
            <span>Hybrid Stain</span>
            
          </div>
        </motion.div>
      </section>

      <TrustStrip />

      <section className="intro-section section-padding">
        <motion.div
          className="intro-grid"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.35 }}
        >
          <motion.div variants={fadeUp}>
            <p className="eyebrow">Choose LUMA</p>
            <h2>Great brows. No appointment. No stress.</h2>
          </motion.div>

          <motion.div className="intro-copy" variants={fadeUp}>
            <p>
              LUMA is designed for the beauty details that frame the face —
              brows. The system feels precise, clean, and
              elevated while staying simple enough for everyday use.
            </p>

            <div className="intro-points">
              <span>
                <Check size={16} /> At-home friendly
              </span>

              <span>
                <Check size={16} /> Soft luxury finish
              </span>

              <span>
                <Check size={16} /> Consistent daily results
              </span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section id="products" className="products-section section-padding">
        <div className="section-heading">
          <p className="eyebrow">The system</p>
          <h2>Essentials for controlled, polished beauty.</h2>
          <p>
            A curated preview of the LUMA product system. Visit the shop to
            explore prices, stock, and checkout.
          </p>
        </div>

        <HomeProductSlider />

        <div className="hero-actions" style={{ justifyContent: "center", marginTop: 32 }}>
          <a href="/products" className="btn btn-primary">
            Shop the system
            <ArrowUpRight size={18} />
          </a>
        </div>
      </section>

      <section id="results" className="benefits-section section-padding">
        <div className="benefits-image-panel">
          <img
            src="/assets/images/brand-in-action.jpg"
            alt="LUMA beauty product in use"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />

          <div className="benefits-fallback" aria-hidden="true" />
        </div>

        <div className="benefits-content">
          <p className="eyebrow">Brows</p>
          <h2>The tiny details that change the whole face.</h2>

          <div className="benefit-list">
            {benefits.map((item) => (
              <motion.div
                className="benefit-item"
                key={item.eyebrow}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.65 }}
              >
                <span>{item.eyebrow}</span>

                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="ritual" className="ritual-section section-padding">
        <div className="section-heading center">
          <p className="eyebrow">The ritual</p>
          <h2>Simple enough for daily life. Precise enough to feel pro.</h2>
        </div>

        <div className="ritual-grid">
          {ritualSteps.map((step) => (
            <motion.div
              className="ritual-card"
              key={step.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.65 }}
            >
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="statement-section">
        <motion.div
          className="statement-card"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.8 }}
        >
          <Sparkles size={24} />
          <h2>
            Making professional-level results accessible, effortless, and part
            of daily life.
          </h2>
          <p>LUMA.</p>
        </motion.div>
      </section>

      <ContactSection />

      <NewsletterSection />

      <section id="faq" className="faq-section section-padding">
        <div className="section-heading">
          <p className="eyebrow">Questions</p>
          <h2>Everything kept simple.</h2>
        </div>

        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq.question} className="faq-item">
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
