import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:4210/mars/");
const framesRoot = resolve(
  process.argv[3] ?? "output/playwright/mars-motion-frames",
);
const deviceScaleFactor = Number(process.argv[4] ?? 2);
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Mars motion capture accepts DPR 1 or DPR 2.");
}
await mkdir(framesRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor,
  reducedMotion: "no-preference",
});
const page = await context.newPage();
try {
  const response = await page.goto(baseUrl.href, { waitUntil: "networkidle" });
  if (response?.status() !== 200) {
    throw new Error(`Mars returned ${response?.status() ?? "no response"}.`);
  }
  await page.waitForFunction(() => window.__mars?.ready === true);
  await page.evaluate(() => {
    window.__mars.pause();
    for (const orbit of document.querySelectorAll(".mars-moon-orbit")) {
      orbit.style.visibility = "hidden";
    }
  });
  const pitches = [
    ...Array.from({ length: 33 }, (_, index) => index / 32 * 65),
    ...Array.from({ length: 32 }, (_, index) => (31 - index) / 32 * 65),
  ];
  for (const [index, pitch] of pitches.entries()) {
    await page.evaluate(({ pitch }) =>
      window.__mars.setView({ pitch, zoom: 0.8 }), { pitch });
    await page.waitForFunction(() => {
      const cache = window.__mars.renderStats.materialCache();
      return cache.pendingRowCount === 0 &&
        cache.appliedFrame === cache.desiredFrame;
    }, null, { timeout: 10_000 });
    await page.evaluate(() => new Promise((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const rect = await page.locator(".mars-material-plane > s").evaluate((leaf) => {
      const bounds = leaf.getBoundingClientRect();
      const margin = 16;
      return {
        x: Math.max(0, bounds.x - margin),
        y: Math.max(0, bounds.y - margin),
        width: Math.min(innerWidth, bounds.right + margin) -
          Math.max(0, bounds.x - margin),
        height: Math.min(innerHeight, bounds.bottom + margin) -
          Math.max(0, bounds.y - margin),
      };
    });
    await page.screenshot({
      path: resolve(
        framesRoot,
        `frame_${String(index).padStart(4, "0")}.png`,
      ),
      clip: rect,
    });
  }
  console.log(JSON.stringify({
    ok: true,
    framesRoot,
    frameCount: pitches.length,
    deviceScaleFactor,
    pitchRange: [0, 65],
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
