import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { serveBuiltFixture } from "../../../../tools/test-built-server.mjs";

const root = resolve(import.meta.dirname, "../../../..");
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const output = resolve(root, `output/playwright/global-delivery-${Date.now()}`), built = resolve(option("built-dir", "dist"));
const dprs = option("dpr", "1,2").split(",").map(Number); assert.ok(dprs.every(dpr => [1,2].includes(dpr)));
await mkdir(output, { recursive: true });
const server = await serveBuiltFixture(built);
const report = { output, built, base: server.url, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  harnessSha256: createHash("sha256").update(await readFile(new URL(import.meta.url))).digest("hex"), recordedAt: new Date().toISOString(),
  qualification: "Unchanged built files on an owned local HTTPS origin, with normal browser caching and no request interception. Geometry and provider images use real endpoints. This is not an application deployment or a measurement of application CDN latency.",
  appCacheAssumption: "Fixture static files: max-age=3600; HTML: no-cache. App bytes are uncompressed. Upstream cache headers are measured independently.",
  runs: [], serverRequests: server.requests };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: server.launchArgs }); report.browser = browser.version();
const group = url => url.includes("earth-assets.lowpoly.cc") ? "r2" : url.includes("mapproxy.terrascope.be") ? "provider" : url.startsWith(server.url) ? "application" : "editorial";
try {
  for (const dpr of dprs) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
    await context.addInitScript(() => {
      const live = new Map(), create = URL.createObjectURL, revoke = URL.revokeObjectURL;
      const probe = window.__deliveryProbe = { peakBlobBytes: 0, peakBlobs: 0, peakSlots: 0, peakSlotsWhileLandCoverSelected: 0, samples: 0 };
      URL.createObjectURL = function(blob) { const url = create.call(this,blob); live.set(url,blob.size); return url; };
      URL.revokeObjectURL = function(url) { live.delete(url); return revoke.call(this,url); };
      const frame = () => {
        probe.samples++; probe.peakBlobBytes = Math.max(probe.peakBlobBytes,[...live.values()].reduce((s,n)=>s+n,0));
        probe.peakBlobs = Math.max(probe.peakBlobs,live.size);
        const slots = document.querySelectorAll('[data-city-page]'); probe.peakSlots = Math.max(probe.peakSlots,slots.length);
        if (document.querySelector('button[name="lens"][value="worldcover-land-cover"]')?.getAttribute('aria-pressed') === 'true') probe.peakSlotsWhileLandCoverSelected = Math.max(probe.peakSlotsWhileLandCoverSelected,slots.length);
        requestAnimationFrame(frame);
      }; requestAnimationFrame(frame);
    });
    const page = await context.newPage(), cdp = await context.newCDPSession(page); await cdp.send("Network.enable");
    const cdpRows = new Map(); let run, phase, pending = new Set(), jobs = [];
    cdp.on("Network.requestWillBeSent", event => cdpRows.set(event.requestId, { url: event.request.url, group: group(event.request.url), phase, method: event.request.method, range: event.request.headers.Range ?? event.request.headers.range }));
    cdp.on("Network.requestServedFromCache", event => { const row = cdpRows.get(event.requestId); if (row) row.cached = true; });
    cdp.on("Network.responseReceived", event => { const row = cdpRows.get(event.requestId); if (row) Object.assign(row, { status: event.response.status, cached: Boolean(row.cached || event.response.fromDiskCache || event.response.fromPrefetchCache), headers: event.response.headers }); });
    cdp.on("Network.loadingFinished", event => { const row = cdpRows.get(event.requestId); if (row) row.transferBytes = event.encodedDataLength; });
    context.on("request", request => { if (!request.url().startsWith("blob:")) pending.add(request); });
    context.on("requestfinished", request => {
      pending.delete(request); if (request.url().startsWith("blob:")) return;
      const owner = run, atPhase = phase;
      jobs.push((async () => {
        const response = await request.response(), sizes = await request.sizes().catch(() => null);
        owner.requests.push({ url: request.url(), group: group(request.url()), phase: atPhase, method: request.method(), status: response?.status(),
          range: request.headers().range, headers: response?.headers(), sizes, fromWorker: Boolean(request.serviceWorker()) });
      })());
    });
    context.on("requestfailed", request => { pending.delete(request); run.failed.push({ url: request.url(), error: request.failure()?.errorText }); });
    page.on("pageerror", error => run.errors.push(error.message));
    const settle = async () => {
      await page.waitForFunction(() => document.documentElement.dataset.ready === "true" && document.querySelector("[data-entity-card]")?.ariaBusy !== "true");
      let prior = "", quiet = Date.now();
      for (const started = Date.now(); Date.now() - started < 120000;) {
        const signature = await page.evaluate(() => JSON.stringify({
          pages: [...document.querySelectorAll("[data-city-page]")].filter(n=>n.style.visibility === "visible").map(n=>n.dataset.cityPage).sort(),
          scene: document.querySelector(".polycss-scene")?.style.transform,
          loading: [...document.querySelectorAll('[role="status"]')].filter(n=>!n.closest('[hidden]')).map(n=>n.textContent),
        }));
        const active = [...pending].some(r=>["application","r2","provider"].includes(group(r.url())));
        if (signature !== prior || active) { quiet = Date.now(); prior = signature; }
        if (Date.now() - quiet >= 1000) return;
        await page.waitForTimeout(100);
      }
      throw new Error("Built delivery did not settle.");
    };
    const snapshot = async name => {
      await settle();
      const state = await page.evaluate(() => {
        const nodes = [...document.querySelector(".planet-stage").querySelectorAll("*")];
        const initial = window.__deliveryRetained ??= nodes;
        return { entity: document.querySelector("[data-entity-card]").dataset.entityId,
          activeLens: document.querySelector('button[name="lens"][aria-pressed="true"]')?.value,
          pageKeys: [...document.querySelectorAll("[data-city-page]")].filter(n=>n.style.visibility === "visible").map(n=>n.dataset.cityPage).sort(),
          statuses: [...document.querySelectorAll('[role="status"]')].filter(n=>!n.closest('[hidden]')).map(n=>n.textContent),
          sceneElements: nodes.length, stable: initial.length === nodes.length && initial.every((node,i)=>node===nodes[i]) };
      });
      assert.ok(state.stable);
      if (name.startsWith("land-cover")) assert.equal(state.activeLens, "worldcover-land-cover");
      if (name === "noise") assert.equal(state.activeLens, "buenos-aires-noise");
      assert.ok(!state.statuses.some(s=>/unavailable|could not|failed|loading/i.test(s)), state.statuses.join("; "));
      state.heap = await cdp.send("Runtime.getHeapUsage");
      state.probe = await page.evaluate(() => window.__deliveryProbe);
      assert.ok(state.probe.peakSlots <= 544);
      run.checkpoints.push({ name, ...state });
      console.log(JSON.stringify({dpr,cache:run.cache,checkpoint:name,pages:state.pageKeys.length}));
      if (run.cache === "cold" && ["land-cover-earth", "noise", "country"].includes(name)) await page.screenshot({ path: resolve(output, `${name}-dpr${dpr}.png`) });
    };
    const select = async (query, id) => {
      await page.locator(".planet-sidebar-search").fill(query); await page.locator(`[data-destination-id="${id}"]`).click();
      await page.waitForFunction(id => document.querySelector("[data-entity-card]").dataset.entityId === id, id); await settle();
    };
    try {
      for (const cache of ["cold", "warm"]) {
        run = { dpr, cache, requests: [], cdp: [], failed: [], errors: [], checkpoints: [] }; report.runs.push(run);
        cdpRows.clear(); phase = "initial";
        const serverRequestStart = server.requests.length;
        if (cache === "cold") await cdp.send("Network.clearBrowserCache");
        await page.goto(`${server.url}/earth/`); await snapshot("initial");
        phase = "search-and-city"; await select("Buenos Aires", "3435910"); await snapshot("base-city");
        phase = "noise"; await page.locator('button[name="lens"][value="buenos-aires-noise"]').click(); await snapshot("noise");
        phase = "country"; await page.locator('[data-entity-parent="country:AR"]').click(); await snapshot("country");
        phase = "tokyo"; await select("Tokyo", "1850147"); await snapshot("tokyo");
        phase = "lagos"; await select("Lagos", "2332459"); await snapshot("lagos");
        phase = "earth"; await page.locator('[data-entity-parent="earth"]').click(); await snapshot("root-return");
        phase = "land-cover"; await page.locator('button[name="lens"][value="worldcover-land-cover"]').click(); await snapshot("land-cover-earth");
        phase = "pan"; await page.mouse.move(1000,550); await page.mouse.down(); await page.mouse.move(1210,610,{steps:24}); await page.waitForTimeout(120); await page.mouse.up(); await snapshot("land-cover-pan");
        phase = "normal"; await page.locator('button[name="lens"][value="normal"]').click(); await snapshot("earth-normal");
        // Let outstanding editorial transport finish without changing tile accounting.
        await page.waitForTimeout(1000); await Promise.all(jobs); jobs = [];
        run.cdp = [...cdpRows.values()];
        run.applicationServerRequests = server.requests.slice(serverRequestStart);
        run.applicationServerBodyBytes = run.applicationServerRequests.reduce((sum,row)=>sum+(row.bytes??0),0);
        run.summary = Object.fromEntries(["application","r2","provider","editorial"].map(name => {
          const rows = run.requests.filter(r => r.group === name), network = run.cdp.filter(r => r.group === name);
          return [name,{ requests: rows.length + run.failed.filter(r=>group(r.url)===name).length,
            completedRequests: rows.length, failedRequests: run.failed.filter(r=>group(r.url)===name).length,
            responseBodyBytes: rows.reduce((s,r)=>s+Math.max(0,r.sizes?.responseBodySize??0),0),
            responseHeaderBytes: rows.reduce((s,r)=>s+(r.sizes?.responseHeadersSize??0),0),
            pageTransferBytes: network.reduce((s,r)=>s+(r.transferBytes??0),0), cachedPageRequests: network.filter(r=>r.cached).length,
            edgeHits: rows.filter(r=>r.headers?.["cf-cache-status"]==="HIT").length }];
        }));
        const ranges = run.requests.filter(r => r.group === "r2" && r.range);
        assert.ok(ranges.length > 0 && ranges.every(r => r.status === 206 && r.headers["content-range"] && r.headers["access-control-allow-origin"]));
        assert.ok(run.summary.provider.requests > 0);
        assert.deepEqual(run.errors, []);
        assert.ok(!run.requests.some(r => r.url.startsWith(server.url) && /wmts-[a-f0-9]{16}/u.test(r.url)));
        run.complete = true; console.log(JSON.stringify({ dpr, cache, summary: run.summary, output }));
      }
    } catch (error) {
      run.failureState = await page.evaluate(() => ({ ready:document.documentElement.dataset.ready, entity:document.querySelector("[data-entity-card]")?.dataset.entityId, text:document.querySelector(".planet-sidebar")?.innerText })).catch(()=>null);
      await page.screenshot({path:resolve(output,`failure-dpr${dpr}.png`)}).catch(()=>{}); throw error;
    } finally { await context.close(); }
  }
  assert.ok(server.requests.some(r=>r.sha256));
  assert.ok(!server.requests.some(r=>/wmts-[a-f0-9]{16}/u.test(r.path)));
  report.scripts = [...new Map(server.requests.filter(r=>r.sha256).map(r=>[r.path,{path:r.path,sha256:r.sha256}])).values()];
  for (const script of report.scripts) assert.equal(createHash("sha256").update(await readFile(resolve(built, `.${script.path}`))).digest("hex"),script.sha256);
  report.complete = true;
} catch (error) { report.error = error.stack; throw error; }
finally { await browser.close(); await server.close(); await writeFile(resolve(output,"report.json"),JSON.stringify(report,null,2)+"\n"); console.log(JSON.stringify({output,complete:report.complete??false})); }
