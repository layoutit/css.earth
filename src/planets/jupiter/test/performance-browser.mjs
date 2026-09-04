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
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserProblems.push(`pageerror: ${error.message}`));
  const cdp = await context.newCDPSession(page);
  let layers = [];
  await cdp.send("LayerTree.enable");
  await cdp.send("Performance.enable");
  cdp.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  await page.addInitScript(() => {
    window.__jupiterLongTasks = [];
    new PerformanceObserver((list) => {
      window.__jupiterLongTasks.push(
        ...list.getEntries().map(({ duration }) => duration),
      );
    }).observe({ type: "longtask", buffered: true });
  });
  const externalRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
      externalRequests.push(request.url());
    }
  });
  const response = await page.goto(new URL("/jupiter/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  try {
    await page.waitForFunction(() => window.__jupiter?.ready === true, null, {
      timeout: 10_000,
    });
  } catch (error) {
    console.error(`Jupiter browser problems: ${JSON.stringify(browserProblems)}`);
    throw error;
  }
  await page.waitForTimeout(500);
  const startup = await page.evaluate(() => ({
    longTasks: [...window.__jupiterLongTasks],
    cache: window.__jupiter.renderStats.materialCache(),
    resources: performance.getEntriesByType("resource")
      .filter(({ name }) => name.includes("/scenes/jupiter/"))
      .map(({ name, transferSize, decodedBodySize }) => ({
        name,
        transferSize,
        decodedBodySize,
      })),
  }));
  await page.evaluate(() => {
    window.__jupiter.pause();
    window.__jupiterLongTasks = [];
    window.__jupiter.setView({ pitch: 0, zoom: 0.8 });
  });
  await page.waitForFunction(() => {
    const cache = window.__jupiter.renderStats.materialCache();
    return cache.pendingRowCount === 0 && cache.appliedRow === cache.desiredRow;
  });
  const motion = await page.evaluate(() => new Promise((resolve) => {
    const samples = [];
    let previous = performance.now();
    const tick = (now) => {
      const motionFrame = samples.length;
      const progress = motionFrame / 119;
      const pitch = progress <= 0.75
        ? progress / 0.75 * 89
        : (1 - progress) / 0.25 * 89;
      const zoom = 0.8 + Math.sin(progress * Math.PI) * 0.3;
      window.__jupiter.setView({ pitch, zoom });
      const cache = window.__jupiter.renderStats.materialCache();
      samples.push({
        interval: now - previous,
        pitch: window.__jupiter.view().pitch,
        zoom: window.__jupiter.view().zoom,
        appliedFrame: cache.appliedFrame,
        desiredFrame: cache.desiredFrame,
        pendingRowCount: cache.pendingRowCount,
        readyRows: cache.readyKeys,
      });
      previous = now;
      if (samples.length >= 120) resolve(samples.slice(5));
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await page.waitForFunction(() => {
    const cache = window.__jupiter.renderStats.materialCache();
    return cache.pendingRowCount === 0 && cache.appliedRow === cache.desiredRow;
  }, null, { timeout: 10_000 });
  const runtime = await page.evaluate(() => ({
    longTasks: [...window.__jupiterLongTasks],
    cache: window.__jupiter.renderStats.materialCache(),
    stableDomIdentity: window.__jupiter.assertStableDomIdentity(),
    retainedLeafCount: window.__jupiter.dom.retainedLeafCount,
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
  const lags = motion.map(({ appliedFrame, desiredFrame }) =>
    Math.abs(appliedFrame - desiredFrame)).sort((left, right) => left - right);
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
      materialLagPreparedFramesP95: percentile(lags, 0.95),
      maximumMaterialLagPreparedFrames: Math.max(...lags),
      materialLagDegreesP95: Number((percentile(lags, 0.95) * 0.5)
        .toFixed(3)),
      materialSettledSamplePercent: Number((
        motion.filter(({ appliedFrame, desiredFrame }) =>
          appliedFrame === desiredFrame).length / motion.length * 100
      ).toFixed(3)),
      worstSamples: Object.freeze([...motion]
        .sort((left, right) =>
          Math.abs(right.appliedFrame - right.desiredFrame) -
          Math.abs(left.appliedFrame - left.desiredFrame))
        .slice(0, 8)),
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
  if (process.env.JUPITER_PERF_REPORT_ONLY !== "1") {
    assert.equal(report.runtime.stableDomIdentity, true);
    assert.equal(report.runtime.retainedLeafCount, 797);
    assert.equal(report.runtime.stageElementCount, 827);
    assert.equal(report.runtime.runningAnimationCount, 0);
    assert.equal(report.runtime.cache.maximumRetainedRowCount, 3);
    assert.ok(report.runtime.cache.retainedRowCount <= 3);
    assert.equal(report.runtime.cache.appliedRow, report.runtime.cache.desiredRow);
    assert.ok(report.runtime.cache.imageAllocations <= 3);
    assert.deepEqual(report.externalRequests, []);
    assert.deepEqual(report.browserProblems, []);
    assert.ok(report.startup.longTasks.every((duration) => duration <= 200),
      JSON.stringify({ startupLongTasks: report.startup.longTasks }));
    assert.ok(report.runtime.longTasks.every((duration) => duration <= 100),
      JSON.stringify({ runtimeLongTasks: report.runtime.longTasks }));
    assert.ok(report.motion.frameIntervalP95Milliseconds <= 40,
      JSON.stringify(report.motion));
    assert.ok(report.motion.materialLagPreparedFramesP95 <= 6,
      JSON.stringify(report.motion));
    assert.ok(report.maximumCompositorLayer.width <= 7000,
      JSON.stringify(report.maximumCompositorLayer));
    assert.ok(report.maximumCompositorLayer.height <= 7000,
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
