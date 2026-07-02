import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import process from "node:process";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.ADMIN_VERIFY_URL || "http://127.0.0.1:4173";
const port = 9333;
const profile = `${process.env.TEMP || "."}\\luma-admin-layout-${Date.now()}`;
const routes = [
  "analytics", "product-sales", "orders", "discounts", "currency-rates",
  "customers", "product-waitlists", "mail", "inventory", "delivery",
  "growth", "email-broadcasts", "automations", "abandoned-carts",
];

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `${baseUrl}/luma-control-room/login`,
], { stdio: "ignore" });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getDebuggerTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      const target = targets.find((item) => item.type === "page");
      if (target) return target;
    } catch {
      // Chrome may still be starting.
    }
    await wait(250);
  }
  throw new Error("Chrome debugging target did not start.");
}

function createClient(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Fetch.requestPaused") {
      id += 1;
      socket.send(JSON.stringify({
        id,
        method: "Fetch.fulfillRequest",
        params: {
          requestId: message.params.requestId,
          responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body: Buffer.from(JSON.stringify({ success: true, data: {} })).toString("base64"),
        },
      }));
      return;
    }
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    }),
    send(method, params = {}) {
      id += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close: () => socket.close(),
  };
}

const auditExpression = `(() => {
  const visible = (element) => element && element.getClientRects().length > 0;
  const buttons = [...document.querySelectorAll('.admin-shell button, .admin-shell .admin-button')].filter(visible);
  const tabs = [...document.querySelectorAll('.admin-tab, .admin-tabs > button')].filter(visible);
  const checkboxes = [...document.querySelectorAll('.admin-shell input[type="checkbox"]')].filter(visible);
  const selects = [...document.querySelectorAll('.admin-shell select')].filter(visible);
  const shell = document.querySelector('.admin-shell');
  const main = document.querySelector('.admin-main');
  const sidebar = document.querySelector('.admin-sidebar');
  return {
    route: location.pathname,
    viewport: innerWidth,
    pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
    shellHeight: shell ? Math.round(shell.getBoundingClientRect().height) : 0,
    mainOverflowY: main ? getComputedStyle(main).overflowY : '',
    sidebarHeight: sidebar ? Math.round(sidebar.getBoundingClientRect().height) : 0,
    clippedButtons: buttons.filter((item) => item.scrollWidth > item.clientWidth + 1).map((item) => item.textContent.trim()).slice(0, 6),
    wrappedButtons: buttons.filter((item) => getComputedStyle(item).whiteSpace !== 'nowrap' && item.textContent.trim()).map((item) => item.textContent.trim()).slice(0, 6),
    giantCheckboxes: checkboxes.filter((item) => item.getBoundingClientRect().width > 20 || item.getBoundingClientRect().height > 20).length,
    narrowSelects: selects.filter((item) => item.getBoundingClientRect().width < 100).length,
    oversizedTabs: tabs.filter((item) => item.getBoundingClientRect().height > 44).map((item) => item.textContent.trim()),
    tablesWithoutInternalScroll: [...document.querySelectorAll('.admin-table')].filter(visible).filter((table) => !table.closest('.admin-table-wrap, .admin-table-scroll')).length,
  };
})()`;

let client;
let report = { checked: 0, failures: [], error: null };
try {
  const target = await getDebuggerTarget();
  client = createClient(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Fetch.enable", {
    patterns: [
      { urlPattern: "http://localhost:5000/*", requestStage: "Request" },
      { urlPattern: "http://127.0.0.1:5000/*", requestStage: "Request" },
    ],
  });
  await client.send("Runtime.evaluate", {
    expression: `localStorage.setItem('luma_admin_token', 'layout-verification-token'); localStorage.setItem('luma_admin_user', JSON.stringify({email:'layout@luma.test'}));`,
  });

  const results = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await client.send("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1, mobile: viewport.width < 600 });
    for (const route of routes) {
      await client.send("Runtime.evaluate", {
        expression: `localStorage.setItem('luma_admin_token', 'layout-verification-token'); localStorage.setItem('luma_admin_user', JSON.stringify({email:'layout@luma.test'}));`,
      });
      await client.send("Page.navigate", { url: `${baseUrl}/luma-control-room/${route}` });
      await wait(1800);
      let value;
      for (let attempt = 0; attempt < 8 && (!value || value.shellHeight === 0 || !value.route.endsWith(`/${route}`)); attempt += 1) {
        if (value && !value.route.endsWith(`/${route}`)) {
          await client.send("Runtime.evaluate", {
            expression: `localStorage.setItem('luma_admin_token', 'layout-verification-token');`,
          });
          await client.send("Page.navigate", { url: `${baseUrl}/luma-control-room/${route}` });
          await wait(900);
        }
        const result = await client.send("Runtime.evaluate", { expression: auditExpression, returnByValue: true });
        value = result?.result?.value;
        if (!value || value.shellHeight === 0 || !value.route.endsWith(`/${route}`)) await wait(350);
      }
      if (value?.shellHeight === 0 || !value?.route.endsWith(`/${route}`)) {
        await client.send("Runtime.evaluate", {
          expression: `localStorage.setItem('luma_admin_token', 'layout-verification-token');`,
        });
        await client.send("Page.navigate", { url: `${baseUrl}/luma-control-room/${route}` });
        await wait(1800);
        const retry = await client.send("Runtime.evaluate", { expression: auditExpression, returnByValue: true });
        value = retry?.result?.value;
      }
      if (!value) throw new Error(`Unable to inspect ${route}`);
      results.push(value);
    }
  }

  const failures = results.filter((item) =>
    item.pageOverflow || item.clippedButtons.length || item.wrappedButtons.length ||
    item.giantCheckboxes || item.narrowSelects || item.oversizedTabs.length ||
    item.tablesWithoutInternalScroll || item.shellHeight === 0 || item.mainOverflowY !== "auto"
  );

  report = { checked: results.length, failures, error: null };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await fs.writeFile(new URL("./admin-layout-report.json", import.meta.url), JSON.stringify(report, null, 2));
  client?.close();
  chrome.kill();
}
