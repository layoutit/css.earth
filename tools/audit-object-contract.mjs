#!/usr/bin/env node
// Fresh scene AND shell evidence, with bounded stable-capture checks.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { compareCaptures, stableCapture } from "./object-contract-visual.mjs";

const mode = process.argv[2];
assert.ok(["baseline", "candidate"].includes(mode));
const baseUrl = process.argv[3] ?? "http://127.0.0.1:4211";
// Pass the served worktree explicitly when the server is not this checkout.
const sourceRoot = resolve(process.argv[4] ?? ".");
assert.ok(process.argv[5], "Provide a fresh evidence directory shared by the baseline and candidate runs.");
const root = resolve(process.argv[5]);
const output = resolve(root, mode);
await mkdir(root, { recursive: true });
await mkdir(output); // Never overwrite earlier evidence, including invalid runs.
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = ["runtime-assets.json", ...(await readdir(resolve(sourceRoot, "src/planets/saturn/runtime"))).sort().map((file) => `runtime/${file}`)];
const fingerprints = Object.fromEntries(await Promise.all(files.map(async (file) =>
  [file, sha(await readFile(resolve(sourceRoot, `src/planets/saturn/${file}`)))])));
const assets = JSON.parse(await readFile(resolve(sourceRoot, "src/planets/saturn/runtime-assets.json")));
const expectedAssets = new Map(assets.assets.map((asset) => [asset.filename, asset]));
const errors = [];
const captures = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const dpr of [1, 2]) {
    for (const width of [390, 820, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr, reducedMotion: "reduce" });
      const page = await context.newPage();
      const checks = [], verifiedAssets = new Set();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        const path = new URL(response.url()).pathname;
        if (!path.startsWith("/scenes/saturn/") || response.status() >= 300 && response.status() < 400) return;
        checks.push((async () => {
          const filename = path.split("/").at(-1), expected = expectedAssets.get(filename);
          assert.ok(expected, `Undeclared Saturn asset: ${filename}`);
          const bytes = await response.body();
          assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.sha256);
          verifiedAssets.add(filename);
        })().catch((error) => errors.push(error.message)));
      });
      await page.goto(`${baseUrl}/saturn/`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__saturn?.ready && window.__cssEarth?.ready);
      await page.evaluate(() => { window.__saturn.pause(); for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].filter((image) => image.currentSrc).map((image) => image.decode()));
      });
      const prefix = `saturn-${width}-dpr${dpr}`;
      const markerRegions = await page.locator(".planet-navigation-marker > i, .scale-marker").evaluateAll((elements) => elements.filter((element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).map((element) => {
        const rect = element.getBoundingClientRect(), scale = devicePixelRatio;
        // Chrome's antialias coverage can extend one physical pixel beyond the
        // logical marker box. This fixed fringe is not a scene-diff tolerance.
        const x = Math.max(0, Math.floor(rect.x * scale) - 1), y = Math.max(0, Math.floor(rect.y * scale) - 1);
        return { x, y, width: Math.min(innerWidth * scale, Math.ceil(rect.right * scale) + 1) - x, height: Math.min(innerHeight * scale, Math.ceil(rect.bottom * scale) + 1) - y };
      }));
      assert.ok(markerRegions.length > 0 && markerRegions.length <= 9, "Unexpected visible marker count");
      assert.ok(markerRegions.every((region) => region.width <= 32 * dpr + 2 && region.height <= 32 * dpr + 2), "Marker exclusions must stay small");
      const stage = page.locator(".planet-stage");
      const settle = async () => {
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.waitForTimeout(100);
      };
      const stable = async (target, label) => {
        const frames = [];
        try {
          return await stableCapture(async () => {
            await settle();
            const png = await target.screenshot();
            frames.push(png);
            return png;
          });
        } catch (error) {
          for (const [index, png] of frames.entries()) await writeFile(resolve(output, `${prefix}-${label}-unstable-${index}.png`), png);
          throw new Error(`INVALID ${prefix} ${label}: ${error.message}`, { cause: error });
        }
      };
      const captureAttempts = [];
      let accepted;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const shell = await stable(page, `shell-${attempt}`);
        // Hide only shell overlays. The scene is compared with no exclusions.
        const hidden = await page.addStyleTag({ content: "body > :not(.planet-stage):not(script):not(style), .planet-stage ~ * { visibility:hidden!important } .planet-stage { visibility:visible!important }" });
        let scene;
        try { scene = await stable(stage, `scene-${attempt}`); }
        finally { await hidden.evaluate((element) => element.remove()); }
        const restored = await stable(page, `restored-${attempt}`);
        const roundTrip = await compareCaptures(shell.png, restored.png);
        captureAttempts.push({ attempt, shell: shell.attempts, scene: scene.attempts, restored: restored.attempts, roundTripChangedPixels: roundTrip.changedPixels });
        if (roundTrip.changedPixels === 0) { accepted = { shell, scene }; break; }
        await writeFile(resolve(output, `${prefix}-rejected-${attempt}-shell.png`), shell.png);
        await writeFile(resolve(output, `${prefix}-rejected-${attempt}-restored.png`), restored.png);
      }
      assert.ok(accepted, `INVALID shell capture: ${prefix} changes after scene-only capture`);
      await writeFile(resolve(output, `${prefix}-shell.png`), accepted.shell.png);
      await writeFile(resolve(output, `${prefix}-scene.png`), accepted.scene.png);
      await Promise.all(checks);
      assert.ok(verifiedAssets.size > 0, "No Saturn browser asset bytes verified");
      const loadedAssets = [...verifiedAssets].sort();
      if (captures.length) assert.deepEqual(loadedAssets, captures[0].verifiedAssets, "Viewport or screen scaling changed the selected Saturn asset bank");
      captures.push({ prefix, shellSha256: sha(accepted.shell.png), sceneSha256: sha(accepted.scene.png), markerRegions, captureAttempts, verifiedAssets: loadedAssets });
      await context.close();
    }
  }
} catch (error) { errors.push(error.stack); }
finally { await browser.close(); }
const report = { mode, baseUrl, sourceRoot, capturedAt: new Date().toISOString(), browser: browser.version(), channel: "chrome", headless: true, markerRasterFringePhysicalPixels: 1, fingerprints, captures, errors, comparisons: [] };
try { if (mode === "candidate" && errors.length === 0) {
  const baseline = JSON.parse(await readFile(resolve(root, "baseline/report.json")));
  assert.equal(baseline.errors.length, 0, "Baseline has browser or asset errors");
  assert.equal(report.markerRasterFringePhysicalPixels, baseline.markerRasterFringePhysicalPixels, "Marker comparison protocol changed");
  assert.deepEqual(fingerprints, baseline.fingerprints, "Saturn prepared/runtime bytes changed");
  assert.equal(report.browser, baseline.browser, "Chrome version changed");
  assert.deepEqual(captures.map(({ prefix }) => prefix), baseline.captures.map(({ prefix }) => prefix));
  for (const capture of captures) {
    const { prefix, markerRegions } = capture;
    const reference = baseline.captures.find((entry) => entry.prefix === prefix);
    assert.deepEqual(markerRegions, reference.markerRegions, `Marker geometry changed: ${prefix}`);
    assert.deepEqual(capture.verifiedAssets, reference.verifiedAssets, `Loaded asset selection changed: ${prefix}`);
    for (const kind of ["scene", "shell"]) {
      const a = await readFile(resolve(root, "baseline", `${prefix}-${kind}.png`));
      const b = await readFile(resolve(output, `${prefix}-${kind}.png`));
      assert.equal(sha(a), reference[`${kind}Sha256`], "Baseline capture bytes changed");
      const { diff, ...comparison } = await compareCaptures(a, b, kind === "shell" ? markerRegions : []);
      await writeFile(resolve(output, `${prefix}-${kind}-absolute-diff.png`), diff);
      report.comparisons.push({ prefix, kind, ...comparison });
    }
  }
} } catch (error) { errors.push(error.stack); }
await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
assert.equal(errors.length, 0);
assert.equal(captures.length, 6);
assert.ok(report.comparisons.every(({ unexpectedPixels }) => unexpectedPixels === 0), "Unintended scene or shell pixels changed");
