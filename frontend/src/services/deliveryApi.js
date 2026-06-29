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

export async function createDeliveryZone(payload) {
  return api.post("/delivery/zones", payload, getAdminConfig());
}

export async function updateDeliveryZone(zoneId, payload) {
  return api.patch(`/delivery/zones/${zoneId}`, payload, getAdminConfig());
}
