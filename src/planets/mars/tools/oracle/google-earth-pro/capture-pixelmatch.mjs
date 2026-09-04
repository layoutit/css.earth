import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import { createPixelmatchTriptych } from "./triptych.mjs";

const ROOT = resolve(import.meta.dirname, "../../../../../..");
const DEFAULT_EVIDENCE_ROOT = resolve(
  ROOT,
  "output/playwright/" +
    "google-earth-pro-mars-oracle-20260902-headless-final-v5",
);
const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210/mars/";
const nativePath = resolve(process.argv[3] ?? resolve(
  DEFAULT_EVIDENCE_ROOT,
  "interaction-default-v2/native-stability-b.jpg",
));
const outputRoot = resolve(process.argv[4] ?? resolve(
  DEFAULT_EVIDENCE_ROOT,
  "pixelmatch-default",
));
const nativeEvidencePath = resolve(
  DEFAULT_EVIDENCE_ROOT,
  "interaction-default-v2/interaction-evidence.json",
);

const VIEWPORT = Object.freeze({ width: 2092, height: 1295 });
const COMPARISON_CROP = Object.freeze({
  left: 0,
  top: 0,
  width: 2092,
  height: 1150,
});
const BROWSER_VIEW = Object.freeze({
  controlPitch: 170,
  controlYaw: -67.5,
  zoom: 2.18,
});
const COMPARISON_THRESHOLD = 0.1;

await mkdir(outputRoot, { recursive: true });
const browserStabilityAPath = resolve(outputRoot, "browser-stability-a.png");
const browserStabilityBPath = resolve(outputRoot, "browser-stability-b.png");
const nativeComparisonPath = resolve(outputRoot, "native-comparison.png");
const browserComparisonPath = resolve(outputRoot, "browser-comparison.png");
const triptychPath = resolve(outputRoot, "native-browser-pixelmatch.png");
const pairingEvidencePath = resolve(outputRoot, "pairing-evidence.json");
const metricsPath = resolve(outputRoot, "pixelmatch-metrics.json");

const nativeEvidence = JSON.parse(await readFile(nativeEvidencePath, "utf8"));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});

let browserState;
const browserProblems = [];
const externalRequests = [];
try {
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserProblems.push(`pageerror: ${error.message}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      externalRequests.push(request.url());
    }
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__mars?.ready === true);
  await page.addStyleTag({ content: `
    body > :not(.planet-stage) { display: none !important; }
    .planet-stage { inset: 0 !important; }
    .planet-stage > .planet-render-root { translate: 0 0 !important; }
  ` });
  await page.evaluate((view) => {
    document.body.dataset.sidebarCollapsed = "true";
    const stage = document.querySelector(".planet-stage");
    stage.dataset.moons = "false";
    const shadows = document.querySelector(
      '.planet-settings input[name="shadows"]',
    );
    if (shadows.checked) shadows.click();
    window.__mars.pause();
    window.__mars.setView(view);
    for (const animation of stage.getAnimations({ subtree: true })) {
      animation.pause();
    }
  }, BROWSER_VIEW);
  await page.waitForFunction(() =>
    window.__mars.renderStats.materialCache().pendingCount === 0);
  await page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
  await page.waitForTimeout(250);

  browserState = await page.evaluate(() => {
    const hitTestStyle = document.createElement("style");
    hitTestStyle.textContent = `
      .planet-render-root, .polycss-scene, .mars-system, .mars-body,
      .mars-body > s { pointer-events: auto !important; }
      .mars-material-counter { pointer-events: none !important; }
    `;
    document.head.appendChild(hitTestStyle);
    const centerX = Math.floor(innerWidth / 2);
    const centerY = Math.floor(innerHeight / 2);
    const leaves = [...document.querySelectorAll(".mars-body > s")];
    const centerLeaf = document.elementsFromPoint(centerX, centerY)
      .find((element) => element.matches?.(".mars-body > s"));
    const surfaceLeafIndex = leaves.indexOf(centerLeaf);
    hitTestStyle.remove();
    const centerSurface = surfaceLeafIndex >= 0 && surfaceLeafIndex < 512
      ? {
          surfaceLeafIndex,
          latitudeIndex: Math.floor(surfaceLeafIndex / 32) + 1,
          longitudeIndex: surfaceLeafIndex % 32,
          longitudeSegments: 32,
          latitudeBands: 18,
        }
      : {
          surfaceLeafIndex,
          pole: centerLeaf?.classList.contains("mars-pole") ?? false,
        };
    return {
      camera: window.__mars.camera.state(),
      sky: window.__mars.sky.state(),
      materialCache: window.__mars.renderStats.materialCache(),
      centerSurface,
      selectedPreparedDensity:
        window.__mars.renderStats.selectedPreparedDensity,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        devicePixelRatio,
      },
      ui: {
        sidebarCollapsed: document.body.dataset.sidebarCollapsed === "true",
        moonsVisible: document.querySelector(".planet-stage").dataset.moons !==
          "false",
        shadowsChecked: document.querySelector(
          '.planet-settings input[name="shadows"]',
        ).checked,
      },
      animations: document.querySelector(".planet-stage")
        .getAnimations({ subtree: true })
        .map(({ playState }) => playState),
    };
  });

  await page.screenshot({ path: browserStabilityAPath, type: "png" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: browserStabilityBPath, type: "png" });
} finally {
  await browser.close();
}

const browserStability = await compareDecodedImages(
  browserStabilityAPath,
  browserStabilityBPath,
  3,
);
if (browserStability.changedPixelRatioAboveTolerance > 0.0005) {
  throw new Error(
    "INVALID unstable browser capture: " +
      `${browserStability.changedPixelRatioAboveTolerance} pixels differ`,
  );
}

await Promise.all([
  sharp(nativePath).rotate().extract(COMPARISON_CROP).png()
    .toFile(nativeComparisonPath),
  sharp(browserStabilityBPath).rotate().extract(COMPARISON_CROP).png()
    .toFile(browserComparisonPath),
]);

const [nativeSphere, browserSphere] = await Promise.all([
  largestBrightComponent(nativeComparisonPath, 20),
  largestBrightComponent(browserComparisonPath, 20),
]);
const pixelmatchMetrics = await createPixelmatchTriptych({
  referencePath: nativeComparisonPath,
  candidatePath: browserComparisonPath,
  outputPath: triptychPath,
  threshold: COMPARISON_THRESHOLD,
});
await writeFile(metricsPath, `${JSON.stringify(pixelmatchMetrics, null, 2)}\n`);

const configuredNativeState = [...nativeEvidence.instrumentation.after]
  .reverse()
  .find((event) => event.event === "runtime-state" &&
    event.stage === "configured");
const nativeActions = Object.fromEntries(
  (configuredNativeState?.qtActions ?? []).map((action) => [
    action.objectName,
    action.checked,
  ]),
);
const pairingEvidence = {
  schema: "cssmars-google-earth-pro-native-browser-pairing@1",
  qualification:
    "PAIRED_DIMENSIONS_SILHOUETTE_AND_CENTER_TILE; " +
    "SURFACE_AND_STARFIELD_IDENTITIES_DIFFER",
  generatedAt: new Date().toISOString(),
  native: {
    source: "Google Earth Pro Mars database renderer 7.3.7.1327",
    capturePath: nativePath,
    captureSha256: await fileSha256(nativePath),
    captureQualification: nativeEvidence.qualification,
    camera: nativeEvidence.interaction.settledObservedCamera,
    streamingProgressAtCapture: nativeEvidence.streamingProgressAtCapture,
    state: {
      mars: nativeActions.mars,
      atmosphere: nativeActions.viewMenuAtmosphere,
      sun: nativeActions.viewMenuSun,
    },
  },
  browser: {
    source:
      "cssEarth Mars retained-CSS renderer; NASA/USGS Viking MDIM surface " +
      "and prepared ESO all-sky cubemap",
    url: baseUrl,
    capturePath: browserStabilityBPath,
    captureSha256: await fileSha256(browserStabilityBPath),
    state: browserState,
    browserProblems,
    externalRequests,
    stability: browserStability,
  },
  pairing: {
    viewport: { ...VIEWPORT, devicePixelRatio: 1 },
    comparisonCrop: {
      ...COMPARISON_CROP,
      reason:
        "Remove the native SaveScreenShot watermark and status overlay; " +
        "the identical crop is applied to both captures.",
    },
    registration: {
      nativeTarget: {
        latitudeDegrees: 0,
        longitudeDegrees: 0,
        tiltDegrees: 0,
        azimuthDegrees: 0,
      },
      browserControlEndpoint: BROWSER_VIEW,
      browserCenterSurfaceTile: browserState.centerSurface,
      sphereSegmentation:
        "largest 4-connected component with max sRGB channel >= 20",
      nativeSphere,
      browserSphere,
      centerDeltaPixels: {
        x: browserSphere.centerX - nativeSphere.centerX,
        y: browserSphere.centerY - nativeSphere.centerY,
      },
      diameterDeltaPixels: {
        width: browserSphere.width - nativeSphere.width,
        height: browserSphere.height - nativeSphere.height,
      },
    },
    rawPixelmatchIsParityPercentage: false,
    limitation:
      "The native Mars surface and starfield bytes are not the browser " +
      "surface and cubemap bytes. Pixelmatch is full-frame mismatch evidence, " +
      "not a like-for-like renderer parity score.",
  },
  outputs: {
    nativeComparisonPath,
    browserComparisonPath,
    triptychPath,
    metricsPath,
  },
};
await writeFile(
  pairingEvidencePath,
  `${JSON.stringify(pairingEvidence, null, 2)}\n`,
);

process.stdout.write(`${JSON.stringify({
  qualification: pairingEvidence.qualification,
  pairingEvidencePath,
  triptychPath,
  metricsPath,
  sphereRegistration: pairingEvidence.pairing.registration,
  browserStability,
  pixelmatch: {
    threshold: pixelmatchMetrics.threshold,
    changedPixels: pixelmatchMetrics.changedPixels,
    changedPixelRatio: pixelmatchMetrics.changedPixelRatio,
    meanAbsoluteRgbDelta: pixelmatchMetrics.meanAbsoluteRgbDelta,
  },
}, null, 2)}\n`);

async function compareDecodedImages(firstPath, secondPath, channelTolerance) {
  const [first, second] = await Promise.all([
    decodedRgba(firstPath),
    decodedRgba(secondPath),
  ]);
  if (first.info.width !== second.info.width ||
      first.info.height !== second.info.height) {
    throw new Error("INVALID browser stability dimensions differ.");
  }
  let changedPixels = 0;
  let changedPixelsAboveTolerance = 0;
  let absoluteRgbTotal = 0;
  const totalPixels = first.info.width * first.info.height;
  for (let offset = 0; offset < first.data.length; offset += 4) {
    let changed = false;
    let aboveTolerance = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(
        first.data[offset + channel] - second.data[offset + channel],
      );
      absoluteRgbTotal += delta;
      if (delta !== 0) changed = true;
      if (delta > channelTolerance) aboveTolerance = true;
    }
    if (changed) changedPixels += 1;
    if (aboveTolerance) changedPixelsAboveTolerance += 1;
  }
  return {
    width: first.info.width,
    height: first.info.height,
    channelTolerance,
    changedPixels,
    changedPixelRatio: changedPixels / totalPixels,
    changedPixelsAboveTolerance,
    changedPixelRatioAboveTolerance:
      changedPixelsAboveTolerance / totalPixels,
    meanAbsoluteRgbDelta: absoluteRgbTotal / (totalPixels * 3),
  };
}

async function decodedRgba(path) {
  return sharp(path).rotate().toColorspace("srgb").ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
}

async function largestBrightComponent(path, minimumChannel) {
  const { data, info } = await sharp(path).rotate().toColorspace("srgb")
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const mask = new Uint8Array(pixelCount);
  for (let pixel = 0, offset = 0; pixel < pixelCount;
    pixel += 1, offset += info.channels) {
    mask[pixel] = Math.max(
      data[offset],
      data[offset + 1],
      data[offset + 2],
    ) >= minimumChannel ? 1 : 0;
  }
  const queue = new Int32Array(pixelCount);
  let largest = null;
  for (let start = 0; start < pixelCount; start += 1) {
    if (mask[start] !== 1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    mask[start] = 2;
    let count = 0;
    let minX = info.width;
    let maxX = 0;
    let minY = info.height;
    let maxY = 0;
    while (head < tail) {
      const current = queue[head++];
      const x = current % info.width;
      const y = (current - x) / info.width;
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const neighbor of [
        current - 1,
        current + 1,
        current - info.width,
        current + info.width,
      ]) {
        const sameRow = neighbor !== current - 1 &&
          neighbor !== current + 1 ||
          Math.floor(neighbor / info.width) === y;
        if (neighbor >= 0 && neighbor < pixelCount && sameRow &&
            mask[neighbor] === 1) {
          mask[neighbor] = 2;
          queue[tail++] = neighbor;
        }
      }
    }
    if (!largest || count > largest.pixelCount) {
      largest = {
        pixelCount: count,
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      };
    }
  }
  if (!largest) throw new Error(`No bright component found in ${path}.`);
  return largest;
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
