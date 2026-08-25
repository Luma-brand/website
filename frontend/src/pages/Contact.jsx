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
        description="Contact LUMA Skincare for product, order, delivery, retail, partnership, and customer support enquiries."
        canonical={`${getSiteOrigin()}/contact`}
      />
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <p className="eyebrow">Contact LUMA</p>
          <h1>We’re here when you need us.</h1>
          <p>
            Product questions, order support, retail interest, partnerships and
            general enquiries can all be sent from one place.
          </p>
        </div>
      </section>

      <ContactSection detailed />

      <Footer />
    </main>
  );
}
