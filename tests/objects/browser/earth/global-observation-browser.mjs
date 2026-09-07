import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:4228";
const dpr = Number(process.argv.find(arg => arg.startsWith("--dpr="))?.slice(6) ?? 1);
const output = new URL(`../../../../output/playwright/global-observation-dpr${dpr}-${Date.now()}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr,
  recordVideo: { dir: output.pathname, size: { width: 1440, height: 1000 } } });
const page = await context.newPage(), report = { base, dpr, browser: browser.version(), requests: [], errors: [], checkpoints: [] };
page.on("request", request => report.requests.push(request.url()));
page.on("pageerror", error => report.errors.push(error.message));
page.on("console", message => { if (message.type() === "error") (report.consoleErrors ??= []).push(message.text()); });
const status = () => page.evaluate(() => ({ lens: window.__earth.runtime.geographicLens(), pages: window.__earth.runtime.pages(),
  surface: window.__earth.runtime.geographicSurface(),
  entity: document.querySelector("[data-entity-card]").dataset.entityId }));
const settle = () => page.waitForFunction(() => {
  const state = window.__earth?.runtime.geographicLens(), pages = window.__earth?.runtime.pages().geographic;
  return ["idle", "ready", "no-coverage"].includes(state?.status) && !pages.pendingSelection && !pages.activeLoads && !pages.index.activeLoads &&
    !window.__earth.camera.stats().dragInertia.destinationFlyTo.active;
}, null, { timeout: 120000 });
const capture = async name => {
  const path = new URL(`${name}.png`, output).pathname;
  await page.screenshot({ path });
  const current = await status();
  assert.equal(await page.evaluate(() => window.__globalObservationNodes.length === document.querySelector(".planet-stage").querySelectorAll("*").length &&
    window.__globalObservationNodes.every(node => node.isConnected)), true);
  assert.ok(current.pages.geographic.poolSize === 32);
  assert.ok(current.pages.geographic.retained.length <= 32);
  assert.ok(current.pages.geographic.activeLoads <= 3);
  report.checkpoints.push({ name, path, ...current });
};
try {
  await page.goto(`${base}/earth/`); await page.waitForFunction(() => window.__earth?.ready);
  await page.evaluate(() => { window.__globalObservationNodes = [...document.querySelector(".planet-stage").querySelectorAll("*")]; });
  assert.equal(report.requests.some(url => url.includes("/scenes/earth/geographic-lens-") || url.includes("esa-worldcover-map-10m")), false);
  assert.equal(await page.locator('button[name="lens"][value="buenos-aires-noise"]').isVisible(), false);
  await page.locator('button[name="lens"][value="worldcover-land-cover"]').click();
  await settle(); await capture("01-earth-land-cover");
  for (const [query, id, name] of [["Argentina", "country:AR", "02-country"], ["Buenos Aires", "admin1:3435907", "03-region"], ["Buenos Aires", "3435910", "04-city"]]) {
    await page.locator(".planet-sidebar-search").fill(query);
    await page.locator(`[data-destination-id="${id}"]`).click();
    await page.waitForFunction(id => document.querySelector("[data-entity-card]").dataset.entityId === id, id);
    await settle();
    assert.equal((await status()).lens.id, null);
    assert.equal(await page.locator('button[name="lens"][value="worldcover-land-cover"]').isVisible(), false);
    await capture(name);
  }
  assert.equal(report.requests.filter(url => url.includes("geographic-lens-worldcover-land-cover-")).length, 1);
  await page.locator('button[name="lens"][value="buenos-aires-noise"]').click();
  await settle(); await capture("05-city-noise");
  assert.equal((await status()).lens.id, "buenos-aires-noise");
  await page.locator(".planet-sidebar-search").fill("Argentina");
  await page.locator('[data-destination-id="country:AR"]').click();
  await page.waitForFunction(() => document.querySelector("[data-entity-card]").dataset.entityId === "country:AR" && window.__earth.runtime.geographicLens().id === null);
  assert.equal(await page.locator('button[name="lens"][value="buenos-aires-noise"]').isVisible(), false);
  assert.equal((await status()).surface.retainedImages, 0);
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.error = error.stack;
  report.failedState = await status().catch(() => null);
  await page.screenshot({ path: new URL("failure.png", output).pathname }).catch(() => {});
  throw error;
} finally {
  await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2));
  await context.close(); await browser.close();
  console.log(JSON.stringify({ output: output.pathname, passed: report.passed ?? false }));
}
