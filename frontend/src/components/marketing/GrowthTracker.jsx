import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { recordAnalyticsEvent, saveUtmParams } from "../../services/growthApi";

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

export function GrowthTracker() {
  const location = useLocation();
  const { user } = useAuth();

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

  return null;
}
