import { useCallback } from "react";
import { recordAnalyticsEvent } from "../services/growthApi";

export function useAnalytics() {
  const track = useCallback((eventType, metadata = {}) => {
    recordAnalyticsEvent({
      eventType,
      metadata: {
        ...metadata,
        page: window.location.pathname,
        referrer: document.referrer || "direct",
      },
    }).catch(() => {});
  }, []);

  const trackPageView = useCallback((page) => track("page_view", { page }), [track]);

  return { track, trackPageView };
}
