import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4310";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
const reports = [];

try {
  for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({
      deviceScaleFactor,
      viewport: { width: 1200, height: 900 },
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    const externalRequests = [];
    const problems = [];
    const requestedPaths = new Set();
    let layers = [];
    await session.send("LayerTree.enable");
    await session.send("Performance.enable");
    session.on("LayerTree.layerTreeDidChange", (event) => {
      layers = event.layers ?? layers;
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      requestedPaths.add(url.pathname);
      if (url.origin !== new URL(baseUrl).origin) {
        externalRequests.push(request.url());
      }
    });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        problems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      problems.push(`pageerror: ${error.message}`);
    });
    await page.addInitScript(() => {
      window.__neptuneProductionLongTasks = [];
      new PerformanceObserver((list) => {
        window.__neptuneProductionLongTasks.push(
          ...list.getEntries().map(({ duration }) => duration),
        );
      }).observe({ type: "longtask", buffered: true });
    });

    try {
      const response = await page.goto(new URL("/neptune/", baseUrl).href, {
        waitUntil: "networkidle",
      });
      assert.equal(response?.status(), 200);
      await page.waitForFunction(() =>
        document.documentElement.dataset.ready === "true" &&
        document.querySelector(".planet-stage")?.getAttribute("aria-busy") ===
          "false");

      const initial = await page.evaluate(() => {
        const stage = document.querySelector(".planet-stage");
        const nodes = [stage, ...stage.querySelectorAll("*")];
        window.__neptuneProductionRetained = {
          nodes,
          parents: nodes.map((node) => node.parentNode),
        };
        return {
          title: document.title,
          stageChildren: stage.childElementCount,
          stageElements: stage.querySelectorAll("*").length,
          bodyLeafCount: stage.querySelectorAll(".neptune-body > s").length,
          materialLeafCount: stage.querySelectorAll(
            "s.neptune-exterior-material",
          ).length,
          orbitGuideLeafCount: stage.querySelectorAll(
            "s.neptune-moon-orbit-guide",
          ).length,
          imageCount: stage.querySelectorAll("img").length,
          canvasCount: stage.querySelectorAll("canvas").length,
          svgCount: stage.querySelectorAll("svg").length,
          sceneTransform: stage.querySelector(".polycss-scene").style.transform,
        };
      });
      assert.deepEqual(initial, {
        title: "Neptune - Powered by PolyCSS",
        stageChildren: 1,
        stageElements: 809,
        bodyLeafCount: 724,
        materialLeafCount: 1,
        orbitGuideLeafCount: 8,
        imageCount: 0,
        canvasCount: 0,
        svgCount: 0,
        sceneTransform:
          "scale(0.022) rotateX(40deg) rotate(0deg) " +
          "translate3d(0px, 0px, 0px)",
      });
      assert.equal(await page.evaluate(() => window.__cssEarth), undefined);
      assert.equal(await page.evaluate(() => window.__neptune), undefined);

      await page.locator("#neptune-lenses").evaluate((panel) => {
        panel.open = true;
      });
      for (const lens of ["methane", "near-infrared", "normal"]) {
        await page.locator(`button[name="lens"][value="${lens}"]`).click();
        await page.waitForFunction((id) =>
          document.querySelector(".planet-stage")?.dataset.lens === id,
        lens);
        assert.equal(await page.locator(
          `button[name="lens"][value="${lens}"]`,
        ).getAttribute("aria-pressed"), "true");
      }

      await drag(page, ".neptune-input-surface", 0, 150);
      await wheel(page, ".neptune-input-surface", -240);
      await page.locator("#neptune-settings").evaluate((panel) => {
        panel.open = true;
      });
      await page.locator('button[name="speed"]').evaluate((button) => {
        button.click();
      });
      const rings = page.locator('input[name="rings"]');
      await rings.evaluate((input) => input.click());
      assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
        stage.classList.contains("neptune-hide-rings")), true);
      await rings.evaluate((input) => input.click());
      await page.waitForTimeout(500);

      const after = await page.evaluate(() => {
        const stage = document.querySelector(".planet-stage");
        const retained = window.__neptuneProductionRetained;
        return {
          stageElements: stage.querySelectorAll("*").length,
          stable: retained.nodes.every((node, index) =>
            node.isConnected && node.parentNode === retained.parents[index]),
          sceneTransform: stage.querySelector(".polycss-scene").style.transform,
          materialAsset: getComputedStyle(
            stage.querySelector(".neptune-exterior-material"),
          ).backgroundImage,
          longTasks: window.__neptuneProductionLongTasks,
          resources: performance.getEntriesByType("resource")
            .filter(({ name }) => name.includes("/scenes/neptune/"))
            .map(({ name, transferSize }) => ({ name, transferSize })),
        };
      });
      assert.equal(after.stageElements, initial.stageElements);
      assert.equal(after.stable, true);
      assert.notEqual(after.sceneTransform, initial.sceneTransform);
      assert.match(after.materialAsset, /neptune-orbit-material-normal-row-/u);

      for (const stem of ["neptune-rings", "neptune-surface-normal"]) {
        assert.ok(requestedPaths.has(`/scenes/neptune/${stem}@2x.webp`));
        assert.equal(
          requestedPaths.has(`/scenes/neptune/${stem}.webp`),
          false,
        );
      }
      const transferBytes = after.resources.reduce(
        (sum, resource) => sum + resource.transferSize,
        0,
      );
      assert.ok(transferBytes < 8_000_000, `${transferBytes} transferred bytes`);
      assert.ok(after.longTasks.every((duration) => duration < 100),
        JSON.stringify(after.longTasks));

      const metrics = Object.fromEntries((await session.send(
        "Performance.getMetrics",
      )).metrics.map(({ name, value }) => [name, value]));
      const maximumLayer = layers.reduce((maximum, layer) => {
        const area = (layer.width ?? 0) * (layer.height ?? 0);
        return area > maximum.area
          ? { area, width: layer.width ?? 0, height: layer.height ?? 0 }
          : maximum;
      }, { area: 0, width: 0, height: 0 });
      assert.ok(maximumLayer.width <= 2400, JSON.stringify(maximumLayer));
      assert.ok(maximumLayer.height <= 1800, JSON.stringify(maximumLayer));
      assert.ok(maximumLayer.area <= 2 * 1200 * 900,
        JSON.stringify(maximumLayer));
      assert.deepEqual(externalRequests, []);
      assert.deepEqual(problems, []);
      reports.push({
        deviceScaleFactor,
        retainedStageElements: initial.stageElements,
        transferBytes,
        longTasks: after.longTasks,
        jsHeapUsedBytes: Math.round(metrics.JSHeapUsedSize ?? 0),
        domNodeMetric: Math.round(metrics.Nodes ?? 0),
        layoutCount: Math.round(metrics.LayoutCount ?? 0),
        recalcStyleCount: Math.round(metrics.RecalcStyleCount ?? 0),
        maximumCompositorLayer: maximumLayer,
        externalRequests: externalRequests.length,
        browserProblems: problems.length,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  ok: true,
  route: "/neptune/",
  mode: "production-build-without-development-diagnostics",
  reports,
}, null, 2));

async function drag(page, selector, deltaX, deltaY) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box);
  const x = box.x + box.width * 0.72;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 12 });
  await page.mouse.up();
  await nextPaint(page);
}

async function wheel(page, selector, deltaY) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5);
  await page.mouse.wheel(0, deltaY);
  await nextPaint(page);
}

function nextPaint(page) {
  return page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
