import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
const surfaceDensityOverride = process.argv[4] ?? "prepared";
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Neptune surface audit accepts DPR 1 or DPR 2.");
}
if (!["prepared", "1x", "solid", "tile"].includes(surfaceDensityOverride)) {
  throw new RangeError(
    "Neptune surface audit density override must be prepared, 1x, solid, or tile.",
  );
}
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `neptune-surface-layers-${timestamp}-dpr${deviceScaleFactor}`,
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
  page.on("requestfailed", (request) => {
    problems.push(`requestfailed: ${request.url()} ${
      request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      problems.push(`response ${response.status()}: ${response.url()}`);
    }
  });

  const response = await page.goto(new URL("/neptune/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  if (response?.status() !== 200) {
    throw new Error(`Neptune returned ${response?.status() ?? "no response"}.`);
  }
  await page.waitForFunction(() => window.__neptune?.ready === true);
  await page.evaluate(() => {
    window.__neptune.pause();
    for (const selector of [
      ".planet-topbar",
      ".planet-sidebar",
      ".planet-strip",
      ".planet-settings",
      ".neptune-moon-orbit",
      ".neptune-ring-plane",
    ]) {
      for (const element of document.querySelectorAll(selector)) {
        element.style.visibility = "hidden";
      }
    }
  });
  if (surfaceDensityOverride === "1x") {
    await page.locator(".planet-stage").evaluate((element) => {
      element.style.setProperty(
        "--neptune-surface-image",
        "url(\"/scenes/neptune/neptune-surface-normal.webp\")",
      );
    });
  }
  if (surfaceDensityOverride === "solid") {
    await page.locator(".neptune-surface-face").evaluateAll((elements) => {
      for (const element of elements) {
        element.style.setProperty("background-image", "none", "important");
        element.style.backgroundColor = "#9ad8e9";
      }
    });
  }
  if (surfaceDensityOverride === "tile") {
    await page.locator(".neptune-surface-face").evaluateAll((elements) => {
      for (const element of elements) {
        element.style.setProperty(
          "background-image",
          "url(\"/scenes/neptune/neptune-moon-dots.webp\")",
          "important",
        );
        element.style.backgroundPosition = "0 0";
        element.style.backgroundSize = "64px 64px";
      }
    });
  }

  for (const lens of ["normal", "methane", "near-infrared"]) {
    await page.evaluate((id) => window.__neptune.lenses.select(id), lens);
    for (const pitch of [0, 34.23, 60, 89]) {
      await page.evaluate(({ pitch }) =>
        window.__neptune.camera.setState({ controlPitch: pitch, zoom: 1.1 }), {
        pitch,
      });
      await settle(page);
      await capture("composite", lens, pitch);
      if (lens !== "normal") continue;
      await page.locator(".neptune-fixed-material").evaluate((element) => {
        element.style.visibility = "hidden";
      });
      await capture("body", lens, pitch);
      await page.locator(".neptune-body-polar").evaluate((element) => {
        element.style.visibility = "hidden";
      });
      await capture("surface", lens, pitch);
      await page.locator(".neptune-body-polar").evaluate((element) => {
        element.style.removeProperty("visibility");
      });
      await page.locator(".neptune-body:not(.neptune-body-polar)").evaluate((element) => {
        element.style.visibility = "hidden";
      });
      await capture("polar", lens, pitch);
      await page.locator(".neptune-body:not(.neptune-body-polar)").evaluate((element) => {
        element.style.removeProperty("visibility");
      });
      await page.locator(".neptune-fixed-material").evaluate((element) => {
        element.style.removeProperty("visibility");
      });
      await page.locator(".neptune-body").evaluateAll((elements) => {
        for (const element of elements) element.style.visibility = "hidden";
      });
      await capture("material", lens, pitch);
      await page.locator(".neptune-body").evaluateAll((elements) => {
        for (const element of elements) element.style.removeProperty("visibility");
      });
    }
  }

  const report = Object.freeze({
    schema: "cssneptune-surface-layer-audit@1",
    capturedAt: new Date().toISOString(),
    browser: Object.freeze({
      channel: "chrome",
      version: browser.version(),
      headless: true,
    }),
    baseUrl,
    deviceScaleFactor,
    surfaceDensityOverride,
    captures,
    problems,
    externalRequests,
  });
  await writeFile(
    resolve(outputRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (problems.length > 0 || externalRequests.length > 0) {
    throw new Error(`Neptune surface audit is not clean: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({
    ok: true,
    outputRoot,
    captureCount: captures.length,
  }, null, 2));

  async function capture(layer, lens, pitch) {
    const file = `${lens}-pitch-${String(pitch).replace(".", "_")}-${layer}.png`;
    const state = await page.evaluate(() => ({
      camera: window.__neptune.camera.state(),
      materialRect: (() => {
        const rect = document.querySelector(".neptune-exterior-material")
          .getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })(),
      stableDomIdentity: window.__neptune.assertStableDomIdentity(),
    }));
    await page.locator(".planet-stage").screenshot({
      path: resolve(outputRoot, file),
    });
    captures.push({ layer, lens, pitch, file, ...state });
  }
} finally {
  await browser.close();
}

async function settle(page) {
  await page.waitForTimeout(150);
  await page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}
