import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Uranus scene audit accepts DPR 1 or DPR 2.");
}
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `uranus-scene-matrix-${timestamp}-dpr${deviceScaleFactor}`,
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

  const response = await page.goto(new URL("/uranus/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  if (response?.status() !== 200) {
    throw new Error(`Uranus returned ${response?.status() ?? "no response"}.`);
  }
  await page.waitForFunction(() => window.__uranus?.ready === true);
  await page.evaluate(() => window.__uranus.pause());

  for (const lens of ["normal", "methane", "near-infrared"]) {
    await page.evaluate((id) => window.__uranus.lenses.select(id), lens);
    for (const pitch of [0, 34.23, 60, 89]) {
      await capture(`${lens}-pitch-${String(pitch).replace(".", "_")}`, {
        lens,
        pitch,
        zoom: 1.1,
      });
    }
  }

  await page.evaluate((id) => window.__uranus.lenses.select(id), "normal");
  await page.setViewportSize({ width: 680, height: 900 });
  await capture("tablet-default", { lens: "normal", pitch: 34.23, zoom: 1.1 });
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("mobile-default", { lens: "normal", pitch: 34.23, zoom: 1.1 });

  const report = Object.freeze({
    schema: "cssuranus-scene-matrix@1",
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
    throw new Error(`Uranus scene audit is not clean: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({
    ok: true,
    outputRoot,
    captureCount: captures.length,
  }, null, 2));
  await context.close();

  async function capture(label, { lens, pitch, zoom }) {
    await page.evaluate(({ pitch, zoom }) =>
      window.__uranus.camera.setState({ controlPitch: pitch, zoom }), {
      pitch,
      zoom,
    });
    await page.evaluate(() => new Promise((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    await page.waitForTimeout(100);
    const file = `${label}.png`;
    const state = await page.evaluate(() => ({
      camera: window.__uranus.camera.state(),
      stableDomIdentity: window.__uranus.assertStableDomIdentity(),
      retainedLeafCount: window.__uranus.dom.retainedLeafCount,
      stageElementCount: document.querySelector(".planet-stage")
        .querySelectorAll("*").length,
      surfaceFaceCount: document.querySelectorAll(".uranus-surface-face").length,
      ringLeafCount: document.querySelectorAll(".uranus-rings").length,
      ringShadowLeafCount: document.querySelectorAll(
        ".uranus-ring-shadow-leaf",
      ).length,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    }));
    await page.locator(".planet-stage").screenshot({
      path: resolve(outputRoot, file),
    });
    captures.push({ label, file, lens, pitch, zoom, ...state });
  }
} finally {
  await browser.close();
}
