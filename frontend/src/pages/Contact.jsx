import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { ContactSection } from "../components/sections/ContactSection";
import { PageSeo } from "../components/seo/PageSeo";

function getSiteOrigin() {
  return (
    import.meta.env.VITE_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

export function Contact() {
  return (
    <main className="page-shell inner-page">
      <PageSeo
        title="Contact LUMA Skincare"
        description="Contact LUMA Skincare for product, order, delivery, and customer support questions."
        canonical={`${getSiteOrigin()}/contact`}
      />
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <p className="eyebrow">Contact</p>
          <h1>Talk to LUMA.</h1>
          <p>
            Send a message about products, delivery, orders, or customer care.
          </p>
        </div>
      </section>

      <ContactSection />

      <Footer />
    </main>
  );
}
