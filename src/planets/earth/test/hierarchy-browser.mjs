import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createDestinationStore } from "../../../platform/prepared-destination-store.mjs";
import { PREPARED_EARTH_PLACES } from "../runtime/preparedPlaces.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:4228";
const selectedCase = process.argv.find(arg => arg.startsWith("--case="))?.slice(7);
const historyOnly = process.argv.includes("--history-only");
const output = resolve(`output/playwright/entity-hierarchy-${Date.now()}`);
await mkdir(output, { recursive: true });
const store = createDestinationStore({ catalog: PREPARED_EARTH_PLACES,
  fetcher: async url => new Response(await readFile(resolve(`public${url}`))) });
const report = { base, output, catalog: PREPARED_EARTH_PLACES,
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingTree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), cases: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  for (const [label, viewport, dpr, mobile] of [
    ["desktop-1", { width: 1440, height: 1000 }, 1, false],
    ["desktop-2", { width: 1440, height: 1000 }, 2, false],
    ["mobile-2", { width: 390, height: 844 }, 2, true],
    ["reduced-motion", { width: 1440, height: 1000 }, 1, false],
  ].filter(([label]) => !selectedCase || selectedCase === label)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile,
      recordVideo: { dir: output, size: viewport } });
    const page = await context.newPage(), errors = [];
    const record = { label, dpr, mobileEmulation: mobile, visits: [], images: [], errors };
    report.cases.push(record);
    page.on("pageerror", error => errors.push(error.message));
    const card = page.locator("[data-entity-card]"), input = page.locator(".planet-sidebar-search");
    const settle = id => page.waitForFunction(id => {
      const card = document.querySelector("[data-entity-card]");
      return card.dataset.entityId === id && card.ariaBusy !== "true" && !window.__earth.camera.stats().dragInertia.destinationFlyTo.active;
    }, id);
    const pages = () => page.waitForFunction(() => {
      const state = window.__earth.runtime.pages().city;
      return !state.pendingSelection && !state.activeLoads && !state.index.activeLoads &&
        state.desired.every(key => state.retained.some(slot => slot.key === key && slot.published));
    }, null, { timeout: 120000 });
    const capture = async name => {
      const path = resolve(output, `${label}-${name}.png`);
      await page.screenshot({ path }); record.images.push({ name, path });
    };
    const rememberNodes = () => page.evaluate(() => {
      window.__hierarchyScene = document.querySelector(".planet-stage");
      window.__hierarchyCard = [...document.querySelector("[data-entity-card]").querySelectorAll("*")];
    });
    const view = () => page.evaluate(() => {
      const { zoom, pose } = window.__earth.camera.state(); return { zoom, scene: pose.scene };
    });
    const sameView = async expected => {
      const actual = await view(); assert.equal(actual.zoom, expected.zoom);
      const numbers = matrix => matrix.slice(9, -1).split(",").map(Number);
      numbers(actual.scene).forEach((value, i) => assert.ok(Math.abs(value - numbers(expected.scene)[i]) < 1e-6, "History restores the saved orientation"));
    };
    const inspect = async (id, { introduction = true } = {}) => {
      await settle(id);
      if (introduction && id !== "earth") await page.waitForFunction(() => document.querySelector("[data-entity-card]").dataset.introductionState !== "loading", null, { timeout: 20000 });
      const actual = await page.evaluate(() => {
        const card = document.querySelector("[data-entity-card]"), nodes = [...card.querySelectorAll("*")];
        const parents = [...card.querySelectorAll("[data-entity-parent]")].filter(button => !button.parentElement.hidden);
        return { id: card.dataset.entityId, title: card.querySelector(".planet-title").ariaLabel,
          parents: parents.map(button => button.dataset.entityParent),
          parentBounds: parents.map(button => ({ id: button.dataset.entityParent, x: button.getBoundingClientRect().x, width: button.getBoundingClientRect().width })),
          introductionState: card.dataset.introductionState, source: JSON.parse(card.dataset.introductionSource ?? "null"),
          lens: window.__earth.lens().id, lensIds: [...card.querySelectorAll('[data-lens-option]:not([hidden]) button[name="lens"]')].map(button => button.value),
          stable: window.__hierarchyScene === document.querySelector(".planet-stage") && window.__earth.assertStableDomIdentity() &&
            nodes.length === window.__hierarchyCard.length && nodes.every((node, i) => node === window.__hierarchyCard[i]),
          cardCount: document.querySelectorAll("[data-entity-card]").length, stats: window.__earth.runtime.destinationStats() };
      });
      record.visits.push(actual);
      assert.equal(actual.id, id); assert.ok(actual.stable); assert.equal(actual.cardCount, 1);
      if (id !== "earth") {
        const { entity, ancestors } = await store.resolve(id);
        assert.equal(actual.title, entity.name);
        assert.deepEqual(actual.parents, ["earth", ...ancestors.toReversed().map(parent => parent.id)]);
        assert.deepEqual(actual.lensIds, entity.lensIds);
        for (const bounds of actual.parentBounds) assert.ok(bounds.width > 12, `Parent ${bounds.id} remains clickable`);
        if (actual.source) assert.equal(actual.source.geonames, entity.identifiers.geonames);
      }
      assert.deepEqual(errors, []);
      return actual;
    };
    const select = async (query, id) => {
      await input.fill(query);
      await page.locator(`[data-destination-id="${id}"]`).click();
      return inspect(id);
    };
    try {
      await page.goto(`${base}/earth/`); await page.waitForFunction(() => window.__earth?.ready && window.__cssEarth?.ready);
      await rememberNodes();
      if (label === "reduced-motion" || historyOnly) {
        if (label === "reduced-motion") await page.emulateMedia({ reducedMotion: "reduce" });
        await select("Argentina", "country:AR"); const countryView = await view();
        await select("Buenos Aires", "3435910"); const cityView = await view();
        await page.goBack(); await inspect("country:AR"); await sameView(countryView);
        await page.goForward(); await inspect("3435910"); await sameView(cityView);
        await page.locator('[data-entity-parent="country:AR"]').click(); await inspect("country:AR");
        const returnedCountry = await view();
        await page.locator('[data-entity-parent="earth"]').click(); await inspect("earth");
        await page.goBack(); await inspect("country:AR"); await sameView(returnedCountry);
        await capture("navigation-history"); record.passed = true;
        console.log(`PASS ${label}: immediate country/city and root-return history`);
        continue;
      }
      await input.fill("Buenos Aires");
      for (const id of ["3435910", "admin1:3433955", "admin1:3435907"]) await page.locator(`[data-destination-id="${id}"]`).waitFor({ state: "visible" });
      record.duplicates = await page.locator('.planet-destination-list li:not([hidden]) button').evaluateAll(buttons => buttons.map(button => ({ id: button.dataset.destinationId, label: button.ariaLabel })));
      assert.equal(new Set(record.duplicates.map(row => row.label)).size, record.duplicates.length);
      await capture("01-distinct-buenos-aires-results");
      for (const [country, admin, city, query] of [
        ["country:AR", "admin1:3433955", "3435910", "Buenos Aires"],
        ["country:JP", "admin1:1850144", "1850147", "Tokyo"],
        ["country:NG", "admin1:2332453", "2332459", "Lagos"],
      ]) {
        const countryEntity = (await store.resolve(country)).entity;
        await select(countryEntity.name, country); await pages();
        await capture(`${country.replace(":", "-")}-country`);
        await select(query, admin); await pages();
        await capture(`${admin.replace(":", "-")}-region`);
        await select(query, city); await pages();
        await capture(`${city}-city`);
        if (city === "3435910") {
          await page.locator('button[name="lens"][value="buenos-aires-noise"]').click();
          await page.waitForFunction(() => window.__earth.runtime.geographicLens().status === "ready");
          await capture("3435910-noise");
        }
        const saved = await view();
        await page.locator(`[data-entity-parent="${admin}"]`).click(); await inspect(admin);
        assert.equal(await page.evaluate(() => window.__earth.lens().id), "normal");
        const parentView = await view();
        await page.goBack(); await inspect(city); await sameView(saved);
        await page.goForward(); await inspect(admin); await sameView(parentView);
        await page.locator(`[data-entity-parent="${country}"]`).click(); await inspect(country);
        await page.locator('[data-entity-parent="earth"]').click(); await inspect("earth");
      }
      // A fresh source identity proves an introduction failure leaves factual
      // navigation usable and does not reuse the previous entity's excerpt.
      await context.route(/https:\/\/[^/]*(wikidata|wikipedia)\.org\//u, route => route.fulfill({ status: 503, body: "Test introduction outage" }));
      const unavailable = await select("Santiago", "3871336");
      assert.equal(unavailable.introductionState, "unavailable"); assert.equal(unavailable.source, null);
      assert.equal(await page.locator(".planet-introduction").isVisible(), false);
      await capture("introduction-outage");
      const parents = unavailable.parents.filter(id => id !== "earth").toReversed();
      for (const id of parents) await page.locator(`[data-entity-parent="${id}"]`).click();
      await page.locator('[data-entity-parent="earth"]').click(); await inspect("earth");
      assert.equal(await page.locator(".planet-title").getAttribute("aria-label"), "Earth");
      record.rapidParents = parents;
      await context.unroute(/https:\/\/[^/]*(wikidata|wikipedia)\.org\//u);
      // The accepted pre-hierarchy fragment still restores the city and lens.
      await page.goto(`${base}/earth/#place=3435910&lens=buenos-aires-noise`);
      await page.waitForFunction(() => window.__earth?.ready); await settle("3435910"); await rememberNodes();
      await page.waitForFunction(() => window.__earth.runtime.geographicLens().status === "ready");
      await pages(); await inspect("3435910");
      assert.equal(await page.evaluate(() => window.__earth.lens().id), "buenos-aires-noise");
      const legacy = await view();
      await page.reload(); await page.waitForFunction(() => window.__earth?.ready); await settle("3435910"); await rememberNodes();
      await page.waitForFunction(() => window.__earth.runtime.geographicLens().status === "ready");
      await sameView(legacy); await inspect("3435910"); await pages();
      await capture("legacy-link-after-refresh");
      record.passed = true;
      console.log(`PASS ${label}: three country/ADM1/city paths, history, outage, rapid parents and legacy link`);
    } catch (error) {
      record.error = error.stack;
      try { await capture("failure"); record.failurePages = await page.evaluate(() => window.__earth?.runtime.pages()); } catch {}
      throw error;
    } finally { await context.close(); record.video = await page.video().path(); }
  }
  report.passed = report.cases.length > 0 && report.cases.every(record => record.passed);
} finally {
  await browser.close(); store.dispose();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, passed: report.passed ?? false }));
}
