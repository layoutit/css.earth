import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 1);
assert.ok([1, 2].includes(deviceScaleFactor));

const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  const page = await context.newPage();
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
  const cdp = await context.newCDPSession(page);
  let layers = [];
  await cdp.send("LayerTree.enable");
  await cdp.send("Performance.enable");
  cdp.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  await page.addInitScript(() => {
    window.__neptuneLongTasks = [];
    new PerformanceObserver((list) => {
      window.__neptuneLongTasks.push(
        ...list.getEntries().map(({ duration }) => duration),
      );
    }).observe({ type: "longtask", buffered: true });
  });

  const response = await page.goto(new URL("/neptune/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => window.__neptune?.ready === true);
  await page.waitForTimeout(500);
  const startup = await page.evaluate(() => ({
    longTasks: [...window.__neptuneLongTasks],
    retainedImages: window.__neptune.renderStats.textureStats
      .retainedInteractiveImageCount,
    resources: performance.getEntriesByType("resource")
      .filter(({ name }) => name.includes("/scenes/neptune/"))
      .map(({ name, transferSize, decodedBodySize }) => ({
        name,
        transferSize,
        decodedBodySize,
      })),
  }));
  await page.evaluate(() => {
    window.__neptune.pause();
    window.__neptuneLongTasks = [];
    window.__neptune.camera.setState({ controlPitch: 0, zoom: 0.8 });
  });
  await page.waitForTimeout(250);
  const motion = await page.evaluate(() => new Promise((resolveMotion) => {
    const samples = [];
    let previous = performance.now();
    const tick = (now) => {
      const motionFrame = samples.length;
      const progress = motionFrame / 119;
      const pitch = progress <= 0.75
        ? progress / 0.75 * 89
        : (1 - progress) / 0.25 * 89;
      const zoom = 0.8 + Math.sin(progress * Math.PI) * 0.3;
      window.__neptune.camera.setState({ controlPitch: pitch, zoom });
      const materialImage = getComputedStyle(document.querySelector(
        ".neptune-exterior-material",
      )).backgroundImage;
      const materialRowMatch = /row-(\d+)\.webp/u.exec(materialImage);
      samples.push({
        interval: now - previous,
        materialRow: materialRowMatch ? Number(materialRowMatch[1]) : null,
        retainedImages: window.__neptune.renderStats.textureStats
          .retainedInteractiveImageCount,
      });
      previous = now;
      if (samples.length >= 120) resolveMotion(samples.slice(5));
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await page.waitForTimeout(1_000);
  const runtime = await page.evaluate(() => ({
    longTasks: [...window.__neptuneLongTasks],
    camera: window.__neptune.camera.stats(),
    retainedImages: window.__neptune.renderStats.textureStats
      .retainedInteractiveImageCount,
    stableDomIdentity: window.__neptune.assertStableDomIdentity(),
    retainedLeafCount: window.__neptune.dom.retainedLeafCount,
    stageElementCount: document.querySelector(".planet-stage")
      .querySelectorAll("*").length,
    runningAnimationCount: document.querySelector(".planet-stage")
      .getAnimations({ subtree: true })
      .filter(({ playState }) => playState === "running").length,
  }));
  const metrics = Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map(
      ({ name, value }) => [name, value],
    ),
  );
  const intervals = motion.map(({ interval }) => interval)
    .sort((left, right) => left - right);
  const maximumCompositorLayer = layers.reduce((maximum, layer) => {
    const area = (layer.width ?? 0) * (layer.height ?? 0);
    return area > maximum.area ? {
      width: layer.width ?? 0,
      height: layer.height ?? 0,
      area,
    } : maximum;
  }, { width: 0, height: 0, area: 0 });
  const report = Object.freeze({
    deviceScaleFactor,
    startup,
    runtime,
    motion: Object.freeze({
      sampleCount: motion.length,
      frameIntervalP95Milliseconds: percentile(intervals, 0.95),
      maximumRetainedImages: Math.max(...motion.map(({ retainedImages }) =>
        retainedImages)),
      visitedMaterialRows: Object.freeze([...new Set(motion.map(
        ({ materialRow }) => materialRow,
      ))]),
    }),
    jsHeapUsedBytes: metrics.JSHeapUsedSize,
    domNodeCount: metrics.Nodes,
    layoutCount: metrics.LayoutCount,
    styleRecalcCount: metrics.RecalcStyleCount,
    compositorLayerCount: layers.length,
    maximumCompositorLayer,
    externalRequests,
    browserProblems,
  });
  if (process.env.NEPTUNE_PERF_REPORT_ONLY !== "1") {
    assert.equal(report.runtime.stableDomIdentity, true);
    assert.equal(report.runtime.retainedLeafCount, 750);
    assert.equal(report.runtime.stageElementCount, 809);
    assert.equal(report.runtime.runningAnimationCount, 0);
    assert.deepEqual(report.externalRequests, []);
    assert.deepEqual(report.browserProblems, []);
    assert.ok(report.startup.longTasks.every((duration) => duration <= 200),
      JSON.stringify({ startupLongTasks: report.startup.longTasks }));
    assert.ok(report.runtime.longTasks.every((duration) => duration <= 100),
      JSON.stringify({ runtimeLongTasks: report.runtime.longTasks }));
    assert.ok(report.motion.frameIntervalP95Milliseconds <= 40,
      JSON.stringify(report.motion));
    assert.ok(report.motion.visitedMaterialRows.length === 16,
      JSON.stringify(report.motion));
    assert.ok(report.maximumCompositorLayer.width <= 7_000,
      JSON.stringify(report.maximumCompositorLayer));
    assert.ok(report.maximumCompositorLayer.height <= 7_000,
      JSON.stringify(report.maximumCompositorLayer));
  }
  console.log(JSON.stringify(report, null, 2));
  await cdp.detach();
  await context.close();
} finally {
  await browser.close();
}

function percentile(sorted, fraction) {
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * fraction),
  )];
}
