import assert from "node:assert/strict";
import { chromium } from "playwright";
import { OBJECTS } from "../objects.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${baseUrl}/earth/`);
    for (const object of OBJECTS) {
      await page.waitForFunction(() => window.__cssEarth?.ready);
      assert.deepEqual(new Set(await page.locator(".planet-object-link").evaluateAll((links) => links.map((link) => link.dataset.objectId))), new Set(OBJECTS.map(({ id }) => id)));
      const search = page.locator(".planet-sidebar-search");
      await search.fill(object.name);
      await page.locator(`.planet-object-link[data-object-id="${object.id}"]`).click();
      await page.waitForFunction((id) => window.__cssEarth?.ready && window.__cssEarth?.activeObjectId === id, object.id);
      assert.equal(new URL(page.url()).pathname, object.route);
      assert.equal(await page.locator(".planet-stage").count(), 1);
      assert.equal(await page.locator(".polycss-camera").count(), 1);
      const scaleIds = await page.locator(".scale-planet").evaluateAll((items) => items.map((item) => item.dataset.planetId));
      assert.deepEqual(scaleIds, OBJECTS.filter(({ classification }) => classification === "planet").map(({ id }) => id));
      reports.push({ width, id: object.id, mountedScenes: 1 });
    }
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ ok: true, reports }));
