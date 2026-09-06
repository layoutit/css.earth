import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { prepareLocationCamera, prepareLocationPoint } from "../tools/city/prepare-location.mjs";

const { preparePlaceCatalog } = await import("../tools/prepare-places.mjs");
const placesById = new Map((await preparePlaceCatalog()).places.map(place => [place.id, place]));
const base = process.argv[2] ?? "http://127.0.0.1:4228";
const dpr = Number(process.argv.find(arg => arg.startsWith("--dpr="))?.slice(6) ?? 1);
const output = new URL(`../../../../output/playwright/geographic-paging-dpr${dpr}-${Date.now()}/`, import.meta.url);
await mkdir(output, { recursive: true });
// These are preparation-side geographic viewpoints, not runtime geocoding or
// catalogue entries. Mouse pan and wheel gestures exercise the ordinary input.
const viewpoints = [
  ["pampas-countryside", -60.4, -35.1, 128],
  ["dateline-east", 179.95, -16.5, 128],
  ["dateline-west", -179.95, -16.5, 128],
  ["arctic", 20, 80, 32],
  ["antarctic-source-gap", 0, -80, 32],
].map(([name, longitude, latitude, zoom]) => ({ name, longitude, latitude,
  camera: prepareLocationCamera(PREPARED_EARTH_SCENE, prepareLocationPoint(PREPARED_EARTH_SCENE, longitude, latitude), zoom) }));
const report = { base, dpr, viewpoints, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingTree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  checkpoints: [], errors: [], requests: [], failedRequests: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr,
  recordVideo: { dir: output.pathname, size: { width: 1440, height: 1000 } } });
const page = await context.newPage();
page.on("pageerror", error => report.errors.push(error.message));
page.on("request", request => report.requests.push(request.url()));
page.on("requestfailed", request => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
const inspect = () => page.evaluate(() => {
  const api = window.__earth, lens = api.runtime.geographicLens();
  return { lens: { id: lens.id, status: lens.status, resolution: lens.resolution, error: lens.error },
    entity: document.querySelector("[data-entity-card]").dataset.entityId,
    geographic: api.runtime.pages().geographic, basePages: api.runtime.pages().city, surface: api.runtime.geographicSurface(), camera: api.camera.state(),
    stable: api.assertStableDomIdentity() && window.__pagingNodes.every(node => node.isConnected) &&
      window.__pagingNodes.length === document.querySelector(".planet-stage").querySelectorAll("*").length };
});
const settle = async () => {
  await page.waitForFunction(() => {
    const api = window.__earth, p = api?.runtime.pages().geographic;
    return p && ["idle", "ready", "no-coverage", "error"].includes(api.runtime.geographicLens().status) &&
      !p.pendingSelection && !p.activeLoads && !p.index.activeLoads && !api.camera.stats().dragInertia.destinationFlyTo.active;
  }, null, { timeout: 120000 });
  const state = await inspect();
  assert.notEqual(state.lens.status, "error", state.lens.error);
  assert.deepEqual(state.geographic.errors, []);
  assert.deepEqual(state.geographic.index.errors, []);
  assert.deepEqual(state.geographic.retained.map(s => s.key).sort(), [...state.geographic.desired].sort(), "Only the complete current cut remains after replacement");
  assert.ok(state.geographic.retained.every(slot => slot.ready && slot.published));
  assert.equal(state.basePages.suspended, state.surface.published);
  if (state.surface.published) assert.equal(state.basePages.retained.length, 0, "Base detail must not cover the observation overview");
  return state;
};
const capture = async name => {
  const state = await settle(), path = new URL(`${String(report.checkpoints.length + 1).padStart(2, "0")}-${name}.png`, output).pathname;
  assert.ok(state.stable); await page.screenshot({ path });
  report.checkpoints.push({ name, path, ...state });
  console.log(JSON.stringify({ checkpoint: name, status: state.lens.status, detailPages: state.geographic.desired.length }));
};
const select = async (query, id) => {
  await page.locator(".planet-sidebar-search").fill(query);
  await page.locator(`[data-destination-id="${id}"]`).click();
  await page.waitForFunction(id => document.querySelector("[data-entity-card]").dataset.entityId === id, id);
};
try {
  await page.goto(`${base}/earth/`); await page.waitForFunction(() => window.__earth?.ready);
  await page.evaluate(() => {
    window.__pagingNodes = [...document.querySelector(".planet-stage").querySelectorAll("*")];
    const samples = [], distinct = new Set(), violations = [];
    window.__pagingProbe = { samples, distinct, violations, running: true };
    const tick = () => {
      if (!window.__pagingProbe.running) return;
      const layers = window.__earth.runtime.pages(), p = layers.geographic, s = window.__earth.runtime.geographicSurface(), i = p.index;
      for (const slot of p.retained) if (slot.published) distinct.add(`${p.dataset}/${slot.key}`);
      const sample = { time: performance.now(), slots: p.retained.length, loads: p.activeLoads + s.activeLoads,
        decoded: p.reservedDecodedBytes + s.reservedDecodedBytes, directories: i.residentDirectories,
        metadataEncoded: i.reservedEncodedBytes, metadataDecoded: i.reservedDecodedBytes,
        rootEncoded: i.rootEncodedBytes, rootDecoded: i.rootDecodedBytes, indexLoads: i.activeLoads,
        aborts: p.aborts, indexAborts: i.aborts, desired: p.desired.length,
        published: p.retained.filter(slot => slot.published).length,
        occludingBasePages: s.published ? layers.city.retained.filter(slot => slot.published).length : 0 };
      samples.push(sample);
      if (sample.slots > 32 || sample.loads > 3 || sample.decoded > 128 * 1024 ** 2 ||
          sample.directories > 32 || sample.metadataDecoded > 8 * 1024 ** 2 || sample.rootDecoded > 2 * 1024 ** 2 || sample.indexLoads > 3 || sample.occludingBasePages) violations.push(sample);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.locator('button[name="lens"][value="worldcover-land-cover"]').click();
  await capture("earth-overview");
  for (const [query, id, label] of [["Buenos Aires", "3435910", "buenos-aires"], ["Tokyo", "1850147", "tokyo"], ["Lagos", "2332459", "lagos"]]) {
    await page.evaluate(camera => window.__earth.camera.setState(camera), placesById.get(id).camera); await capture(label);
    for (const [n, dx, dy] of [[1, 280, 40], [2, -380, -100]]) {
      await page.mouse.move(1000, 550); await page.mouse.down();
      await page.mouse.move(1000 + dx, 550 + dy, { steps: 24 });
      // Stop the pointer before release so this checkpoint measures paging,
      // without waiting for a long free-running inertia tail.
      await page.waitForTimeout(120); await page.mouse.up();
      await capture(`${label}-pan-${n}`);
    }
    await page.mouse.wheel(0, -200);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await capture(`${label}-zoom`);
  }
  assert.equal((await inspect()).entity, "earth"); await capture("earth-owner-retained");
  for (const viewpoint of viewpoints) {
    await page.evaluate(camera => window.__earth.camera.setState(camera), viewpoint.camera);
    await capture(viewpoint.name);
  }
  // Three rapidly replaced views force outstanding directory/image work to
  // cancel; the last view must converge without pixels from abandoned work.
  for (const viewpoint of viewpoints.slice(0, 3)) {
    await page.evaluate(camera => window.__earth.camera.setState(camera), viewpoint.camera);
    await page.waitForTimeout(80);
  }
  await capture("rapid-replacement-final");
  await select("Buenos Aires", "3435910"); await capture("noise-before-switch");
  await page.locator('button[name="lens"][value="buenos-aires-noise"]').click(); await capture("noise");
  assert.equal((await inspect()).surface.retainedImages, 0);
  await page.locator('[data-entity-parent="earth"]').click(); await settle();
  await page.evaluate(camera => window.__earth.camera.setState(camera), placesById.get("3435910").camera);
  await page.locator('button[name="lens"][value="worldcover-land-cover"]').click(); await capture("land-cover-restored");
  report.probe = await page.evaluate(() => {
    const probe = window.__pagingProbe; probe.running = false;
    const runtime = window.__earth.runtime, nodes = window.__pagingNodes;
    // The body link performs a document navigation. Read the old lifetime
    // after its registered pagehide cleanup, before that document is gone.
    window.addEventListener("pagehide", event => {
      sessionStorage.setItem("geographic-paging-teardown", JSON.stringify({ persisted: event.persisted,
        pages: runtime.pages().geographic, surface: runtime.geographicSurface(),
        oldSceneConnected: nodes.some(node => node.isConnected) }));
    }, { once: true });
    return { samples: probe.samples, distinct: [...probe.distinct], violations: probe.violations };
  });
  assert.ok(report.probe.distinct.length > 16);
  assert.deepEqual(report.probe.violations, []);
  assert.ok(report.probe.samples.some(sample => sample.aborts > 0 || sample.indexAborts > 0));
  await page.locator(".planet-sidebar-search").fill("Mars");
  await page.locator('.planet-object-browser a[href="/mars/"]').click(); await page.waitForFunction(() => window.__mars?.ready);
  report.teardown = await page.evaluate(() => JSON.parse(sessionStorage.getItem("geographic-paging-teardown")));
  assert.ok(report.teardown, "The actual body navigation must record old-page cleanup");
  assert.equal(report.teardown.oldSceneConnected, false);
  assert.equal(report.teardown.pages.retained.length, 0);
  assert.equal(report.teardown.pages.apiImages.residentImages, 0);
  assert.equal(report.teardown.pages.index.residentDirectories, 0);
  assert.equal(report.teardown.surface.retainedImages, 0);
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.error = error.stack; report.failedState = await inspect().catch(() => null);
  await page.screenshot({ path: new URL("failure.png", output).pathname }).catch(() => {});
  throw error;
} finally {
  await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2));
  await context.close(); await browser.close();
  console.log(JSON.stringify({ output: output.pathname, passed: report.passed ?? false }));
}
