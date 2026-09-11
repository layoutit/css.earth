#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { decodeElevationGrid, elevationRaster } from "../../unit/pluto/preparation-fixture.mts";
import { verifyPlutoSourceManifest } from "../../unit/pluto/preparation-fixture.mts";
import { readPreparedFixture } from '../../fixtures.mts';
import { shape, text, number, array, optional } from '../../../../tools/objects/geographic-pages/source-records.mts';
import { requireRecord } from '../../../../tools/source-values.mts';
import { required } from '../../../../tools/test-values.mts';
const PREPARED_PLUTO_LENSES = shape({controls:array(shape({id:text,surface2xUrl:text,poles2xUrl:text}))})(await readPreparedFixture('pluto', 'lenses'));
const PREPARED_PLUTO_SCENE = shape({body:shape({bands:array(shape({leaves:array(shape({style:text,projectiveTextureLayer:optional(shape({frameMatrix:text}))}))}))})})(await readPreparedFixture('pluto', 'scene'));

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4211";
assert.ok(process.argv[3], "Provide a fresh evidence directory.");
const root = resolve(process.argv[3]);
await mkdir(resolve(root, ".."), { recursive: true });
await mkdir(root); // Never silently overwrite prior evidence.
await verifyPlutoSourceManifest();
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await readFile(new URL("../../../../src/planets/pluto/runtime-assets.json", import.meta.url));
const manifest = shape({assets:array(shape({filename:text,bytes:number,sha256:text}))})(JSON.parse(manifestBytes.toString('utf8')));
const expected = new Map(manifest.assets.map((entry) => [entry.filename, entry]));
const source = shape({inputs:array(requireRecord)})(JSON.parse(await readFile(new URL("../../../../src/planets/pluto/source/manifest.json", import.meta.url),"utf8")));
const views: {dpr:number;lens:string;view:string;controlPitch:number;controlYaw:number;zoom:number;file:string;sha256:string}[]=[];
const runtimes: {dpr:number;loadedAndVerified:string[];[key:string]:unknown}[]=[];
const report = { browser: "", qualification: "SOURCE-BOUND BROWSER PRESENTATION; not native camera or pixel parity", baseUrl, capturedAt: new Date().toISOString(), channel: "chrome", headless: true, runtimeManifestSha256: sha(manifestBytes), preparedSceneSha256: sha(await readFile(new URL("../../../../src/planets/pluto/prepared/scene.json", import.meta.url))), sourceInputs: source.inputs, views, runtime:runtimes };

// Observation references, separate from browser captures: these are flat source
// products, so no misleading source-map-to-globe pixel-difference is reported.
for (const [id, file] of [["surface", "surface/pluto-color-mosaic.jpg"], ["monochrome", "lenses/pluto-monochrome.tif"]]) {
  await sharp(new URL(`../../../../src/planets/pluto/source/${file}`, import.meta.url).pathname, { limitInputPixels: false }).resize(1024, 512).png().toFile(resolve(root, `source-${id}.png`));
}
const elevation = elevationRaster(decodeElevationGrid(await readFile(new URL("../../../../src/planets/pluto/source/lenses/pluto-dem.tif", import.meta.url))), 1024, 512);
await sharp(elevation.data, { raw: elevation.info }).png().toFile(resolve(root, "source-topography-presentation.png"));

const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, reducedMotion: "reduce" });
    const page = await context.newPage();
    const problems: string[] = [], external: string[] = [], checks: Promise<unknown>[] = [], loaded = new Set<string>();
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("request", (request) => { if (new URL(request.url()).origin !== new URL(baseUrl).origin) external.push(request.url()); });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith("/scenes/pluto/")) return;
      if (response.status() >= 300 && response.status() < 400) return;
      checks.push((async () => {
        const file = required(url.pathname.split("/").at(-1)), pinned = expected.get(file);
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
    await page.evaluate(() => {
      function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
      function requiredInput(value: Element | null): HTMLInputElement { if (!(value instanceof HTMLInputElement)) throw new Error("Expected required HTMLInputElement"); return value; }
 (requiredInput(document.querySelector('input[name="motion"]')).checked && requiredInput(document.querySelector('input[name="motion"]')).click()); for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } });
    await page.screenshot({ path: resolve(root, `pluto-dpr${dpr}-shell.png`) });
    const pitch = await page.evaluate(() => {
      function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__pluto).camera.state().controlPitch; });
    const defaultZoom = await page.evaluate(() => {
      function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__pluto).camera.state().zoom; });
    const leaves = PREPARED_PLUTO_SCENE.body.bands.flatMap((band) => band.leaves);
    const published = await page.locator(".pluto-body > s").evaluateAll((elements, expected) => elements.map((element, index) => {
      if (!(element instanceof HTMLElement)) throw new Error("Prepared Pluto leaf must be HTML");
      const probe = document.createElement("s");
      probe.style.cssText = expected[index].style;
      if (expected[index].projectiveTextureLayer) probe.style.transform = `matrix3d(${expected[index].projectiveTextureLayer.frameMatrix})`;
      const texture = element.firstElementChild;
      if (texture && !(texture instanceof HTMLElement)) throw new Error("Prepared texture layer must be HTML");
      const m = texture && new DOMMatrix(texture.style.transform);
      return { matches: element.style.transform === probe.style.transform, children: element.childElementCount, affine: !m || (m.m14 === 0 && m.m24 === 0 && m.m44 === 1) };
    }), leaves);
    assert.equal(published.length, leaves.length);
    for (const [index, leaf] of leaves.entries()) {
      assert.deepEqual(published[index], { matches: true, children: leaf.projectiveTextureLayer ? 1 : 0, affine: true });
    }
    for (const lens of PREPARED_PLUTO_LENSES.controls) {
      await page.evaluate((id) => {
        function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__pluto).lenses.select(id); }, lens.id);
      for (const [view, controlPitch, controlYaw, zoom] of [["boundary", 0, 180, defaultZoom], ["rotated", 89, 110, defaultZoom], ["zoom", 34, 150, 2.2]] as const) {
        await page.evaluate((state) => {
          function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__pluto).camera.setState(state); }, { controlPitch, controlYaw, zoom });
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const file = `pluto-${lens.id}-${view}-dpr${dpr}.png`;
        if (view === "zoom") await page.screenshot({ path: resolve(root, file) });
        else await page.locator(".pluto-material").screenshot({ path: resolve(root, file) });
        report.views.push({ dpr, lens: lens.id, view, controlPitch, controlYaw, zoom, file, sha256: sha(await readFile(resolve(root, file))) });
      }
    }
    await page.evaluate((state) => {
      function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
 requiredDiagnostics(window.__pluto).camera.setState(state); return requiredDiagnostics(window.__pluto).lenses.select("surface"); }, { controlPitch: pitch, controlYaw: 0, zoom: defaultZoom });
    const before = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
    const frames = await page.evaluate(async () => {
      function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

      const samples: number[] = []; let previous = performance.now();
      requiredElement(document.querySelector(".planet-motion-setting")).click();
      await new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => { samples.push(now - previous); previous = now; if (now - start < 3000) requestAnimationFrame(tick); else resolve(); };
        requestAnimationFrame(tick);
      });
      requiredElement(document.querySelector(".planet-motion-setting")).click();
      return samples.slice(1);
    });
    const after = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
    const runtime = await page.evaluate(() => {
      function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

      function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return ({ stableDomIdentity: requiredDiagnostics(window.__pluto).assertStableDomIdentity(), nodes: requiredElement(document.querySelector(".planet-stage")).querySelectorAll<HTMLElement>("*").length, density: requiredDiagnostics(window.__pluto).renderStats.textureStats.selectedPreparedDensity, cameraCount: document.querySelectorAll<HTMLElement>(".polycss-camera").length, canvasCount: document.querySelectorAll<HTMLElement>("canvas").length, sceneSvgCount: document.querySelectorAll<HTMLElement>(".planet-stage svg").length }); });
    await Promise.all(checks);
    for (const lens of PREPARED_PLUTO_LENSES.controls) {
      assert.ok(loaded.has(required(lens.surface2xUrl.split("/").at(-1))));
      assert.ok(loaded.has(required(lens.poles2xUrl.split("/").at(-1))));
    }
    assert.equal(runtime.stableDomIdentity, true); assert.equal(runtime.density, 2); assert.equal(runtime.cameraCount, 1); assert.equal(runtime.canvasCount + runtime.sceneSvgCount, 0);
    assert.equal(runtime.nodes, 931);
    if (report.runtime.length) assert.deepEqual([...loaded].sort(), report.runtime[0].loadedAndVerified, "Display scaling changed the loaded asset bank");
    assert.deepEqual(problems, []); assert.deepEqual(external, []);
    report.runtime.push({ dpr, ...runtime, loadedAndVerified: [...loaded].sort(), loadedAssetHashes: Object.fromEntries([...loaded].sort().map(file => [file, required(expected.get(file)).sha256])), problems, external, measurement: "3 second rAF/CDP sample; not compositor frame-drop proof", frameCount: frames.length, frameP95Ms: [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)], taskDurationMs: (after.TaskDuration - before.TaskDuration) * 1000, layoutCount: after.LayoutCount - before.LayoutCount, recalcStyleCount: after.RecalcStyleCount - before.RecalcStyleCount });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(resolve(root, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output: root, browser: report.browser, runtime: report.runtime }, null, 2));
