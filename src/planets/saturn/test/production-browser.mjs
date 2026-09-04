import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4310";
const densities = process.argv[3] ? [Number(process.argv[3])] : [1, 2];
assert.ok(densities.every((density) => density === 1 || density === 2));

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
  ignoreDefaultArgs: ["--disable-back-forward-cache"],
});
const reports = [];

try {
  for (const deviceScaleFactor of densities) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor,
    });
    const page = await context.newPage();
    const problems = [];
    const externalRequests = [];
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
      window.__saturnProductionPageShows = [];
      addEventListener("pageshow", ({ persisted }) => {
        window.__saturnProductionPageShows.push(persisted);
      });
    });

    try {
      const response = await page.goto(new URL("/saturn/", baseUrl).href, {
        waitUntil: "networkidle",
      });
      assert.equal(response?.status(), 200);
      await waitForReady(page);
      const initial = await page.evaluate(() => {
        const stage = document.querySelector(".planet-stage");
        const nodes = [stage, ...stage.querySelectorAll("*")];
        window.__saturnProductionRetained = {
          nodes,
          parents: nodes.map((node) => node.parentNode),
        };
        return {
          title: document.title,
          descendants: stage.querySelectorAll("*").length,
          leaves: stage.querySelectorAll("b, s, u").length,
          canvas: stage.querySelectorAll("canvas").length,
          sceneSvg: stage.querySelectorAll(".polycss-scene svg").length,
          cutaways: stage.querySelectorAll(".saturn-cutaway").length,
          minorMoons: stage.querySelectorAll(".saturn-minor-moons > b").length,
          renderRoots: stage.querySelectorAll(":scope > .planet-render-root")
            .length,
        };
      });
      assert.deepEqual(initial, {
        title: "Saturn - Powered by PolyCSS",
        descendants: 1_322,
        leaves: 1_246,
        canvas: 0,
        sceneSvg: 0,
        cutaways: 1,
        minorMoons: 285,
        renderRoots: 2,
      });
      assert.equal(await page.evaluate(() => window.__cssEarth), undefined);
      assert.equal(await page.evaluate(() => window.__saturn), undefined);

      const input = page.locator(".saturn-input-surface");
      await input.focus();
      await page.keyboard.press("End");
      await page.keyboard.press("Home");
      await page.keyboard.press("=");
      await page.keyboard.press("-");
      await page.locator('button[name="lens"][value="ultraviolet"]').click();
      await page.waitForFunction(() =>
        document.querySelector(".planet-stage")?.dataset.lens === "ultraviolet");
      await page.locator('button[name="lens"][value="cross-section"]').click();
      await page.waitForFunction(() =>
        document.querySelector(".planet-stage")?.dataset.view === "interior");
      await page.locator('button[name="lens"][value="thermal"]').click();
      await page.waitForFunction(() =>
        document.querySelector(".planet-stage")?.dataset.lens === "thermal");
      await page.locator('button[name="lens"][value="cross-section"]').click();
      await page.waitForFunction(() =>
        !document.querySelector(".planet-stage")?.dataset.view);

      for (const [name, className] of [
        ["rings", "saturn-hide-rings"],
        ["shadows", "saturn-hide-shadows"],
      ]) {
        const control = page.locator(`input[name="${name}"]`);
        await control.evaluate((element) => element.click());
        await page.waitForFunction((expectedClass) =>
          document.querySelector(".planet-stage")?.classList
            .contains(expectedClass), className);
        await control.evaluate((element) => element.click());
        await page.waitForFunction((expectedClass) =>
          !document.querySelector(".planet-stage")?.classList
            .contains(expectedClass), className);
      }

      const after = await page.evaluate(() => {
        const stage = document.querySelector(".planet-stage");
        const retained = window.__saturnProductionRetained;
        return {
          descendants: stage.querySelectorAll("*").length,
          leaves: stage.querySelectorAll("b, s, u").length,
          stable: retained.nodes.every((node, index) =>
            node.isConnected && node.parentNode === retained.parents[index]),
          resources: performance.getEntriesByType("resource")
            .map(({ name }) => name)
            .filter((name) => name.includes("/scenes/saturn/")),
        };
      });
      assert.equal(after.descendants, initial.descendants);
      assert.equal(after.leaves, initial.leaves);
      assert.equal(after.stable, true);
      const selectedRing = "/scenes/saturn/saturn-rings@2x.webp";
      const wrongRing = "/scenes/saturn/saturn-rings.webp";
      assert.ok(after.resources.some((url) => url.endsWith(selectedRing)));
      assert.equal(after.resources.some((url) => url.endsWith(wrongRing)), false);

      await page.goto(new URL("/mars/", baseUrl).href, {
        waitUntil: "networkidle",
      });
      await page.goBack({ waitUntil: "networkidle" });
      await waitForReady(page);
      await page.waitForFunction(() =>
        window.__saturnProductionPageShows.length > 1, null, {
        timeout: 3_000,
      });
      const restored = await page.evaluate(() => ({
        path: location.pathname,
        persistedPageShow: window.__saturnProductionPageShows.at(-1),
        notRestoredReasons: performance.getEntriesByType("navigation")[0]
          ?.notRestoredReasons ?? null,
        descendants: document.querySelector(".planet-stage")
          ?.querySelectorAll("*").length,
        leaves: document.querySelector(".planet-stage")
          ?.querySelectorAll("b, s, u").length,
      }));
      assert.deepEqual(restored, {
        path: "/saturn/",
        persistedPageShow: true,
        notRestoredReasons: null,
        descendants: initial.descendants,
        leaves: initial.leaves,
      });
      assert.equal(await page.evaluate(() => window.__saturn), undefined);
      assert.deepEqual(externalRequests, []);
      assert.deepEqual(problems, []);
      reports.push({
        deviceScaleFactor,
        retainedLeaves: initial.leaves,
        retainedDescendants: initial.descendants,
        selectedRing,
        bfcacheRestored: restored.persistedPageShow,
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
  route: "/saturn/",
  mode: "production-build-without-development-diagnostics",
  reports,
}, null, 2));

async function waitForReady(page) {
  await page.waitForFunction(() =>
    document.documentElement.dataset.ready === "true" &&
    document.querySelector(".planet-stage")?.getAttribute("aria-busy") ===
      "false");
}
