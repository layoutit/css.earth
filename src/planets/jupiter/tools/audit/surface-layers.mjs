import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Jupiter surface audit accepts DPR 1 or DPR 2.");
}
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `jupiter-surface-layers-${timestamp}-dpr${deviceScaleFactor}`,
);
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const problems = [];
const externalRequests = [];
const captures = [];
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
      ".jupiter-rings",
      ".jupiter-moon-orbit",
      ".jupiter-moon-orbit-guide",
    ]) {
      for (const element of document.querySelectorAll(selector)) {
        element.style.visibility = "hidden";
      }
    }
  });

  for (const lens of ["normal", "ultraviolet", "methane"]) {
    await page.evaluate((id) => window.__jupiter.selectLens(id), lens);
    for (const pitch of [0, 20.9, 55, 89]) {
      await page.evaluate(({ pitch }) =>
        window.__jupiter.setView({ pitch, zoom: 1.1 }), { pitch });
      await settleMaterial(page);
      await capture("composite", lens, pitch);
      if (lens !== "normal") continue;
      await page.locator(".jupiter-material").evaluate((element) => {
        element.style.visibility = "hidden";
      });
      await capture("body", lens, pitch);
      await page.locator(".jupiter-material").evaluate((element) => {
        element.style.removeProperty("visibility");
      });
      await page.locator(".jupiter-body").evaluate((element) => {
        element.style.visibility = "hidden";
      });
      await capture("material", lens, pitch);
      await page.locator(".jupiter-body").evaluate((element) => {
        element.style.removeProperty("visibility");
      });
    }
  }

  const report = Object.freeze({
    schema: "cssjupiter-surface-layer-audit@1",
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
    throw new Error(`Jupiter surface audit is not clean: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({ ok: true, outputRoot, captureCount: captures.length }, null, 2));

  async function capture(layer, lens, pitch) {
    const file = `${lens}-pitch-${String(pitch).replace(".", "_")}-${layer}.png`;
    const state = await page.evaluate(() => ({
      view: window.__jupiter.view(),
      cache: window.__jupiter.renderStats.materialCache(),
      materialRect: (() => {
        const rect = document.querySelector(".jupiter-material > s")
          .getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })(),
    }));
    await page.locator(".planet-stage").screenshot({ path: resolve(outputRoot, file) });
    captures.push({ layer, lens, pitch, file, ...state });
  }
} finally {
  await browser.close();
}

async function settleMaterial(page) {
  try {
    await page.waitForFunction(() => {
      const cache = window.__jupiter?.renderStats.materialCache();
      return cache && cache.pendingCount === 0 &&
        cache.appliedRow === cache.desiredRow;
    }, null, { timeout: 10_000 });
  } catch (error) {
    const cache = await page.evaluate(() =>
      window.__jupiter?.renderStats.materialCache());
    throw new Error(`Jupiter material did not settle: ${JSON.stringify(cache)}`, {
      cause: error,
    });
  }
  await page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}
