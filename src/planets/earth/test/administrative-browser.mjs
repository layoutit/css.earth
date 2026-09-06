import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createPolyCamera } from "@layoutit/polycss";
import { createDestinationStore } from "../../../platform/prepared-destination-store.mjs";
import { PREPARED_EARTH_PLACES } from "../runtime/preparedPlaces.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:4228";
const dpr = Number(process.argv.find(arg => arg.startsWith("--dpr="))?.split("=")[1] ?? 1);
const output = resolve(`output/playwright/administrative-cards-dpr${dpr}-${Date.now()}`);
await mkdir(output, { recursive: true });
const store = createDestinationStore({ catalog: PREPARED_EARTH_PLACES,
  fetcher: async url => new Response(await readFile(resolve(`public${url}`))) });
const report = { base, dpr, output, catalog: PREPARED_EARTH_PLACES, cases: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
  try {
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/earth/`);
    await page.waitForFunction(() => window.__earth?.ready && window.__cssEarth?.ready);
    await page.evaluate(() => { window.__hierarchyNodes = [...document.querySelector("[data-entity-card]").querySelectorAll("*")]; });
    for (const id of ["admin1:3435907", "admin1:3433955", "admin1:1850144", "admin1:5332921", "admin1:2332453", "admin1:11287936", "country:MC"]) {
      const { entity, ancestors } = await store.resolve(id);
      await page.locator(".planet-sidebar-search").fill(`${entity.name} ${entity.kind === "admin1" ? "region" : ""}`.trim());
      await page.locator(`[data-destination-id="${id}"]`).click();
      await page.waitForFunction(id => document.querySelector("[data-entity-card]").dataset.entityId === id &&
        document.querySelector("[data-entity-card]").ariaBusy !== "true" && !window.__earth.camera.stats().dragInertia.destinationFlyTo.active, id);
      await page.waitForFunction(() => {
        const state = window.__earth.runtime.pages().city;
        return !state.pendingSelection && !state.activeLoads && !state.index.activeLoads && state.desired.every(key => state.retained.some(slot => slot.key === key && slot.published));
      }, null, { timeout: 90000 });
      const actual = await page.evaluate(() => {
        const card = document.querySelector("[data-entity-card]"), nodes = [...card.querySelectorAll("*")];
        return { id: card.dataset.entityId, kind: card.dataset.entityKind, title: card.querySelector(".planet-title").ariaLabel,
          parents: [...card.querySelectorAll("[data-entity-parent]")].filter(node => !node.parentElement.hidden).map(node => ({ id: node.dataset.entityParent, name: node.textContent })),
          facts: [...card.querySelectorAll(".planet-primary-facts > li, .planet-additional-facts > li")].filter(row => !row.hidden)
            .map(row => ({ label: row.querySelector(".planet-fact-label").textContent, value: row.querySelector(".planet-fact-value").textContent })),
          sourceRecord: window.__earth.runtime.destination().sourceRecord,
          navigation: window.__earth.runtime.destination().navigation,
          camera: window.__earth.camera.state(), stable: window.__earth.assertStableDomIdentity() && nodes.length === window.__hierarchyNodes.length && nodes.every((node, index) => node === window.__hierarchyNodes[index]) };
      });
      const image = resolve(output, `${id.replace(":", "-")}.png`);
      await page.screenshot({ path: image });
      const result = { ...actual, expectedCamera: entity.camera, image, passed: false };
      report.cases.push(result);
      assert.equal(actual.id, entity.id); assert.equal(actual.kind, entity.kind); assert.equal(actual.title, entity.name);
      assert.deepEqual(actual.parents, [{ id: "earth", name: "Earth" }, ...ancestors.toReversed().map(({ id, name }) => ({ id, name }))]);
      assert.deepEqual(actual.facts, entity.facts.map(({ label, value }) => ({ label, value })));
      assert.deepEqual(actual.sourceRecord, entity.sourceRecord); assert.deepEqual(actual.navigation, entity.navigation);
      // The accepted camera update publishes angles at two decimals and zoom
      // at four. Check its exact published endpoint, retaining raw source values.
      const expected = createPolyCamera();
      expected.update({ rotX: entity.camera.controlPitch, rotY: entity.camera.controlYaw, zoom: entity.camera.zoom });
      result.expectedPublishedCamera = { controlPitch: expected.state.rotX, controlYaw: expected.state.rotY, zoom: expected.state.zoom };
      for (const [key, value] of Object.entries(result.expectedPublishedCamera)) assert.equal(actual.camera[key], value, `${id} camera ${key}`);
      assert.ok(actual.stable); assert.deepEqual(errors, []);
      result.passed = true;
      console.log(`PASS ${id}: ${entity.name}; ${entity.navigation.kind}; sourced card and parent`);
    }
  } finally { await context.close(); }
} finally {
  await browser.close(); store.dispose();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(output);
}
