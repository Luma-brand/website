import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { captureAffiliateReferral } from "../../lib/affiliateReferral";

export function AffiliateTracker() {
  const { search, pathname } = useLocation();
  const code = new URLSearchParams(search).get("ref");
  useEffect(() => {
    if (!pathname.startsWith("/luma-control-room") && !pathname.startsWith("/admin")) {
      void captureAffiliateReferral(code, pathname);
    }
  }, [code, pathname]);
  return null;
}
