import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useCart } from "../context/CartContext";
import { verifyFlutterwavePayment } from "../services/api";

export function FlutterwaveCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [state, setState] = useState({ status: "verifying", message: "Securely verifying your payment…" });

  useEffect(() => {
    const status = params.get("status");
    const txRef = params.get("tx_ref");
    const transactionId = params.get("transaction_id");
    if (!txRef || !transactionId || status !== "successful") {
      queueMicrotask(() => setState({ status: "failed", message: status === "cancelled" ? "Payment cancelled." : "We couldn’t verify this payment yet." }));
      return;
    }
    verifyFlutterwavePayment({ status, tx_ref: txRef, transaction_id: transactionId })
      .then((response) => {
        clearCart();
        setState({ status: "success", message: "Payment successful." });
        window.setTimeout(() => navigate(`/order-success/${response.data.id}`, { replace: true }), 900);
      })
      .catch(() => setState({ status: "failed", message: "Your payment could not be verified yet. Please try again shortly." }));
  }, [clearCart, navigate, params]);

  const Icon = state.status === "verifying" ? LoaderCircle : state.status === "success" ? CheckCircle2 : XCircle;
  return (
    <main className="page-shell inner-page">
      <Header />
      <section className="commerce-page payment-callback-page">
        <div className={`success-panel payment-callback-card ${state.status}`}>
          <Icon size={42} className={state.status === "verifying" ? "spin" : ""} />
          <p className="eyebrow">Flutterwave secure payment</p>
          <h1>{state.status === "verifying" ? "Confirming your order" : state.message}</h1>
          <p>{state.status === "verifying" ? "Please keep this page open while LUMA confirms the transaction." : "You can return to checkout if you still need to complete payment."}</p>
          {state.status === "failed" && <Link to="/checkout" className="btn btn-primary">Return to checkout</Link>}
        </div>
      </section>
      <Footer />
    </main>
  );
}
