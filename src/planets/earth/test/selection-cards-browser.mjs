import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:4228";
const output = new URL(`../../../../output/playwright/selection-cards-${Date.now()}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { base, browser: browser.version(), cases: [] };
try {
  for (const [label, viewport, dpr, mobile] of [
    ["desktop-1", { width: 1440, height: 1000 }, 1, false],
    ["desktop-2", { width: 1440, height: 1000 }, 2, false],
    ["mobile-2", { width: 390, height: 844 }, 2, true],
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile,
      recordVideo: { dir: output.pathname, size: viewport } });
    const page = await context.newPage(), errors = [], record = { label, dpr, screenshots: [], errors };
    report.cases.push(record);
    page.on("pageerror", error => errors.push(error.message));
    const requests = []; page.on("request", request => requests.push(request.url()));
    const cdp = await context.newCDPSession(page); await cdp.send("Performance.enable");
    record.network = { requests };
    await page.addInitScript(() => {
      window.__journeyMetrics = { longTasks: [], peaks: {} };
      new PerformanceObserver(list => { for(const entry of list.getEntries()) window.__journeyMetrics.longTasks.push(entry.duration); }).observe({type:"longtask",buffered:true});
      setInterval(() => {
        for(const [id, stats] of Object.entries(window.__earth?.runtime.pages() ?? {})) {
          const peak = window.__journeyMetrics.peaks[id] ??= {loads:0,decodedBytes:0,retained:0,poolSize:stats.poolSize,byteBound:stats.decodedPageByteBound};
          peak.loads = Math.max(peak.loads,stats.activeLoads); peak.decodedBytes = Math.max(peak.decodedBytes,stats.reservedDecodedBytes);
          peak.retained = Math.max(peak.retained,stats.retained.length);
        }
      },100);
    });
    const settlePages = layer => page.waitForFunction(layer => {
      const s=window.__earth.runtime.pages()[layer];
      return !s.pendingSelection && !s.activeLoads && !s.index.activeLoads && s.desired.length > 0 && s.desired.every(key=>s.retained.some(slot=>slot.key===key&&slot.published));
    },layer,{timeout:120000});
    const settleNoise = async () => { await settlePages("geographic"); await settlePages("city"); };
    const saveMetrics = async name => {
      const metrics = await page.evaluate(() => window.__journeyMetrics);
      for (const peak of Object.values(metrics.peaks)) { assert.ok(peak.retained<=peak.poolSize); assert.ok(peak.decodedBytes<=peak.byteBound); }
      (record.metrics ??= []).push({name,...metrics,performance:(await cdp.send("Performance.getMetrics")).metrics});
    };
    const capture = async name => {
      const path = new URL(`${label}-${name}.png`, output).pathname;
      await page.screenshot({ path }); record.screenshots.push({ name, path });
    };
    const flight = () => page.waitForFunction(() => !window.__earth.camera.stats().dragInertia.destinationFlyTo.active);
    const select = async (name, id) => {
      await page.locator(".planet-sidebar-search").fill(name);
      await page.locator(`[data-destination-id="${id}"]`).click();
      await page.waitForFunction(id => document.querySelector("[data-entity-card]").dataset.entityId === id, id);
      await flight();
      await page.waitForFunction(() => document.querySelector("[data-entity-card]").dataset.introductionState === "ready", null, { timeout: 20000 });
      assert.equal(await page.locator(".planet-destination-status").isVisible(), false);
      assert.ok((await page.locator(".planet-introduction").innerText()).length > 40);
      const provenance = JSON.parse(await page.locator("[data-entity-card]").getAttribute("data-introduction-source"));
      assert.match(provenance.wikidata, /^Q\d+$/u);
      assert.ok(provenance.revision > 0);
      assert.equal(await page.locator('.planet-resource-row[href="' + provenance.url + '"]').count(), 1);
      assert.equal(await page.locator("[data-entity-card]").count(), 1);
      assert.equal(await page.locator("[data-entity-card]").isVisible(), true);
      assert.equal(await page.locator('.planet-stage').count(), 1);
    };
    const noise = page.locator('button[name="lens"][value="buenos-aires-noise"]');
    try {
      await page.goto(`${base}/earth/`); await page.waitForFunction(() => window.__earth?.ready);
      await page.evaluate(() => { window.__cardScene = document.querySelector(".planet-stage"); window.__cardNodes = [...document.querySelector("[data-entity-card]").querySelectorAll("*")]; });
      assert.equal(await noise.isVisible(), false);
      assert.equal(await page.evaluate(() => window.__earth.selectLens("buenos-aires-noise")), false);
      assert.equal(requests.some(url=>url.includes("/scenes/earth/geographic-lens-") || url.includes("earth-noise-day-")),false);
      await capture("01-earth");
      await select("Argentina", "country:AR");
      assert.equal(await noise.isVisible(), false);
      assert.equal(await page.locator(".planet-title").getAttribute("aria-label"), "Argentina");
      await capture("02-argentina");
      await select("Buenos Aires", "3435910");
      assert.equal(await noise.isVisible(), true);
      assert.equal(await page.locator('[data-entity-parent="country:AR"]').textContent(), "Argentina");
      assert.equal(requests.some(url=>url.includes("/scenes/earth/geographic-lens-")),false);
      await settlePages("city"); await capture("03-buenos-aires");
      const cityCamera = await page.evaluate(() => window.__earth.camera.state());
      await noise.click();
      await page.waitForFunction(() => {
        const state = window.__earth.runtime.pages().geographic;
        return state.desired.length > 0 && !state.pendingSelection && !state.activeLoads &&
          state.desired.every(key => state.retained.some(slot => slot.key === key && slot.published));
      }, null, { timeout: 90000 });
      assert.equal(await noise.getAttribute("aria-pressed"), "true");
      assert.equal(await page.evaluate(() => window.__earth.camera.stats().dragInertia.destinationFlyTo.active), false, "A local lens must not start another flight");
      assert.deepEqual(await page.evaluate(() => window.__earth.camera.state()), cityCamera);
      assert.equal(await page.evaluate(() => window.__earth.selectLens("topography")), false, "Planet lenses cannot replace a place lens inside the place card");
      await settleNoise();
      await capture("04-buenos-aires-noise");
      await page.locator('button[name="lens"][value="normal"]').click();
      await page.waitForFunction(() => window.__earth.lens().id === "normal");
      assert.equal(await page.locator('[data-lens-legend="buenos-aires-noise"]').isVisible(), false);
      await noise.click(); await page.waitForFunction(() => window.__earth.lens().id === "buenos-aires-noise");
      await page.locator('[data-entity-parent="country:AR"]').click(); await flight();
      await page.waitForFunction(() => window.__earth.runtime.destination()?.id === "country:AR");
      assert.equal(await page.evaluate(() => window.__earth.lens().id), "normal");
      assert.equal(await noise.isVisible(), false);
      await select("Tokyo", "1850147");
      assert.equal(await noise.isVisible(), false);
      assert.equal(await page.evaluate(() => window.__earth.selectLens("buenos-aires-noise")), false);
      assert.equal(await page.locator('[data-lens-option]:not([hidden])').count(), 1);
      await settlePages("city"); await capture("05-tokyo");
      await page.locator('[data-entity-parent="earth"]').click();
      await page.waitForFunction(() => document.querySelector("[data-entity-card]").dataset.entityId === "earth"); await flight();
      assert.equal(await page.locator(".planet-information-panel").isVisible(), true);
      assert.equal(await noise.isVisible(), false);
      assert.equal(await page.evaluate(() => window.__earth.runtime.destination()), null);
      await page.locator('.planet-lenses').evaluate(panel => { panel.open = true; });
      await page.locator('button[name="lens"][value="topography"]').click();
      await page.waitForFunction(() => window.__earth.lens().id === "topography");
      record.cardRetained = await page.evaluate(() => [...document.querySelector("[data-entity-card]").querySelectorAll("*")].every((node,index) => node === window.__cardNodes[index]));
      assert.equal(record.cardRetained, true);
      record.retained = await page.evaluate(() => window.__cardScene === document.querySelector(".planet-stage") && window.__earth.assertStableDomIdentity());
      assert.equal(record.retained, true);
      await saveMetrics("retained-city-journey");
      await select("Buenos Aires", "3435910"); await noise.click(); await settleNoise();
      assert.ok(page.url().includes("place=3435910&lens=buenos-aires-noise"));
      await page.goBack(); await page.waitForFunction(()=>window.__earth.lens().id==="normal");
      assert.equal(await page.locator("[data-entity-card]").getAttribute("data-entity-id"),"3435910");
      await page.goForward(); await settleNoise();
      assert.equal(await page.evaluate(()=>window.__earth.assertStableDomIdentity()),true);
      await page.reload();
      await page.waitForFunction(()=>window.__earth?.ready && document.querySelector("[data-entity-card]").dataset.entityId==="3435910");
      await flight(); await settleNoise();
      await capture("06-restored-after-refresh");
      await page.locator(".planet-sidebar-search").fill("Mars");
      await page.locator('.planet-object-browser a[href="/mars/"]').click();
      await page.waitForFunction(()=>window.__mars?.ready);
      assert.equal(await page.locator(".planet-stage").count(),1);
      await page.goBack();
      await page.waitForFunction(()=>window.__earth?.ready && document.querySelector("[data-entity-card]").dataset.entityId==="3435910");
      await flight(); await settleNoise();
      await capture("07-returned-from-mars");
      const normal=page.locator('button[name="lens"][value="normal"]');
      await normal.click();
      await page.route("**/geographic-lens-*.json",route=>route.fulfill({status:503,body:"Temporarily unavailable"}));
      await noise.click(); await page.waitForFunction(()=>window.__earth.runtime.geographicLens().status==="error");
      assert.match(await page.locator('[data-geographic-option]:not([hidden]) [role="status"]').innerText(),/retry/);
      assert.equal(await page.evaluate(()=>window.__earth.runtime.pages().geographic.retained.length),0);
      await capture("08-recoverable-lens-failure");
      await page.unroute("**/geographic-lens-*.json"); await noise.click(); await settleNoise();
      await page.evaluate(()=>window.__earth.setView({zoom:8}));
      await page.waitForFunction(()=>window.__earth.runtime.geographicLens().status==="no-coverage");
      assert.equal(await page.evaluate(()=>window.__earth.runtime.pages().geographic.retained.length),0);
      await select("Buenos Aires", "3435910"); await noise.click(); await settleNoise();
      await page.locator('[data-geographic-attribution]').filter({visible:true}).scrollIntoViewIfNeeded();
      await capture("09-source-and-legend");
      await saveMetrics("history-refresh-recovery");
      record.history = {back:true,forward:true,refresh:true,returnFromPlanet:true,retry:true,noCoverage:true};
      assert.deepEqual(errors, []); record.passed = true;
    } finally {
      await context.close(); record.video = await page.video().path();
    }
  }
  report.passed = true;
} finally {
  await browser.close(); await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output: output.pathname, passed: report.passed ?? false, cases: report.cases.map(({label, passed}) => ({label, passed})) }));
}
