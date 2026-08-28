import { api } from "../lib/api";

const getAdminToken = () => localStorage.getItem("luma_admin_token");

const getAdminConfig = () => ({
  headers: {
    Authorization: `Bearer ${getAdminToken()}`,
  },
});

export async function getDeliveryOverview() {
  return api.get("/delivery/overview", getAdminConfig());
}

export async function getDeliveryQuote(params = {}) {
  return api.get("/delivery/quote", { params });
}

export async function calculateDeliveryFee(payload = {}) {
  return api.post("/delivery/calculate", payload);
}

export async function getShippingStates() {
  return api.get("/delivery/states");
}

export async function getPickupLocations(params = {}, { admin = false } = {}) {
  return api.get(
    admin ? "/delivery/admin/pickup-locations" : "/delivery/pickup-locations",
    admin ? { ...getAdminConfig(), params } : { params }
  );
}

export async function updateDeliverySettings(payload) {
  return api.patch("/delivery/settings", payload, getAdminConfig());
}

export async function recalculateDeliveryRates() {
  return api.post("/delivery/recalculate", {}, getAdminConfig());
}

export async function updatePricingBand(type, bandId, payload) {
  return api.patch(`/delivery/pricing-bands/${type}/${bandId}`, payload, getAdminConfig());
}

export async function updateRegionRule(region, payload) {
  return api.patch(`/delivery/region-rules/${encodeURIComponent(region)}`, payload, getAdminConfig());
}

export async function setDeliveryRouteOverride(routeId, payload) {
  return api.put(`/delivery/routes/${routeId}/override`, payload, getAdminConfig());
}

export async function resetDeliveryRouteOverride(routeId) {
  return api.delete(`/delivery/routes/${routeId}/override`, getAdminConfig());
}

export async function createPickupLocation(payload) {
  return api.post("/delivery/pickup-locations", payload, getAdminConfig());
}

export async function updatePickupLocation(locationId, payload) {
  return api.patch(`/delivery/pickup-locations/${locationId}`, payload, getAdminConfig());
}

export async function createDeliveryZone(payload) {
  return api.post("/delivery/zones", payload, getAdminConfig());
}

export async function updateDeliveryZone(zoneId, payload) {
  return api.patch(`/delivery/zones/${zoneId}`, payload, getAdminConfig());
}
