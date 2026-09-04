import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const outputPath = resolve(
  process.argv[3] ?? "output/mercury-performance.json",
);
const SATURN_STANDARD_MAX_INITIAL_RETAINED_NODES = 540;
const SATURN_STANDARD_MAX_INTERACTIVE_RETAINED_NODES = 1_040;
const SATURN_STANDARD_MAX_COMPOSITED_LAYERS = 630;
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Performance.enable");
  await session.send("LayerTree.enable");
  let compositedLayerCount = 0;
  session.on("LayerTree.layerTreeDidChange", ({ layers = [] }) => {
    compositedLayerCount = layers.length;
  });
  await page.goto(new URL("/mercury/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() =>
    document.documentElement.dataset.ready === "true" &&
    window.__mercury?.ready === true);
  const profile = await page.evaluate(async () => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const startupMercuryResources = performance.getEntriesByType("resource")
      .filter(({ name }) => name.includes("/scenes/mercury/"));
    const initialRetainedNodeCount = document.querySelector(".planet-stage")
      .querySelectorAll("*").length;
    const lensMilliseconds = {};
    for (const id of ["enhanced", "topography", "interior", "normal"]) {
      const start = performance.now();
      await window.__mercury.lenses.select(id);
      lensMilliseconds[id] = performance.now() - start;
    }

    const synchronousStart = performance.now();
    for (let index = 0; index < 500; index += 1) {
      window.__mercury.camera.setState({
        controlPitch: index % 90 === 89 ? 89 : (index * 0.173) % 89,
        controlYaw: index * 1.37,
        zoom: 0.9 + index % 9 * 0.05,
      });
    }
    const synchronousPublicationMilliseconds =
      performance.now() - synchronousStart;

    const frameSamples = [];
    for (let index = 0; index < 120; index += 1) {
      const start = performance.now();
      window.__mercury.camera.setState({
        controlPitch: index / 119 * 89,
        controlYaw: index / 119 * 360,
        zoom: 1.1,
      });
      await new Promise((done) => requestAnimationFrame(done));
      frameSamples.push(performance.now() - start);
    }
    frameSamples.sort((left, right) => left - right);
    const mercuryResources = performance.getEntriesByType("resource")
      .filter(({ name }) => name.includes("/scenes/mercury/"));

    return {
      navigationMilliseconds: {
        duration: navigation.duration,
        domContentLoaded: navigation.domContentLoadedEventEnd,
        loadEventEnd: navigation.loadEventEnd,
      },
      mercuryResourceCount: mercuryResources.length,
      mercuryTransferBytes: mercuryResources.reduce(
        (sum, resource) => sum + resource.transferSize,
        0,
      ),
      mercuryDecodedBodyBytes: mercuryResources.reduce(
        (sum, resource) => sum + resource.decodedBodySize,
        0,
      ),
      startupMercuryResourceCount: startupMercuryResources.length,
      startupInteriorResourceCount: startupMercuryResources.filter(({ name }) =>
        name.includes("mercury-interior-")).length,
      lensMilliseconds,
      synchronousCameraPublications: 500,
      synchronousPublicationMilliseconds,
      framePublicationMilliseconds: {
        samples: frameSamples.length,
        p50: frameSamples[Math.floor(frameSamples.length * 0.5)],
        p95: frameSamples[Math.floor(frameSamples.length * 0.95)],
        maximum: frameSamples.at(-1),
      },
      initialRetainedNodeCount,
      interactiveRetainedNodeCount: document.querySelector(".planet-stage")
        .querySelectorAll("*").length,
      stableDomIdentity: window.__mercury.assertStableDomIdentity(),
      selectedPreparedDensity:
        window.__mercury.renderStats.textureStats.selectedPreparedDensity,
      materialCache: window.__mercury.renderStats.textureStats.materialCache(),
      cameraTransport: window.__mercury.camera.stats(),
    };
  });
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const metrics = await session.send("Performance.getMetrics");
  const metric = Object.fromEntries(metrics.metrics.map(({ name, value }) =>
    [name, value]));
  const report = {
    schema: "cssmercury-browser-performance@1",
    route: "/mercury/",
    browser: "Chrome",
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    ...profile,
    chrome: {
      jsHeapUsedBytes: metric.JSHeapUsedSize,
      jsHeapTotalBytes: metric.JSHeapTotalSize,
      nodes: metric.Nodes,
      layoutCount: metric.LayoutCount,
      layoutDurationSeconds: metric.LayoutDuration,
      recalcStyleCount: metric.RecalcStyleCount,
      recalcStyleDurationSeconds: metric.RecalcStyleDuration,
      compositedLayers: compositedLayerCount,
    },
  };
  assert.ok(report.initialRetainedNodeCount <=
    SATURN_STANDARD_MAX_INITIAL_RETAINED_NODES);
  assert.ok(report.interactiveRetainedNodeCount <=
    SATURN_STANDARD_MAX_INTERACTIVE_RETAINED_NODES);
  assert.ok(report.chrome.compositedLayers > 0);
  assert.ok(report.chrome.compositedLayers <=
    SATURN_STANDARD_MAX_COMPOSITED_LAYERS);
  assert.equal(report.startupInteriorResourceCount, 0);
  assert.equal(report.stableDomIdentity, true);
  assert.equal(report.cameraTransport.cameraModel, "accumulated-matrix3d");
  assert.equal(report.cameraTransport.pitchBounded, false);
  assert.equal(report.cameraTransport.yawBounded, false);
  assert.ok(report.cameraTransport.runtimeTransformStringWrites > 0);
  assert.equal(report.materialCache.maximumRetainedRowCount, 3);
  assert.ok(report.materialCache.retainedRowCount <= 3);
  assert.ok(report.synchronousPublicationMilliseconds < 50);
  assert.ok(report.framePublicationMilliseconds.p95 < 35);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
