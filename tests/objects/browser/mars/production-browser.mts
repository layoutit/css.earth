declare global { interface Window { __marsProductionRetained: { nodes: Element[]; parents: (ParentNode | null)[] }; __marsProductionLongTasks: number[]; } }
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4332";
const densities = process.argv[3] ? [Number(process.argv[3])] : [1, 2];
assert.ok(densities.every((density) => [1, 2].includes(density)));

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const reports = [];
try {
  for (const deviceScaleFactor of densities) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const browserProblems: string[] = [];
    const externalRequests: string[] = [];
    let layers: { width: number; height: number }[] = [];
    await cdp.send("LayerTree.enable");
    cdp.on("LayerTree.layerTreeDidChange", (event) => {
      layers = event.layers ?? layers;
    });
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
    await page.addInitScript(() => {
      window.__marsProductionLongTasks = [];
      new PerformanceObserver((list) => {
        window.__marsProductionLongTasks.push(
          ...list.getEntries().map(({ duration }) => duration),
        );
      }).observe({ type: "longtask", buffered: true });
    });
    try {
      const response = await page.goto(new URL("/mars/", baseUrl).href, {
        waitUntil: "networkidle",
      });
      assert.equal(response?.status(), 200);
      await page.waitForFunction(() =>
        document.documentElement.dataset.ready === "true" &&
        document.querySelector<HTMLElement>(".planet-stage")?.getAttribute("aria-busy") ===
          "false",
      );
      const initial = await page.evaluate(() => {
        function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

        const stage = requiredElement(document.querySelector(".planet-stage"));
        const nodes = [stage, ...stage.querySelectorAll<HTMLElement>("*")];
        window.__marsProductionRetained = {
          nodes,
          parents: nodes.map((node) => node.parentNode),
        };
        return {
          title: document.title,
          diagnostics: typeof window.__mars,
          stageElements: stage.querySelectorAll<HTMLElement>("*").length,
          retainedLeaves: stage.querySelectorAll<HTMLElement>("b, s, u").length,
          canvasCount: stage.querySelectorAll<HTMLElement>("canvas").length,
          svgCount: stage.querySelectorAll<HTMLElement>("svg").length,
          sceneTransform: getComputedStyle(requiredElement(stage.querySelector(
            ".polycss-scene",
          ))).transform,
          normalSurfaceImage: getComputedStyle(requiredElement(stage.querySelector(
            ".mars-body > s:not(.mars-pole)",
          ))).backgroundImage,
          normalPolesImage: getComputedStyle(requiredElement(stage.querySelector(
            ".mars-body > .mars-pole",
          ))).backgroundImage,
          materialImage: getComputedStyle(requiredElement(stage.querySelector(
            ".mars-material-plane > s",
          ))).backgroundImage,
          moonImage: getComputedStyle(requiredElement(stage.querySelector(
            ".mars-moon-shape > s",
          ))).backgroundImage,
          loadedPreparedAssetUrls: performance.getEntriesByType("resource").filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming)
            .map(({ name }) => name)
            .filter((url) => url.includes("/scenes/mars/")),
          renderRootCount: stage.querySelectorAll<HTMLElement>(
            ":scope > .planet-render-root",
          ).length,
          materialSharesMoonScene:
            stage.querySelector<HTMLElement>(".mars-material")?.closest(".polycss-scene") ===
            stage.querySelector<HTMLElement>(".mars-moon-shape")?.closest(".polycss-scene"),
        };
      });
      assert.equal(initial.title, "Mars | cssEarth");
      assert.equal(initial.diagnostics, "undefined");
      assert.equal(initial.stageElements, 551);
      assert.equal(initial.retainedLeaves, 520);
      assert.equal(initial.canvasCount, 0);
      assert.equal(initial.svgCount, 0);
      assert.equal(initial.renderRootCount, 1);
      assert.equal(initial.materialSharesMoonScene, true);
      const densityAwareAssets = [...new Set(
        initial.loadedPreparedAssetUrls.filter((url) =>
          /\/mars-(?:surface|poles|moon-billboards|directional-sun|starfield-(?:front|right|back|left|top|bottom))(?:@2x)?\.webp$/u
            .test(url)),
      )];
      assert.equal(densityAwareAssets.length, 10);
      assert.equal(densityAwareAssets.every((url) =>
        url.includes("@2x.webp")), true);
      assert.equal(
        initial.materialImage.includes("-2x-row-"),
        true,
      );

      await page.mouse.move(930, 520);
      await page.mouse.down();
      await page.mouse.move(930, 300, { steps: 14 });
      await page.mouse.up();
      await page.mouse.wheel(0, -180);
      await page.locator("#mars-lenses").evaluate((panel) => {
if (!(panel instanceof HTMLDetailsElement)) throw new Error("Expected HTMLDetailsElement observation");

        panel.open = true;
      });
      for (const lens of ["elevation", "thermal", "normal"]) {
        await page.locator(`button[name="lens"][value="${lens}"]`).click();
        await page.waitForFunction((id) =>
          document.querySelector<HTMLButtonElement>(`button[name="lens"][value="${id}"]`)
            ?.getAttribute("aria-pressed") === "true", lens);
      }
      await page.locator("#mars-settings").evaluate((panel) => {
if (!(panel instanceof HTMLDetailsElement)) throw new Error("Expected HTMLDetailsElement observation");

        panel.open = true;
      });
      for (const name of ["shadows", "moons"]) {
        const input = page.locator(`input[name="${name}"]`);
        await input.evaluate((control) => {
if (!(control instanceof HTMLElement)) throw new Error("Expected HTMLElement observation");
return control.click(); });
        await input.evaluate((control) => {
if (!(control instanceof HTMLElement)) throw new Error("Expected HTMLElement observation");
return control.click(); });
      }
      await page.waitForTimeout(800);
      const after = await page.evaluate(() => {
        function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

        const stage = requiredElement(document.querySelector(".planet-stage"));
        const retained = window.__marsProductionRetained;
        return {
          sceneTransform: getComputedStyle(requiredElement(stage.querySelector(
            ".polycss-scene",
          ))).transform,
          stageElements: stage.querySelectorAll<HTMLElement>("*").length,
          stable: retained.nodes.every((node, index) =>
            node.isConnected && node.parentNode === retained.parents[index]),
          runningAnimationCount: stage.getAnimations({ subtree: true })
            .filter(({ playState }) => playState === "running").length,
          longTasks: window.__marsProductionLongTasks,
          materialImage: getComputedStyle(requiredElement(stage.querySelector(
            ".mars-material-plane > s",
          ))).backgroundImage,
          resources: performance.getEntriesByType("resource").filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming)
            .filter(({ name }) => name.includes("/scenes/mars/"))
            .map(({ name, transferSize }) => ({ name, transferSize })),
        };
      });
      assert.notEqual(after.sceneTransform, initial.sceneTransform);
      assert.equal(after.stageElements, initial.stageElements);
      assert.equal(after.stable, true);
      assert.ok(after.runningAnimationCount <= 5);
      assert.ok(after.longTasks.every((duration) => duration <= 200),
        JSON.stringify(after.longTasks));
      assert.equal(
        after.materialImage.includes("-2x-row-"),
        true,
      );
      const transferBytes = after.resources.reduce(
        (total, resource) => total + resource.transferSize,
        0,
      );
      const transferBudget = 25_000_000;
      assert.ok(transferBytes < transferBudget, JSON.stringify({
        deviceScaleFactor,
        transferBytes,
        transferBudget,
      }));
      const maximumLayer = layers.reduce<{ area: number; width: number; height: number }>((maximum, layer) => {
        const area = (layer.width ?? 0) * (layer.height ?? 0);
        return area > maximum.area ? {
          width: layer.width ?? 0,
          height: layer.height ?? 0,
          area,
        } : maximum;
      }, { width: 0, height: 0, area: 0 });
      assert.ok(maximumLayer.width <= 2880, JSON.stringify(maximumLayer));
      assert.ok(maximumLayer.height <= 2880, JSON.stringify(maximumLayer));
      assert.deepEqual(externalRequests, []);
      assert.deepEqual(browserProblems, []);
      reports.push(Object.freeze({
        deviceScaleFactor,
        retainedLeaves: initial.retainedLeaves,
        retainedStageElements: initial.stageElements,
        runningAnimations: after.runningAnimationCount,
        transferBytes,
        maximumCompositorLayer: maximumLayer,
        externalRequests: externalRequests.length,
        browserProblems: browserProblems.length,
      }));
    } finally {
      await cdp.detach();
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, production: true, reports }, null, 2));

