import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Jupiter scene audit accepts DPR 1 or DPR 2.");
}
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `jupiter-scene-matrix-${timestamp}-dpr${deviceScaleFactor}`,
);
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const problems = [];
const externalRequests = [];
const captures = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
      externalRequests.push(request.url());
    }
  });
  page.on("requestfailed", (request) => {
    problems.push(`requestfailed: ${request.url()} ${
      request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      problems.push(`response ${response.status()}: ${response.url()}`);
    }
  });

  const response = await page.goto(new URL("/jupiter/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  if (response?.status() !== 200) {
    throw new Error(`Jupiter returned ${response?.status() ?? "no response"}.`);
  }
  await page.waitForFunction(() => window.__jupiter?.ready === true);
  await page.evaluate(() => window.__jupiter.pause());

  for (const pitch of [0, 20.9, 55, 89]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await capture(`desktop-pitch-${String(pitch).replace(".", "_")}`, pitch, 1.1);
  }
  await page.setViewportSize({ width: 680, height: 900 });
  await capture("tablet-default", 20.9, 1.1);
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("mobile-default", 20.9, 1.1);

  const report = Object.freeze({
    schema: "cssjupiter-scene-matrix@1",
    capturedAt: new Date().toISOString(),
    browser: Object.freeze({
      channel: "chrome",
      version: browser.version(),
      headless: true,
    }),
    baseUrl,
    deviceScaleFactor,
    captures,
    problems,
    externalRequests,
  });
  await writeFile(
    resolve(outputRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (problems.length > 0 || externalRequests.length > 0) {
    throw new Error(`Jupiter scene audit is not clean: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({
    ok: true,
    outputRoot,
    captureCount: captures.length,
  }, null, 2));
  await context.close();

  async function capture(label, pitch, zoom) {
    await page.evaluate(({ pitch, zoom }) =>
      window.__jupiter.setView({ pitch, zoom }), { pitch, zoom });
    await settleMaterial(page);
    const state = await page.evaluate(() => ({
      view: window.__jupiter.view(),
      stableDomIdentity: window.__jupiter.assertStableDomIdentity(),
      retainedLeafCount: window.__jupiter.dom.retainedLeafCount,
      stageElementCount: document.querySelector(".planet-stage")
        .querySelectorAll("*").length,
      ringLeafCount: document.querySelectorAll(".jupiter-ring-leaf").length,
      ringVisibleLeafCount: [...document.querySelectorAll(".jupiter-ring-leaf")]
        .filter((leaf) => getComputedStyle(leaf).visibility !== "hidden").length,
      materialCache: window.__jupiter.renderStats.materialCache(),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    }));
    const file = `${label}.png`;
    await page.locator(".planet-stage").screenshot({
      path: resolve(outputRoot, file),
    });
    captures.push({ label, file, ...state });
  }
} finally {
  await browser.close();
}

async function settleMaterial(page) {
  await page.waitForFunction(() => {
    const cache = window.__jupiter?.renderStats.materialCache();
    return cache && cache.pendingCount === 0 &&
      cache.appliedRow === cache.desiredRow;
  }, null, { timeout: 10_000 });
  await page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}
