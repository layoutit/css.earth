import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import { PNG } from "pngjs";

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:4210/mars/");
const outputRoot = resolve(
  process.argv[3] ?? "output/playwright/mars-moon-depth",
);
const deviceScaleFactor = Number(process.argv[4] ?? 2);
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Mars moon-depth audit accepts DPR 1 or DPR 2.");
}

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const browserVersion = browser.version();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor,
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const problems = [];
const externalRequests = [];
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) {
    problems.push(`${message.type()}: ${message.text()}`);
  }
});
page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
page.on("request", (request) => {
  if (new URL(request.url()).origin !== baseUrl.origin) {
    externalRequests.push(request.url());
  }
});

let report;
try {
  const response = await page.goto(baseUrl.href, { waitUntil: "networkidle" });
  if (response?.status() !== 200) {
    throw new Error(`Mars returned ${response?.status() ?? "no response"}.`);
  }
  await page.waitForFunction(() => window.__mars?.ready === true);
  await page.evaluate(() => {
    window.__mars.pause();
    window.__mars.setView({ pitch: 65, zoom: 0.8 });
    for (const animation of document.getAnimations()) animation.pause();
  });
  await settle();
  const depthContext = await page.evaluate(() => ({
    renderRootCount: document.querySelectorAll(
      ".planet-stage > .planet-render-root",
    ).length,
    materialSharesMoonScene:
      document.querySelector(".mars-material")?.closest(".polycss-scene") ===
      document.querySelector(".mars-moon-shape")?.closest(".polycss-scene"),
  }));
  const moons = await page.locator(".mars-moon-orbit").count();
  const transits = [];
  for (let moonIndex = 0; moonIndex < moons; moonIndex += 1) {
    const candidates = [];
    const allGeometry = [];
    for (const cameraPitch of [65, 60, 55, 50, 45, 40, 35, 30, 25, 18]) {
      await page.evaluate((pitch) =>
        window.__mars.setView({ pitch, zoom: 0.8 }), cameraPitch);
      await settle();
      for (let step = 0; step < 128; step += 1) {
        const geometry = await setMoonProgress(moonIndex, step / 128);
        const candidate = { ...geometry, cameraPitch };
        allGeometry.push(candidate);
        if (!candidate.insideDisc) continue;
        candidates.push(candidate);
      }
      if (candidates.some(({ centerDistance }) => centerDistance < 0.8)) break;
    }
    candidates.sort((left, right) => left.centerDistance - right.centerDistance);
    let selected = null;
    const attempts = [];
    for (const candidate of candidates.slice(0, 40)) {
      await page.evaluate((pitch) =>
        window.__mars.setView({ pitch, zoom: 0.8 }), candidate.cameraPitch);
      await settle();
      await setMoonProgress(moonIndex, candidate.progress);
      const capture = await captureTransit(moonIndex, candidate);
      attempts.push({ progress: candidate.progress, ...capture });
      if (capture.visibleMoonPixelCount > 8 &&
          capture.visibleMoonCorePixelCount > 0 &&
          capture.materialDifferenceOverMoonCorePixels <= 2 &&
          capture.materialChangedMoonCorePixelPercent <= 5) {
        selected = { ...candidate, ...capture };
        break;
      }
    }
    if (!selected) {
      throw new Error(
        `No visible foreground transit found for moon ${moonIndex}: ` +
        JSON.stringify({ candidateCount: candidates.length, candidates: candidates.slice(0, 5), nearest: allGeometry.sort((a,b)=>a.centerDistance-b.centerDistance).slice(0,5), attempts }),
      );
    }
    transits.push(selected);
  }
  report = Object.freeze({
    schema: "cssmars-moon-depth-audit@1",
    capturedAt: new Date().toISOString(),
    browser: { channel: "chrome", version: browserVersion, headless: true },
    baseUrl: baseUrl.href,
    deviceScaleFactor,
    depthContext,
    transits,
    problems,
    externalRequests,
  });
  await writeFile(
    resolve(outputRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
} finally {
  await context.close();
  await browser.close();
}

if (!report.depthContext.materialSharesMoonScene ||
    report.depthContext.renderRootCount !== 1) {
  throw new Error(`Mars depth context is split: ${JSON.stringify(report.depthContext)}`);
}
for (const transit of report.transits) {
  if (transit.materialDifferenceOverMoonCorePixels > 2 ||
      transit.materialChangedMoonCorePixelPercent > 5) {
    throw new Error(
      `Mars material overpainted ${transit.moon}: ${JSON.stringify(transit)}`,
    );
  }
}
if (problems.length > 0 || externalRequests.length > 0) {
  throw new Error(JSON.stringify({ problems, externalRequests }));
}
console.log(JSON.stringify({ ok: true, outputRoot, ...report }, null, 2));

async function setMoonProgress(moonIndex, progress) {
  const geometry = await page.evaluate(({ moonIndex, progress }) => {
    const orbits = [...document.querySelectorAll(".mars-moon-orbit")];
    for (const [index, orbit] of orbits.entries()) {
      orbit.style.visibility = index === moonIndex ? "visible" : "hidden";
    }
    const orbit = orbits[moonIndex];
    const fixed = orbit.querySelector(".mars-moon-fixed");
    for (const root of [orbit, fixed]) {
      for (const animation of root.getAnimations()) {
        const duration = animation.effect.getComputedTiming().duration;
        animation.currentTime = duration * progress;
        animation.pause();
      }
    }
    const shape = orbit.querySelector(".mars-moon-shape > s");
    const shapeRect = shape.getBoundingClientRect();
    const materialRect = document.querySelector(".mars-material-plane > s")
      .getBoundingClientRect();
    const center = {
      x: shapeRect.x + shapeRect.width / 2,
      y: shapeRect.y + shapeRect.height / 2,
    };
    const discCenter = {
      x: materialRect.x + materialRect.width / 2,
      y: materialRect.y + materialRect.height / 2,
    };
    const normalizedX = (center.x - discCenter.x) / (materialRect.width / 2);
    const normalizedY = (center.y - discCenter.y) / (materialRect.height / 2);
    return {
      moon: orbit.querySelector(".mars-moon-label")?.textContent ??
        `moon-${moonIndex}`,
      moonIndex,
      progress,
      shapeRect: plainRect(shapeRect),
      materialRect: plainRect(materialRect),
      centerDistance: Math.hypot(normalizedX, normalizedY),
      insideDisc: normalizedX ** 2 + normalizedY ** 2 < 0.94 ** 2,
    };

    function plainRect(rect) {
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }
  }, { moonIndex, progress });
  await settle();
  return geometry;
}

async function captureTransit(moonIndex, candidate) {
  const clip = clipAround(candidate.shapeRect, 4);
  const shown = await page.screenshot({ clip });
  await page.locator(".mars-moon-orbit").nth(moonIndex).evaluate((orbit) => {
    orbit.style.visibility = "hidden";
  });
  await settle();
  const moonHidden = await page.screenshot({ clip });
  await page.locator(".mars-moon-orbit").nth(moonIndex).evaluate((orbit) => {
    orbit.style.visibility = "visible";
  });
  await page.locator(".mars-material").evaluate((material) => {
    material.style.visibility = "hidden";
  });
  await settle();
  const materialHidden = await page.screenshot({ clip });
  await page.locator(".mars-material").evaluate((material) => {
    material.style.visibility = "visible";
  });
  await settle();
  const prefix = `${candidate.moon.toLowerCase()}-foreground-transit`;
  await Promise.all([
    writeFile(resolve(outputRoot, `${prefix}-composite.png`), shown),
    writeFile(resolve(outputRoot, `${prefix}-moon-hidden.png`), moonHidden),
    writeFile(resolve(outputRoot, `${prefix}-material-hidden.png`), materialHidden),
  ]);
  const composite = PNG.sync.read(shown);
  const withoutMoon = PNG.sync.read(moonHidden);
  const withoutMaterial = PNG.sync.read(materialHidden);
  let visibleMoonPixelCount = 0;
  let materialChangedMoonPixels = 0;
  let materialDifferenceOverMoonPixels = 0;
  let visibleMoonCorePixelCount = 0;
  let materialChangedMoonCorePixels = 0;
  let materialDifferenceOverMoonCorePixels = 0;
  for (let offset = 0; offset < composite.data.length; offset += 4) {
    const moonDifference = maximumDifference(
      composite.data,
      withoutMoon.data,
      offset,
    );
    if (moonDifference <= 4) continue;
    visibleMoonPixelCount += 1;
    const materialDifference = maximumDifference(
      composite.data,
      withoutMaterial.data,
      offset,
    );
    materialDifferenceOverMoonPixels += materialDifference;
    if (materialDifference > 4) materialChangedMoonPixels += 1;
    const pixelIndex = offset / 4;
    const x = pixelIndex % composite.width;
    const y = Math.floor(pixelIndex / composite.width);
    const core = Math.abs(x - composite.width / 2) <= composite.width * 0.25 &&
      Math.abs(y - composite.height / 2) <= composite.height * 0.25;
    if (core) {
      visibleMoonCorePixelCount += 1;
      materialDifferenceOverMoonCorePixels += materialDifference;
      if (materialDifference > 4) materialChangedMoonCorePixels += 1;
    }
  }
  return Object.freeze({
    clip,
    visibleMoonPixelCount,
    materialDifferenceOverMoonPixels: visibleMoonPixelCount === 0 ? null :
      Number((materialDifferenceOverMoonPixels / visibleMoonPixelCount).toFixed(6)),
    materialChangedMoonPixels,
    materialChangedMoonPixelPercent: visibleMoonPixelCount === 0 ? null :
      Number((materialChangedMoonPixels / visibleMoonPixelCount * 100).toFixed(6)),
    visibleMoonCorePixelCount,
    materialDifferenceOverMoonCorePixels:
      visibleMoonCorePixelCount === 0 ? null : Number((
        materialDifferenceOverMoonCorePixels / visibleMoonCorePixelCount
      ).toFixed(6)),
    materialChangedMoonCorePixels,
    materialChangedMoonCorePixelPercent:
      visibleMoonCorePixelCount === 0 ? null : Number((
        materialChangedMoonCorePixels / visibleMoonCorePixelCount * 100
      ).toFixed(6)),
    files: Object.freeze({
      composite: `${prefix}-composite.png`,
      moonHidden: `${prefix}-moon-hidden.png`,
      materialHidden: `${prefix}-material-hidden.png`,
    }),
  });
}

function clipAround(rect, margin) {
  const x = Math.max(0, Math.floor(rect.x - margin));
  const y = Math.max(0, Math.floor(rect.y - margin));
  return {
    x,
    y,
    width: Math.min(1280 - x, Math.ceil(rect.width + margin * 2)),
    height: Math.min(900 - y, Math.ceil(rect.height + margin * 2)),
  };
}

function maximumDifference(left, right, offset) {
  return Math.max(
    Math.abs(left[offset] - right[offset]),
    Math.abs(left[offset + 1] - right[offset + 1]),
    Math.abs(left[offset + 2] - right[offset + 2]),
    Math.abs(left[offset + 3] - right[offset + 3]),
  );
}

function settle() {
  return page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}
