import { useEffect, useState } from "react";
import { ArrowRight, Copy, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getActivePromotion } from "../../services/api";
import { recordAnalyticsEvent, saveUtmParams } from "../../services/growthApi";

function getUtmParams(search) {
  const params = new URLSearchParams(search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

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
    // A promotion must never block shopping.
  }
}

function isPromptEligiblePath(pathname) {
  return pathname === "/" || pathname === "/products" || pathname.startsWith("/products/") || pathname === "/cart";
}

const promptStyles = `
  .luma-growth-overlay {
    position: fixed; inset: 0; z-index: 9990; display: grid; place-items: center;
    padding: 20px; background: rgba(22, 22, 22, 0.48); backdrop-filter: blur(8px);
    animation: luma-growth-fade 180ms ease both;
  }
  .luma-growth-card {
    position: relative; width: min(470px, 100%); padding: 34px;
    border: 1px solid rgba(22, 22, 22, 0.12); border-radius: 28px;
    background: #fffaf0; box-shadow: 0 28px 80px rgba(22, 22, 22, 0.24);
    color: var(--color-ink, #161616); animation: luma-growth-rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .luma-growth-close {
    position: absolute; top: 16px; right: 16px; display: grid; width: 38px; height: 38px;
    place-items: center; border: 1px solid rgba(22, 22, 22, 0.12); border-radius: 999px;
    background: #fffaf0; color: #161616; cursor: pointer;
  }
  .luma-growth-eyebrow {
    display: inline-flex; margin: 0 0 16px; padding: 8px 12px; border-radius: 999px;
    background: var(--color-yellow, #fff19f); font-family: var(--font-serif, serif); font-size: 0.9rem;
  }
  .luma-growth-card h2 {
    max-width: 390px; margin: 0; padding-right: 24px; font-size: clamp(2rem, 7vw, 3rem);
    line-height: 1; letter-spacing: -0.055em;
  }
  .luma-growth-copy { margin: 16px 0 0; color: var(--color-muted, #66645f); font-size: 0.98rem; line-height: 1.65; }
  .luma-growth-code {
    display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 22px;
    padding: 13px 14px 13px 17px; border: 1px dashed rgba(22, 22, 22, 0.32);
    border-radius: 16px; background: #fff;
  }
  .luma-growth-code span { overflow: hidden; font-size: 1.05rem; font-weight: 900; letter-spacing: 0.07em; text-overflow: ellipsis; }
  .luma-growth-code button, .luma-growth-primary, .luma-growth-secondary {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 999px;
    font-weight: 800; cursor: pointer;
  }
  .luma-growth-code button { min-height: 36px; padding: 0 12px; border: 0; background: #161616; color: #fff6d6; }
  .luma-growth-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  .luma-growth-primary, .luma-growth-secondary { min-height: 46px; padding: 0 18px; }
  .luma-growth-primary { border: 1px solid #161616; background: #161616; color: #fff6d6; }
  .luma-growth-secondary { border: 1px solid rgba(22, 22, 22, 0.15); background: transparent; color: #161616; }
  @keyframes luma-growth-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes luma-growth-rise { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @media (max-width: 640px) {
    .luma-growth-overlay { padding: 14px; }
    .luma-growth-card { padding: 28px 20px 22px; border-radius: 24px; }
    .luma-growth-card h2 { font-size: clamp(1.9rem, 10vw, 2.55rem); }
    .luma-growth-actions { display: grid; }
    .luma-growth-primary, .luma-growth-secondary { width: 100%; }
  }
`;

export function GrowthTracker() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [promotion, setPromotion] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const eligiblePath = isPromptEligiblePath(location.pathname);

  useEffect(() => {
    const utm = getUtmParams(location.search);
    const path = `${location.pathname}${location.search}`;
    saveUtmParams(utm);
    void recordAnalyticsEvent({ eventType: "page_view", customerEmail: user?.email, utm, metadata: { path } }).catch(() => {});
  }, [location.pathname, location.search, user?.email]);

  useEffect(() => {
    if (!eligiblePath) return undefined;

    let mounted = true;
    let timer;
    let handleExitIntent;

    async function loadPromotion() {
      try {
        const response = await getActivePromotion();
        const nextPromotion = response.data;
        if (!mounted || !nextPromotion?.id) return;

        const storageKey = `luma_promotion_${nextPromotion.id}_shown_at`;
        const lastShown = Number(getStoredValue(storageKey) || 0);
        const frequencyMs = Math.max(1, Number(nextPromotion.frequencyHours || 168)) * 60 * 60 * 1000;
        if (lastShown && Date.now() - lastShown < frequencyMs) return;

        setPromotion(nextPromotion);
        let hasShown = false;

        function showPromotion(trigger) {
          if (!mounted || hasShown) return;
          hasShown = true;
          setStoredValue(storageKey, String(Date.now()));
          setIsOpen(true);
          void recordAnalyticsEvent({
            eventType: "marketing_prompt_view",
            customerEmail: user?.email,
            metadata: {
              prompt: "admin_promotion",
              trigger,
              promotionId: nextPromotion.id,
              code: nextPromotion.code,
            },
          }).catch(() => {});
        }

        handleExitIntent = (event) => {
          if (event.relatedTarget || event.clientY > 8) return;
          showPromotion("exit_intent");
        };

        document.addEventListener("mouseout", handleExitIntent);
        timer = window.setTimeout(() => showPromotion("timed"), 6500);
      } catch {
        // No configured promotion is a valid storefront state.
      }
    }

    void loadPromotion();
    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
      if (handleExitIntent) document.removeEventListener("mouseout", handleExitIntent);
    };
  }, [eligiblePath, user?.email]);

  function closePrompt(action = "dismiss") {
    if (promotion) {
      void recordAnalyticsEvent({
        eventType: "marketing_prompt_action",
        customerEmail: user?.email,
        metadata: { prompt: "admin_promotion", promotionId: promotion.id, action },
      }).catch(() => {});
    }
    setIsOpen(false);
    setCopied(false);
  }

  async function copyPromotionCode() {
    if (!promotion?.code) return;
    try {
      await navigator.clipboard.writeText(promotion.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }

    void recordAnalyticsEvent({
      eventType: "marketing_prompt_action",
      customerEmail: user?.email,
      metadata: { prompt: "admin_promotion", promotionId: promotion.id, action: "copy_code", code: promotion.code },
    }).catch(() => {});
  }

  function continueShopping() {
    const destination = promotion?.ctaPath || "/products";
    closePrompt("cta");
    navigate(destination);
  }

  return (
    <>
      <style>{promptStyles}</style>
      {eligiblePath && isOpen && promotion && (
        <div className="luma-growth-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePrompt("backdrop");
        }}>
          <section className="luma-growth-card" role="dialog" aria-modal="true" aria-labelledby="luma-promotion-title">
            <button type="button" className="luma-growth-close" onClick={() => closePrompt()} aria-label="Close promotion">
              <X size={18} />
            </button>
            <p className="luma-growth-eyebrow">A LUMA offer</p>
            <h2 id="luma-promotion-title">{promotion.headline}</h2>
            <p className="luma-growth-copy">{promotion.message}</p>
            <div className="luma-growth-code">
              <span>{promotion.code}</span>
              <button type="button" onClick={copyPromotionCode}>
                <Copy size={15} /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="luma-growth-actions">
              <button type="button" className="luma-growth-primary" onClick={continueShopping}>
                {promotion.ctaLabel} <ArrowRight size={17} />
              </button>
              <button type="button" className="luma-growth-secondary" onClick={() => closePrompt("keep_browsing")}>
                Keep browsing
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
