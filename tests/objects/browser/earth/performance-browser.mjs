import assert from "node:assert/strict";
import { chromium } from "playwright";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";
import { PREPARED_EARTH_SCENE } from "../../unit/earth/prepared-fixture.mjs";
import { PREPARED_EARTH_STARFIELD } from "../../unit/earth/prepared-fixture.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const deviceScaleFactor = Number(process.argv[3] ?? 1);
assert.ok(deviceScaleFactor === 1 || deviceScaleFactor === 2);

const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  let layers = [];
  await session.send("LayerTree.enable");
  await session.send("Performance.enable");
  session.on("LayerTree.layerTreeDidChange", (event) => {
    layers = event.layers ?? layers;
  });
  await page.addInitScript(() => {
    window.__earthLongTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__earthLongTasks.push(entry.duration);
      }
    }).observe({ type: "longtask", buffered: true });
  });
  const external = [];
  const requestedAssets = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
      external.push(request.url());
    } else {
      requestedAssets.push(new URL(request.url()).pathname);
    }
  });
  await page.goto(new URL("/earth/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__earth?.ready === true);
  await page.waitForTimeout(1200);
  const startup = await page.evaluate(() => ({
    retainedImageCount:
      window.__earth.renderStats.textureStats.retainedInteractiveImageCount,
    resources: performance.getEntriesByType("resource")
      .filter(({ name }) => name.includes("/scenes/earth/"))
      .map(({ name, transferSize, decodedBodySize }) => ({
        name,
        transferSize,
        decodedBodySize,
      })),
    longTasks: [...window.__earthLongTasks],
  }));
  await page.evaluate(() => { window.__earthLongTasks = []; });
  const frameIntervals = await page.evaluate(() => new Promise((resolve) => {
    const samples = [];
    let previous = performance.now();
    const sample = (now) => {
      samples.push(now - previous);
      previous = now;
      const motionFrame = samples.length - 1;
      window.__earth.camera.setState({
        controlPitch: motionFrame % 90,
        zoom: 0.85 + (motionFrame % 31) / 100,
      });
      if (samples.length >= 120) resolve(samples.slice(5));
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  await page.waitForFunction(() => {
    const runtime = window.__earth.runtime, selected = runtime.selection();
    return !selected.pending && !selected.loadingMaterial && runtime.resources().pools
      .filter(pool => ["lighting", "atmosphere"].includes(pool.id)).every(pool => pool.pending === 0);
  }, null, { timeout: 10_000 });
  const runtime = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource")
      .filter(({ name }) => name.includes("/scenes/earth/"));
    return {
      elementCount: document.querySelectorAll("*").length,
      retainedLeafCount: window.__earth.dom.retainedLeafCount,
      retainedImageCount:
        window.__earth.renderStats.textureStats.retainedInteractiveImageCount,
      selectedPreparedDensity:
        window.__earth.renderStats.textureStats.selectedPreparedDensity,
      runningAnimationCount: document.getAnimations()
        .filter(({ playState }) => playState === "running").length,
      longTasks: window.__earthLongTasks,
      transferBytes: resources.reduce(
        (sum, entry) => sum + entry.transferSize,
        0,
      ),
      decodedBodyBytes: resources.reduce(
        (sum, entry) => sum + entry.decodedBodySize,
        0,
      ),
      resourceCount: resources.length,
      cameraStats: window.__earth.camera.stats(),
      materials: window.__earth.material.state(),
      materialCaches: Object.fromEntries(window.__earth.runtime.resources().pools
        .filter(pool => ["lighting", "atmosphere"].includes(pool.id)).map(pool => [pool.id, pool])),
      selection: window.__earth.runtime.selection(),
      embeddedMoonElementCount:
        document.querySelectorAll('[class*="earth-moon"]').length,
    };
  });
  const hiddenAtmosphereTransport = await page.evaluate(async () => {
    const input = document.querySelector(
      'input[name="atmosphere"][type="checkbox"]',
    );
    if (!(input instanceof HTMLInputElement)) return null;
    if (input.checked) input.click();
    const stats = () => ({ pool: window.__earth.runtime.resources().pools.find(pool => pool.id === "atmosphere"),
      decodes: window.__earth.runtime.resources().decodes, selection: window.__earth.runtime.selection() });
    while (stats().pool.pending !== 0 || stats().selection.pending) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const before = stats();
    for (let controlPitch = 0; controlPitch < 90; controlPitch += 1) {
      window.__earth.camera.setState({ controlPitch });
    }
    await new Promise((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(resolve)));
    const after = stats();
    return { before, after };
  });
  const metrics = Object.fromEntries(
    (await session.send("Performance.getMetrics")).metrics.map(
      ({ name, value }) => [name, value],
    ),
  );
  await page.evaluate(() => (document.querySelector('input[name="motion"]').checked && document.querySelector('input[name="motion"]').click()));
  const describedLayers = await Promise.all(layers.map(async (layer) => {
    let className = "";
    if (layer.backendNodeId) {
      try {
        const { node } = await session.send("DOM.describeNode", {
          backendNodeId: layer.backendNodeId,
        });
        const attributes = node.attributes ?? [];
        const classIndex = attributes.indexOf("class");
        if (classIndex >= 0) className = attributes[classIndex + 1] ?? "";
      } catch {
        className = "";
      }
    }
    return { ...layer, className };
  }));
  const maximumLayer = layers.reduce((maximum, layer) => {
    const area = (layer.width ?? 0) * (layer.height ?? 0);
    return area > maximum.area
      ? { area, width: layer.width ?? 0, height: layer.height ?? 0 }
      : maximum;
  }, { area: 0, width: 0, height: 0 });
  const maximumSceneLayer = describedLayers
    .filter(({ className }) => !className.split(/\s+/u)
      .includes("earth-input-surface"))
    .reduce((maximum, layer) => {
      const area = (layer.width ?? 0) * (layer.height ?? 0);
      return area > maximum.area
        ? { area, width: layer.width ?? 0, height: layer.height ?? 0 }
        : maximum;
    }, { area: 0, width: 0, height: 0 });
  const totalLayerArea = layers.reduce((sum, layer) =>
    sum + (layer.width ?? 0) * (layer.height ?? 0), 0);
  const sortedFrameIntervals = [...frameIntervals].sort((left, right) =>
    left - right);
  const report = {
    deviceScaleFactor,
    startup,
    ...runtime,
    hiddenAtmosphereTransport,
    maximumCompositorLayer: maximumLayer,
    maximumSceneCompositorLayer: maximumSceneLayer,
    jsHeapUsedBytes: metrics.JSHeapUsedSize,
    domNodeCount: metrics.Nodes,
    layoutCount: metrics.LayoutCount,
    styleRecalcCount: metrics.RecalcStyleCount,
    compositorLayerCount: layers.length,
    totalCompositorLayerArea: totalLayerArea,
    frameIntervalP95Milliseconds:
      sortedFrameIntervals[Math.floor(sortedFrameIntervals.length * 0.95)],
    materialRowRequests: Object.freeze({
      lighting: requestedAssets.filter((pathname) =>
        /earth-lighting-row-\d+(?:@2x)?\.webp$/u.test(pathname)),
      atmosphere: requestedAssets.filter((pathname) =>
        /earth-atmosphere-row-\d+(?:@2x)?\.webp$/u.test(pathname)),
    }),
    externalRequests: external,
  };
  // Preserve the measured report before any budget assertion.
  console.log(JSON.stringify(report, null, 2));
  assert.equal(
    report.selectedPreparedDensity,
    CANONICAL_PREPARED_IMAGE_DENSITY,
  );
  assert.equal(report.retainedLeafCount,
    PREPARED_EARTH_SCENE.counts.maximumRetainedLeafCount);
  const startupRetainedImageCount =
    PREPARED_EARTH_SCENE.body.assets.surface.urls.length + 1 +
      PREPARED_EARTH_STARFIELD.faces.length * 2 + 1 + 1 +
      PREPARED_EARTH_SCENE.material.atmosphere.transport.initialWarmRows.length;
  assert.equal(report.startup.retainedImageCount, startupRetainedImageCount);
  assert.ok(report.retainedImageCount <= startupRetainedImageCount + 4,
    JSON.stringify({ retainedImageCount: report.retainedImageCount }));
  assert.ok(report.runningAnimationCount <= 5);
  assert.equal(report.cameraStats.runtimeGeometryPreparation, false);
  assert.ok(report.cameraStats.publications >= 100,
    JSON.stringify(report.cameraStats));
  assert.ok(report.materials.lighting.addressWrites + report.materials.atmosphere.addressWrites > 0,
    JSON.stringify(report.materials));
  for (const cache of Object.values(report.materialCaches)) {
    assert.equal(cache.capacity, 3);
    assert.ok(cache.nativeSlots <= 3, JSON.stringify(cache));
    assert.equal(cache.pending, 0);
  }
  assert.equal(report.selection.committed.shadows, false);
  assert.equal(report.materialCaches.lighting.resident, 0);
  assert.ok(!report.selection.plan.required.some(key => key.startsWith("lighting:")));
  assert.equal(report.materialRowRequests.lighting.length, 0);
  assert.ok(new Set(report.materialRowRequests.atmosphere).size <=
    PREPARED_EARTH_SCENE.material.atmosphere.shardCount,
  JSON.stringify(report.materialRowRequests.atmosphere));
  assert.ok(report.materialRowRequests.atmosphere.length <= 24,
    JSON.stringify(report.materialRowRequests.atmosphere));
  assert.ok(report.hiddenAtmosphereTransport);
  assert.equal(report.hiddenAtmosphereTransport.before.selection.committed.atmosphere, false);
  assert.deepEqual(report.hiddenAtmosphereTransport.after.pool.keys, report.hiddenAtmosphereTransport.before.pool.keys);
  assert.equal(
    report.hiddenAtmosphereTransport.after.decodes,
    report.hiddenAtmosphereTransport.before.decodes,
  );
  const transferBudget = 34_000_000;
  assert.ok(report.transferBytes < transferBudget,
    JSON.stringify({ transferBytes: report.transferBytes, transferBudget }));
  assert.equal(report.embeddedMoonElementCount, 0);
  const maximumLayerDimension =
    1440 * CANONICAL_PREPARED_IMAGE_DENSITY + 10;
  assert.ok(report.maximumCompositorLayer.width <= maximumLayerDimension,
    JSON.stringify(report.maximumCompositorLayer));
  assert.ok(report.maximumCompositorLayer.height <= maximumLayerDimension,
    JSON.stringify(report.maximumCompositorLayer));
  assert.ok(report.maximumSceneCompositorLayer.width <= maximumLayerDimension,
    JSON.stringify(report.maximumSceneCompositorLayer));
  assert.ok(report.maximumSceneCompositorLayer.height <= maximumLayerDimension,
    JSON.stringify(report.maximumSceneCompositorLayer));
  assert.deepEqual(report.externalRequests, []);
  assert.equal(requestedAssets.some((pathname) =>
    pathname.includes("earth-moon-")), false);
  assert.ok(report.longTasks.every((duration) => duration <= 100),
    JSON.stringify({ longTasks: report.longTasks }));
  assert.ok(report.startup.longTasks.every((duration) => duration <= 200),
    JSON.stringify({ startupLongTasks: report.startup.longTasks }));
  assert.ok(report.frameIntervalP95Milliseconds <= 40,
    JSON.stringify({ p95: report.frameIntervalP95Milliseconds }));

} finally {
  await browser.close();
}
