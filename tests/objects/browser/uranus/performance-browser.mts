declare global { interface Window { __uranusLongTasks: number[]; } }
type MotionSample = { interval: number; pitch: number; zoom: number; materialRow: number; retainedImages: number };
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
  const browserProblems: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserProblems.push(`pageerror: ${error.message}`));
  const cdp = await context.newCDPSession(page);
  let layers: { width: number; height: number; backendNodeId?: number }[] = [];
  await cdp.send("LayerTree.enable");
  await cdp.send("Performance.enable");
  cdp.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  await page.addInitScript(() => {
    window.__uranusLongTasks = [];
    new PerformanceObserver((list) => {
      window.__uranusLongTasks.push(
        ...list.getEntries().map(({ duration }) => duration),
      );
    }).observe({ type: "longtask", buffered: true });
  });
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
      externalRequests.push(request.url());
    }
  });
  const response = await page.goto(new URL("/uranus/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => window.__uranus?.ready === true);
  await page.waitForTimeout(500);
  const startup = await page.evaluate(() => {
    function requiredDiagnostics<T>(value: T): NonNullable<T> { if (value === undefined || value === null) throw new Error("Expected mounted development diagnostics"); return value; }
return ({
    longTasks: [...window.__uranusLongTasks],
    retainedImages: requiredDiagnostics(window.__uranus).renderStats.textureStats
      .retainedInteractiveImageCount,
    resources: performance.getEntriesByType("resource").filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming)
      .filter(({ name }) => name.includes("/scenes/uranus/"))
      .map(({ name, transferSize, decodedBodySize }) => ({
        name,
        transferSize,
        decodedBodySize,
      })),
  }); });
  await page.evaluate(() => {
    function requiredDiagnostics<T>(value: T): NonNullable<T> { if (value === undefined || value === null) throw new Error("Expected mounted development diagnostics"); return value; }

    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
    function requiredInput(value: Element | null): HTMLInputElement { if (!(value instanceof HTMLInputElement)) throw new Error("Expected required HTMLInputElement"); return value; }

    (requiredInput(document.querySelector('input[name="motion"]')).checked && requiredInput(document.querySelector('input[name="motion"]')).click());
    window.__uranusLongTasks = [];
    requiredDiagnostics(window.__uranus).camera.setState({ controlPitch: 0, zoom: 0.8 });
  });
  await page.waitForTimeout(250);
  const motion = await page.evaluate(() => {
    function requiredDiagnostics<T>(value: T): NonNullable<T> { if (value === undefined || value === null) throw new Error("Expected mounted development diagnostics"); return value; }
return new Promise<MotionSample[]>((resolve) => {
    const samples: MotionSample[] = [];
    let previous = performance.now();
    const tick = (now: number) => {
      const motionFrame = samples.length;
      const progress = motionFrame / 119;
      const pitch = progress <= 0.75
        ? progress / 0.75 * 89
        : (1 - progress) / 0.25 * 89;
      const zoom = 0.8 + Math.sin(progress * Math.PI) * 0.3;
      requiredDiagnostics(window.__uranus).camera.setState({ controlPitch: pitch, zoom });
      samples.push({
        interval: now - previous,
        pitch: requiredDiagnostics(window.__uranus).camera.state().controlPitch,
        zoom: requiredDiagnostics(window.__uranus).camera.state().zoom,
        materialRow: requiredDiagnostics(requiredDiagnostics(window.__uranus).material.state().lighting.row),
        retainedImages: requiredDiagnostics(window.__uranus).renderStats.textureStats
          .retainedInteractiveImageCount,
      });
      previous = now;
      if (samples.length >= 120) resolve(samples.slice(5));
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }); });
  await page.waitForTimeout(1_000);
  const runtime = await page.evaluate(() => {
    function requiredDiagnostics<T>(value: T): NonNullable<T> { if (value === undefined || value === null) throw new Error("Expected mounted development diagnostics"); return value; }

    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return ({
    longTasks: [...window.__uranusLongTasks],
    camera: requiredDiagnostics(window.__uranus).camera.stats(),
    retainedImages: requiredDiagnostics(window.__uranus).renderStats.textureStats
      .retainedInteractiveImageCount,
    stableDomIdentity: requiredDiagnostics(window.__uranus).assertStableDomIdentity(),
    retainedLeafCount: requiredDiagnostics(window.__uranus).dom.retainedLeafCount,
    stageElementCount: requiredElement(document.querySelector(".planet-stage"))
      .querySelectorAll<HTMLElement>("*").length,
    runningAnimationCount: requiredElement(document.querySelector(".planet-stage"))
      .getAnimations({ subtree: true })
      .filter(({ playState }) => playState === "running").length,
  }); });
  const metrics = Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map(
      ({ name, value }) => [name, value],
    ),
  );
  const intervals = motion.map(({ interval }) => interval)
    .sort((left, right) => left - right);
  const maximumCompositorLayer = layers.reduce<{ area: number; width: number; height: number }>((maximum, layer) => {
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
  // Preserve the measured report before any budget assertion.
  console.log(JSON.stringify(report, null, 2));
  if (process.env.URANUS_PERF_REPORT_ONLY !== "1") {
    assert.equal(report.runtime.stableDomIdentity, true);
    assert.equal(report.runtime.retainedLeafCount, 1_102);
    assert.equal(report.runtime.stageElementCount, 1_232);
    assert.equal(report.runtime.runningAnimationCount, 0);
    assert.deepEqual(report.externalRequests, []);
    assert.deepEqual(report.browserProblems, []);
    assert.ok(report.startup.longTasks.every((duration) => duration <= 200),
      JSON.stringify({ startupLongTasks: report.startup.longTasks }));
    assert.ok(report.runtime.longTasks.every((duration) => duration <= 100),
      JSON.stringify({ runtimeLongTasks: report.runtime.longTasks }));
    assert.ok(report.motion.frameIntervalP95Milliseconds <= 40,
      JSON.stringify(report.motion));
    assert.ok(report.maximumCompositorLayer.width <= 7_000,
      JSON.stringify(report.maximumCompositorLayer));
    assert.ok(report.maximumCompositorLayer.height <= 7_000,
      JSON.stringify(report.maximumCompositorLayer));
  }

  await cdp.detach();
  await context.close();
} finally {
  await browser.close();
}

function percentile(sorted: readonly number[], fraction: number) {
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * fraction),
  )];
}
