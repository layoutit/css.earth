import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Capture the accepted layout before a structural change, then compare its geometry.
const captureBefore = process.argv.includes("--capture-before");
const compareBaseline = process.argv.includes("--compare-baseline");
const baseUrl = process.argv[2] ?? process.env.CSSEARTH_LAYOUT_URL ?? "http://127.0.0.1:4210";
const output = resolve("output/playwright/layout-foundation");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const cases = [
  { name: "desktop", width: 1280, height: 720, density: 1 },
  { name: "desktop-dpr2", width: 1440, height: 960, density: 2 },
  { name: "small-landscape", width: 900, height: 600, density: 1 },
  { name: "phone", width: 390, height: 844, density: 2 },
  { name: "tablet", width: 1024, height: 1366, density: 1 },
];
const selectors = [
  ".explorer-shell-header", ".explorer-shell-wordmark", ".maps-brand-button",
  ".explorer-rail", ".explorer-rail-explore", ".planet-sidebar", ".planet-sidebar-search",
  ".planet-information-panel", ".planet-title", ".planet-introduction",
  ".planet-panel-summary", ".planet-lens-icon", ".planet-stage",
];

try {
  for (const config of cases) {
    const page = await browser.newPage({
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: config.density,
    });
    await page.goto(`${baseUrl}/jupiter/`);
    await page.waitForFunction(() => document.querySelector(".planet-stage")?.getAttribute("aria-busy") === "false");
    const geometry = await page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
      const node = document.querySelector(selector);
      const { x, y, width, height } = node.getBoundingClientRect();
      return [selector, { x, y, width, height }];
    })), selectors);
    const beforePath = `${output}/${config.name}-before.json`;
    if (captureBefore) {
      await writeFile(beforePath, JSON.stringify(geometry, null, 2));
    } else if (compareBaseline) {
      const before = JSON.parse(await readFile(beforePath, "utf8"));
      for (const selector of selectors) {
        for (const dimension of ["x", "y", "width", "height"]) {
          assert.ok(Math.abs(geometry[selector][dimension] - before[selector][dimension]) < 0.1,
            `${config.name} ${selector} ${dimension}: ${before[selector][dimension]} -> ${geometry[selector][dimension]}`);
        }
      }
    }
    await page.screenshot({ path: `${output}/${config.name}-${captureBefore ? "before" : "after"}.png` });
    if (!captureBefore) {
      const measure = () => page.evaluate(() => {
        const bodyStyle = getComputedStyle(document.body);
        const box = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
        const sidebar = box(".planet-sidebar");
        return {
          header: box(".explorer-shell-header"), rail: box(".explorer-rail"), stage: box(".planet-stage"), sidebar,
          firstItem: box(".explorer-rail-explore"),
          firstIcon: box(".explorer-rail-explore .material-symbol"),
          wordmarkSlot: box(".explorer-shell-wordmark"),
          wordmark: box(".maps-brand-button"),
          versionCount: document.querySelectorAll(".planet-wordmark-version").length,
          railScrollHeight: document.querySelector(".explorer-rail").scrollHeight,
          search: box(".planet-sidebar-search-card"), card: box(".planet-information-panel"),
          inset: parseFloat(bodyStyle.getPropertyValue("--explorer-content-inset")),
          titleInset: box(".planet-title").left - sidebar.left,
          mountedLayers: document.querySelectorAll(".planet-stage > .planet-render-root").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      const check = (result, { inset = 20 } = {}) => {
        const mobile = config.width <= 820 || config.height >= config.width;
        const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.08,
          `${config.name}: ${label}: ${actual} != ${expected}`);
        near(result.header.x, 12, "header left inset");
        near(result.header.y, 8, "header top inset");
        near(result.header.height, 48, "header height");
        near(result.rail.y, result.header.y, "rail and wordmark share one row");
        near(result.rail.height, result.header.height, "rail and header share one height");
        assert.ok(result.rail.bottom < config.height, `${config.name}: rail ends before the viewport bottom`);
        near(result.stage.left, 0, "floating shell leaves the scene full-width");
        near(result.wordmarkSlot.x, 16, "wordmark left inset");
        near(result.wordmarkSlot.y, 8, "wordmark top inset");
        near(result.wordmarkSlot.height, 48, "wordmark row height");
        near(result.rail.right, result.header.right, "controls end at the card edge");
        near(result.firstIcon.bottom, result.wordmark.bottom, "icons share the wordmark visual baseline");
        assert.ok(result.wordmark.right <= result.rail.x, "wordmark stays before the rail");
        assert.equal(result.versionCount, 0);
        near(result.sidebar.x, 12, "sidebar left inset");
        near(result.card.top - result.search.bottom, 8, "search to card gap");
        if (!mobile) {
          near(result.search.y, result.header.bottom + 12, "search follows the header");
          near(result.titleInset, inset, "title inset");
          near(result.sidebar.y, 0, "panel starts at the top");
          assert.ok(result.sidebar.bottom <= config.height - 16,
            `${config.name}: information panel leaves a bottom gap`);
        }
        assert.equal(result.overflow, false, `${config.name}: no page overflow`);
        assert.ok(result.mountedLayers > 0, `${config.name}: scene remains mounted`);
      };
      check(await measure());
      if (config.name === "desktop") {
        const style = await page.locator("body").getAttribute("style");
        try {
          for (const settings of [{ inset: 12 }, { inset: 24 }]) {
            await page.evaluate(({ inset }) => {
              document.body.style.setProperty("--explorer-content-inset", `${inset}px`);
            }, settings);
            check(await measure(), settings);
          }
        } finally {
          await page.evaluate((style) => {
            if (style === null) document.body.removeAttribute("style");
            else document.body.setAttribute("style", style);
          }, style);
        }
      }
    }
    console.log(`${config.name}: ${captureBefore ? "baseline captured" : "layout and alignment passed"}`);
    await page.close();
  }
} finally {
  await browser.close();
}
