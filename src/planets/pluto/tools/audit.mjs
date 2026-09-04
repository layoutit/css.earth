#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { decodeElevationGrid, elevationRaster } from "./elevation-raster.mjs";
import { verifyPlutoSourceManifest } from "./source-manifest.mjs";
import { PREPARED_PLUTO_LENSES } from "../runtime/preparedLenses.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4211";
const root = resolve("output/playwright/pluto-visual");
await mkdir(root, { recursive: true });
await verifyPlutoSourceManifest();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(await readFile(new URL("../runtime-assets.json", import.meta.url)));
const expected = new Map(manifest.assets.map((entry) => [entry.filename, entry]));
const source = JSON.parse(await readFile(new URL("../source/manifest.json", import.meta.url)));
const report = { qualification: "SOURCE-BOUND BROWSER PRESENTATION; not native camera or pixel parity", baseUrl, sourceInputs: source.inputs, views: [], runtime: [] };

// Observation references, separate from browser captures: these are flat source
// products, so no misleading source-map-to-globe pixel-difference is reported.
for (const [id, file] of [["surface", "surface/pluto-color-mosaic.jpg"], ["monochrome", "lenses/pluto-monochrome.tif"]]) {
  await sharp(new URL(`../source/${file}`, import.meta.url).pathname, { limitInputPixels: false }).resize(1024, 512).png().toFile(resolve(root, `source-${id}.png`));
}
const elevation = elevationRaster(decodeElevationGrid(await readFile(new URL("../source/lenses/pluto-dem.tif", import.meta.url))), 1024, 512);
await sharp(elevation.data, { raw: elevation.info }).png().toFile(resolve(root, "source-topography-presentation.png"));

const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, reducedMotion: "reduce" });
    const page = await context.newPage();
    const problems = [], external = [], checks = [], loaded = new Set();
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("request", (request) => { if (new URL(request.url()).origin !== new URL(baseUrl).origin) external.push(request.url()); });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith("/scenes/pluto/")) return;
      if (response.status() >= 300 && response.status() < 400) return;
      checks.push((async () => {
        const file = url.pathname.split("/").at(-1), pinned = expected.get(file);
        assert.ok(pinned, `Unexpected loaded Pluto asset: ${file}`);
        const bytes = await response.body();
        assert.equal(bytes.length, pinned.bytes); assert.equal(sha(bytes), pinned.sha256);
        loaded.add(file);
      })().catch((error) => problems.push(error.message)));
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await page.goto(`${baseUrl}/pluto/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__pluto?.ready && window.__cssEarth?.ready);
    await page.evaluate(() => { window.__pluto.pause(); for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } });
    await page.screenshot({ path: resolve(root, `pluto-dpr${dpr}-shell.png`) });
    const pitch = await page.evaluate(() => window.__pluto.camera.state().controlPitch);
    for (const lens of PREPARED_PLUTO_LENSES.controls) {
      await page.evaluate((id) => window.__pluto.lenses.select(id), lens.id);
      for (const [view, controlPitch] of [["default", pitch], ["north", 0], ["south", 89]]) {
        await page.evaluate((controlPitch) => window.__pluto.camera.setState({ controlPitch }), controlPitch);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const file = `pluto-${lens.id}-${view}-dpr${dpr}.png`;
        await page.locator(".planet-stage").screenshot({ path: resolve(root, file) });
        report.views.push({ dpr, lens: lens.id, view, controlPitch, file, sha256: sha(await readFile(resolve(root, file))) });
      }
    }
    await page.evaluate((controlPitch) => { window.__pluto.camera.setState({ controlPitch }); return window.__pluto.lenses.select("surface"); }, pitch);
    const before = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
    const frames = await page.evaluate(async () => {
      const samples = []; let previous = performance.now();
      document.querySelector(".planet-motion-setting").click();
      await new Promise((resolve) => {
        const start = performance.now();
        const tick = (now) => { samples.push(now - previous); previous = now; if (now - start < 3000) requestAnimationFrame(tick); else resolve(); };
        requestAnimationFrame(tick);
      });
      document.querySelector(".planet-motion-setting").click();
      return samples.slice(1);
    });
    const after = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
    const runtime = await page.evaluate(() => ({ stableDomIdentity: window.__pluto.assertStableDomIdentity(), nodes: document.querySelector(".planet-stage").querySelectorAll("*").length, density: window.__pluto.renderStats.textureStats.selectedPreparedDensity, cameraCount: document.querySelectorAll(".polycss-camera").length, canvasCount: document.querySelectorAll("canvas").length, sceneSvgCount: document.querySelectorAll(".planet-stage svg").length }));
    await Promise.all(checks);
    for (const lens of PREPARED_PLUTO_LENSES.controls) {
      assert.ok(loaded.has(lens.surface2xUrl.split("/").at(-1)));
      assert.ok(loaded.has(lens.poles2xUrl.split("/").at(-1)));
    }
    assert.equal(runtime.stableDomIdentity, true); assert.equal(runtime.density, 2); assert.equal(runtime.cameraCount, 1); assert.equal(runtime.canvasCount + runtime.sceneSvgCount, 0);
    assert.deepEqual(problems, []); assert.deepEqual(external, []);
    report.runtime.push({ dpr, ...runtime, loadedAndVerified: [...loaded].sort(), problems, external, measurement: "3 second rAF/CDP sample; not compositor frame-drop proof", frameCount: frames.length, frameP95Ms: [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)], taskDurationMs: (after.TaskDuration - before.TaskDuration) * 1000, layoutCount: after.LayoutCount - before.LayoutCount, recalcStyleCount: after.RecalcStyleCount - before.RecalcStyleCount });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(resolve(root, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output: root, browser: report.browser, runtime: report.runtime }, null, 2));
