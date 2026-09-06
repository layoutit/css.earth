import { gunzipSync } from "node:zlib";
import { PREPARED_EARTH_PLACES } from "../runtime/preparedPlaces.mjs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { prepareLocationPoint } from "../tools/city/prepare-location.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:4228";
const output = new URL(`../../../../output/playwright/city-selection-${Date.now()}/`, import.meta.url);
await mkdir(output, { recursive: true });
const directory = JSON.parse(gunzipSync(await readFile(new URL(`../../../../public${PREPARED_EARTH_PLACES.url}`, import.meta.url))));
const { createDestinationStore } = await import("../../../platform/prepared-destination-store.mjs");
const records = createDestinationStore({ catalog: PREPARED_EARTH_PLACES, fetcher: async url => new Response(await readFile(new URL(`../../../../public${url}`, import.meta.url))) });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
const imagerySettled = page => page.waitForFunction(() => {
  const state = window.__earth.runtime.pages().city;
  return !state.pendingSelection && state.activeLoads === 0 && state.index.activeLoads === 0 &&
    state.desired.length > 0 && state.desired.every(key => state.retained.some(slot => slot.key === key && slot.published));
}, null, { timeout: 60000 });
try {
  for (const [label, viewport, dpr, mobile] of [
    ["desktop-1", { width: 1440, height: 1000 }, 1, false],
    ["desktop-2", { width: 1440, height: 1000 }, 2, false],
    ["mobile-2", { width: 390, height: 844 }, 2, true],
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [], catalogRequests = [], cityUrls = new Set();
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (request.url().endsWith(directory.search.url)) catalogRequests.push(request.url());
      if (request.url().includes("mapproxy/wmts/")) cityUrls.add(request.url());
      assert.ok(!request.url().includes("geonames.org"), "Place sources must not be requested at runtime");
    });
    try {
      await page.goto(`${base}/earth/`);
      await page.waitForFunction(() => window.__earth?.ready, null, { timeout: 60000 });
      assert.equal(catalogRequests.length, 0, "Place catalogue is lazy");
      await page.evaluate(() => { window.__placeSceneNodes = [...document.querySelector(".planet-stage").querySelectorAll("*")]; });
      const search = page.locator(".planet-sidebar-search");
      await search.fill("Buenos Aires");
      await page.getByRole("button", { name: "Buenos Aires, Buenos Aires F.D., Argentina", exact: true }).waitFor();
      await page.screenshot({ path: new URL(`${label}-search.png`, output).pathname });
      await search.press("Enter");
      await page.locator("[data-entity-card]").waitFor();
      await page.waitForFunction(() => document.querySelector('[data-entity-card]').ariaBusy === 'false');
      await imagerySettled(page);
      const buenosAires = (await records.resolve("3435910")).entity;
      const point = prepareLocationPoint(PREPARED_EARTH_SCENE, buenosAires.longitude, buenosAires.latitude);
      const centered = await page.evaluate(point => {
        const style = selector => getComputedStyle(document.querySelector(selector));
        const m = new DOMMatrix(style(".polycss-scene").transform)
          .multiply(new DOMMatrix(style(".earth-system").transform))
          .multiply(new DOMMatrix(style(".earth-body:not(.earth-body-polar)").transform));
        const target = m.transformPoint(new DOMPoint(...point));
        return { pixels: Math.hypot(target.x, target.y) * parseFloat(style(".polycss-camera").scale), z: target.z };
      }, point);
      assert.ok(centered.z > 0 && centered.pixels < 20, JSON.stringify(centered));
      assert.equal(await page.locator(".planet-title-text").innerText(), "Buenos Aires");
      assert.equal(await page.locator(".planet-destination-status").isVisible(), false);
      const city = await page.evaluate(() => window.__earth.runtime.pages().city);
      assert.deepEqual(city.errors, []);
      assert.deepEqual(city.index.errors, []);
      await page.screenshot({ path: new URL(`${label}-buenos-aires.png`, output).pathname });
      await page.locator('[data-entity-parent="earth"]').click();
      assert.equal(await page.locator("[data-entity-card]").getAttribute("data-entity-id"), "earth");
      await page.waitForFunction(() => !window.__earth.camera.stats().dragInertia.destinationFlyTo.active);
      assert.ok(await page.evaluate(() => window.__earth.camera.state().zoom < 3));
      await search.fill("Tokyo");
      await page.getByRole("button", { name: "Tokyo, Tokyo, Japan", exact: true }).waitFor();
      await search.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.locator("[data-entity-card]").waitFor();
      await page.waitForFunction(() => document.querySelector('[data-entity-card]').ariaBusy === 'false');
      assert.equal(await page.locator(".planet-destination-status").isVisible(), false);
      assert.equal(await page.evaluate(() => window.__earth.camera.state().zoom), 1024);
      await imagerySettled(page);
      const tokyo = await page.evaluate(() => window.__earth.runtime.pages().city);
      assert.deepEqual(tokyo.errors, []);
      assert.deepEqual(tokyo.index.errors, []);
      await page.screenshot({ path: new URL(`${label}-tokyo.png`, output).pathname });
      await search.fill("qqqzzzimpossiblecity");
      await page.getByText("No matching places. Try a country or city name.", { exact: true }).waitFor();
      await search.press("Escape");
      assert.equal(await search.inputValue(), "Tokyo");
      assert.equal(await page.locator("[data-entity-card]").isVisible(), true);
      assert.equal(await page.evaluate(() => [...document.querySelector(".planet-stage").querySelectorAll("*")]
        .every((node, i) => node === window.__placeSceneNodes[i])), true);
      assert.equal(await page.locator(".planet-destination-result").count(), 8);
      assert.equal(catalogRequests.length, 1);
      assert.deepEqual(errors, []);
      reports.push({ label, dpr, mobileEmulation: mobile, cameraErrorCssPixels: centered.pixels,
        sceneNodes: await page.evaluate(() => window.__placeSceneNodes.length), catalogRequests: catalogRequests.length,
        destinationPages: { buenosAires: [...city.desired].sort(), tokyo: [...tokyo.desired].sort() },
        cityPages: city.retained.filter(slot => slot.published).length, cityUrls: [...cityUrls].sort(), errors });
      console.log(`PASS ${label}: city search, keyboard selection, camera target, imagery, globe return, no coverage, stable DOM`);
    } catch (error) { console.error(error); throw error; } finally { await context.close(); }
  }
  // Flights sample different intermediate views as frame and network timing
  // vary. Compare the fully published destination assets at identical poses.
  assert.deepEqual(reports[0].destinationPages, reports[1].destinationPages, "DPR selects the same prepared city assets");
  const fault = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const page = await fault.newPage();
    let attempts = 0;
    await fault.route(`**${directory.search.url}`, route => {
      if (++attempts === 1) return route.fulfill({ status: 503, body: "Temporarily unavailable" });
      return route.continue();
    });
    await page.goto(`${base}/earth/`);
    await page.waitForFunction(() => window.__earth?.ready);
    const search = page.locator(".planet-sidebar-search");
    await search.fill("Buenos");
    await page.getByText("Places could not load. Change your search to retry.", { exact: true }).waitFor();
    await search.fill("Buenos Aires");
    await page.getByRole("button", { name: "Buenos Aires, Buenos Aires F.D., Argentina", exact: true }).waitFor();
    assert.equal(attempts, 2);
    // Planet results precede cities and retain their normal navigation action.
    await search.fill("Mars");
    await page.locator('.planet-object-item:not([hidden]) a').first().waitFor();
    await search.press("Enter");
    await page.waitForURL("**/mars/");
    reports.push({ label: "retry-and-object-navigation", catalogAttempts: attempts, passed: true });
    console.log("PASS catalogue failure/retry and planet keyboard navigation");
  } catch (error) { console.error(error); throw error; } finally { await fault.close(); }
} finally {
  await browser.close();
  await writeFile(new URL("report.json", output), JSON.stringify({ browser: "Real Google Chrome", base, reports }, null, 2) + "\n");
}
