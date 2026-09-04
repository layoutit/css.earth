import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Neptune drag capture accepts DPR 1 or DPR 2.");
}
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `neptune-drag-${timestamp}-dpr${deviceScaleFactor}`,
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
    ]) {
      for (const element of document.querySelectorAll(selector)) {
        element.style.visibility = "hidden";
      }
    }
  });

  let frameIndex = 0;
  async function capture(label) {
    const sample = await page.evaluate(() => ({
      camera: window.__neptune.camera.state(),
      cameraStats: window.__neptune.camera.stats(),
      materialImage: getComputedStyle(document.querySelector(
        ".neptune-exterior-material",
      )).backgroundImage,
      materialPosition: getComputedStyle(document.querySelector(
        ".neptune-exterior-material",
      )).backgroundPosition,
      stable: window.__neptune.assertStableDomIdentity(),
    }));
    const file = `frame_${String(frameIndex).padStart(4, "0")}.png`;
    samples.push({ frameIndex, label, file, ...sample });
    await page.locator(".planet-stage").screenshot({
      path: resolve(frameRoot, file),
    });
    frameIndex += 1;
  }

  await page.evaluate(() => window.__neptune.camera.setState({
    controlPitch: 34.23,
    zoom: 1,
  }));
  await page.waitForTimeout(200);
  await capture("baseline");

  await page.mouse.move(930, 450);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(930, 450 + step * 25);
    await capture(`drag-down-${step}`);
  }
  await page.mouse.up();
  await capture("pointer-up-immediate");
  await page.waitForTimeout(500);
  await capture("pointer-up-settled");

  const report = Object.freeze({
    schema: "cssneptune-drag-capture@1",
    capturedAt: new Date().toISOString(),
    browser: Object.freeze({
      channel: "chrome",
      version: browser.version(),
      headless: true,
    }),
    baseUrl,
    deviceScaleFactor,
    frameCount: frameIndex,
    problems,
    externalRequests,
    samples,
  });
  await writeFile(
    resolve(outputRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (problems.length > 0 || externalRequests.length > 0) {
    throw new Error(`Neptune drag capture is not clean: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({
    ok: true,
    outputRoot,
    frameCount: frameIndex,
  }, null, 2));
} finally {
  await browser.close();
}
