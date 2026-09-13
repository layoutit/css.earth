import assert from "node:assert/strict";
import { chromium } from "playwright";
import { OBJECTS } from "../objects.mts";
import { browserObjects } from './browser-objects.mts';

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${baseUrl}/earth/`);
    for (const object of browserObjects()) {
      await page.waitForFunction(() => window.__cssEarth?.ready);
      for (const entry of OBJECTS) {
        // The navbar lists a body in every group it belongs to; each copy shows the same distance.
        const label = await page.locator(`.planet-object-link[data-object-id="${entry.id}"] .planet-object-distance`).first().innerText();
        assert.equal(label.replace(/\s+/gu, " ").trim(), `${Number(entry.distanceAu.toFixed(3))} AU`);
      }
      assert.deepEqual(new Set(await page.locator(".planet-object-link").evaluateAll((links) => links.map((link) => link.dataset.objectId).filter((id) => id !== undefined))), new Set(OBJECTS.map(({ id }) => id)));
      const search = page.locator(".planet-sidebar-search");
      await search.fill(object.name);
      await page.locator(`.planet-object-link[data-object-id="${object.id}"]`).first().click();
      await page.waitForFunction((id) => window.__cssEarth?.ready && window.__cssEarth?.activeObjectId === id, object.id);
      assert.equal(new URL(page.url()).pathname, object.route);
      assert.equal(await page.locator(".planet-stage").count(), 1);
      assert.equal(await page.locator(".polycss-camera").count(), 1);
      reports.push({ width, id: object.id, mountedScenes: 1 });
    }
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ ok: true, reports }));
