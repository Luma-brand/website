import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

export function PrivacyPolicy() {
  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="legal-page section-padding">
        <Link to="/" className="back-link">
          <ArrowLeft size={17} />
          Back home
        </Link>

        <p className="eyebrow">Privacy Policy</p>
        <h1>LUMA Privacy Policy</h1>
        <p>Last updated: June 2026</p>

        <div className="legal-content">
          <h2>1. Introduction</h2>
          <p>
            LUMA respects your privacy. This Privacy Policy explains how we
            collect, use, store, and protect information when you visit our
            website, create an account, join our waitlist, contact us, or place
            an order.
          </p>

          <h2>2. Information we collect</h2>
          <p>
            We may collect your name, email address, phone number, delivery
            address, order details, account preferences, waitlist interest, and
            contact messages. We may also collect technical information such as
            device type, browser type, and general usage activity.
          </p>

          <h2>3. How we use your information</h2>
          <p>
            We use your information to process orders, manage checkout,
            communicate about your purchase, respond to enquiries, send order
            confirmations, improve the website, prevent fraud, and provide
            customer support.
          </p>

          <h2>4. Payments</h2>
          <p>
            Payments are processed securely through Flutterwave. LUMA does not
            store your card details. Flutterwave may collect and process payment
            information according to its own privacy and security policies.
          </p>

          <h2>5. Emails</h2>
          <p>
            We may send order confirmations, payment updates, and important
            service messages. If you join the waitlist, we may contact you about
            product launches and LUMA updates.
          </p>

          <h2>6. Data storage</h2>
          <p>
            Customer and order information may be stored in our secure database
            and related service providers such as hosting, payment, email, and
            image storage platforms.
          </p>

          <h2>7. Sharing of information</h2>
          <p>
            We do not sell your personal information. We only share information
            with trusted services needed to run LUMA, including payment
            processing, email delivery, hosting, database storage, and order
            fulfilment.
          </p>

          <h2>8. Security</h2>
          <p>
            We take reasonable steps to protect your information. However, no
            online service is completely risk-free. You should keep your device
            and account information secure.
          </p>

          <h2>9. Your rights</h2>
          <p>
            You may contact us to request access, correction, or deletion of
            your personal information where legally possible.
          </p>

          <h2>10. Contact</h2>
          <p>
            For privacy questions, contact LUMA through the official contact
            details provided on our website.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
