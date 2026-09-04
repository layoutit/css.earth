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
const report = { protocol: "immutable-headless-native-readback-pairs@4", mode, sourceRoot, baseUrl, capturedAt: new Date().toISOString(), headless: true, fingerprints: {}, sourceHashes: {}, harnessHashes: {}, expectedCaptureCount: 0, captures: [], errors: [], comparisons: [] };
const harnessRoot = resolve(import.meta.dirname, "..");
// Include repository code/data imported indirectly by the registry, profiles,
// controls, and prepared-state modules. Dependencies are pinned by the lockfile.
const harnessFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "site", "src", "tools", "package.json", "pnpm-lock.yaml"], { cwd: harnessRoot, encoding: "utf8" })
  .split("\0").filter((file) => /\.(?:[cm]?js|ts|json|astro|css|ya?ml)$/.test(file));
for (const file of [...new Set(harnessFiles)].sort()) {
  report.harnessHashes[file] = sha(await readFile(resolve(harnessRoot, file)));
}
report.gitHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot, encoding: "utf8" }).trim();
report.gitStatus = execFileSync("git", ["status", "--porcelain"], { cwd: sourceRoot, encoding: "utf8" }).trim();
const platformFiles = (await readdir(resolve(sourceRoot, "src/platform")))
  .filter((name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs"))
  .sort().map((name) => `src/platform/${name}`);
for (const file of ["site/scene-router.mjs", "site/runtime-policy.mjs", "site/planet-shell-client.mjs", "site/planet-shell.css", "site/components/PlanetShell.astro", ...platformFiles]) {
  report.sourceHashes[file] = sha(await readFile(resolve(sourceRoot, file)));
}
const baseline = mode === "candidate" ? JSON.parse(await readFile(resolve(root, "baseline/report.json"))) : null;
// Keep the native scrollbar out of the content viewport. Captures are always
// headless; the audit must not open windows on the user's desktop.
report.browserArgs = ["--hide-scrollbars"];
let browser, browserSession;
async function gpuProof() {
  const { gpu } = await browserSession.send("SystemInfo.getInfo");
  assert.equal(gpu.featureStatus.gpu_compositing, "enabled", "Native GPU composition required");
  assert.equal(gpu.featureStatus.rasterization, "enabled", "Native GPU rasterization required");
  assert.equal(gpu.auxAttributes.processCrashCount, 0, "GPU crash invalidates capture evidence");
  const renderer = gpu.auxAttributes.glRenderer;
  const hardware = /\b(?:Apple|NVIDIA|AMD|ATI|Intel|Qualcomm|Adreno|Mali|PowerVR)\b/i;
  assert.equal(typeof renderer, "string", "Renderer identity is required");
  assert.doesNotMatch(renderer, /SwiftShader|llvmpipe|softpipe|software|\bWARP\b|Microsoft Basic/i,
    "Software rendering cannot qualify the native-GPU audit");
  assert.match(renderer, hardware, "A recognized hardware renderer is required");
  assert.ok(gpu.devices.some(({ vendorString, deviceString }) =>
    hardware.test(`${vendorString ?? ""} ${deviceString ?? ""}`)),
  "A hardware device identity is required");
  return {
    devices: gpu.devices,
    compositor: gpu.featureStatus.gpu_compositing,
    rasterization: gpu.featureStatus.rasterization,
    renderer: gpu.auxAttributes.glRenderer,
    backend: gpu.auxAttributes.skiaBackendType,
    processCrashCount: gpu.auxAttributes.processCrashCount,
  };
}
try {
  browser = await chromium.launch({ channel: "chrome", headless: true, args: report.browserArgs });
  report.browser = browser.version();
  browserSession = await browser.newBrowserCDPSession();
  if (baseline) {
    assert.deepEqual(baseline.errors, []);
    assert.equal(baseline.protocol, report.protocol);
    assert.equal(report.browser, baseline.browser);
    assert.equal(report.headless, baseline.headless, "Match window presentation mode");
    assert.deepEqual(report.browserArgs, baseline.browserArgs);
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
    const testPath = resolve(import.meta.dirname, `../src/planets/${object.id}/test`);
    const hasExtraPoses = (await readdir(testPath)).includes("visual-poses.mjs");
    for (const file of ["browser-profile.mjs", ...(hasExtraPoses ? ["visual-poses.mjs"] : [])]) {
      assert.ok(Object.hasOwn(report.harnessHashes, `src/planets/${object.id}/test/${file}`),
        "Visual profiles must belong to the starting harness snapshot");
    }
    const extraPoses = hasExtraPoses
      ? (await import(new URL(`../src/planets/${object.id}/test/visual-poses.mjs`, import.meta.url))).visualPoses
      : [];
    assert.ok(Array.isArray(extraPoses));
    for (const pose of extraPoses) {
      assert.match(pose.id, /^[a-z][a-z0-9-]+$/);
      assert.notEqual(pose.id, "default");
      assert.equal(typeof pose.apply, "function");
    }
    assert.equal(new Set(extraPoses.map(({ id }) => id)).size, extraPoses.length);
    report.expectedCaptureCount += 8 + 4 * extraPoses.length;
    for (const scale of [1, 2]) for (const width of [390, 1440]) for (const kind of ["shell", "scene"])
      for (const pose of [{ id: "default" }, ...(kind === "scene" ? extraPoses : [])]) {
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
        await page.mouse.move(0, 0);
        await page.evaluate(async () => {
          for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 0; }
          await document.fonts.ready;
          await Promise.all([...document.images].filter((image) => image.currentSrc).map((image) => image.decode()));
        });
        const poseState = pose.apply ? await pose.apply(page) : null;
        if (pose.apply) await page.waitForLoadState("networkidle");
        assert.equal(await profile.selectedDensity(page), 2, "Canonical highest-density bank");
        assert.equal(await profile.stable(page), true);
        const gpuBefore = await gpuProof();
        const versionLabel = await page.locator(".planet-wordmark-version").textContent();
        const prefix = `${object.id}-${width}-scale${scale}${pose.id === "default" ? "" : `-${pose.id}`}`;
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
        const gpuAfter = await gpuProof();
        assert.deepEqual(gpuAfter, gpuBefore, "GPU identity must remain stable during capture");
        const record = { prefix, kind, pose: pose.id, poseState, loadedAssets, versionLabel, gpu: gpuAfter, frameSha256s: frame.frames.map(sha), coverage: frame.validation, captureAttempts: frame.attempts };
        report.captures.push(record);
        for (const [phase, png] of frame.frames.entries()) {
          const filename = `${prefix}-${kind}${phase ? "-phase1" : ""}.png`;
          await writeFile(resolve(output, filename), png);
          if (baseline) {
            const reference = baseline.captures.find((entry) => entry.prefix === prefix && entry.kind === kind);
            assert.ok(reference, prefix);
            assert.deepEqual(poseState, reference.poseState, `${prefix}: matched camera/lens pose`);
            assert.deepEqual(loadedAssets, reference.loadedAssets, `${prefix}: loaded identity`);
            assert.equal(versionLabel, reference.versionLabel, `${prefix}: match rendered build metadata`);
            assert.deepEqual(gpuAfter, reference.gpu, `${prefix}: match native GPU identity`);
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
  for (const [file, hash] of Object.entries(report.harnessHashes)) {
    assert.equal(sha(await readFile(resolve(harnessRoot, file))), hash, `Harness changed during capture: ${file}`);
  }
  assert.equal(report.captures.length, report.expectedCaptureCount, "Complete visual matrix required");
  assert.equal(new Set(report.captures.map(({ prefix, kind }) => `${prefix}-${kind}`)).size, report.captures.length);
  if (baseline) {
    assert.deepEqual(report.harnessHashes, baseline.harnessHashes, "Match recorded repository harness inputs");
    assert.equal(report.expectedCaptureCount, baseline.expectedCaptureCount);
    assert.equal(report.comparisons.length, report.expectedCaptureCount * 2);
    assert.ok(report.comparisons.every(({ changedPixels }) => changedPixels === 0), "Unintended pixels changed; inspect absolute differences.");
  }
} catch (error) { report.errors.push(error.stack); process.exitCode = 1; }
finally {
  try { await browserSession?.detach(); }
  catch (error) { report.errors.push(`CDP cleanup: ${error.message}`); }
  try { await browser?.close(); }
  catch (error) { report.errors.push(`Browser cleanup: ${error.message}`); }
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ output, captures: report.captures.length, errors: report.errors }));
if (report.errors.length) process.exitCode = 1;
