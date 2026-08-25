import { useEffect, useState } from "react";
import { ArrowRight, Copy, ShoppingBag, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { recordAnalyticsEvent, saveUtmParams } from "../../services/growthApi";

const WELCOME_CODE = "WELCOME10";
const WELCOME_SEEN_KEY = "luma_growth_welcome_seen";
const EXIT_SHOWN_KEY = "luma_growth_exit_shown_at";
const EXIT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function getUtmParams(search) {
  const params = new URLSearchParams(search);
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ];

  return keys.reduce((values, key) => {
    const value = params.get(key);
    if (value) values[key] = value;
    return values;
  }, {});
}

function getStoredValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Growth prompts must never block shopping.
  }
}

function isPromptEligiblePath(pathname) {
  return (
    pathname === "/" ||
    pathname === "/products" ||
    pathname.startsWith("/products/") ||
    pathname === "/cart"
  );
}

const promptStyles = `
  .luma-growth-overlay {
    position: fixed;
    inset: 0;
    z-index: 9990;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(22, 22, 22, 0.46);
    backdrop-filter: blur(11px);
    animation: luma-growth-fade 220ms ease both;
  }

  .luma-growth-card {
    position: relative;
    width: min(560px, 100%);
    overflow: hidden;
    padding: 42px;
    border: 1px solid rgba(22, 22, 22, 0.12);
    border-radius: var(--radius-xl, 34px);
    background:
      radial-gradient(circle at top right, rgba(255, 241, 159, 0.95), transparent 38%),
      linear-gradient(145deg, #fffaf0 0%, #fff6d6 100%);
    box-shadow: 0 34px 100px rgba(22, 22, 22, 0.26);
    color: var(--color-ink, #161616);
    animation: luma-growth-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .luma-growth-card::after {
    content: "LUMA";
    position: absolute;
    right: -14px;
    bottom: -28px;
    color: rgba(22, 22, 22, 0.045);
    font-size: clamp(5rem, 16vw, 9rem);
    font-weight: 900;
    letter-spacing: -0.09em;
    pointer-events: none;
  }

  .luma-growth-close {
    position: absolute;
    top: 18px;
    right: 18px;
    z-index: 2;
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border: 1px solid rgba(22, 22, 22, 0.1);
    border-radius: 999px;
    background: rgba(255, 250, 240, 0.78);
    color: #161616;
    cursor: pointer;
  }

  .luma-growth-eyebrow {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 18px;
    padding: 9px 13px;
    border-radius: 999px;
    background: var(--color-yellow, #fff19f);
    font-family: var(--font-serif, serif);
    font-size: 0.92rem;
  }

  .luma-growth-card h2 {
    position: relative;
    z-index: 1;
    max-width: 470px;
    margin: 0;
    font-size: clamp(2.35rem, 7vw, 4.2rem);
    line-height: 0.96;
    letter-spacing: -0.065em;
  }

  .luma-growth-copy {
    position: relative;
    z-index: 1;
    max-width: 455px;
    margin: 20px 0 0;
    color: var(--color-muted, #66645f);
    font-size: 1rem;
    line-height: 1.75;
  }

  .luma-growth-code {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 26px;
    padding: 15px 16px 15px 19px;
    border: 1px dashed rgba(22, 22, 22, 0.34);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.48);
  }

  .luma-growth-code span {
    font-size: 1.18rem;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .luma-growth-code button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 38px;
    padding: 0 13px;
    border: 0;
    border-radius: 999px;
    background: #161616;
    color: #fff6d6;
    font-weight: 800;
    cursor: pointer;
  }

  .luma-growth-actions {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 28px;
  }

  .luma-growth-primary,
  .luma-growth-secondary {
    display: inline-flex;
    min-height: 50px;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 0 20px;
    border-radius: 999px;
    font-weight: 800;
    cursor: pointer;
  }

  .luma-growth-primary {
    border: 1px solid #161616;
    background: #161616;
    color: #fff6d6;
  }

  .luma-growth-secondary {
    border: 1px solid rgba(22, 22, 22, 0.14);
    background: rgba(255, 250, 240, 0.68);
    color: #161616;
  }

  .luma-growth-note {
    position: relative;
    z-index: 1;
    margin: 16px 0 0;
    color: #77746c;
    font-size: 0.78rem;
  }

  @keyframes luma-growth-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes luma-growth-rise {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (max-width: 640px) {
    .luma-growth-overlay { padding: 14px; }
    .luma-growth-card { padding: 34px 22px 26px; border-radius: 28px; }
    .luma-growth-card h2 { font-size: clamp(2.15rem, 12vw, 3.25rem); }
    .luma-growth-actions { display: grid; }
    .luma-growth-primary, .luma-growth-secondary { width: 100%; }
  }
`;

export function GrowthTracker() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cartCount } = useCart();
  const [activePrompt, setActivePrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const eligiblePath = isPromptEligiblePath(location.pathname);

  useEffect(() => {
    const utm = getUtmParams(location.search);
    const path = `${location.pathname}${location.search}`;

    saveUtmParams(utm);

    void recordAnalyticsEvent({
      eventType: "page_view",
      customerEmail: user?.email,
      utm,
      metadata: { path },
    }).catch(() => {});
  }, [location.pathname, location.search, user?.email]);

  useEffect(() => {
    if (!eligiblePath) {
      setActivePrompt("");
      return undefined;
    }

    if (getStoredValue(WELCOME_SEEN_KEY)) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActivePrompt((current) => current || "welcome");
      setStoredValue(WELCOME_SEEN_KEY, String(Date.now()));
      void recordAnalyticsEvent({
        eventType: "marketing_prompt_view",
        customerEmail: user?.email,
        metadata: { prompt: "welcome_discount", code: WELCOME_CODE },
      }).catch(() => {});
    }, 6500);

    return () => window.clearTimeout(timer);
  }, [eligiblePath, user?.email]);

  useEffect(() => {
    if (!eligiblePath) return undefined;

    const lastShown = Number(getStoredValue(EXIT_SHOWN_KEY) || 0);
    if (lastShown && Date.now() - lastShown < EXIT_COOLDOWN_MS) {
      return undefined;
    }

    function handleExitIntent(event) {
      if (event.relatedTarget || event.clientY > 8) return;

      setActivePrompt((current) => {
        if (current) return current;

        setStoredValue(EXIT_SHOWN_KEY, String(Date.now()));
        void recordAnalyticsEvent({
          eventType: "marketing_prompt_view",
          customerEmail: user?.email,
          value: cartCount || 0,
          metadata: {
            prompt: "exit_intent",
            cartCount,
            path: location.pathname,
          },
        }).catch(() => {});
        return "exit";
      });
    }

    document.addEventListener("mouseout", handleExitIntent);
    return () => document.removeEventListener("mouseout", handleExitIntent);
  }, [cartCount, eligiblePath, location.pathname, user?.email]);

  function closePrompt(action = "dismiss") {
    if (activePrompt) {
      void recordAnalyticsEvent({
        eventType: "marketing_prompt_action",
        customerEmail: user?.email,
        metadata: { prompt: activePrompt, action },
      }).catch(() => {});
    }
    setActivePrompt("");
    setCopied(false);
  }

  async function copyWelcomeCode() {
    try {
      await navigator.clipboard.writeText(WELCOME_CODE);
      setCopied(true);
    } catch {
      setCopied(false);
    }

    void recordAnalyticsEvent({
      eventType: "marketing_prompt_action",
      customerEmail: user?.email,
      metadata: { prompt: "welcome", action: "copy_code", code: WELCOME_CODE },
    }).catch(() => {});
  }

  function continueShopping(destination) {
    closePrompt("cta");
    navigate(destination);
  }

  return (
    <>
      <style>{promptStyles}</style>

      {activePrompt === "welcome" && (
        <div className="luma-growth-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePrompt("backdrop");
        }}>
          <section className="luma-growth-card" role="dialog" aria-modal="true" aria-labelledby="luma-welcome-title">
            <button type="button" className="luma-growth-close" onClick={() => closePrompt()} aria-label="Close welcome offer">
              <X size={18} />
            </button>

            <p className="luma-growth-eyebrow">A little LUMA welcome</p>
            <h2 id="luma-welcome-title">10% off your first ritual.</h2>
            <p className="luma-growth-copy">
              Welcome to softer brow days. Use this code at checkout whenever you are ready to start your LUMA ritual.
            </p>

            <div className="luma-growth-code">
              <span>{WELCOME_CODE}</span>
              <button type="button" onClick={copyWelcomeCode}>
                <Copy size={15} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="luma-growth-actions">
              <button type="button" className="luma-growth-primary" onClick={() => continueShopping("/products")}>
                Shop LUMA <ArrowRight size={17} />
              </button>
              <button type="button" className="luma-growth-secondary" onClick={() => closePrompt("keep_browsing")}>
                Keep browsing
              </button>
            </div>
            <p className="luma-growth-note">One welcome prompt per browser. No annoying repeat pop-ups.</p>
          </section>
        </div>
      )}

      {activePrompt === "exit" && (
        <div className="luma-growth-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePrompt("backdrop");
        }}>
          <section className="luma-growth-card" role="dialog" aria-modal="true" aria-labelledby="luma-exit-title">
            <button type="button" className="luma-growth-close" onClick={() => closePrompt()} aria-label="Close reminder">
              <X size={18} />
            </button>

            <p className="luma-growth-eyebrow"><ShoppingBag size={15} /> Before you go</p>
            <h2 id="luma-exit-title">
              {cartCount > 0 ? "Your LUMA bag is still here." : "Your brow ritual can wait for you."}
            </h2>
            <p className="luma-growth-copy">
              {cartCount > 0
                ? `You still have ${cartCount} item${cartCount === 1 ? "" : "s"} saved in your bag. Finish whenever you're ready.`
                : "Not ready yet? Keep exploring the collection — your recently viewed products will still be easy to find."}
            </p>

            <div className="luma-growth-actions">
              <button type="button" className="luma-growth-primary" onClick={() => continueShopping(cartCount > 0 ? "/cart" : "/products")}>
                {cartCount > 0 ? "Return to bag" : "Keep exploring"} <ArrowRight size={17} />
              </button>
              <button type="button" className="luma-growth-secondary" onClick={() => closePrompt("leave_anyway")}>
                Maybe later
              </button>
            </div>
            <p className="luma-growth-note">This reminder is limited to once every 7 days.</p>
          </section>
        </div>
      )}
    </>
  );
}
