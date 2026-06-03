import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

export function Forbidden() {
  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page">
        <div className="empty-state">
          <ShieldX size={38} />
          <p className="eyebrow">403 Forbidden</p>
          <h1>Access denied.</h1>
          <p>
            This area is restricted. You do not have permission to access this
            page.
          </p>

          <Link to="/" className="btn btn-primary">
            Return home
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}