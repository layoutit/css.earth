import assert from "node:assert/strict";
import { chromium } from "playwright";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4310";
const densities = process.argv[3] ? [Number(process.argv[3])] : [1, 2];
assert.ok(densities.every((density) => density === 1 || density === 2));

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const reports = [];
try {
  for (const deviceScaleFactor of densities) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor,
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    const problems = [];
    const externalRequests = [];
    let layers = [];
    await session.send("LayerTree.enable");
    session.on("LayerTree.layerTreeDidChange", (event) => {
      layers = event.layers ?? layers;
    });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        problems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== new URL(baseUrl).origin) {
        externalRequests.push(request.url());
      }
    });
    await page.addInitScript(() => {
      window.__earthProductionLongTasks = [];
      new PerformanceObserver((list) => {
        window.__earthProductionLongTasks.push(
          ...list.getEntries().map(({ duration }) => duration),
        );
      }).observe({ type: "longtask", buffered: true });
    });
    try {
      const response = await page.goto(new URL("/earth/", baseUrl).href, {
        waitUntil: "networkidle",
      });
      assert.equal(response?.status(), 200);
      await page.waitForFunction(() =>
        document.documentElement.dataset.ready === "true" &&
        document.querySelector(".planet-stage")?.getAttribute("aria-busy") === "false",
      );
      const initial = await page.evaluate(() => {
        const stage = document.querySelector(".planet-stage");
        const nodes = [stage, ...stage.querySelectorAll("*")];
        window.__earthProductionRetained = {
          nodes,
          parents: nodes.map((node) => node.parentNode),
        };
        return {
          title: document.title,
          stageElements: stage.querySelectorAll("*").length,
          retainedLeaves: stage.querySelectorAll("b, s, u").length,
          canvasCount: stage.querySelectorAll("canvas").length,
          svgCount: stage.querySelectorAll("svg").length,
          sceneTransform: getComputedStyle(
            stage.querySelector(".polycss-scene"),
          ).transform,
          normalSurfaceImage: getComputedStyle(
            stage.querySelector(".earth-body:not(.earth-body-polar) > s"),
            "::before",
          ).backgroundImage,
          normalPolesImage: getComputedStyle(
            stage.querySelector(".earth-body-polar > s"),
          ).backgroundImage,
          embeddedMoonElementCount:
            stage.querySelectorAll('[class*="earth-moon"]').length,
          atmosphereImage: getComputedStyle(
            stage.querySelector(".earth-atmosphere-material"),
          ).backgroundImage,
          renderRootCount: stage.querySelectorAll(":scope > .planet-render-root")
            .length,
        };
      });
      assert.equal(initial.title, "Earth - Powered by PolyCSS");
      assert.equal(initial.retainedLeaves,
        PREPARED_EARTH_SCENE.counts.maximumRetainedLeafCount);
      assert.equal(initial.canvasCount, 0);
      assert.equal(initial.svgCount, 0);
      assert.equal(initial.embeddedMoonElementCount, 0);
      assert.equal(initial.normalSurfaceImage.endsWith(
        '/scenes/earth/earth-surface.webp")'), true);
      assert.equal(initial.normalPolesImage.endsWith(
        '/scenes/earth/earth-surface-poles.webp")'), true);
      assert.equal(initial.atmosphereImage.includes("@2x"), true);
      assert.equal(initial.renderRootCount, 1);

      await page.mouse.move(900, 450);
      await page.mouse.down();
      await page.mouse.move(900, 600, { steps: 10 });
      await page.mouse.up();
      await page.mouse.wheel(0, -180);
      await page.locator("#earth-lenses").evaluate((panel) => { panel.open = true; });
      await page.locator('button[name="lens"][value="topography"]').click();
      await page.waitForFunction(() =>
        document.querySelector('button[name="lens"][value="topography"]')
          ?.getAttribute("aria-pressed") === "true",
      );
      await page.locator('button[name="lens"][value="normal"]').click();
      await page.locator("#earth-settings").evaluate((panel) => { panel.open = true; });
      for (const name of ["atmosphere"]) {
        const control = page.locator(`input[name="${name}"]`);
        await control.evaluate((input) => input.click());
        await control.evaluate((input) => input.click());
      }
      await page.waitForTimeout(1200);
      const after = await page.evaluate(() => {
        const stage = document.querySelector(".planet-stage");
        const retained = window.__earthProductionRetained;
        return {
          sceneTransform: getComputedStyle(
            stage.querySelector(".polycss-scene"),
          ).transform,
          stageElements: stage.querySelectorAll("*").length,
          stable: retained.nodes.every((node, index) =>
            node.isConnected && node.parentNode === retained.parents[index]),
          animationCount: stage.getAnimations({ subtree: true })
            .filter(({ playState }) => playState === "running").length,
          longTasks: window.__earthProductionLongTasks,
          resources: performance.getEntriesByType("resource")
            .filter(({ name }) => name.includes("/scenes/earth/"))
            .map(({ name, transferSize }) => ({ name, transferSize })),
        };
      });
      assert.notEqual(after.sceneTransform, initial.sceneTransform);
      assert.equal(after.stageElements, initial.stageElements);
      assert.equal(after.stable, true);
      assert.ok(after.animationCount <= 5);
      assert.deepEqual(after.longTasks, []);
      const transferBytes = after.resources.reduce(
        (sum, resource) => sum + resource.transferSize,
        0,
      );
      const transferBudget = 45_000_000;
      assert.ok(transferBytes < transferBudget, JSON.stringify({
        deviceScaleFactor,
        transferBytes,
        transferBudget,
        resources: after.resources,
      }));
      assert.equal(after.resources.some(({ name }) =>
        name.includes("earth-moon-")), false);
      assert.equal(after.resources.some(({ name }) =>
        name.includes("earth-interior-")), true);
      await page.locator('button[name="lens"][value="cross-section"]').click();
      await page.waitForFunction(() =>
        document.querySelectorAll(".earth-cutaway").length === 1,
      );
      await page.locator('button[name="lens"][value="normal"]').click();
      await page.locator('button[name="lens"][value="cross-section"]').click();
      assert.deepEqual(await page.evaluate(() => ({
        rootCount: document.querySelectorAll(".earth-cutaway").length,
        leafCount: document.querySelectorAll(".earth-cutaway s").length,
        stageElements: document.querySelector(".planet-stage")
          .querySelectorAll("*").length,
      })), {
        rootCount: 1,
        leafCount: PREPARED_EARTH_SCENE.interior.leafCount,
        stageElements: initial.stageElements,
      });
      const maximumLayer = layers.reduce((maximum, layer) => {
        const area = (layer.width ?? 0) * (layer.height ?? 0);
        return area > maximum.area
          ? { area, width: layer.width ?? 0, height: layer.height ?? 0 }
          : maximum;
      }, { area: 0, width: 0, height: 0 });
      const maximumLayerDimension =
        1440 * CANONICAL_PREPARED_IMAGE_DENSITY;
      assert.ok(maximumLayer.width <= maximumLayerDimension,
        JSON.stringify(maximumLayer));
      assert.ok(maximumLayer.height <= maximumLayerDimension,
        JSON.stringify(maximumLayer));
      assert.ok(maximumLayer.area <= maximumLayerDimension ** 2,
        JSON.stringify(maximumLayer));
      assert.deepEqual(externalRequests, []);
      assert.deepEqual(problems, []);
      reports.push({
        deviceScaleFactor,
        retainedLeaves: initial.retainedLeaves,
        retainedStageElements: initial.stageElements,
        runningAnimations: after.animationCount,
        transferBytes,
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

console.log(JSON.stringify({ ok: true, production: true, reports }, null, 2));
