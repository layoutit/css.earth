import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { PREPARED_EARTH_PLACES } from "../runtime/preparedPlaces.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:4228";
const output = resolve(`output/playwright/entity-search-${Date.now()}`);
await mkdir(output, { recursive: true });
const directory = JSON.parse(gunzipSync(await readFile(`public${PREPARED_EARTH_PLACES.url}`)));
const strata = [
  directory.entries.filter(([id]) => /^\d+$/u.test(id)),
  directory.entries.filter(([id]) => id.startsWith("admin1:")),
  directory.entries.filter(([id]) => id.startsWith("country:")),
];
assert.ok(strata.every(rows => rows.length >= 50));
const ids = Array.from({ length: 50 }, (_, i) => {
  const rows = strata[i % strata.length];
  return rows[Math.floor(i * rows.length / 50)][0];
});
const report = { base, output, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingTree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), runs: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const browserCdp = await browser.newBrowserCDPSession();
async function workerHeap() {
  const { targetInfos } = await browserCdp.send("Target.getTargets");
  const target = targetInfos.find(target => target.type === "worker" && target.url.includes("prepared-destination-worker"));
  assert.ok(target, "The mounted entity worker exists");
  const { sessionId } = await browserCdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: false });
  let serial = 0;
  async function send(method) {
    const id = ++serial;
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { browserCdp.off("Target.receivedMessageFromTarget", listener); reject(new Error("Worker heap read timed out")); }, 10000);
      function listener(event) {
        const message = JSON.parse(event.message);
        if (event.sessionId !== sessionId || message.id !== id) return;
        clearTimeout(timer); browserCdp.off("Target.receivedMessageFromTarget", listener);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      }
      browserCdp.on("Target.receivedMessageFromTarget", listener);
    });
    await browserCdp.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method }) });
    return response;
  }
  try { await send("HeapProfiler.collectGarbage"); return await send("Runtime.getHeapUsage"); }
  finally { await browserCdp.send("Target.detachFromTarget", { sessionId }); }
}
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr,
      ...(dpr === 1 ? { recordVideo: { dir: output, size: { width: 1440, height: 1000 } } } : {}) });
    const page = await context.newPage(), requests = [], errors = [];
    const record = { dpr, requests, errors, visits: [] }; report.runs.push(record);
    context.on("request", request => { if (/destinations-|earth-places/u.test(request.url())) requests.push(request.url()); });
    page.on("pageerror", error => errors.push(error.message));
    // This journey tests navigation during introduction outages. The separate
    // entity-card journey verifies the real sourced introductions and artwork.
    await context.route(/https:\/\/[^/]*(wikidata|wikipedia)\.org\//u, route => route.fulfill({ status: 503, body: "Test source outage" }));
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { entered = resolve; });
    let holds = 0;
    await context.route(`**${directory.search.url}`, async route => {
      if (++holds === 1) { entered(); await gate; }
      try { await route.continue(); } catch { /* canceled query */ }
    });
    try {
      await page.goto(`${base}/earth/`);
      await page.waitForFunction(() => window.__cssEarth?.ready && window.__earth?.ready);
      assert.equal(requests.length, 0, "Entity data is lazy");
      await page.evaluate(() => {
        window.__searchNodes = [...document.querySelectorAll(".planet-destination-list button")];
        window.__searchLongTasks = []; window.__searchFrames = [];
        window.__searchPaints = [];
        let query;
        document.addEventListener("input", event => {
          if (event.target.matches?.(".planet-sidebar-search")) query = { query: event.target.value, inputAt: performance.now() };
        }, true);
        const results = document.querySelector(".planet-destination-results");
        new MutationObserver(() => {
          const current = query;
          if (!current?.query || current.scheduled || results.hidden || ![...results.querySelectorAll("li")].some(row => !row.hidden)) return;
          current.scheduled = true;
          requestAnimationFrame(frameAt => {
            if (query === current && !results.hidden) window.__searchPaints.push({ ...current, frameAt, inputToReadyFrameMs: Math.max(0, frameAt - current.inputAt) });
          });
        }).observe(results, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
        new PerformanceObserver(list => window.__searchLongTasks.push(...list.getEntries().map(e => ({ at: e.startTime, duration: e.duration })))).observe({ type: "longtask" });
        let previous;
        const frame = now => { if (previous) window.__searchFrames.push(now - previous); previous = now; requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      });
      const input = page.locator(".planet-sidebar-search");
      const pose = await page.evaluate(() => window.__earth.camera.state().pose);
      await input.fill("Buenos");
      await Promise.race([requested, new Promise((_, reject) => setTimeout(() => reject(new Error("Search request was not held")), 20000))]);
      await input.fill("Tokyo");
      await page.mouse.move(950, 460); await page.mouse.down(); await page.mouse.move(1080, 500, { steps: 16 }); await page.mouse.up();
      release();
      await page.locator('[data-destination-id="1850147"]').waitFor({ state: "visible" });
      assert.notDeepEqual(await page.evaluate(() => window.__earth.camera.state().pose), pose, "Dragging works during cold index transport");
      assert.equal(await input.inputValue(), "Tokyo");
      assert.equal(await page.locator('.planet-destination-list li:not([hidden]) button').first().getAttribute("data-destination-id"), "1850147");
      record.cold = await page.evaluate(() => ({ longTasks: window.__searchLongTasks, frames: window.__searchFrames, stats: window.__earth.runtime.destinationStats() }));
      await page.screenshot({ path: resolve(output, `dpr${dpr}-cold-search.png`) });
      record.searches = [];
      for (let repetition = 1; repetition <= 3; repetition++) for (const [query, id] of [
        ["Paris Texas", "4717560"], ["São Paulo", "3448439"], ["東京", "1850147"], ["Buenos Aires Argentina", "3435910"],
        ["Tokyo region", "admin1:1850144"], ["Lagos region", "admin1:2332453"], ["Buenos Aires region", "admin1:3435907"], ["Monaco", "country:MC"],
      ]) {
        const inputAfter = await page.evaluate(() => performance.now()), start = performance.now();
        await input.fill(query); await page.locator(`[data-destination-id="${id}"]`).waitFor({ state: "visible" });
        await page.waitForFunction(({ query, inputAfter }) => window.__searchPaints.some(p => p.query === query && p.inputAt >= inputAfter), { query, inputAfter });
        const paint = await page.evaluate(({ query, inputAfter }) => window.__searchPaints.find(p => p.query === query && p.inputAt >= inputAfter), { query, inputAfter });
        record.searches.push({ query, repetition, milliseconds: performance.now() - start, ...paint });
      }
      const paints = record.searches.map(row => row.inputToReadyFrameMs).sort((a, b) => a - b);
      record.searchP95 = paints[Math.ceil(paints.length * .95) - 1];
      assert.ok(record.searchP95 <= 100, `Warm search input-to-ready-result RAF p95 ${record.searchP95} ms exceeds 100 ms`);
      // Use actual same-document history restoration with the preserved view
      // token. This qualifies record/cache lifetime without 50 camera flights.
      await page.waitForFunction(() => new URL(location.href).searchParams.has("v"));
      for (const [index, id] of ids.entries()) {
        await page.evaluate(id => {
          const url = new URL(location.href); url.hash = `place=${encodeURIComponent(id)}`;
          history.pushState(history.state, "", url); dispatchEvent(new PopStateEvent("popstate"));
        }, id);
        await page.waitForFunction(id => document.querySelector('[data-entity-card]').dataset.entityId === id && document.querySelector('[data-entity-card]').ariaBusy === "false", id);
        const stats = await page.evaluate(() => window.__earth.runtime.destinationStats());
        assert.ok(stats.store.detailPacks <= 16); assert.ok(stats.store.detailDecodedBytes <= 4 * 1024 * 1024); assert.ok(stats.store.peakLoads <= 3);
        record.visits.push({ id, stats, ...((index + 1) % 10 === 0 ? { heap: await workerHeap() } : {}) });
      }
      const heaps = record.visits.filter(v => v.heap).map(v => v.heap.usedSize);
      // The live index and at most sixteen card shards should plateau. Allow
      // source-label size variation and V8 overhead, not per-visit accumulation.
      assert.ok(Math.max(...heaps.slice(1)) - Math.min(...heaps.slice(1)) < 4 * 1024 * 1024, JSON.stringify(heaps));
      assert.ok(record.visits.at(-1).stats.store.evictions > 0, "A mixed hierarchy journey exceeds and evicts the fixed detail cache");
      assert.ok(await page.evaluate(() => window.__earth.assertStableDomIdentity() && [...document.querySelectorAll(".planet-destination-list button")].every((node, i) => node === window.__searchNodes[i])));
      assert.equal(await page.locator('[data-entity-card]').count(), 1);
      const retired = Promise.withResolvers();
      await page.exposeFunction("reportRetiredDestinations", stats => retired.resolve(stats));
      await page.evaluate(() => {
        const stats = window.__earth.runtime.destinationStats;
        window.addEventListener("pagehide", () => { void window.reportRetiredDestinations(stats()); }, { once: true });
      });
      await page.locator('a[href="/mars/"]').first().click(); await page.waitForURL("**/mars/");
      await page.waitForFunction(() => window.__mars?.ready);
      record.retired = await Promise.race([retired.promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Missing teardown receipt")), 10000))]);
      assert.equal(record.retired.disposed, true); assert.equal(record.retired.worker, false); assert.equal(record.retired.store, null);
      assert.deepEqual(errors, []); record.passed = true;
      console.log(JSON.stringify({ dpr, visits: record.visits.length, heaps, cold: record.cold.longTasks, searches: record.searches, retired: record.retired }));
    } finally { release(); await context.close(); record.video = await page.video()?.path(); }
  }
  report.passed = report.runs.every(run => run.passed);
} finally {
  await browser.close(); await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, passed: report.passed ?? false }));
}
