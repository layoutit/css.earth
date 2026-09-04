#!/usr/bin/env node
// Matched paused-pose regression evidence, not native/source-renderer parity.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { OBJECTS } from "../site/objects.mjs";
import { loadPlanetBrowserProfile } from "../site/test/load-browser-profile.mjs";
import { compareCaptures, assertSceneCoverage } from "./object-contract-visual.mjs";
import { saturnSceneCoverage } from "./saturn-scene-coverage.mjs";

const [mode, baseUrl, sourceArgument, outputArgument] = process.argv.slice(2);
assert.ok(["baseline", "candidate"].includes(mode) && baseUrl && sourceArgument && outputArgument,
  "Use baseline|candidate BASE_URL SERVED_WORKTREE FRESH_EVIDENCE_DIRECTORY");
const sourceRoot = resolve(sourceArgument), root = resolve(outputArgument), output = resolve(root, mode);
await mkdir(root, { recursive: true });
await mkdir(output); // Refuse to overwrite evidence.
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = { protocol: "immutable-settled-readback-pairs@2", mode, sourceRoot, baseUrl, capturedAt: new Date().toISOString(), fingerprints: {}, sourceHashes: {}, captures: [], errors: [], comparisons: [] };
report.gitHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot, encoding: "utf8" }).trim();
report.gitStatus = execFileSync("git", ["status", "--porcelain"], { cwd: sourceRoot, encoding: "utf8" }).trim();
const platformFiles = (await readdir(resolve(sourceRoot, "src/platform")))
  .filter((name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs"))
  .sort().map((name) => `src/platform/${name}`);
for (const file of ["site/scene-router.mjs", "site/runtime-policy.mjs", "site/planet-shell-client.mjs", "site/planet-shell.css", "site/components/PlanetShell.astro", ...platformFiles]) {
  report.sourceHashes[file] = sha(await readFile(resolve(sourceRoot, file)));
}
const baseline = mode === "candidate" ? JSON.parse(await readFile(resolve(root, "baseline/report.json"))) : null;
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  if (baseline) {
    assert.deepEqual(baseline.errors, []);
    assert.equal(baseline.protocol, report.protocol);
    assert.equal(report.browser, baseline.browser);
  }
  for (const object of OBJECTS) {
    const packagePath = resolve(sourceRoot, `src/planets/${object.id}`);
    for (const file of (await readdir(resolve(packagePath, "runtime"))).sort()) {
      report.sourceHashes[`src/planets/${object.id}/runtime/${file}`] = sha(await readFile(resolve(packagePath, "runtime", file)));
    }
    const names = (await readdir(resolve(packagePath, "runtime")))
      .filter((name) => name.startsWith("prepared") && name !== "preparedRowCache.mjs").sort();
    const fingerprints = {};
    for (const file of ["runtime-assets.json", ...names.map((name) => `runtime/${name}`)]) {
      fingerprints[file] = sha(await readFile(resolve(packagePath, file)));
    }
    report.fingerprints[object.id] = fingerprints;
    if (baseline) assert.deepEqual(fingerprints, baseline.fingerprints[object.id], `${object.id}: prepared bytes unchanged`);
    const inventory = JSON.parse(await readFile(resolve(packagePath, "runtime-assets.json")));
    const expected = new Map(inventory.assets.map((asset) => [asset.filename, asset]));
    const profile = await loadPlanetBrowserProfile(object);
    for (const scale of [1, 2]) for (const width of [390, 1440]) for (const kind of ["shell", "scene"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: scale, reducedMotion: "reduce" });
      try {
        const page = await context.newPage(), checks = [], loaded = new Map();
        page.on("pageerror", (error) => report.errors.push(`${object.id}: ${error.message}`));
        page.on("response", (response) => {
          const pathname = new URL(response.url()).pathname;
          if (!pathname.startsWith(`/scenes/${object.id}/`) || response.status() >= 300 && response.status() < 400) return;
          checks.push((async () => {
            const asset = expected.get(pathname.split("/").at(-1));
            assert.ok(asset, `Undeclared asset ${pathname}`);
            const bytes = await response.body();
            assert.equal(bytes.length, asset.bytes, pathname);
            assert.equal(sha(bytes), asset.sha256, pathname);
            loaded.set(pathname, asset.sha256);
          })().catch((error) => report.errors.push(error.message)));
        });
        if (kind === "scene") await page.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => {
            const style = document.createElement("style");
            style.textContent = "body > :not(.planet-stage):not(script):not(style), .planet-stage ~ * { visibility:hidden!important } .planet-stage { visibility:visible!important }";
            document.head.appendChild(style);
          }, { once: true });
        });
        await page.goto(new URL(object.route, baseUrl).href, { waitUntil: "networkidle" });
        await page.waitForFunction(() => window.__cssEarth?.ready);
        await profile.waitForRuntime(page);
        await profile.pause(page);
        await page.evaluate(async () => {
          for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 0; }
          await document.fonts.ready;
          await Promise.all([...document.images].filter((image) => image.currentSrc).map((image) => image.decode()));
        });
        assert.equal(await profile.selectedDensity(page), 2, "Canonical highest-density bank");
        assert.equal(await profile.stable(page), true);
        const prefix = `${object.id}-${width}-scale${scale}`;
        const capture = async (target, scene) => {
          let previous = null, matches = 0;
          const history = [];
          for (let attempts = 1; attempts <= 24; attempts++) {
            // Preserve both ordered native readbacks. Some paused Chrome
            // layers alternate A/B by one color level; never choose a phase.
            // Settle before EACH readback and avoid per-shot caret style
            // mutations. Immediate repeated captures can contain missing
            // raster tiles even on the unchanged baseline.
            const frames = [];
            for (let phase = 0; phase < 2; phase++) {
              await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
              await page.waitForTimeout(100);
              frames.push(await target.screenshot({ caret: "initial" }));
            }
            history.push(...frames);
            matches = previous && frames.every((png, index) => png.equals(previous[index])) ? matches + 1 : 1;
            previous = frames;
            if (matches >= 3) {
              const validation = [];
              for (const png of frames) {
                if (object.id === "saturn" && scene) validation.push(await assertSceneCoverage(png, saturnSceneCoverage(width, scale)));
              }
              assert.equal(await page.locator(".planet-stage .polycss-camera").count(), 1);
              assert.ok(await page.locator(".planet-stage *").count() > 20);
              const framesPath = resolve(output, `${prefix}-${kind}-frames`);
              await mkdir(framesPath);
              for (const [index, png] of history.slice(-6).entries()) {
                await writeFile(resolve(framesPath, `frame_${String(index).padStart(4, "0")}.png`), png);
              }
              return { frames, attempts, validation };
            }
          }
          for (const [index, png] of history.slice(-6).entries()) await writeFile(resolve(output, `${prefix}-${kind}-unstable-${index}.png`), png);
          throw new Error(`INVALID ${prefix}-${kind}: no repeated ordered readback pair in 24 attempts`);
        };
        // Use an immutable capture condition in a fresh context. Toggling
        // overlays on an already rasterized page changes Chrome's layer
        // readback at a few dark pixels despite an unchanged paused state.
        const frame = await capture(kind === "scene" ? page.locator(".planet-stage") : page, kind === "scene");
        await Promise.all(checks);
        assert.ok(loaded.size > 0, `${prefix}: loaded bytes verified`);
        const loadedAssets = Object.fromEntries([...loaded].sort(([a], [b]) => a.localeCompare(b)));
        const record = { prefix, kind, loadedAssets, frameSha256s: frame.frames.map(sha), coverage: frame.validation, captureAttempts: frame.attempts };
        report.captures.push(record);
        for (const [phase, png] of frame.frames.entries()) {
          const filename = `${prefix}-${kind}${phase ? "-phase1" : ""}.png`;
          await writeFile(resolve(output, filename), png);
          if (baseline) {
            const reference = baseline.captures.find((entry) => entry.prefix === prefix && entry.kind === kind);
            assert.ok(reference, prefix);
            assert.deepEqual(loadedAssets, reference.loadedAssets, `${prefix}: loaded identity`);
            const bytes = await readFile(resolve(root, "baseline", filename));
            assert.equal(sha(bytes), reference.frameSha256s[phase]);
            const { diff, ...comparison } = await compareCaptures(bytes, png);
            await writeFile(resolve(output, `${prefix}-${kind}-phase${phase}-absolute-diff.png`), diff);
            report.comparisons.push({ prefix, kind, phase, ...comparison });
          }
        }
        console.log(`${mode}: ${prefix}-${kind}`);
      } finally { await context.close(); }
    }
  }
  for (const [file, hash] of Object.entries(report.sourceHashes)) {
    assert.equal(sha(await readFile(resolve(sourceRoot, file))), hash, `Source changed during capture: ${file}`);
  }
  if (baseline) assert.ok(report.comparisons.every(({ changedPixels }) => changedPixels === 0), "Unintended pixels changed; inspect absolute differences.");
} catch (error) { report.errors.push(error.stack); process.exitCode = 1; }
finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ output, captures: report.captures.length, errors: report.errors }));
if (report.errors.length) process.exitCode = 1;
