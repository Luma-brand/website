import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { PageSeo } from "../components/seo/PageSeo";

function getSiteOrigin() {
  return (
    import.meta.env.VITE_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

export function About() {
  return (
    <main className="page-shell inner-page">
      <PageSeo
        title="About LUMA Skincare | Soft Luxury Beauty"
        description="Learn about LUMA Skincare, a soft luxury beauty brand focused on refined everyday skincare rituals."
        canonical={`${getSiteOrigin()}/about`}
      />
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <p className="eyebrow">About LUMA</p>
          <h1>Soft luxury skincare for everyday rituals.</h1>
          <p>
            LUMA Skincare creates refined beauty essentials for customers who
            want clear routines, considered textures, and a calm shopping
            experience from discovery to delivery.
          </p>
        </div>

        <div className="success-panel">
          <h2>Our point of view</h2>
          <p>
            Every product in the LUMA system is presented with clear stock,
            pricing, and product guidance so customers can choose with
            confidence.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
