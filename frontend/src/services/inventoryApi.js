import { api } from "../lib/api";

const getAdminToken = () => localStorage.getItem("luma_admin_token");

const getAdminConfig = () => ({
  headers: {
    Authorization: `Bearer ${getAdminToken()}`,
  },
});

export async function getInventoryOverview() {
  return api.get("/inventory/overview", getAdminConfig());
}

export async function getInventorySummary() {
  return api.get("/inventory/summary", getAdminConfig());
}

export async function getInventoryProducts(params = {}) {
  return api.get("/inventory/products", {
    ...getAdminConfig(),
    params,
  });
}

export async function getStockMovementHistory(params = {}) {
  return api.get("/inventory/movements", {
    ...getAdminConfig(),
    params,
  });
}

export async function getLowStockProducts() {
  return api.get("/inventory/low-stock", getAdminConfig());
}

export async function getOutOfStockProducts() {
  return api.get("/inventory/out-of-stock", getAdminConfig());
}

export async function adjustInventoryStock(productId, stockData) {
  return api.patch(
    `/inventory/products/${productId}/stock`,
    stockData,
    getAdminConfig()
  );
}

export async function postInventoryStockAdjustment(productId, stockData) {
  return api.post(
    `/inventory/products/${productId}/adjust`,
    stockData,
    getAdminConfig()
  );
}
