import { trackAffiliateReferral } from "../services/api";

const REFERRAL_KEY = "luma_affiliate_referral_v1";
const VISITOR_KEY = "luma_affiliate_visitor_v1";
let pending = Promise.resolve();
let lastCapture = "";
let sequence = 0;

export function captureAffiliateReferral(code, landingPath) {
  if (!code || !/^LUMA[A-F0-9]{12}$/i.test(code)) return pending;
  const captureKey = code.toUpperCase();
  if (lastCapture === captureKey) return pending;
  lastCapture = captureKey;
  const captureSequence = ++sequence;
  pending = (async () => {
    try {
      let visitorId = localStorage.getItem(VISITOR_KEY);
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem(VISITOR_KEY, visitorId);
      }
      const response = await trackAffiliateReferral({ code: captureKey, visitorId, landingPath });
      if (captureSequence === sequence) localStorage.setItem(REFERRAL_KEY, JSON.stringify(response.data));
    } catch {
      // Invalid links, blocked storage and tracking outages never block browsing or checkout.
      if (captureSequence === sequence) lastCapture = "";
    }
  })();
  return pending;
}

export async function getAffiliateCheckoutToken() {
  await pending;
  try {
    const referral = JSON.parse(localStorage.getItem(REFERRAL_KEY) || "null");
    if (referral?.token && Date.parse(referral.expiresAt) > Date.now()) return referral.token;
    localStorage.removeItem(REFERRAL_KEY);
  } catch { /* Browsers may disable storage. */ }
  return null;
}
