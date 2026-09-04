import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
const renderMode = process.argv[4] ?? "prepared";
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Neptune ring audit accepts DPR 1 or DPR 2.");
}
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `neptune-ring-layer-${timestamp}-dpr${deviceScaleFactor}`,
);
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  await page.goto(new URL("/neptune/", baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__neptune?.ready === true);
  const geometry = await page.evaluate(() => {
    window.__neptune.pause();
    const material = document.querySelector(".neptune-exterior-material")
      .getBoundingClientRect();
    for (const selector of [
      ".planet-topbar",
      ".planet-sidebar",
      ".planet-strip",
      ".planet-settings",
      ".neptune-moon-orbit",
      ".neptune-body",
      ".neptune-fixed-material",
    ]) {
      for (const element of document.querySelectorAll(selector)) {
        element.style.visibility = "hidden";
      }
    }
    const ring = document.querySelector(".neptune-ring-plane");
    const ringLeaf = ring.querySelector("s");
    const ringRect = ringLeaf.getBoundingClientRect();
    const ringComputed = getComputedStyle(ringLeaf);
    return {
      planet: {
        left: material.left,
        right: material.right,
        top: material.top,
        bottom: material.bottom,
      },
      ring: {
        parentClass: ring.className,
        stageClass: ring.closest(".planet-stage").className,
        style: ringLeaf.getAttribute("style"),
        rect: {
          left: ringRect.left,
          right: ringRect.right,
          top: ringRect.top,
          bottom: ringRect.bottom,
          width: ringRect.width,
          height: ringRect.height,
        },
        computed: {
          display: ringComputed.display,
          visibility: ringComputed.visibility,
          opacity: ringComputed.opacity,
          backgroundImage: ringComputed.backgroundImage,
          backgroundSize: ringComputed.backgroundSize,
        },
      },
    };
  });
  if (renderMode === "solid") {
    await page.locator(".neptune-ring-plane > s").evaluate((element) => {
      element.style.setProperty("background-image", "none", "important");
      element.style.backgroundColor = "#ffffff";
    });
  }
  await settle(page);
  const ringPath = resolve(outputRoot, "ring-only.png");
  const hiddenPath = resolve(outputRoot, "ring-hidden.png");
  await page.locator(".planet-stage").screenshot({ path: ringPath });
  await page.locator(".neptune-ring-plane").evaluate((element) => {
    element.style.visibility = "hidden";
  });
  await page.locator(".planet-stage").screenshot({ path: hiddenPath });
  const [ring, hidden] = await Promise.all([
    sharp(ringPath).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(hiddenPath).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const splitLeft = Math.floor(geometry.planet.left * deviceScaleFactor);
  const splitRight = Math.ceil(geometry.planet.right * deviceScaleFactor);
  const result = {
    left: { changed: 0, maximum: 0 },
    center: { changed: 0, maximum: 0 },
    right: { changed: 0, maximum: 0 },
  };
  for (let y = 0; y < ring.info.height; y += 1) {
    for (let x = 0; x < ring.info.width; x += 1) {
      const side = x < splitLeft ? "left" : x >= splitRight ? "right" : "center";
      const offset = (y * ring.info.width + x) * ring.info.channels;
      const difference = Math.max(
        Math.abs(ring.data[offset] - hidden.data[offset]),
        Math.abs(ring.data[offset + 1] - hidden.data[offset + 1]),
        Math.abs(ring.data[offset + 2] - hidden.data[offset + 2]),
      );
      result[side].maximum = Math.max(result[side].maximum, difference);
      if (difference >= 1) result[side].changed += 1;
    }
  }
  const report = {
    schema: "cssneptune-ring-layer-audit@1",
    browser: { channel: "chrome", version: browser.version(), headless: true },
    baseUrl,
    deviceScaleFactor,
    renderMode,
    geometry,
    result,
    captures: ["ring-only.png", "ring-hidden.png"],
  };
  await writeFile(resolve(outputRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, outputRoot, result }, null, 2));
} finally {
  await browser.close();
}

async function settle(page) {
  await page.waitForTimeout(150);
  await page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}
