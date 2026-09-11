import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import { PNG } from "pngjs";
interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
interface MoonGeometry { readonly moon: string; readonly moonIndex: number; readonly progress: number; readonly shapeRect: Rect; readonly materialRect: Rect; readonly centerDistance: number; readonly insideDisc: boolean; }
interface CameraMoonGeometry extends MoonGeometry { readonly cameraPitch: number; }
interface TransitCapture { readonly visibleMoonPixelCount: number; readonly visibleMoonCorePixelCount: number; readonly materialDifferenceOverMoonCorePixels: number | null; readonly materialChangedMoonCorePixelPercent: number | null; }

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
const problems: string[] = [];
const externalRequests: string[] = [];
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
    const motion = document.querySelector('input[name="motion"]');
    if (!(motion instanceof HTMLInputElement)) throw new Error("Mars motion control is unavailable.");
    if (!window.__mars) throw new Error("Mars runtime is unavailable.");
    if (motion.checked) motion.click();
    window.__mars.setView({ controlPitch: 65, zoom: 0.8 });
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
    const candidates: CameraMoonGeometry[] = [];
    const allGeometry: CameraMoonGeometry[] = [];
    for (const cameraPitch of [65, 60, 55, 50, 45, 40, 35, 30, 25, 18]) {
      await page.evaluate((pitch) => {
        if (!window.__mars) throw new Error("Mars runtime is unavailable.");
        window.__mars.setView({ controlPitch: pitch, zoom: 0.8 });
      }, cameraPitch);
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
    let selected: (CameraMoonGeometry & TransitCapture) | null = null;
    const attempts: Array<{ readonly progress: number } & TransitCapture> = [];
    for (const candidate of candidates.slice(0, 40)) {
      await page.evaluate((pitch) => {
        if (!window.__mars) throw new Error("Mars runtime is unavailable.");
        window.__mars.setView({ controlPitch: pitch, zoom: 0.8 });
      }, candidate.cameraPitch);
      await settle();
      await setMoonProgress(moonIndex, candidate.progress);
      const capture = await captureTransit(moonIndex, candidate);
      attempts.push({ progress: candidate.progress, ...capture });
      if (capture.visibleMoonPixelCount > 8 &&
          capture.visibleMoonCorePixelCount > 0 &&
          capture.materialDifferenceOverMoonCorePixels !== null &&
          capture.materialChangedMoonCorePixelPercent !== null &&
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
  if (transit.materialDifferenceOverMoonCorePixels === null ||
      transit.materialChangedMoonCorePixelPercent === null ||
      transit.materialDifferenceOverMoonCorePixels > 2 ||
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

async function setMoonProgress(moonIndex: number, progress: number): Promise<MoonGeometry> {
  const geometry = await page.evaluate(({ moonIndex, progress }) => {
    const orbits = [...document.querySelectorAll<HTMLElement>(".mars-moon-orbit")];
    for (const [index, orbit] of orbits.entries()) {
      orbit.style.visibility = index === moonIndex ? "visible" : "hidden";
    }
    const orbit = orbits[moonIndex];
    if (!orbit) throw new Error(`Mars moon ${moonIndex} is unavailable.`);
    const fixed = orbit.querySelector<HTMLElement>(".mars-moon-fixed");
    if (!fixed) throw new Error(`Mars moon ${moonIndex} fixed transform is unavailable.`);
    for (const root of [orbit, fixed]) {
      for (const animation of root.getAnimations()) {
        const duration = animation.effect?.getComputedTiming().duration;
        if (typeof duration !== "number") throw new Error("Mars moon animation duration is unavailable.");
        animation.currentTime = duration * progress;
        animation.pause();
      }
    }
    const shape = orbit.querySelector<HTMLElement>(".mars-moon-shape > s");
    if (!shape) throw new Error(`Mars moon ${moonIndex} shape is unavailable.`);
    const shapeRect = shape.getBoundingClientRect();
    const material = document.querySelector<HTMLElement>(".mars-material-plane > s");
    if (!material) throw new Error("Mars material leaf is unavailable.");
    const materialRect = material.getBoundingClientRect();
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

    function plainRect(rect: DOMRect): Rect {
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

async function captureTransit(moonIndex: number, candidate: MoonGeometry): Promise<TransitCapture> {
  const clip = clipAround(candidate.shapeRect, 4);
  const shown = await page.screenshot({ clip });
  await page.locator(".mars-moon-orbit").nth(moonIndex).evaluate((orbit) => {
    if (!(orbit instanceof HTMLElement)) throw new Error("Mars moon orbit is unavailable.");
    orbit.style.visibility = "hidden";
  });
  await settle();
  const moonHidden = await page.screenshot({ clip });
  await page.locator(".mars-moon-orbit").nth(moonIndex).evaluate((orbit) => {
    if (!(orbit instanceof HTMLElement)) throw new Error("Mars moon orbit is unavailable.");
    orbit.style.visibility = "visible";
  });
  await page.locator(".mars-material").evaluate((material) => {
    if (!(material instanceof HTMLElement)) throw new Error("Mars material is unavailable.");
    material.style.visibility = "hidden";
  });
  await settle();
  const materialHidden = await page.screenshot({ clip });
  await page.locator(".mars-material").evaluate((material) => {
    if (!(material instanceof HTMLElement)) throw new Error("Mars material is unavailable.");
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

function clipAround(rect: Rect, margin: number): Rect {
  const x = Math.max(0, Math.floor(rect.x - margin));
  const y = Math.max(0, Math.floor(rect.y - margin));
  return {
    x,
    y,
    width: Math.min(1280 - x, Math.ceil(rect.width + margin * 2)),
    height: Math.min(900 - y, Math.ceil(rect.height + margin * 2)),
  };
}

function maximumDifference(left: Uint8Array, right: Uint8Array, offset: number): number {
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
