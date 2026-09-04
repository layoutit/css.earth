import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Jupiter drag capture accepts DPR 1 or DPR 2.");
}
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `jupiter-drag-current-${timestamp}-dpr${deviceScaleFactor}`,
);
const frameRoot = resolve(outputRoot, "frames");
await mkdir(frameRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const problems = [];
const externalRequests = [];
const samples = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
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
    waitUntil: "domcontentloaded",
  });
  if (response?.status() !== 200) {
    throw new Error(`Jupiter returned ${response?.status() ?? "no response"}.`);
  }
  await page.waitForFunction(() => window.__jupiter?.ready === true);
  await page.evaluate(() => {
    window.__jupiter.pause();
    for (const selector of [
      ".planet-topbar",
      ".planet-sidebar",
      ".planet-strip",
      ".planet-settings",
    ]) {
      for (const element of document.querySelectorAll(selector)) {
        element.style.visibility = "hidden";
      }
    }
  });

  let frameIndex = 0;
  async function capture(label) {
    const sample = await page.evaluate(() => {
      const leaf = document.querySelector(".jupiter-material > s");
      const cache = window.__jupiter.renderStats.materialCache();
      return {
        view: window.__jupiter.view(),
        cache,
        lagRows: cache.appliedRow === null || cache.desiredRow === null
          ? null
          : Math.abs(cache.appliedRow - cache.desiredRow),
        materialImage: getComputedStyle(leaf).backgroundImage,
        materialConnected: leaf?.isConnected === true,
      };
    });
    const file = `frame_${String(frameIndex).padStart(4, "0")}.png`;
    samples.push({ frameIndex, label, file, ...sample });
    await page.locator(".planet-stage").screenshot({
      path: resolve(frameRoot, file),
    });
    frameIndex += 1;
  }

  await page.evaluate(() => window.__jupiter.setView({ pitch: 20.9, zoom: 1 }));
  await settleMaterial(page);
  await capture("baseline");

  await page.mouse.move(930, 450);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(930, 450 + step * 25);
    await capture(`drag-down-${step}`);
  }
  await page.mouse.up();
  await capture("pointer-up-immediate");
  await settleMaterial(page);
  await capture("pointer-up-settled");

  const report = Object.freeze({
    schema: "cssjupiter-current-drag-capture@1",
    capturedAt: new Date().toISOString(),
    browser: Object.freeze({
      channel: "chrome",
      version: browser.version(),
      headless: true,
    }),
    baseUrl,
    deviceScaleFactor,
    frameCount: frameIndex,
    maximumMaterialLagRows: Math.max(...samples.map(({ lagRows }) => lagRows ?? 0)),
    problems,
    externalRequests,
    samples,
  });
  await writeFile(
    resolve(outputRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (problems.length > 0 || externalRequests.length > 0) {
    throw new Error(`Jupiter drag capture is not clean: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({
    ok: true,
    outputRoot,
    frameCount: frameIndex,
    maximumMaterialLagRows: report.maximumMaterialLagRows,
  }, null, 2));
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
