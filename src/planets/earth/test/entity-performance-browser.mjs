// Real Chrome performance journey. Source/runtime changes are deliberately
// separate from this measurement harness; preserve every frame interval.
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpus, totalmem, platform, release } from "node:os";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { summarizeEntityTrace, writeEntityPerformanceReview } from "./entity-performance-report.mjs";

const option = (key, fallback) => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const base = process.argv.find(arg => /^https?:/u.test(arg)) ?? "http://127.0.0.1:4228";
const mode = option("mode", "baseline"), dpr = Number(option("dpr", "1")), repetitions = Number(option("repetitions", "3"));
assert.ok([1, 2].includes(dpr) && repetitions >= 1 && repetitions <= 3);
const output = resolve(option("output", `output/playwright/entity-performance-${mode}-dpr${dpr}-${Date.now()}`));
await mkdir(output, { recursive: true });
const capture = option("capture", "trace") === "trace";
const traceCategories = option("trace-categories", "devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler,disabled-by-default-devtools.screenshot,blink.user_timing");
const viewport = { width: 1440, height: 1000 };
const report = { schema: "cssearth-entity-performance@1", base, mode, output, dpr, repetitions, viewport, capture, traceCategories,
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingTree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  harnessSha256: createHash("sha256").update(await readFile(new URL(import.meta.url))).digest("hex"),
  environment: { platform: platform(), osRelease: release(), cpu: cpus()[0].model, cores: cpus().length, memoryBytes: totalmem(),
    cpuThrottle: 1, networkThrottle: "none", servedCwd: process.cwd(), cache: "cold: isolated context; warm: same mounted scene and HTTP cache" }, runs: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true }); report.browser = browser.version();
report.preparedModules = Object.fromEntries(await Promise.all([
  "preparedScene.mjs", "preparedLenses.mjs", "preparedPresentation.mjs", "preparedPlaces.mjs",
].map(async name => [name, createHash("sha256").update(await readFile(new URL(`../runtime/${name}`, import.meta.url))).digest("hex")])));
try {
  for (let repetition = 1; repetition <= repetitions; repetition++) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, ...(capture ? { recordVideo: { dir: output, size: viewport } } : {}) });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await page.addInitScript(() => {
      const data = window.__entityPerf = { phases: [], frames: [], longTasks: [], inputs: [], peaks: {}, queryPaints: [] };
      let previous, active = null, pendingQuery = null;
      document.addEventListener("input", event => {
        if (event.target.matches?.(".planet-sidebar-search")) pendingQuery = { query: event.target.value, inputAt: performance.now() };
      }, true);
      document.addEventListener("DOMContentLoaded", () => {
        const root = document.querySelector(".planet-destination-results");
        if (!root) return;
        new MutationObserver(() => {
          const query = pendingQuery;
          if (!query?.query || query.scheduled || root.hidden || ![...root.querySelectorAll("li")].some(row => !row.hidden)) return;
          query.scheduled = true; query.readyAt = performance.now();
          requestAnimationFrame(now => {
            if (pendingQuery !== query || root.hidden) return;
            data.queryPaints.push({ ...query, frameAt: now, inputToFrameMs: Math.max(0, now - query.inputAt) });
          });
        }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
      }, { once: true });
      function frame(now) {
        if (previous !== undefined) data.frames.push({ at: now, duration: now - previous, phase: active });
        previous = now; requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      new PerformanceObserver(list => {
        for (const item of list.getEntries()) data.longTasks.push({ at: item.startTime, duration: item.duration, phase: active });
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver(list => {
        for (const item of list.getEntries()) data.inputs.push({ at: item.startTime, name: item.name, duration: item.duration, inputDelay: item.processingStart - item.startTime });
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      data.begin = name => { active = name; const at = performance.now(); performance.mark(`entity:${name}:start`); return at; };
      data.end = async (name, start) => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const end = performance.now(); performance.mark(`entity:${name}:end`);
        data.phases.push({ name, start, end, duration: end - start }); active = null;
      };
      data.begin("document");
      setInterval(() => {
        for (const [id, stats] of Object.entries(window.__earth?.runtime.pages() ?? {})) {
          const peak = data.peaks[id] ??= { loads: 0, retained: 0, decodedBytes: 0, indexBytes: 0 };
          peak.loads = Math.max(peak.loads, stats.activeLoads); peak.retained = Math.max(peak.retained, stats.retained.length);
          peak.decodedBytes = Math.max(peak.decodedBytes, stats.reservedDecodedBytes);
          peak.indexBytes = Math.max(peak.indexBytes, stats.index.reservedDecodedBytes ?? 0);
        }
      }, 250);
    });
    const errors = [], network = new Map();
    page.on("pageerror", error => errors.push(error.message));
    cdp.on("Network.requestWillBeSent", event => network.set(event.requestId, { url: event.request.url, start: event.timestamp, type: event.type }));
    cdp.on("Network.responseReceived", event => {
      const row = network.get(event.requestId); if (row) Object.assign(row, { status: event.response.status, mimeType: event.response.mimeType,
        cached: Boolean(event.response.fromDiskCache || event.response.fromPrefetchCache), response: event.timestamp });
    });
    cdp.on("Network.loadingFinished", event => { const row = network.get(event.requestId); if (row) Object.assign(row, { end: event.timestamp, transferBytes: event.encodedDataLength }); });
    const flight = () => page.waitForFunction(() => document.querySelector("[data-entity-card]").ariaBusy !== "true" && !window.__earth.camera.stats().dragInertia.destinationFlyTo.active);
    const settle = layer => page.waitForFunction(layer => {
      const s = window.__earth.runtime.pages()[layer];
      return s.desired.length > 0 && !s.pendingSelection && !s.activeLoads && !s.index.activeLoads && s.desired.every(key => s.retained.some(slot => slot.key === key && slot.published));
    }, layer, { timeout: 120000 });
    const query = async (name, id) => {
      await page.locator(".planet-sidebar-search").fill(name);
      await page.locator(`[data-destination-id="${id}"]`).waitFor({ state: "visible" });
    };
    const select = async (name, id) => { await query(name, id); await page.locator(`[data-destination-id="${id}"]`).click(); await flight(); };
    try {
      for (const cache of ["cold", "warm"]) {
        const label = `${repetition}-${cache}`, run = { label, cache, repetition, phases: [], errors };
        report.runs.push(run); network.clear();
        if (cache === "cold") {
          await cdp.send("Network.clearBrowserCache");
          await page.goto(`${base}/earth/`);
          await page.waitForFunction(() => window.__cssEarth?.ready && window.__earth?.ready);
        } else {
          await page.locator('[data-entity-parent="earth"]').click(); await flight();
          await page.waitForTimeout(200);
          // Saved-place restoration no longer loads search. Record this cold
          // index / warm HTTP request separately, then compare resident search
          // with the baseline's already decoded full catalogue.
          if (await page.evaluate(() => Boolean(window.__earth.runtime.destinationStats?.() && !window.__earth.runtime.destinationStats().store?.searchDecodedBytes))) {
            const start = performance.now(); await query("Argentina", "country:AR");
            run.searchAfterReload = { wallMs: performance.now() - start, residency: "cold index, warm HTTP cache" };
            await page.locator(".planet-sidebar-search").fill("");
          }
        }
        await page.evaluate(() => { const d = window.__entityPerf; d.phases = []; d.frames = []; d.longTasks = []; d.inputs = []; d.peaks = {}; d.queryPaints = []; });
        const trace = [], collect = ({ value }) => trace.push(...value);
        cdp.on("Tracing.dataCollected", collect);
        if (capture) await cdp.send("Tracing.start", { categories: traceCategories, transferMode: "ReportEvents" });
        async function phase(name, action) {
          const start = await page.evaluate(name => window.__entityPerf.begin(name), name);
          await action(); await page.evaluate(({ name, start }) => window.__entityPerf.end(name, start), { name, start });
        }
        try {
          await phase("search-first", () => query("Argentina", "country:AR"));
          for (const [name, id] of [["Tokyo", "1850147"], ["Buenos Aires", "3435910"], ["Argentina", "country:AR"]]) {
            await phase(`search-${name}`, () => query(name, id));
          }
          await phase("country-flight", async () => { await page.locator('[data-destination-id="country:AR"]').click(); await flight(); });
          await phase("city-flight", () => select("Buenos Aires", "3435910"));
          await phase("city-pages", () => settle("city"));
          await phase("noise-open", async () => {
            await page.locator('button[name="lens"][value="buenos-aires-noise"]').click(); await settle("geographic");
          });
          if (capture) await page.screenshot({ path: resolve(output, `${label}-noise.png`) });
          await phase("city-pan", async () => {
            await page.mouse.move(950, 470); await page.mouse.down();
            for (let i = 1; i <= 30; i++) { await page.mouse.move(950 + i * 2, 470 + i / 2); await page.waitForTimeout(16); }
            await page.mouse.up(); await page.waitForFunction(() => !window.__earth.camera.stats().dragInertia.active);
          });
          await phase("pan-pages", async () => { await settle("city"); await settle("geographic"); });
          await page.waitForTimeout(200);
          run.metrics = await page.evaluate(() => {
            const d = window.__entityPerf;
            return { phases: d.phases, frames: d.frames, longTasks: d.longTasks, inputs: d.inputs, queryPaints: d.queryPaints, peaks: d.peaks,
              catalog: window.__earth.runtime.destinationCatalog(), destinationStats: window.__earth.runtime.destinationStats?.() ?? null, camera: window.__earth.camera.state(), stable: window.__earth.assertStableDomIdentity(),
              resources: performance.getEntriesByType("resource").map(({ name, startTime, duration, transferSize, encodedBodySize, decodedBodySize }) => ({ name, startTime, duration, transferSize, encodedBodySize, decodedBodySize })) };
          });
        } finally {
          if (capture) { const completed = new Promise(resolve => cdp.once("Tracing.tracingComplete", resolve));
            await cdp.send("Tracing.end"); await completed; }
          cdp.off("Tracing.dataCollected", collect);
          run.network = [...network.values()];
          run.trace = `${label}-trace.json.gz`;
          if (capture) await writeFile(resolve(output, run.trace), gzipSync(JSON.stringify({ traceEvents: trace })));
        }
        run.summary = await summarizeEntityTrace(trace, run.metrics, { output, prefix: label, network: run.network });
        assert.ok(run.metrics.stable); assert.deepEqual(errors, []); run.passed = true;
        console.log(JSON.stringify({ label, phases: run.summary.phases.map(({ name, wallMs, frameP95, frameMax, longTaskMax }) => ({ name, wallMs, frameP95, frameMax, longTaskMax })) }));
        // Refresh is measured separately: its new document has a fresh clock.
        network.clear(); const start = performance.now(), reloadTrace = [];
        const collectReload = ({ value }) => reloadTrace.push(...value);
        cdp.on("Tracing.dataCollected", collectReload);
        if (capture) await cdp.send("Tracing.start", { categories: traceCategories, transferMode: "ReportEvents" });
        try {
          await page.reload();
          await page.waitForFunction(() => window.__cssEarth?.ready && window.__earth?.ready && document.querySelector('[data-entity-card]').dataset.entityId === "3435910");
          await flight(); await settle("city"); await settle("geographic");
          await page.evaluate(() => window.__entityPerf.end("document", 0));
          run.refresh = { wallMs: performance.now() - start, network: [...network.values()], metrics: await page.evaluate(() => ({ phases: window.__entityPerf.phases, frames: window.__entityPerf.frames, longTasks: window.__entityPerf.longTasks })) };
        } finally {
          if (capture) { const completed = new Promise(resolve => cdp.once("Tracing.tracingComplete", resolve));
            await cdp.send("Tracing.end"); await completed; }
          cdp.off("Tracing.dataCollected", collectReload);
          if (capture) await writeFile(resolve(output, `${label}-refresh-trace.json.gz`), gzipSync(JSON.stringify({ traceEvents: reloadTrace })));
        }
        run.refresh.summary = await summarizeEntityTrace(reloadTrace, run.refresh.metrics, { output, prefix: `${label}-refresh`, network: run.refresh.network });
        await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
      }
    } finally {
      await context.close(); const video = await page.video()?.path();
      for (const run of report.runs.filter(run => run.repetition === repetition)) run.video = video;
    }
  }
  report.passed = report.runs.length === repetitions * 2 && report.runs.every(run => run.passed);
} finally {
  await browser.close(); await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  await writeEntityPerformanceReview(report);
  console.log(JSON.stringify({ output, passed: report.passed ?? false }));
}
