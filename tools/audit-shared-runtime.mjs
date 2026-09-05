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
import {
  snapshotAuditSources, verifyAuditSource, assertAuditResponse,
} from "./audit-source-identity.mjs";
import { captureFixedReadbacks } from "./readback-sequence.mjs";
import { runtimeAuditPoses } from "./runtime-audit-poses.mjs";

const [mode, baseUrl, sourceArgument, outputArgument, ...options] = process.argv.slice(2);
assert.ok(["baseline", "candidate"].includes(mode) && baseUrl && sourceArgument && outputArgument,
  "Use baseline|candidate BASE_URL SERVED_WORKTREE FRESH_EVIDENCE_DIRECTORY [--report-only] [--runtime-matrix] [--object ID] [--reference BASELINE_DIRECTORY]");
let reportOnly = false, runtimeMatrix = false, objectId, referenceDirectory;
for (let index = 0; index < options.length; index++) {
  const option = options[index];
  if (option === "--report-only") reportOnly = true;
  else if (option === "--runtime-matrix") runtimeMatrix = true;
  else if (option === "--object") objectId = options[++index];
  else if (option === "--reference") referenceDirectory = options[++index];
  else throw new Error(`Unknown audit option: ${option}`);
}
const objects = OBJECTS.filter(({ id }) => objectId === undefined || id === objectId);
assert.ok(objects.length, "Select an existing object");
assert.ok(!referenceDirectory || mode === "candidate", "Only a candidate can select a reference");
const sourceRoot = resolve(sourceArgument), root = resolve(outputArgument), output = resolve(root, mode);
await mkdir(root, { recursive: true });
await mkdir(output); // Refuse to overwrite evidence.
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = { protocol: "immutable-headless-native-readback-pairs@5", mode, sourceRoot, baseUrl, capturedAt: new Date().toISOString(), headless: true, fingerprints: {}, sourceHashes: {}, harnessHashes: {}, expectedCaptureCount: 0, captures: [], errors: [], comparisons: [] };
if (reportOnly) {
  report.protocol = "report-only-fixed-six-native-readbacks@3";
  report.qualification = "Diagnostic only; does not satisfy the strict acceptance gate.";
}
report.reportOnly = reportOnly;
report.runtimeMatrix = runtimeMatrix;
report.objectIds = objects.map(({ id }) => id);
report.scenarios = {};
report.complete = false;
report.repeatabilityFailures = [];
report.visualFailures = [];
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
const referenceRoot = resolve(referenceDirectory ?? resolve(root, "baseline"));
const baseline = mode === "candidate" ? JSON.parse(await readFile(resolve(referenceRoot, "report.json"))) : null;
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
  const sourceSnapshot = await snapshotAuditSources(sourceRoot);
  report.sourceIdentity = await verifyAuditSource(baseUrl, sourceSnapshot);
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
  for (const object of objects) {
    const packagePath = resolve(sourceRoot, `src/planets/${object.id}`);
    for (const file of (await readdir(resolve(packagePath, "runtime"))).sort()) {
      report.sourceHashes[`src/planets/${object.id}/runtime/${file}`] = sha(await readFile(resolve(packagePath, "runtime", file)));
    }
    const names = (await readdir(resolve(packagePath, "runtime")))
      .filter((name) => name.startsWith("prepared") && name !== "preparedRowCache.mjs").sort();
    const fingerprints = {};
    for (const file of ["runtime-assets.json", ...names.map((name) => `runtime/${name}`)]) {
      fingerprints[file] = sha(await readFile(resolve(packagePath, file)));
      report.sourceHashes[`src/planets/${object.id}/${file}`] = fingerprints[file];
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
    const sourcePoses = hasExtraPoses
      ? (await import(new URL(`../src/planets/${object.id}/test/visual-poses.mjs`, import.meta.url))).visualPoses
      : [];
    const extraPoses = [...sourcePoses, ...(runtimeMatrix ? runtimeAuditPoses(profile) : [])];
    assert.ok(Array.isArray(extraPoses));
    for (const pose of extraPoses) {
      assert.match(pose.id, /^[a-z][a-z0-9-]+$/);
      assert.notEqual(pose.id, "default");
      assert.equal(typeof pose.apply, "function");
    }
    assert.equal(new Set(extraPoses.map(({ id }) => id)).size, extraPoses.length);
    report.scenarios[object.id] = { dprs: [1, 2], defaultWidths: [390, 1440],
      poseWidths: runtimeMatrix ? [1440] : [390, 1440], poses: extraPoses.map(({ id }) => id) };
    report.expectedCaptureCount += 8 + (runtimeMatrix ? 2 : 4) * extraPoses.length;
    for (const scale of [1, 2]) for (const width of [390, 1440]) for (const kind of ["shell", "scene"])
      for (const pose of [{ id: "default" }, ...(kind === "scene" ? extraPoses : [])]) {
      if (runtimeMatrix && width !== 1440 && pose.id !== "default") continue;
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: scale, reducedMotion: "reduce" });
      try {
        const page = await context.newPage(), checks = [], loaded = new Map(), loadedCode = new Map();
        page.on("pageerror", (error) => report.errors.push(`${object.id}: ${error.message}`));
        page.on("response", (response) => {
          checks.push((async () => {
            const url = new URL(response.url());
            const pathname = url.pathname;
            assertAuditResponse({ url: response.url(), status: response.status(),
              headers: await response.allHeaders() }, baseUrl, report.sourceIdentity);
            if (pathname.startsWith(`/scenes/${object.id}/`)) {
              const asset = expected.get(pathname.split("/").at(-1));
              assert.ok(asset, `Undeclared asset ${pathname}`);
              const bytes = await response.body();
              assert.equal(bytes.length, asset.bytes, pathname);
              assert.equal(sha(bytes), asset.sha256, pathname);
              loaded.set(pathname, asset.sha256);
            } else if (["document", "script", "stylesheet"].includes(response.request().resourceType())) {
              const key = pathname + url.search;
              const hash = sha(await response.body());
              if (loadedCode.has(key)) assert.equal(loadedCode.get(key), hash, `Application response changed: ${key}`);
              loadedCode.set(key, hash);
            }
          })().catch((error) => report.errors.push(error.message)));
        });
        if (kind === "scene") await page.addInitScript(({ inputSelector }) => {
          document.addEventListener("DOMContentLoaded", () => {
            const style = document.createElement("style");
            // The transparent input surface must remain hit-testable for the
            // native gesture cases; hiding shell pixels must not disable input.
            style.textContent = `body > :not(.planet-stage):not(script):not(style):not(${inputSelector}), .planet-stage ~ :not(${inputSelector}) { visibility:hidden!important } .planet-stage { visibility:visible!important }`;
            document.head.appendChild(style);
          }, { once: true });
        }, { inputSelector: profile.inputSelector });
        await page.goto(new URL(object.route, baseUrl).href, { waitUntil: "networkidle" });
        await page.waitForFunction(() => window.__cssEarth?.ready);
        await profile.waitForRuntime(page);
        await profile.pause(page);
        await page.mouse.move(0, 0);
        await page.evaluate(async () => {
          for (const animation of document.getAnimations()) {
            animation.pause();
            // CSS rotation is clock-driven. A prepared WAAPI pose can be
            // camera-addressed, so resetting its time would change the view.
            if (animation instanceof CSSAnimation) animation.currentTime = 0;
          }
          await document.fonts.ready;
          await Promise.all([...document.images].filter((image) => image.currentSrc).map((image) => image.decode()));
        });
        const poseState = pose.apply ? await pose.apply(page) : null;
        if (pose.apply) await page.waitForLoadState("networkidle");
        // Lazy prepared components can register animations during selection.
        // Every comparison uses the same native phase, including those handles.
        if (runtimeMatrix) await page.evaluate(() => {
          for (const animation of document.getAnimations()) {
            animation.pause();
            if (animation instanceof CSSAnimation) animation.currentTime = 0;
          }
        });
        const observedPose = reportOnly ? {
          camera: await profile.camera(page),
          lens: (await profile.lens(page)).id,
          visibleLens: await profile.visibleLens(page),
          cameraTransform: await page.locator(".planet-stage .polycss-camera").evaluate((camera) => ({
            transform: getComputedStyle(camera).transform,
            perspective: getComputedStyle(camera).perspective,
            transformOrigin: getComputedStyle(camera).transformOrigin,
          })),
        } : null;
        if (reportOnly) {
          assert.ok(Number.isFinite(observedPose.camera.pitch) && Number.isFinite(observedPose.camera.zoom));
          assert.equal(typeof observedPose.lens, "string");
          assert.equal(observedPose.visibleLens, observedPose.lens);
        }
        assert.equal(await profile.selectedDensity(page), 2, "Canonical highest-density bank");
        assert.equal(await profile.stable(page), true);
        const gpuBefore = await gpuProof();
        const versionLabel = await page.locator(".planet-wordmark-version, .explorer-about-row:first-child .explorer-about-link-destination").textContent();
        const prefix = `${object.id}-${width}-scale${scale}${pose.id === "default" ? "" : `-${pose.id}`}`;
        const capture = async (target, scene) => {
          if (reportOnly) {
            // Fixed schedule, not a favorable-frame search. Preserve every
            // measured frame even when the stream cannot qualify as repeatable.
            const framesPath = resolve(output, `${prefix}-${kind}-frames`);
            await mkdir(framesPath);
            await page.waitForTimeout(2_000);
            const validation = [], stateHashes = [];
            const sequence = await captureFixedReadbacks({
              snapshot: () => page.evaluate(() => {
                const stage = document.querySelector(".planet-stage");
                const properties = ["transform", "transformOrigin", "width", "height",
                  "backgroundImage", "backgroundPosition", "backgroundSize", "opacity",
                  "display", "visibility", "perspective", "perspectiveOrigin", "clipPath"];
                return {
                  cameras: stage.querySelectorAll(".polycss-camera").length,
                  nodes: [stage, ...stage.querySelectorAll("*")].map((node) => {
                    const style = getComputedStyle(node);
                    return [node.tagName, [...node.attributes].map(({ name, value }) => [name, value]),
                      properties.map((property) => style[property])];
                  }),
                  animations: document.getAnimations().map((animation) => ({
                    time: animation.currentTime, state: animation.playState,
                    pending: animation.pending, rate: animation.playbackRate,
                  })),
                };
              }),
              capture: async () => {
                await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
                await page.waitForTimeout(100);
                return target.screenshot({ caret: "initial" });
              },
              validate: async (png, phase) => {
                if (object.id === "saturn" && scene && pose.id === "default") {
                  try {
                    validation.push(await assertSceneCoverage(png, saturnSceneCoverage(width, scale)));
                  } catch (error) {
                    // Report every missing-region frame, then measure the rest.
                    // This mode always fails qualification; the strict path
                    // below still throws immediately on incomplete coverage.
                    const failure = { prefix, kind, phase, error: error.message };
                    report.visualFailures.push(failure);
                    validation.push({ failed: true, ...failure });
                  }
                }
              },
              onFrame: async ({ index, image, before, after }) => {
                await writeFile(resolve(framesPath, `frame_${String(index).padStart(4, "0")}.png`), image);
                const beforeBytes = JSON.stringify(before), afterBytes = JSON.stringify(after);
                stateHashes.push({ before: sha(beforeBytes), after: sha(afterBytes) });
                if (index === 0) await writeFile(resolve(framesPath, "state.json"), beforeBytes + "\n");
                await writeFile(resolve(framesPath, "state-hashes.json"), JSON.stringify(stateHashes) + "\n");
                if (beforeBytes !== afterBytes) {
                  await writeFile(resolve(framesPath, `frame_${index}-changed-state.json`),
                    JSON.stringify({ before, after }) + "\n");
                }
              },
            });
            assert.equal(sequence.state.cameras, 1);
            assert.ok(sequence.state.nodes.length > 20);
            if (!sequence.repeatablePairs) report.repeatabilityFailures.push(`${prefix}-${kind}`);
            return { frames: sequence.frames, attempts: 3, validation,
              repeatable: sequence.repeatablePairs, stateHashes };
          }
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
                if (object.id === "saturn" && scene && pose.id === "default") validation.push(await assertSceneCoverage(png, saturnSceneCoverage(width, scale)));
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
        assert.deepEqual(report.errors, [], "Every response must belong to the recorded audit server");
        await verifyAuditSource(baseUrl, sourceSnapshot, report.sourceIdentity.session);
        assert.ok(loadedCode.size > 0, `${prefix}: application response bytes verified`);
        const loadedApplication = Object.fromEntries([...loadedCode].sort(([a], [b]) => a.localeCompare(b)));
        assert.ok(loaded.size > 0, `${prefix}: loaded bytes verified`);
        const loadedAssets = Object.fromEntries([...loaded].sort(([a], [b]) => a.localeCompare(b)));
        const gpuAfter = await gpuProof();
        assert.deepEqual(gpuAfter, gpuBefore, "GPU identity must remain stable during capture");
        const runtimeObservation = runtimeMatrix ? await page.evaluate((id) => {
          const runtime = window[`__${id}`];
          return {
            renderStats: runtime.renderStats, dom: runtime.dom,
            camera: runtime.camera.stats(), options: runtime.options?.state(),
            features: runtime.features?.state(), input: window.__runtimeAuditInput ?? null,
            animations: document.querySelector(".planet-stage").getAnimations({ subtree: true }).map((animation) => ({
              target: animation.effect?.target?.className, name: animation.animationName,
              timing: animation.effect?.getTiming(), rate: animation.playbackRate,
              time: animation.currentTime, state: animation.playState,
            })),
          };
        }, object.id) : null;
        const record = { prefix, kind, pose: pose.id, poseState, loadedAssets, loadedApplication, versionLabel, gpu: gpuAfter, frameSha256s: frame.frames.map(sha), coverage: frame.validation, captureAttempts: frame.attempts,
          ...(runtimeMatrix ? { runtimeObservation } : {}),
          ...(reportOnly ? { observedPose, repeatable: frame.repeatable, stateHashes: frame.stateHashes } : {}) };
        report.captures.push(record);
        for (const [phase, png] of frame.frames.entries()) {
          const filename = `${prefix}-${kind}${phase ? `-phase${phase}` : ""}.png`;
          await writeFile(resolve(output, filename), png);
          if (baseline) {
            const reference = baseline.captures.find((entry) => entry.prefix === prefix && entry.kind === kind);
            assert.ok(reference, prefix);
            assert.deepEqual(poseState, reference.poseState, `${prefix}: matched camera/lens pose`);
            if (reportOnly) assert.deepEqual(observedPose, reference.observedPose,
              `${prefix}: matched observed camera and lens`);
            assert.deepEqual(loadedAssets, reference.loadedAssets, `${prefix}: loaded identity`);
            assert.equal(versionLabel, reference.versionLabel, `${prefix}: match rendered build metadata`);
            assert.deepEqual(gpuAfter, reference.gpu, `${prefix}: match native GPU identity`);
            const bytes = await readFile(resolve(referenceRoot, filename));
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
  await verifyAuditSource(baseUrl, sourceSnapshot, report.sourceIdentity.session);
  assert.deepEqual(await snapshotAuditSources(sourceRoot), sourceSnapshot,
    "Audit source tree changed during capture");
  for (const [file, hash] of Object.entries(report.sourceHashes)) {
    assert.equal(sha(await readFile(resolve(sourceRoot, file))), hash, `Source changed during capture: ${file}`);
  }
  for (const [file, hash] of Object.entries(report.harnessHashes)) {
    assert.equal(sha(await readFile(resolve(harnessRoot, file))), hash, `Harness changed during capture: ${file}`);
  }
  assert.equal(report.captures.length, report.expectedCaptureCount, "Complete visual matrix required");
  assert.equal(new Set(report.captures.map(({ prefix, kind }) => `${prefix}-${kind}`)).size, report.captures.length);
  if (baseline) {
    if (runtimeMatrix) {
      // Application sources are deliberately changed by a runtime migration.
      // Freeze executable comparison code; retain both complete source snapshots.
      const comparisonCode = ["tools/audit-shared-runtime.mjs", "tools/runtime-audit-poses.mjs",
        "tools/audit-source-identity.mjs", "tools/readback-sequence.mjs",
        "tools/object-contract-visual.mjs", "tools/saturn-scene-coverage.mjs"];
      for (const file of comparisonCode) assert.equal(report.harnessHashes[file], baseline.harnessHashes[file],
        `Comparison implementation changed: ${file}`);
      assert.equal(baseline.runtimeMatrix, true);
      for (const id of report.objectIds) assert.deepEqual(report.scenarios[id], baseline.scenarios[id]);
    } else {
      assert.deepEqual(report.harnessHashes, baseline.harnessHashes, "Match recorded repository harness inputs");
      assert.equal(report.expectedCaptureCount, baseline.expectedCaptureCount);
    }
    assert.equal(report.comparisons.length, report.expectedCaptureCount * (reportOnly ? 6 : 2));
    report.exactComparisonPass = report.comparisons.every(({ changedPixels }) => changedPixels === 0);
    if (!reportOnly) assert.ok(report.exactComparisonPass, "Unintended pixels changed; inspect absolute differences.");
  }
  report.complete = true;
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
// A report-only run can collect the entire matrix successfully and still fail
// qualification. It must never be consumed as a passing strict audit.
if (reportOnly) process.exitCode = 1;
