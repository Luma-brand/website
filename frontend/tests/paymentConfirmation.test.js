import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmPayment } from "../src/lib/paymentConfirmation.js";
import { getOrderProgress } from "../src/utils/orderProgress.js";

const paid = { id: "order-123", payment_status: "paid" };

test("waits for a paid order after transient server errors and pending responses", async () => {
  let calls = 0;
  const result = await confirmPayment("reference", {
    verify: async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("Server error"), { status: 500 });
      return { success: true, data: calls === 2 ? { ...paid, payment_status: "pending" } : paid };
    },
    wait: async () => {},
  });
  assert.equal(result.id, paid.id);
  assert.equal(calls, 3);
});

test("never treats an HTTP success with an unpaid or missing order as a successful payment", async () => {
  for (const data of [{ ...paid, payment_status: "failed" }, { payment_status: "paid" }, null]) {
    await assert.rejects(confirmPayment("reference", { verify: async () => ({ success: true, data }), delays: [] }), /still being confirmed/);
  }
});

test("does not repeatedly retry rejected payments or account mismatches", async () => {
  let calls = 0;
  await assert.rejects(confirmPayment("reference", { verify: async () => {
    calls += 1;
    throw Object.assign(new Error("Ownership mismatch"), { status: 403 });
  } }), /Ownership mismatch/);
  assert.equal(calls, 1);
});

test("cancels verification when the customer leaves the callback", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(confirmPayment("reference", {
    signal: controller.signal,
    verify: async () => { calls += 1; controller.abort(); throw new Error("Network error"); },
  }), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("pickup and delivery progress use persisted order status", () => {
  assert.equal(getOrderProgress({ ...paid, status: "processing" }).current, 1);
  assert.equal(getOrderProgress({ ...paid, status: "shipped" }).title, "On the way");
  assert.equal(getOrderProgress({ ...paid, status: "ready_for_pickup", delivery_method: "STUDIO_PICKUP" }).title, "Ready for collection");
  assert.equal(getOrderProgress({ ...paid, status: "delivered", delivery_method: "GIG_PICKUP" }).title, "Collected");
  assert.equal(getOrderProgress({ ...paid, status: "delivered" }).title, "Delivered");
});

test("unpaid, cancelled, refunded and stock-review orders never imply normal fulfilment", () => {
  assert.equal(getOrderProgress({ payment_status: "pending", status: "processing" }).current, -1);
  assert.equal(getOrderProgress({ ...paid, status: "stock_issue" }).current, 0);
  assert.equal(getOrderProgress({ ...paid, status: "cancelled" }).steps.length, 0);
  assert.equal(getOrderProgress({ payment_status: "refunded", status: "delivered" }).title, "Payment refunded");
});
