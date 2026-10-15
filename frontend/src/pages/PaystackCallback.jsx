import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { verifyPaystackPayment } from "../services/paymentApi";
import { canRetryPayment, confirmPayment } from "../lib/paymentConfirmation";
import "../styles/order-status.css";

export function PaystackCallback() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const navigate = useNavigate();
  const [state, setState] = useState("verifying");
  const [message, setMessage] = useState("Confirming your payment securely. This can take a moment.");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function verify() {
      if (!reference) {
        setState("error");
        setMessage("No payment reference was returned. Contact LUMA if you have already paid.");
        return;
      }

      try {
        const order = await confirmPayment(reference, {
          verify: verifyPaystackPayment,
          signal: controller.signal,
          onRetry: () => setMessage("Still checking with Paystack. Please keep this page open."),
        });
        if (controller.signal.aborted) return;
        setState("success");
        setMessage("Payment received. Opening your order and tracking details...");
        navigate(`/order-success/${order.id}`, { replace: true });
      } catch (error) {
        if (controller.signal.aborted) return;
        const pending = canRetryPayment(error);
        setState(pending ? "pending" : "error");
        setMessage(pending
          ? "We’re still checking your payment. If you’ve been debited, please don’t pay again. You can check the status below."
          : error.message || "We couldn’t confirm this payment. Contact LUMA with your reference for help.");
      }
    }

    void verify();
    return () => controller.abort();
  }, [navigate, reference, retry]);

  return (
    <main className="page-shell inner-page">
      <Header />
      <section className="commerce-page">
        <div className="success-panel payment-result" aria-live="polite">
          {state === "verifying" ? <LoaderCircle className="payment-spinner" size={40} />
            : state === "success" ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
          <p className="eyebrow">Secure payment</p>
          <h1>{state === "success" ? "Payment confirmed."
            : state === "verifying" ? "Confirming payment."
              : state === "pending" ? "Confirmation pending." : "Let’s check your payment."}</h1>
          <p>{message}</p>
          {reference && <div className="payment-reference"><span>Payment reference</span><strong>{reference}</strong></div>}
          {["pending", "error"].includes(state) && (
            <div className="order-actions">
              {reference && <button type="button" className="btn btn-primary" onClick={() => {
                setState("verifying");
                setMessage("Checking your payment again...");
                setRetry((current) => current + 1);
              }}>Check payment status</button>}
              <a className="btn btn-secondary" href={`mailto:hello@shopwithluma.com?subject=${encodeURIComponent(`Payment help${reference ? ` — ${reference}` : ""}`)}`}>Contact LUMA</a>
              <Link to="/products" className="btn btn-secondary">Continue shopping</Link>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
