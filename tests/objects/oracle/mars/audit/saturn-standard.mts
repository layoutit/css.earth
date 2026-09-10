#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium, type Page } from "playwright";
import sharp from "sharp";

import { PREPARED_MARS_CAMERA,PREPARED_MARS_LIGHTING,PREPARED_MARS_SCENE } from "../../../unit/mars/prepared-fixture.mjs";

interface RuntimeProbe { readonly ready: boolean; readonly dom: { readonly retainedLeafCount: number }; assertStableDomIdentity(): boolean; }
interface MarsAuditRuntime extends RuntimeProbe { selectLens(id: string): void; setView(view: { readonly pitch: number; readonly zoom: number }): void; view(): { readonly pitch: number }; readonly renderStats: { readonly selectedPreparedDensity: number; materialCache(): { readonly pendingRowCount: number; readonly appliedFrame: number; readonly desiredFrame: number; readonly appliedRow: number; readonly desiredRow: number; readonly maximumRetainedRowCount: number; readonly retainedRowCount: number } }; }
interface SaturnRuntimeProbe extends RuntimeProbe { readonly camera: { state(): { readonly controlPitch: number; readonly zoom: number }; setState(state: { readonly controlPitch: number; readonly zoom: number }): void }; }
interface Layer { readonly width?: number; readonly height?: number; }
interface MaximumLayer { readonly width: number; readonly height: number; readonly area: number; }
interface View { readonly lens: string; readonly name: string; readonly pitch: number; readonly file: string; readonly sha256: string; }

declare global { interface Window { __mars?: MarsAuditRuntime; __saturn?: SaturnRuntimeProbe; __cssEarth?: { readonly ready: boolean; readonly activeObjectId: string; readonly mountedObjectCount: number; }; } }

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
let saturn: Awaited<ReturnType<typeof auditSaturn>>;
let mars: Awaited<ReturnType<typeof auditMars>>;
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
    moonLeafCount: 0,
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
    marsSource: "src/planets/mars/README.md",
    marsScene: "src/planets/mars/prepared/body.json",
    marsCamera: "src/planets/mars/prepared/camera.json",
    marsLighting: "src/planets/mars/prepared/lighting.json",
    marsLenses: "src/planets/mars/prepared/surface-lenses.json",
    marsAssets: "src/planets/mars/runtime-assets.json",
    marsClient: "src/renderers/css/runtime/object-runtime.ts",
    marsRowCache: "src/renderers/css/rendering/prepared-residency.ts",
    marsStyles: "src/renderers/css/styles/mars-surfaces.css",
    saturnSource: "src/planets/saturn/README.md",
    saturnScene: "src/planets/saturn/prepared/scene.json",
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
  let layers: Layer[] = [];
  const cdp = await context.newCDPSession(page);
  await cdp.send("LayerTree.enable");
  cdp.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  try {
    await load(page, "saturn");
    await toggleMotion(page);
    await settle(page);
    const shell = "saturn-shell.png";
    await page.screenshot({ path: resolve(outputRoot, shell) });
    const camera = await page.evaluate(() => {
      if (!window.__saturn) throw new Error("Saturn runtime is unavailable.");
      const { controlPitch, zoom } = window.__saturn.camera.state();
      return { controlPitch, zoom };
    });
    const scenes: Array<{ readonly name: string; readonly pitch: number; readonly file: string; readonly sha256: string }> = [];
    const saturnPitches: ReadonlyArray<readonly [string, number]> = [
      ["minimum", 0],
      ["default", camera.controlPitch],
      ["maximum", 89],
    ];
    for (const [name, pitch] of saturnPitches) {
      await page.evaluate(({ controlPitch, zoom }) => {
        if (!window.__saturn) throw new Error("Saturn runtime is unavailable.");
        window.__saturn.camera.setState({ controlPitch, zoom });
      }, {
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
  let layers: Layer[] = [];
  const cdp = await context.newCDPSession(page);
  await cdp.send("LayerTree.enable");
  cdp.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  try {
    await load(page, "mars");
    await toggleMotion(page);
    await settleMars(page);
    const shell = "mars-shell.png";
    await page.screenshot({ path: resolve(outputRoot, shell) });
    const views: View[] = [];
    for (const lens of ["normal", "elevation", "thermal"]) {
      await page.evaluate((id) => {
        if (!window.__mars) throw new Error("Mars runtime is unavailable.");
        window.__mars.selectLens(id);
      }, lens);
      const marsPitches: ReadonlyArray<readonly [string, number]> = [
        ["minimum", 0],
        ["default", 18],
        ["maximum", 65],
      ];
      for (const [name, pitch] of marsPitches) {
        await page.evaluate(({ pitch }) => {
          if (!window.__mars) throw new Error("Mars runtime is unavailable.");
          window.__mars.setView({ pitch, zoom: 0.8 });
        }, { pitch });
        await settleMars(page);
        const file = `mars-${lens}-${name}.png`;
        await page.locator(".planet-stage").screenshot({
          path: resolve(outputRoot, file),
        });
        views.push({ lens, name, pitch, file, sha256: await sha256(file) });
      }
    }
    await page.evaluate(() => {
      if (!window.__mars) throw new Error("Mars runtime is unavailable.");
      window.__mars.selectLens("normal");
      window.__mars.setView({ pitch: 18, zoom: 0.8 });
    });
    await settleMars(page);
    const responsive: Array<{ readonly width: number; readonly file: string; readonly horizontalOverflow: boolean; readonly labelsInside: boolean }> = [];
    for (const width of [390, 820, 1200]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await settle(page);
      const file = `mars-responsive-${width}.png`;
      await page.screenshot({ path: resolve(outputRoot, file) });
      responsive.push(await page.evaluate(({ width, file }) => {
        const labels = [...document.querySelectorAll<HTMLElement>(".mars-moon-label")]
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
      const stage = document.querySelector<HTMLElement>(".planet-stage");
      if (!stage || !window.__cssEarth || !window.__mars) throw new Error("Mars audit runtime boundary is unavailable.");
      const normalSurface = stage.querySelector(".mars-body > s:not(.mars-pole)");
      const normalPoles = stage.querySelector(".mars-body > .mars-pole");
      const material = stage.querySelector(".mars-material-plane > s");
      if (!normalSurface || !normalPoles || !material) throw new Error("Mars material audit elements are unavailable.");
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
        normalSurfaceImage: getComputedStyle(normalSurface).backgroundImage,
        normalPolesImage: getComputedStyle(normalPoles).backgroundImage,
        materialImage: getComputedStyle(material).backgroundImage,
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

async function load(page: Page, planet: "saturn" | "mars"): Promise<void> {
  const response = await page.goto(new URL(`/${planet}/`, baseUrl).href, {
    waitUntil: "networkidle",
  });
  if (response?.status() !== 200) {
    throw new Error(`${planet} returned ${response?.status() ?? "no response"}.`);
  }
  await page.waitForFunction((id) =>
    window.__cssEarth?.ready === true && (id === "saturn" ? window.__saturn : window.__mars)?.ready === true,
  planet, { timeout: 120_000 });
}

async function commonRuntime(page: Page, planet: "saturn" | "mars") {
  return page.evaluate((id) => {
    const stage = document.querySelector<HTMLElement>(".planet-stage");
    const runtime = id === "saturn" ? window.__saturn : window.__mars;
    if (!stage || !runtime || !window.__cssEarth) throw new Error("Planet audit runtime boundary is unavailable.");
    return {
      activeObjectId: window.__cssEarth.activeObjectId,
      mountedObjectCount: window.__cssEarth.mountedObjectCount,
      retainedLeafCount: runtime.dom.retainedLeafCount,
      stageElementCount: stage.querySelectorAll("*").length,
      stableDomIdentity: runtime.assertStableDomIdentity(),
      canvasCount: stage.querySelectorAll("canvas").length,
      sceneSvgCount: stage.querySelectorAll("svg").length,
    };
  }, planet);
}

function observe(page: Page) {
  const browserProblems: string[] = [];
  const externalRequests: string[] = [];
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

function settle(page: Page): Promise<unknown> {
  return page.evaluate(() => new Promise((resolveFrame) =>
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}

async function settleMars(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const cache = window.__mars?.renderStats.materialCache();
    return cache && cache.pendingRowCount === 0 &&
      cache.appliedRow === cache.desiredRow;
  }, null, { timeout: 10_000 });
  await settle(page);
}

function maximumLayer(layers: readonly Layer[]): MaximumLayer {
  return layers.reduce<MaximumLayer>((maximum, layer) => {
    const area = (layer.width ?? 0) * (layer.height ?? 0);
    return area > maximum.area ? {
      width: layer.width ?? 0,
      height: layer.height ?? 0,
      area,
    } : maximum;
  }, { width: 0, height: 0, area: 0 });
}

async function prepareContactSheet(views: readonly View[]) {
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

async function fingerprints(paths: Record<string, string>): Promise<Record<string, { readonly path: string; readonly sha256: string }>> {
  return Object.fromEntries(await Promise.all(Object.entries(paths).map(
    async ([id, path]) => [id, {
      path,
      sha256: createHash("sha256").update(await readFile(path)).digest("hex"),
    }],
  )));
}

async function sha256(file: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(resolve(outputRoot, file)))
    .digest("hex");
}

async function toggleMotion(page: Page): Promise<void> {
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (!(motion instanceof HTMLInputElement)) throw new Error("Motion control is unavailable.");
    if (motion.checked) motion.click();
  });
}
