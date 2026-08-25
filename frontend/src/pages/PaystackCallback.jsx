import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, LockKeyhole } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { verifyPaystackPayment } from "../services/paymentApi";

export function PaystackCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState("verifying");
  const [message, setMessage] = useState("Confirming your payment securely...");

  useEffect(() => {
    let mounted = true;
    const reference = searchParams.get("reference") || searchParams.get("trxref");

    async function verify() {
      if (!reference) {
        if (mounted) {
          setState("error");
          setMessage("Paystack did not return a payment reference.");
        }
        return;
      }

      try {
        const response = await verifyPaystackPayment(reference);
        const orderId = response.data?.id;

        if (!mounted) return;

        setState("success");
        setMessage("Payment confirmed. Your LUMA order is ready.");

        if (orderId) {
          window.setTimeout(() => navigate(`/order-success/${orderId}`, { replace: true }), 700);
        }
      } catch (error) {
        if (!mounted) return;
        setState("error");
        setMessage(
          error.message ||
            "We could not verify this payment yet. If you were charged, your signed Paystack webhook can still confirm the order automatically."
        );
      }
    }

    verify();
    return () => {
      mounted = false;
    };
  }, [navigate, searchParams]);

  return (
    <main className="page-shell inner-page">
      <Header />
      <section className="commerce-page">
        <div className="success-panel">
          {state === "verifying" && <LockKeyhole size={40} />}
          {state === "success" && <CheckCircle2 size={40} />}
          {state === "error" && <AlertCircle size={40} />}

          <p className="eyebrow">Paystack</p>
          <h1>
            {state === "verifying"
              ? "Confirming payment."
              : state === "success"
                ? "Payment confirmed."
                : "One more check."}
          </h1>
          <p>{message}</p>

          {state === "error" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 24 }}>
              <Link to="/account" className="btn btn-secondary">Account</Link>
              <Link to="/products" className="btn btn-primary">Continue shopping</Link>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
