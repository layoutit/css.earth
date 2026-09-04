#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import { PREPARED_MOON_LENSES } from "../../runtime/preparedLenses.mjs";
import { PREPARED_MOON_SCENE } from "../../runtime/preparedScene.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
const strict = process.argv.includes("--strict");
const mercuryBaselineReportPath = process.env.MERCURY_BASELINE_REPORT
  ? resolve(process.env.MERCURY_BASELINE_REPORT)
  : null;
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Moon Saturn-standard audit accepts DPR 1 or DPR 2.");
}

const viewport = Object.freeze({ width: 1440, height: 900 });
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `moon-saturn-audit-${timestamp}-dpr${deviceScaleFactor}`,
);
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const browserVersion = browser.version();
let saturn;
let mercury;
let moon;
try {
  saturn = await auditReference("saturn");
  mercury = mercuryBaselineReportPath
    ? await loadMercuryBaseline()
    : await auditReference("mercury");
  moon = await auditMoon();
} finally {
  await browser.close();
}

const qualityGaps = auditQualityGaps({ saturn, mercury, moon });
const contactSheet = await prepareContactSheet([
  ...saturn.views,
  ...mercury.views,
  ...moon.views,
]);
const report = Object.freeze({
  schema: "cssmoon-saturn-standard-audit@1",
  createdAt: new Date().toISOString(),
  referencePlanet: "saturn",
  visualComparator: "mercury",
  candidatePlanet: "moon",
  baseUrl,
  browser: Object.freeze({
    channel: "chrome",
    version: browserVersion,
    headless: true,
  }),
  viewport,
  deviceScaleFactor,
  referenceEvidence: Object.freeze({
    mercuryBaselineReport: mercuryBaselineReportPath,
    mercuryBaselineSha256: mercuryBaselineReportPath
      ? await sha256(mercuryBaselineReportPath)
      : null,
  }),
  preparedContract: Object.freeze({
    bodyLeafCount: PREPARED_MOON_SCENE.counts.retainedLeafCount,
    materialLeafCount: PREPARED_MOON_SCENE.counts.materialLeafCount ?? 0,
    skyboxFaceCount: PREPARED_MOON_SCENE.counts.retainedSkyboxFaceCount,
    lenses: PREPARED_MOON_LENSES.controls.map(({ id }) => id),
    cameraModel: PREPARED_MOON_SCENE.camera.cameraModel,
    runtimeGeometryPreparation:
      PREPARED_MOON_SCENE.counts.runtimeGeometryPreparation,
    runtimeRasterization: PREPARED_MOON_SCENE.counts.runtimeRasterization,
  }),
  qualityGaps,
  saturn,
  mercury,
  moon,
  contactSheet,
  sourceFingerprints: await fingerprints({
    moonSource: "src/planets/moon/SOURCE.md",
    moonScene: "src/planets/moon/runtime/preparedScene.mjs",
    moonLenses: "src/planets/moon/runtime/preparedLenses.mjs",
    moonAssets: "src/planets/moon/runtime-assets.json",
    moonClient: "src/planets/moon/runtime/client.mjs",
    moonStyles: "src/planets/moon/runtime/styles.css",
    moonManifest: "src/planets/moon/source/manifest.json",
    mercuryScene: "src/planets/mercury/runtime/preparedScene.mjs",
    saturnScene: "src/planets/saturn/runtime/preparedScene.mjs",
  }),
});
await writeFile(
  resolve(outputRoot, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

for (const candidate of [saturn, mercury, moon]) {
  if (candidate.externalRequests.length > 0 ||
      candidate.browserProblems.length > 0) {
    throw new Error(`${candidate.planet} browser evidence is not clean.`);
  }
  if (!candidate.runtime.stableDomIdentity ||
      candidate.runtime.canvasCount !== 0 ||
      candidate.runtime.sceneSvgCount !== 0) {
    throw new Error(`${candidate.planet} retained renderer contract failed.`);
  }
}
if (moon.runtime.cameraCount !== 1 ||
    moon.runtime.bodyLeafCount !== PREPARED_MOON_SCENE.counts.retainedLeafCount ||
    moon.runtime.skyboxFaceCount !== 6 ||
    moon.runtime.selectedPreparedDensity !== 2) {
  throw new Error(`Moon runtime contract drifted: ${JSON.stringify(moon.runtime)}`);
}
if (moon.views.length !== PREPARED_MOON_LENSES.controls.length * 3 ||
    new Set(moon.views.map(({ sha256 }) => sha256)).size !== moon.views.length) {
  throw new Error("Moon lens and pitch visual matrix is incomplete or duplicated.");
}

console.log(JSON.stringify({
  ok: qualityGaps.length === 0,
  outputRoot,
  report: resolve(outputRoot, "report.json"),
  contactSheet: resolve(outputRoot, contactSheet.file),
  qualityGaps,
}, null, 2));
if (strict && qualityGaps.length > 0) process.exitCode = 1;

async function auditReference(planet) {
  const session = await openPlanet(planet);
  try {
    const camera = await cameraState(session.page, planet);
    const view = await captureView(
      session.page,
      planet,
      "default",
      camera.controlPitch,
      camera.zoom,
    );
    return Object.freeze({
      planet,
      views: Object.freeze([view]),
      runtime: await commonRuntime(session.page, planet),
      maximumCompositorLayer: maximumLayer(session.layers()),
      ...session.evidence,
    });
  } finally {
    await session.close();
  }
}

async function loadMercuryBaseline() {
  const baseline = JSON.parse(await readFile(
    mercuryBaselineReportPath,
    "utf8",
  )).mercury;
  return Object.freeze({
    ...baseline,
    views: Object.freeze(baseline.views.map((view) => Object.freeze({
      ...view,
      file: resolve(dirname(mercuryBaselineReportPath), view.file),
    }))),
  });
}

async function auditMoon() {
  const session = await openPlanet("moon");
  try {
    const camera = await cameraState(session.page, "moon");
    const views = [];
    for (const { id } of PREPARED_MOON_LENSES.controls) {
      await session.page.evaluate((lens) => window.__moon.lenses.select(lens), id);
      for (const [name, pitch] of [
        ["minimum", 0],
        ["default", camera.controlPitch],
        ["maximum", 89],
      ]) {
        views.push(await captureView(
          session.page,
          "moon",
          `${id}-${name}`,
          pitch,
          camera.zoom,
          id,
        ));
      }
    }
    return Object.freeze({
      planet: "moon",
      views: Object.freeze(views),
      runtime: await commonRuntime(session.page, "moon"),
      maximumCompositorLayer: maximumLayer(session.layers()),
      ...session.evidence,
    });
  } finally {
    await session.close();
  }
}

async function openPlanet(planet) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  let layers = [];
  await cdp.send("LayerTree.enable");
  cdp.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  const evidence = observe(page);
  const response = await page.goto(new URL(`/${planet}/`, baseUrl).href, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  if (response?.status() !== 200) {
    throw new Error(`${planet} route returned ${response?.status()}.`);
  }
  await page.waitForFunction((id) =>
    window.__cssEarth?.ready === true &&
    window[`__${id}`]?.ready === true &&
    document.documentElement.dataset.ready === "true", planet, {
    timeout: 120_000,
  });
  await page.evaluate((id) => window[`__${id}`].pause(), planet);
  await settle(page);
  return Object.freeze({
    page,
    evidence,
    layers: () => layers,
    async close() {
      await cdp.detach();
      await context.close();
    },
  });
}

async function captureView(page, planet, name, controlPitch, zoom, lens = null) {
  await page.evaluate(({ id, pitch, nextZoom }) =>
    window[`__${id}`].camera.setState({
      controlPitch: pitch,
      zoom: nextZoom,
    }), { id: planet, pitch: controlPitch, nextZoom: zoom });
  await settle(page);
  const file = `${planet}-${name}.png`;
  const path = resolve(outputRoot, file);
  await page.locator(".planet-stage").screenshot({ path });
  return Object.freeze({
    planet,
    name,
    lens,
    controlPitch,
    zoom,
    file,
    sha256: await sha256(path),
    disc: await measureDisc(page, path, planet),
  });
}

async function measureDisc(page, path, planet) {
  const geometry = await page.evaluate(({ id, logicalDiameter }) => {
    const stage = document.querySelector(".planet-stage");
    const camera = document.querySelector(`.${id}-camera`);
    const scene = camera?.querySelector(".polycss-scene");
    if (!stage || !camera || !scene) return null;
    const stageRect = stage.getBoundingClientRect();
    const cameraRect = camera.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    const scale = cameraRect.width / Math.max(1, stageRect.width);
    return {
      centerX: sceneRect.left - stageRect.left,
      centerY: sceneRect.top - stageRect.top,
      radius: logicalDiameter / 2 * scale,
    };
  }, {
    id: planet,
    logicalDiameter: planet === "moon"
      ? PREPARED_MOON_LENSES.material.presentationSize
      : 460,
  });
  if (!geometry || geometry.radius < 1) return null;
  const { data, info } = await sharp(path).raw().toBuffer({
    resolveWithObject: true,
  });
  const scale = info.width / viewport.width;
  const centerX = geometry.centerX * scale;
  const centerY = geometry.centerY * scale;
  const radius = geometry.radius * scale;
  const values = [];
  const centerValues = [];
  const limbValues = [];
  for (let y = Math.max(0, Math.floor(centerY - radius));
    y <= Math.min(info.height - 1, Math.ceil(centerY + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(centerX - radius));
      x <= Math.min(info.width - 1, Math.ceil(centerX + radius)); x += 1) {
      const normalizedRadius = Math.hypot(x - centerX, y - centerY) / radius;
      if (normalizedRadius > 0.92) continue;
      const offset = (y * info.width + x) * info.channels;
      const luminance = data[offset] * 0.2126 +
        data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
      values.push(luminance);
      if (normalizedRadius < 0.32) centerValues.push(luminance);
      if (normalizedRadius > 0.76) limbValues.push(luminance);
    }
  }
  values.sort((left, right) => left - right);
  const mean = average(values);
  return Object.freeze({
    sampleCount: values.length,
    mean: fixed(mean),
    standardDeviation: fixed(Math.sqrt(average(values.map((value) =>
      (value - mean) ** 2)))),
    p10: fixed(percentile(values, 0.1)),
    p50: fixed(percentile(values, 0.5)),
    p90: fixed(percentile(values, 0.9)),
    centerMean: fixed(average(centerValues)),
    limbMean: fixed(average(limbValues)),
    centerToLimbDifference: fixed(
      average(centerValues) - average(limbValues),
    ),
  });
}

async function commonRuntime(page, planet) {
  return page.evaluate((id) => {
    const runtime = window[`__${id}`];
    return {
      cameraCount: document.querySelectorAll(`.${id}-camera`).length,
      bodyLeafCount: document.querySelectorAll(`.${id}-body > s`).length,
      materialLeafCount: document.querySelectorAll(`.${id}-material`).length,
      skyboxFaceCount: document.querySelectorAll(`.${id}-skybox-face`).length,
      canvasCount: document.querySelectorAll("canvas").length,
      sceneSvgCount: document.querySelectorAll(".planet-stage svg").length,
      stageElementCount: document.querySelectorAll(".planet-stage *").length,
      selectedPreparedDensity:
        runtime.renderStats?.textureStats?.selectedPreparedDensity ?? null,
      stableDomIdentity: runtime.assertStableDomIdentity(),
      loadedPreparedAssetUrls: performance.getEntriesByType("resource")
        .map(({ name }) => new URL(name).pathname)
        .filter((url) => url.startsWith(`/scenes/${id}/`)),
    };
  }, planet);
}

function auditQualityGaps({ mercury: mercuryReport, moon: moonReport }) {
  const gaps = [];
  const mercuryDisc = mercuryReport.views[0].disc;
  const moonSurface = moonReport.views.find(({ name }) =>
    name === "surface-default")?.disc;
  if (!moonSurface || !mercuryDisc) {
    gaps.push("disc-photometry-missing");
    return gaps;
  }
  if (moonReport.runtime.materialLeafCount < 1) {
    gaps.push("prepared-curvature-material-missing");
  }
  if (moonSurface.mean > mercuryDisc.mean * 1.65) {
    gaps.push("surface-presentation-overbright");
  }
  if (moonSurface.centerToLimbDifference <
      mercuryDisc.centerToLimbDifference * 0.65) {
    gaps.push("surface-curvature-too-flat");
  }
  if ((moonSurface.p90 - moonSurface.p10) <
      (mercuryDisc.p90 - mercuryDisc.p10) * 0.7) {
    gaps.push("surface-local-contrast-too-low");
  }
  return gaps;
}

function observe(page) {
  const browserProblems = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserProblems.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
      externalRequests.push(request.url());
    }
  });
  return { browserProblems, externalRequests };
}

async function prepareContactSheet(views) {
  const width = 360;
  const height = 225;
  const columns = 3;
  const rows = Math.ceil(views.length / columns);
  const composites = [];
  for (const [index, view] of views.entries()) {
    const input = await sharp(resolve(outputRoot, view.file))
      .resize(width, height, { fit: "cover" })
      .png()
      .toBuffer();
    composites.push({
      input,
      left: index % columns * width,
      top: Math.floor(index / columns) * height,
    });
  }
  const file = "contact-sheet.png";
  await sharp({
    create: {
      width: width * columns,
      height: height * rows,
      channels: 3,
      background: "#000",
    },
  }).composite(composites).png().toFile(resolve(outputRoot, file));
  return Object.freeze({
    file,
    width: width * columns,
    height: height * rows,
    order: views.map(({ planet, name }) => `${planet}:${name}`),
  });
}

function maximumLayer(layers) {
  const normalized = layers.map(({ width = 0, height = 0 }) => ({
    width,
    height,
    area: width * height,
  }));
  return normalized.sort((left, right) => right.area - left.area)[0] ?? {
    width: 0,
    height: 0,
    area: 0,
  };
}

async function cameraState(page, planet) {
  return page.evaluate((id) => window[`__${id}`].camera.state(), planet);
}

async function fingerprints(paths) {
  return Object.fromEntries(await Promise.all(Object.entries(paths).map(
    async ([name, path]) => [name, await sha256(resolve(path))],
  )));
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  return values[Math.min(
    values.length - 1,
    Math.max(0, Math.round((values.length - 1) * fraction)),
  )];
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fixed(value) {
  return Number(value.toFixed(3));
}

function settle(page) {
  return page.evaluate(() => new Promise((resolvePromise) =>
    requestAnimationFrame(() => requestAnimationFrame(resolvePromise))));
}
