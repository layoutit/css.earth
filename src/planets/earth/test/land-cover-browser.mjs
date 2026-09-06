import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import sharp from "sharp";
import { PREPARED_GEOGRAPHIC_LENSES } from "../runtime/preparedGeographicLenses.mjs";
import { PREPARED_EARTH_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_EARTH_NOISE } from "../runtime/preparedNoise.mjs";
import { prepareLocationCamera, prepareLocationPoint } from "../tools/city/prepare-location.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:4228";
const dpr = Number(process.argv.find(arg => arg.startsWith("--dpr="))?.slice(6) ?? 1);
const globalCoverage = process.argv.includes("--global");
const output = new URL(`../../../../output/playwright/land-cover-dpr${dpr}-${Date.now()}/`, import.meta.url);
await mkdir(output, { recursive: true });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const descriptor = PREPARED_GEOGRAPHIC_LENSES.find(entry => entry.lens.id === "worldcover-land-cover").lens;
const content = JSON.parse(await readFile(new URL(`../../../../public${descriptor.package.url}`, import.meta.url)));
const palette = new Set(content.legend.items.map(item => item.color.slice(4, -1)));
const report = { base, dpr, globalCoverage, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  retrievedAt: new Date().toISOString(), workingDiffSha256: sha(execFileSync("git", ["diff", "--binary"], { maxBuffer: 32 * 1024 ** 2 })),
  harnessSha256: sha(await readFile(new URL(import.meta.url))),
  package: descriptor.package, source: content.source, sourceTiles: [], views: [], errors: [] };
const acceptedNoise = JSON.parse(execFileSync("git", ["show", "105c159b:src/planets/earth/runtime/preparedNoise.mjs"], { encoding: "utf8" })
  .match(/^export const PREPARED_EARTH_NOISE=(.*);$/mu)[1]);
assert.deepEqual(PREPARED_EARTH_NOISE.roots, acceptedNoise.roots);
assert.equal(PREPARED_EARTH_NOISE.sourceSha256, acceptedNoise.sourceSha256);
report.noiseParity = { baseline: "105c159b50e16386148137a3b5f2439968304d9b", unchangedGeometryAndImages: acceptedNoise.roots.length,
  sourceSha256: acceptedNoise.sourceSha256 };
const jobs = [], sourceByUrl = new Map();
const browser = await chromium.launch({ channel: "chrome", headless: true }); report.browser = browser.version();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr,
  recordVideo: { dir: output.pathname, size: { width: 1440, height: 1000 } } });
const page = await context.newPage();
page.on("pageerror", error => report.errors.push(error.message));
page.on("response", response => {
  if (!response.url().includes("esa-worldcover-map-10m-2021-v2_map/") || response.status() !== 200) return;
  const job = (async () => {
    let bytes;
    try { bytes = await response.body(); } catch { return; } // An explicitly aborted viewport request did not publish.
    const image = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const tile = { url: response.url(), bytes: bytes.length, sha256: sha(bytes), width: image.info.width, height: image.info.height,
      transparent: 0, palette: 0, other: 0, colors: [] };
    const colors = new Set();
    for (let i = 0; i < image.data.length; i += 4) {
      if (!image.data[i + 3]) { tile.transparent++; continue; }
      const color = `${image.data[i]},${image.data[i+1]},${image.data[i+2]}`;
      if (image.data[i + 3] === 255 && palette.has(color)) { tile.palette++; colors.add(color); } else tile.other++;
    }
    tile.colors = [...colors]; report.sourceTiles.push(tile); sourceByUrl.set(tile.url, tile);
  })();
  jobs.push(job);
});
const settle = async () => {
  await page.waitForFunction(() => {
    const api = window.__earth, p = api?.runtime.pages().geographic;
    return p && ["ready", "no-coverage", "error"].includes(api.runtime.geographicLens().status) && !p.pendingSelection &&
      !p.activeLoads && !p.index.activeLoads && !api.camera.stats().dragInertia.destinationFlyTo.active;
  }, null, { timeout: 120000 });
  assert.notEqual(await page.evaluate(() => window.__earth.runtime.geographicLens().status), "error");
};
const inspect = () => page.evaluate(async () => {
    const api = window.__earth, state = api.runtime.geographicLens(), p = api.runtime.pages().geographic;
    const legend = document.querySelector(`[data-lens-legend="${state.id}"]`);
    const leaves = [...document.querySelectorAll(".planet-stage [data-city-page]")].filter(node => p.desired.includes(node.dataset.cityPage));
    const images = [];
    for (const leaf of leaves) {
      if (getComputedStyle(leaf).visibility === "hidden") continue;
      const url = leaf.style.backgroundImage.match(/url\(["']?(blob:[^"')]+)["']?\)/)?.[1];
      if (!url) throw Error("Published geographic leaf has no retained image");
      const bytes = await (await fetch(url)).arrayBuffer();
      images.push({ key: leaf.dataset.cityPage, bytes: bytes.byteLength,
        sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("") });
    }
    return { entity: document.querySelector("[data-entity-card]").dataset.entityId, id: state.id, status: state.status,
      resolution: state.resolution, source: state.content.source, images, desired: p.desired,
      legend: [...legend.querySelectorAll("li:not([hidden])")].map(row => ({
        label: row.querySelector(".planet-lens-legend-category-label").textContent,
        color: row.querySelector(".planet-lens-legend-swatch").style.getPropertyValue("--planet-lens-legend-color") })),
      qualification: legend.querySelector("[data-geographic-qualification]").textContent,
      statusText: legend.querySelector("[data-geographic-status]").textContent,
      sourceUrl: legend.querySelector("[data-geographic-attribution]").href,
      licenseUrl: legend.querySelector("[data-geographic-license]").href };
});
async function capture(name, { colorPixels = false } = {}) {
  await settle(); await Promise.all(jobs);
  const state = await inspect();
  assert.equal(state.id, descriptor.id);
  assert.deepEqual(state.legend, content.legend.items.map(({ label, color }) => ({ label, color })));
  assert.match(state.qualification, /2021/); assert.match(state.qualification, /not.*live|not.*a live/);
  assert.equal(state.sourceUrl, content.source.url); assert.equal(state.licenseUrl, content.source.licenseUrl);
  if (state.resolution === "overview") assert.match(state.statusText, /overview/i);
  for (const image of state.images) {
    const [, level, x, y] = image.key.match(/^wmts-(\d+)-(\d+)-(\d+)-/);
    const url = content.pages.imageSource.urlTemplate.replace("{TileMatrix}", String(level).padStart(2, "0"))
      .replace("{TileCol}", x).replace("{TileRow}", y);
    const source = sourceByUrl.get(url); assert.ok(source, `Missing received source bytes for ${image.key}`);
    assert.equal(image.sha256, source.sha256); assert.equal(image.bytes, source.bytes);
  }
  const path = new URL(`${String(report.views.length + 1).padStart(2, "0")}-${name}.png`, output).pathname;
  const screenshot = await page.screenshot({ path });
  if (colorPixels) {
    const scene = await sharp(screenshot).extract({ left: 400 * dpr, top: 100 * dpr, width: 1040 * dpr, height: 850 * dpr }).ensureAlpha().raw().toBuffer();
    const counts = new Map();
    for (let i = 0; i < scene.length; i += 4) {
      const color = `${scene[i]},${scene[i+1]},${scene[i+2]}`;
      if (palette.has(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    state.sceneCategoryPixels = Object.fromEntries(counts);
    assert.ok([...counts.values()].filter(n => n > 100 * dpr ** 2).length >= 2, `${name}: source category colors must reach the real scene pixels`);
    assert.ok(state.images.length > 0, `${name}: detail must use received source pixels`);
  }
  report.views.push({ name, path, ...state });
  console.log(JSON.stringify({ checkpoint: name, detailImages: state.images.length, resolution: state.resolution }));
}
async function select(query, id) {
  await page.locator(".planet-sidebar-search").fill(query); await page.locator(`[data-destination-id="${id}"]`).click();
  await page.waitForFunction(id => document.querySelector("[data-entity-card]").dataset.entityId === id, id);
}
async function unlit() {
  if (await page.evaluate(() => window.__earth.settings.state().atmosphere)) {
    await page.locator(".planet-settings-action").click();
    await page.locator('label:has(input[name="atmosphere"])').click();
    await page.waitForFunction(() => window.__earth.settings.state().atmosphere === false);
    await page.getByRole("button", { name: "Planet information", exact: true }).click();
  }
}
try {
  await page.goto(`${base}/earth/`); await page.waitForFunction(() => window.__earth?.ready);
  // The default atmosphere is a prepared translucent material over the globe.
  // Its tint is intentional; source-color qualification uses the existing
  // unlit controls. The separate paging recordings retain default atmosphere.
  await page.locator(".planet-settings-action").click();
  await page.locator('label:has(input[name="atmosphere"])').click();
  await page.waitForFunction(() => window.__earth.settings.state().atmosphere === false);
  report.renderSettings = await page.evaluate(() => window.__earth.settings.state());
  await page.getByRole("button", { name: "Planet information", exact: true }).click();
  await page.locator('button[name="lens"][value="worldcover-land-cover"]').click(); await capture("earth");
  for (const [query, id, label, detail] of [["Argentina", "country:AR", "country", false], ["Buenos Aires", "admin1:3435907", "province", false],
    ["Buenos Aires", "3435910", "buenos-aires", true], ["Tokyo", "1850147", "tokyo", true], ["Lagos", "2332459", "lagos-coast", true]]) {
    await select(query, id); await capture(label, { colorPixels: detail });
  }
  await page.locator('[data-entity-parent="earth"]').click(); await settle();
  for (const [name, longitude, latitude, zoom] of [["cropland", -60.4, -35.1, 128], ["dateline-west", 179.95, -16.5, 128],
    ["dateline-east", -179.95, -16.5, 128], ["arctic", 20, 80, 32], ["antarctic-source-gap", 0, -80, 32]]) {
    const camera = prepareLocationCamera(PREPARED_EARTH_SCENE, prepareLocationPoint(PREPARED_EARTH_SCENE, longitude, latitude), zoom);
    await page.evaluate(camera => window.__earth.camera.setState(camera), camera); await capture(name, { colorPixels: name === "cropland" });
  }
  if (globalCoverage) {
    report.qualification = "Stratified source-backed viewpoints and seeded catalogue samples. This is not exhaustive worldwide valid-pixel or physical-device proof.";
    for (const [name, longitude, latitude, zoom] of [
      ["north-america-new-york", -74.006, 40.713, 1024], ["europe-london", -.1276, 51.5072, 1024],
      ["oceania-sydney", 151.2093, -33.8688, 1024], ["asia-delhi", 77.209, 28.614, 1024],
      ["africa-cairo", 31.2357, 30.0444, 1024], ["face-boundary-west", 112.49, 32.1, 512], ["face-boundary-east", 112.51, 32.1, 512],
    ]) {
      const camera = prepareLocationCamera(PREPARED_EARTH_SCENE, prepareLocationPoint(PREPARED_EARTH_SCENE, longitude, latitude), zoom);
      await page.evaluate(camera => window.__earth.camera.setState(camera), camera); await capture(name, { colorPixels: true });
    }
    const { preparePlaceCatalog } = await import("../tools/prepare-places.mjs"), catalog = await preparePlaceCatalog();
    let seed = 260906; report.randomSeed = seed; report.randomSamples = [];
    for (const kind of ["country", "admin1", "city"]) {
      const candidates = catalog.places.filter(place => place.kind === kind), used = new Set();
      for (let i = 0; i < 3; i++) {
        let place;
        do { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; place = candidates[seed % candidates.length]; } while (used.has(place.id));
        used.add(place.id);
        await page.goto(`${base}/earth/#place=${encodeURIComponent(place.id)}&lens=worldcover-land-cover`);
        await page.waitForFunction(id => window.__earth?.ready && document.querySelector('[data-entity-card]').dataset.entityId === id, place.id);
        await unlit(); await capture(`sample-${kind}-${i+1}`);
        assert.equal(await page.locator('.planet-title').getAttribute('aria-label'), place.name);
        assert.ok(await page.locator(`[data-entity-parent="${place.parentId}"]`).isVisible());
        report.randomSamples.push({ id: place.id, name: place.name, kind, parentId: place.parentId, identifiers: place.identifiers,
          latitude: place.latitude, longitude: place.longitude, camera: place.camera, view: report.views.at(-1).name });
      }
    }
    report.catalogSourceSha256 = sha(await readFile(new URL("../source/places/manifest.json", import.meta.url)));
  }
  await select("Buenos Aires", "3435910"); await settle();
  const legend = page.locator('[data-lens-legend="worldcover-land-cover"]');
  await legend.locator('[data-geographic-license]').scrollIntoViewIfNeeded();
  const sourcePath = new URL("source-and-legend.png", output).pathname;
  await page.screenshot({ path: sourcePath }); report.sourceScreenshot = sourcePath;
  await page.locator(".planet-settings-action").click();
  await page.locator('label:has(input[name="atmosphere"])').click();
  await page.waitForFunction(() => window.__earth.settings.state().atmosphere === true);
  await page.getByRole("button", { name: "Planet information", exact: true }).click();
  await page.locator('button[name="lens"][value="buenos-aires-noise"]').click(); await settle();
  report.noise = await page.evaluate(() => ({ state: window.__earth.runtime.geographicLens(), pages: window.__earth.runtime.pages().geographic,
    overview: window.__earth.runtime.geographicSurface(), base: window.__earth.runtime.pages().city }));
  assert.equal(report.noise.state.id, "buenos-aires-noise"); assert.equal(report.noise.overview.retainedImages, 0); assert.equal(report.noise.base.suspended, false);
  report.noisePaint = await inspect();
  assert.ok(report.noisePaint.images.length > 0);
  for (const image of report.noisePaint.images) {
    const accepted = acceptedNoise.roots.find(root => root.key === image.key); assert.ok(accepted);
    assert.equal(image.sha256, accepted.sha256); assert.equal(image.bytes, accepted.bytes);
  }
  await page.screenshot({ path: new URL("noise-preserved.png", output).pathname });
  await select("Tokyo", "1850147");
  await page.waitForFunction(() => window.__earth.runtime.geographicLens().id === null);
  assert.equal(await page.locator('button[name="lens"][value="buenos-aires-noise"]').isVisible(), false);
  await Promise.all(jobs);
  for (const tile of report.sourceTiles) {
    assert.equal(tile.other, 0, `Only source category colors are admitted: ${tile.url}`);
    if (tile.width === 1) assert.equal(tile.sha256, content.pages.imageSource.emptyImage.sha256);
    else { assert.equal(tile.width, 256); assert.equal(tile.height, 256); }
  }
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.error = error.stack; await page.screenshot({ path: new URL("failure.png", output).pathname }).catch(() => {}); throw error;
} finally {
  await Promise.allSettled(jobs); await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2));
  await context.close(); await browser.close(); console.log(JSON.stringify({ output: output.pathname, passed: report.passed ?? false }));
}
