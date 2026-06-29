#!/usr/bin/env node

const backendUrl = String(process.env.BACKEND_URL || "https://website-ikv5.onrender.com").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET;

async function main() {
  if (!cronSecret) {
    throw new Error("CRON_SECRET is required to run the abandoned cart cron script.");
  }

  const response = await fetch(`${backendUrl}/api/cron/abandoned-carts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit: Number(process.env.ABANDONED_CART_CRON_LIMIT || 25) }),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(data.message || `Cron request failed with ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  if (error.data) console.error(JSON.stringify(error.data, null, 2));
  process.exit(1);
});
