import { earthPreparationConfig } from '../../unit/earth/prepared-fixture.mjs';
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PREPARED_EARTH_SCENE } from "../../unit/earth/prepared-fixture.mjs";
import { readPublishedCoverage } from "../../../../tools/objects/geographic-pages/operations/published-coverage.mjs";
import { prepareCityPageGeometry } from "../../../../tools/objects/geographic-pages/page-geometry.mjs";
import { prepareLocationCamera } from "../../../../tools/objects/geographic-pages/prepare-location.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:4228";
const output = new URL("../../../../output/playwright/published-coverage/", import.meta.url);
await mkdir(output, { recursive: true });
const snapshot = await readPublishedCoverage(new URL('../../../../src/planets/earth/source/city/published-coverage.json.gz',import.meta.url));
// Sample source windows across every integrated region. These are geographic
// addresses chosen offline, independent of the place catalogue or search UI.
const samples = snapshot.faces.map(receipt => {
  const valid = p => (p.width * p.height - p.nodataPixels - (p.absentSource?.pixels ?? 0)) / (p.width * p.height);
  const source = [...receipt.provenance].sort((a, b) => valid(b) - valid(a))[0];
  const [level, x, y] = source.id.replace("global-", "").split("-").map(Number);
  const page = prepareCityPageGeometry({ level, x, y }, PREPARED_EARTH_SCENE);
  const point = page.corners.reduce((sum, corner) => sum.map((v, axis) => v + corner[axis] / 4), [0, 0, 0]);
  return { region: receipt.face.key, sourceWindow: source.id, sourceValidFraction: valid(source),
    camera: prepareLocationCamera(PREPARED_EARTH_SCENE, point, 32, {body:PREPARED_EARTH_SCENE[earthPreparationConfig.sceneBodyKey],camera:earthPreparationConfig.camera}) };
});
const report = { capturedAt: new Date().toISOString(), base, mode: "headless", channel: "chrome",
  qualification: "Source-window samples in every published region; not exhaustive pixel or alignment proof.", samples, runs: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: dpr });
    const run = { dpr, views: [], pageErrors: [], indexUrls: [], imageUrls: [] };
    report.runs.push(run);
    try {
      const page = await context.newPage();
      const indexes = new Set(), images = new Set();
      page.on("pageerror", error => run.pageErrors.push(error.message));
      page.on("request", request => {
        if (/\/city-index-[^/]+\.json$/u.test(request.url())) indexes.add(request.url());
        else if (/\/city-[^/]+\.webp$/u.test(request.url())) images.add(request.url());
      });
      await page.goto(`${base}/earth/`);
      await page.waitForFunction(() => window.__earth?.ready);
      await page.evaluate(() => {
        { const motion = document.querySelector('input[name="motion"]'); if (motion.checked) motion.click(); }
        window.__coverageNodes = [...document.querySelector(".planet-stage").querySelectorAll("*")];
      });
      for (const sample of samples) {
        for (const zoom of [32, 512]) {
          await page.evaluate(camera => window.__earth.camera.setState(camera), { ...sample.camera, zoom });
          await settle(page);
          const state = await page.evaluate(() => ({
            stable: window.__earth.assertStableDomIdentity(),
            identical: [...document.querySelector(".planet-stage").querySelectorAll("*")]
              .every((node, index) => node === window.__coverageNodes[index]),
            nodeCount: document.querySelector(".planet-stage").querySelectorAll("*").length,
            paging: window.__earth.runtime.pages().city,
          }));
          assert.equal(state.stable, true);
          assert.equal(state.identical, true);
          assert.ok(state.paging.retained.length <= state.paging.poolSize);
          assert.ok(state.paging.reservedDecodedBytes <= state.paging.decodedPageByteBound);
          assert.ok(state.paging.index.residentDirectories <= state.paging.index.maximumDirectories);
          assert.ok(state.paging.index.reservedEncodedBytes <= state.paging.index.maximumBytes);
          assert.deepEqual(state.paging.errors, []);
          assert.deepEqual(state.paging.index.errors, []);
          assert.ok(state.paging.retained.some(slot => {
            const [level, x, y] = slot.key.split("-").map(Number);
            return slot.published && `0-${Math.floor(x / 2 ** level)}-${Math.floor(y / 2 ** level)}` === sample.region;
          }), `${sample.region} at zoom ${zoom} must show its published imagery`);
          run.views.push({ region: sample.region, sourceWindow: sample.sourceWindow, zoom, state });
          if (dpr === 2 && ["0-27-4", "0-28-5", "0-11-9"].includes(sample.region)) {
            await page.screenshot({ path: new URL(`${sample.region}-${zoom}.png`, output).pathname });
          }
        }
        console.log(JSON.stringify({ dpr, region: sample.region, checked: run.views.length }));
      }
      await page.evaluate(() => window.__earth.camera.setState({ zoom: 1.1 }));
      await settle(page);
      run.released = await page.evaluate(() => window.__earth.runtime.pages().city);
      assert.equal(run.released.retained.length, 0);
      assert.equal(run.released.index.residentDirectories, 0);
      assert.deepEqual(run.pageErrors, []);
      run.indexUrls = [...indexes].sort();
      run.imageUrls = [...images].sort();
    } finally { await context.close(); }
  }
  const selectedPages = run => run.views.map(view => ({ region: view.region, zoom: view.zoom,
    desired: [...view.state.paging.desired].sort() }));
  assert.deepEqual(selectedPages(report.runs[0]), selectedPages(report.runs[1]),
    "Both display densities must use the same canonical prepared pages");
  report.samePagesAcrossDpr = true;
} finally {
  await browser.close();
  await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ passed: report.runs.map(run => ({ dpr: run.dpr, views: run.views.length })) }));

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => {
    const state = window.__earth.runtime.pages().city;
    return !state.pendingSelection && state.activeLoads === 0 && state.index.activeLoads === 0;
  }, null, { timeout: 60000 });
}
