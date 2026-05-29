import { useCallback } from "react";
import { api } from "../lib/api";

export function useAnalytics() {
  const track = useCallback((eventType, metadata = {}) => {
    api.post("/analytics/track", {
      eventType,
      page: window.location.pathname,
      metadata,
      source: document.referrer || "direct",
    }).catch(() => {});
  }, []);

  const trackPageView = useCallback((page) => track("page_view", { page }), [track]);

  return { track, trackPageView };
}
