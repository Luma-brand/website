import { ArrowLeft } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

export function NotFound() {
  return (
    <main className="page-shell">
      <Header />

      <section className="not-found-section">
        <p className="eyebrow">404</p>
        <h1>Nothing to shape here.</h1>
        <p>
          The page you’re looking for doesn’t exist or has been moved. Return to
          the LUMA homepage and continue exploring the system.
        </p>

        <a href="/" className="btn btn-primary">
          <ArrowLeft size={18} />
          Back to homepage
        </a>
      </section>

      <Footer />
    </main>
  );
}