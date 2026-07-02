import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

export function TermsConditions() {
  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="legal-page section-padding">
        <Link to="/" className="back-link">
          <ArrowLeft size={17} />
          Back home
        </Link>

        <p className="eyebrow">Terms & Conditions</p>
        <h1>LUMA Terms & Conditions</h1>
        <p>Last updated: June 2026</p>

        <div className="legal-content">
          <h2>1. Agreement</h2>
          <p>
            By using the LUMA website, creating an account, joining the
            waitlist, contacting us, or placing an order, you agree to these
            Terms & Conditions.
          </p>

          <h2>2. Products</h2>
          <p>
            LUMA provides beauty products and related information. Product
            descriptions, images, prices, stock, and availability may change
            without notice.
          </p>

          <h2>3. Account requirement</h2>
          <p>
            Customers may be required to create or sign in to a LUMA account
            before checkout. You are responsible for ensuring the information
            you provide is accurate.
          </p>

          <h2>4. Orders</h2>
          <p>
            When you place an order, you agree that all delivery and contact
            information provided is correct. We may contact you if additional
            information is needed to complete your order.
          </p>

          <h2>5. Payments</h2>
          <p>
            Payments are processed through Flutterwave. Orders are processed after
            payment confirmation. LUMA does not store card details or sensitive
            payment credentials.
          </p>

          <h2>6. Pricing</h2>
          <p>
            Prices are displayed in Nigerian Naira unless otherwise stated.
            Prices may change at any time, but confirmed paid orders will be
            processed based on the amount paid at checkout.
          </p>

          <h2>7. Delivery</h2>
          <p>
            Delivery timelines may vary depending on customer location,
            availability, courier conditions, and other factors outside our
            control.
          </p>

          <h2>8. Returns and issues</h2>
          <p>
            If you receive a wrong, damaged, or incomplete order, contact LUMA
            as soon as possible with your order details. Resolution may depend on
            the condition of the product, timing of the report, and order
            verification.
          </p>

          <h2>9. Website use</h2>
          <p>
            You agree not to misuse the website, attempt unauthorized access,
            interfere with the checkout system, abuse forms, or use the website
            for fraudulent purposes.
          </p>

          <h2>10. Limitation of liability</h2>
          <p>
            LUMA is not responsible for indirect losses, technical issues, or
            service interruptions beyond reasonable control.
          </p>

          <h2>11. Changes to these terms</h2>
          <p>
            We may update these Terms & Conditions from time to time. Continued
            use of the website means you accept the updated terms.
          </p>

          <h2>12. Contact</h2>
          <p>
            For questions about these terms, contact LUMA through the official
            contact details on our website.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
