#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import { PREPARED_MARS_CAMERA } from "../../runtime/preparedCamera.mjs";
import { PREPARED_MARS_LIGHTING } from "../../runtime/preparedLighting.mjs";
import { PREPARED_MARS_MOONS } from "../../runtime/preparedMoons.mjs";
import { PREPARED_MARS_SCENE } from "../../runtime/preparedScene.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 2);
if (![1, 2].includes(deviceScaleFactor)) {
  throw new RangeError("Mars Saturn-standard audit accepts DPR 1 or DPR 2.");
}
const viewport = Object.freeze({ width: 1440, height: 900 });
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const outputRoot = resolve(
  "output/playwright",
  `mars-saturn-audit-${timestamp}-dpr${deviceScaleFactor}`,
);
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const browserVersion = browser.version();
let saturn;
let mars;
try {
  saturn = await auditSaturn();
  mars = await auditMars();
} finally {
  await browser.close();
}

const contactSheet = await prepareContactSheet(mars.views);
const report = Object.freeze({
  schema: "cssmars-saturn-standard-audit@1",
  createdAt: new Date().toISOString(),
  referencePlanet: "saturn",
  candidatePlanet: "mars",
  browser: { channel: "chrome", version: browserVersion, headless: true },
  baseUrl,
  viewport,
  deviceScaleFactor,
  preparedContract: Object.freeze({
    bodyLeafCount: PREPARED_MARS_SCENE.retainedDom.totalLeafCount,
    moonLeafCount: PREPARED_MARS_MOONS.retainedDom.surfaceLeafCount,
    materialLeafCount: 1,
    pitchStates: PREPARED_MARS_CAMERA.stateCount,
    zoomStates: PREPARED_MARS_CAMERA.zoomStateCount,
    materialDepthContract: PREPARED_MARS_CAMERA.materialDepthContract,
    materialTransport: PREPARED_MARS_LIGHTING.banks[
      String(deviceScaleFactor)
    ].transport,
  }),
  saturn,
  mars,
  contactSheet,
  sourceFingerprints: await fingerprints({
    marsSource: "src/planets/mars/SOURCE.md",
    marsScene: "src/planets/mars/runtime/preparedScene.mjs",
    marsCamera: "src/planets/mars/runtime/preparedCamera.mjs",
    marsLighting: "src/planets/mars/runtime/preparedLighting.mjs",
    marsMoons: "src/planets/mars/runtime/preparedMoons.mjs",
    marsLenses: "src/planets/mars/runtime/preparedLenses.mjs",
    marsAssets: "src/planets/mars/runtime-assets.json",
    marsClient: "src/planets/mars/runtime/client.mjs",
    marsRowCache: "src/planets/mars/runtime/preparedRowCache.mjs",
    marsStyles: "src/planets/mars/runtime/styles.css",
    saturnSource: "src/planets/saturn/SOURCE.md",
    saturnScene: "src/planets/saturn/runtime/preparedScene.mjs",
    saturnAssets: "src/planets/saturn/runtime-assets.json",
  }),
});
await writeFile(
  resolve(outputRoot, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

for (const candidate of [saturn, mars]) {
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
if (mars.runtime.renderRootCount !== 1 ||
    !mars.runtime.materialSharesMoonScene) {
  throw new Error("Mars material and moons are not in one 3D depth context.");
}
if (mars.runtime.stageElementCount !== 550 ||
    mars.runtime.retainedLeafCount !== 519) {
  throw new Error(`Mars retained DOM drifted: ${JSON.stringify(mars.runtime)}`);
}
if (mars.views.length !== 9 ||
    new Set(mars.views.map(({ sha256 }) => sha256)).size !== 9) {
  throw new Error("Mars lens and pitch visual matrix is incomplete or duplicated.");
}
if (mars.responsive.some(({ horizontalOverflow, labelsInside }) =>
  horizontalOverflow || !labelsInside)) {
  throw new Error(`Mars responsive framing failed: ${JSON.stringify(mars.responsive)}`);
}
if (mars.runtime.selectedPreparedDensity !== deviceScaleFactor ||
    !mars.runtime.materialImage.includes(`-${deviceScaleFactor}x-row-`)) {
  throw new Error("Mars selected the wrong prepared DPR assets.");
}
const densityAwareAssets = mars.runtime.loadedPreparedAssetUrls.filter((url) =>
  /\/mars-(?:surface|poles|lens-(?:elevation|thermal)(?:-poles)?)(?:@2x)?\.webp$/u
    .test(url));
if (densityAwareAssets.length !== 6 || densityAwareAssets.some((url) =>
  (deviceScaleFactor === 2) !== url.includes("@2x.webp"))) {
  throw new Error(`Mars loaded the wrong DPR visual bytes: ${
    JSON.stringify(densityAwareAssets)}`);
}
if (mars.runtime.materialCache.maximumRetainedRowCount !== 3 ||
    mars.runtime.materialCache.retainedRowCount > 3 ||
    mars.runtime.materialCache.appliedRow !== mars.runtime.materialCache.desiredRow) {
  throw new Error(`Mars material cache is not bounded and settled: ${
    JSON.stringify(mars.runtime.materialCache)}`);
}
if (mars.maximumCompositorLayer.width > saturn.maximumCompositorLayer.width ||
    mars.maximumCompositorLayer.height > saturn.maximumCompositorLayer.height ||
    mars.maximumCompositorLayer.area > saturn.maximumCompositorLayer.area) {
  throw new Error("Mars exceeds the Saturn compositor-layer envelope.");
}

console.log(JSON.stringify({
  ok: true,
  outputRoot,
  report: resolve(outputRoot, "report.json"),
  contactSheet: resolve(outputRoot, contactSheet.file),
}, null, 2));

async function auditSaturn() {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const evidence = observe(page);
  let layers = [];
  const cdp = await context.newCDPSession(page);
  await cdp.send("LayerTree.enable");
  cdp.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  try {
    await load(page, "saturn");
    await page.evaluate(() => window.__saturn.pause());
    await settle(page);
    const shell = "saturn-shell.png";
    await page.screenshot({ path: resolve(outputRoot, shell) });
    const camera = await page.evaluate(() => {
      const { controlPitch, zoom } = window.__saturn.camera.state();
      return { controlPitch, zoom };
    });
    const scenes = [];
    for (const [name, pitch] of [
      ["minimum", 0],
      ["default", camera.controlPitch],
      ["maximum", 89],
    ]) {
      await page.evaluate(({ controlPitch, zoom }) =>
        window.__saturn.camera.setState({ controlPitch, zoom }), {
        controlPitch: pitch,
        zoom: camera.zoom,
      });
      await settle(page);
      const file = `saturn-${name}.png`;
      await page.locator(".planet-stage").screenshot({
        path: resolve(outputRoot, file),
      });
      scenes.push({ name, pitch, file, sha256: await sha256(file) });
    }
    const runtime = await commonRuntime(page, "saturn");
    return Object.freeze({
      planet: "saturn",
      shell,
      scenes,
      runtime,
      maximumCompositorLayer: maximumLayer(layers),
      ...evidence,
    });
  } finally {
    await cdp.detach();
    await context.close();
  }
}

async function auditMars() {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const evidence = observe(page);
  let layers = [];
  const cdp = await context.newCDPSession(page);
  await cdp.send("LayerTree.enable");
  cdp.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  try {
    await load(page, "mars");
    await page.evaluate(() => window.__mars.pause());
    await settleMars(page);
    const shell = "mars-shell.png";
    await page.screenshot({ path: resolve(outputRoot, shell) });
    const views = [];
    for (const lens of ["normal", "elevation", "thermal"]) {
      await page.evaluate((id) => window.__mars.selectLens(id), lens);
      for (const [name, pitch] of [
        ["minimum", 0],
        ["default", 18],
        ["maximum", 65],
      ]) {
        await page.evaluate(({ pitch }) =>
          window.__mars.setView({ pitch, zoom: 0.8 }), { pitch });
        await settleMars(page);
        const file = `mars-${lens}-${name}.png`;
        await page.locator(".planet-stage").screenshot({
          path: resolve(outputRoot, file),
        });
        views.push({ lens, name, pitch, file, sha256: await sha256(file) });
      }
    }
    await page.evaluate(() => {
      window.__mars.selectLens("normal");
      window.__mars.setView({ pitch: 18, zoom: 0.8 });
    });
    await settleMars(page);
    const responsive = [];
    for (const width of [390, 820, 1200]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await settle(page);
      const file = `mars-responsive-${width}.png`;
      await page.screenshot({ path: resolve(outputRoot, file) });
      responsive.push(await page.evaluate(({ width, file }) => {
        const labels = [...document.querySelectorAll(".mars-moon-label")]
          .map((label) => label.getBoundingClientRect());
        return {
          width,
          file,
          horizontalOverflow: document.documentElement.scrollWidth > width,
          labelsInside: labels.every((rect) => rect.left >= 0 &&
            rect.right <= width && rect.top >= 0 &&
            rect.bottom <= innerHeight),
        };
      }, { width, file }));
    }
    await page.setViewportSize(viewport);
    await settleMars(page);
    const runtime = await page.evaluate(() => {
      const stage = document.querySelector(".planet-stage");
      return {
        activeObjectId: window.__cssEarth.activeObjectId,
        mountedObjectCount: window.__cssEarth.mountedObjectCount,
        retainedLeafCount: window.__mars.dom.retainedLeafCount,
        stageElementCount: stage.querySelectorAll("*").length,
        stableDomIdentity: window.__mars.assertStableDomIdentity(),
        canvasCount: stage.querySelectorAll("canvas").length,
        sceneSvgCount: stage.querySelectorAll("svg").length,
        renderRootCount: stage.querySelectorAll(":scope > .planet-render-root")
          .length,
        materialSharesMoonScene:
          stage.querySelector(".mars-material")?.closest(".polycss-scene") ===
          stage.querySelector(".mars-moon-shape")?.closest(".polycss-scene"),
        selectedPreparedDensity:
          window.__mars.renderStats.selectedPreparedDensity,
        normalSurfaceImage: getComputedStyle(stage.querySelector(
          ".mars-body > s:not(.mars-pole)",
        )).backgroundImage,
        normalPolesImage: getComputedStyle(stage.querySelector(
          ".mars-body > .mars-pole",
        )).backgroundImage,
        materialImage: getComputedStyle(stage.querySelector(
          ".mars-material-plane > s",
        )).backgroundImage,
        loadedPreparedAssetUrls: performance.getEntriesByType("resource")
          .map(({ name }) => name)
          .filter((url) => url.includes("/scenes/mars/")),
        materialCache: window.__mars.renderStats.materialCache(),
      };
    });
    return Object.freeze({
      planet: "mars",
      shell,
      views,
      responsive,
      runtime,
      maximumCompositorLayer: maximumLayer(layers),
      ...evidence,
    });
  } finally {
    await cdp.detach();
    await context.close();
  }
}

async function load(page, planet) {
  const response = await page.goto(new URL(`/${planet}/`, baseUrl).href, {
    waitUntil: "networkidle",
  });
  if (response?.status() !== 200) {
    throw new Error(`${planet} returned ${response?.status() ?? "no response"}.`);
  }
  await page.waitForFunction((id) =>
    window.__cssEarth?.ready === true && window[`__${id}`]?.ready === true,
  planet, { timeout: 120_000 });
}

async function commonRuntime(page, planet) {
  return page.evaluate((id) => {
    const stage = document.querySelector(".planet-stage");
    return {
      activeObjectId: window.__cssEarth.activeObjectId,
      mountedObjectCount: window.__cssEarth.mountedObjectCount,
      retainedLeafCount: window[`__${id}`].dom.retainedLeafCount,
      stageElementCount: stage.querySelectorAll("*").length,
      stableDomIdentity: window[`__${id}`].assertStableDomIdentity(),
      canvasCount: stage.querySelectorAll("canvas").length,
      sceneSvgCount: stage.querySelectorAll("svg").length,
    };
  }, planet);
}

function observe(page) {
  const browserProblems = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserProblems.push(
    `pageerror: ${error.message}`,
  ));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
      externalRequests.push(request.url());
    }
  });
  return { browserProblems, externalRequests };
}

function settle(page) {
  return page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}

async function settleMars(page) {
  await page.waitForFunction(() => {
    const cache = window.__mars?.renderStats.materialCache();
    return cache && cache.pendingRowCount === 0 &&
      cache.appliedRow === cache.desiredRow;
  }, null, { timeout: 10_000 });
  await settle(page);
}

function maximumLayer(layers) {
  return layers.reduce((maximum, layer) => {
    const area = (layer.width ?? 0) * (layer.height ?? 0);
    return area > maximum.area ? {
      width: layer.width ?? 0,
      height: layer.height ?? 0,
      area,
    } : maximum;
  }, { width: 0, height: 0, area: 0 });
}

async function prepareContactSheet(views) {
  const cellWidth = 360;
  const cellHeight = 225;
  const cells = await Promise.all(views.map(({ file }) => sharp(
    resolve(outputRoot, file),
  ).resize(cellWidth, cellHeight, { fit: "fill" }).png().toBuffer()));
  const file = "mars-lens-pitch-contact-sheet.png";
  await sharp({
    create: {
      width: cellWidth * 3,
      height: cellHeight * 3,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  }).composite(cells.map((input, index) => ({
    input,
    left: index % 3 * cellWidth,
    top: Math.floor(index / 3) * cellHeight,
  }))).png().toFile(resolve(outputRoot, file));
  return Object.freeze({
    file,
    width: cellWidth * 3,
    height: cellHeight * 3,
    order: views.map(({ lens, name }) => `${lens}:${name}`),
  });
}

async function fingerprints(paths) {
  return Object.fromEntries(await Promise.all(Object.entries(paths).map(
    async ([id, path]) => [id, {
      path,
      sha256: createHash("sha256").update(await readFile(path)).digest("hex"),
    }],
  )));
}

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(resolve(outputRoot, file)))
    .digest("hex");
}
