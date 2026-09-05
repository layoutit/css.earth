import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { PREPARED_NEPTUNE_LENSES } from "../../src/planets/neptune/runtime/preparedLenses.mjs";
import { PREPARED_SATURN_RUNTIME_SCENE as SATURN } from "../../src/planets/saturn/runtime/preparedSceneRuntime.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const selected = process.argv[3] ?? "all";
assert.ok(["all", "saturn", "neptune"].includes(selected));
const output = resolve(process.argv[4] ?? `output/playwright/runtime-complex-${Date.now()}`);
await mkdir(output, { recursive: true });
const report = { capturedAt: new Date().toISOString(), baseUrl, source: {}, cases: [] };
for (const file of ["site/scene-router.mjs", "src/platform/latest-selection.mjs",
  "src/planets/saturn/runtime/client.mjs", "src/planets/neptune/runtime/client.mjs",
  "src/planets/saturn/runtime/preparedSceneRuntime.mjs", "src/planets/neptune/runtime/preparedLenses.mjs"]) {
  report.source[file] = createHash("sha256").update(await readFile(file)).digest("hex");
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();
try {
  for (const deviceScaleFactor of [1, 2]) {
    if (selected !== "saturn") {
      await runCase("neptune", "late-row-camera-supersession", deviceScaleFactor, neptuneRace);
      await runCase("neptune", "late-row-disposal", deviceScaleFactor, neptuneDestroy);
    }
    if (selected !== "neptune") {
      await runCase("saturn", "compound-presentation-and-failure-reset", deviceScaleFactor, saturnCompound);
    }
  }
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify({ output, cases: report.cases.length, error: report.error ?? null }));

async function runCase(id, name, deviceScaleFactor, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 },
    deviceScaleFactor, reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const record = { id, name, deviceScaleFactor, samples: [], pageErrors: [] };
  report.cases.push(record);
  page.on("pageerror", (error) => record.pageErrors.push(error.message));
  try {
    await installDecodeProbe(page);
    await page.goto(new URL(`/${id}/`, baseUrl).href);
    await page.waitForFunction((objectId) =>
      window.__cssEarth?.ready && window[`__${objectId}`]?.ready, id);
    await toggle(page, "motion", false);
    await run(page, record);
    assert.deepEqual(record.pageErrors, [], `${id}: no uncaught or unhandled errors`);
    await page.screenshot({ path: resolve(output, `${id}-${name}-${deviceScaleFactor}.png`) });
    record.passed = true;
  } finally {
    await context.close();
  }
}

async function installDecodeProbe(page) {
  await page.addInitScript(() => {
    const nativeDecode = Image.prototype.decode;
    const probe = { gate: null, pending: [], calls: [], released: 0 };
    // Delay the native decode's completion, not the application or playback
    // policy. The tested image bytes still come from the actual prepared URL.
    Image.prototype.decode = function decodeWithControlledCompletion(...args) {
      const path = new URL(this.currentSrc || this.src, location.href).pathname;
      const rule = probe.gate && path.includes(probe.gate.fragment) ? probe.gate : null;
      probe.calls.push(path);
      return nativeDecode.apply(this, args).then(() => {
        if (!rule) return;
        if (rule.mode === "fail") throw new Error(`Injected prepared decode failure: ${path}`);
        if (rule.released) return;
        return new Promise((resolve) => probe.pending.push({ path, resolve, rule }));
      });
    };
    probe.hold = (fragment, mode = "hold") => { probe.gate = { fragment, mode, released: false }; };
    probe.release = () => {
      if (probe.gate) probe.gate.released = true;
      probe.gate = null;
      for (const entry of probe.pending.splice(0)) {
        entry.rule.released = true;
        entry.resolve();
        probe.released += 1;
      }
    };
    window.__runtimeComplexProbe = probe;
  });
}

async function toggle(page, name, checked) {
  await page.locator(`input[name="${name}"]`).evaluate((input, value) => {
    if (input.disabled) throw new Error(`Control ${input.name} is unexpectedly disabled.`);
    if (input.checked !== value) input.click();
  }, checked);
}

async function clickLens(page, id) {
  await page.locator(`button[name="lens"][value="${id}"]`).evaluate((button) => button.click());
}

async function settled(page, id, lens) {
  await page.waitForFunction(({ objectId, lensId }) => {
    const runtime = window[`__${objectId}`];
    return runtime?.lenses.state().id === lensId &&
      !document.querySelector(".planet-lenses").classList.contains("is-loading");
  }, { objectId: id, lensId: lens });
}

async function snapshot(page, id) {
  return page.evaluate((objectId) => {
    const runtime = window[`__${objectId}`];
    const stage = document.querySelector(".planet-stage");
    const material = (name) => {
      const leaf = stage.querySelector(`.${objectId}-${name}-material`);
      return leaf ? { image: leaf.style.backgroundImage, position: leaf.style.backgroundPosition,
        size: leaf.style.backgroundSize } : null;
    };
    return {
      lifecycle: window.__cssEarth.lifecycle,
      lens: runtime?.lenses.state() ?? null,
      features: runtime?.features.state() ?? null,
      camera: runtime?.camera.state() ?? null,
      cameraStats: runtime?.camera.stats() ?? null,
      stable: runtime?.assertStableDomIdentity() ?? null,
      exterior: material("exterior"), interior: material("interior"),
      classes: stage.className, view: stage.dataset.view ?? null,
      stageChildren: stage.childElementCount,
      busy: document.querySelector(".planet-lenses").classList.contains("is-loading"),
      settingsBusy: document.querySelector(".planet-settings").classList.contains("is-loading"),
      pressed: [...document.querySelectorAll('button[name="lens"][aria-pressed="true"]')].map(({ value }) => value),
      heldDecodes: window.__runtimeComplexProbe.pending.map(({ path }) => path),
    };
  }, id);
}

function assertAddress(actual, expected) {
  assert.ok(actual.image.includes(expected.assetUrl), `Actual material image must use ${expected.assetUrl}`);
  assert.equal(actual.position, expected.backgroundPosition, "Actual prepared material address");
  assert.equal(actual.size, expected.backgroundSize, "Actual prepared material scale");
}

async function setNondefaultNeptuneCamera(page, controlPitch, waitForRows = true) {
  await page.evaluate((pitch) => window.__neptune.camera.setState({ controlPitch: pitch, controlYaw: 20 }), controlPitch);
  if (waitForRows) await page.waitForFunction(() => window.__neptune.camera.stats().orbitMaterialCache.pendingRowCount === 0);
}

async function neptuneRace(page, record) {
  await toggle(page, "shadows", true);
  await setNondefaultNeptuneCamera(page, 63);
  const before = await snapshot(page, "neptune");
  assert.notEqual(before.camera.controlPitch, before.cameraStats.defaultControlPitchDegrees);
  await page.evaluate(() => window.__runtimeComplexProbe.hold("neptune-orbit-material-methane-row-"));
  await clickLens(page, "methane");
  await page.waitForFunction(() => window.__runtimeComplexProbe.pending.length > 0);
  const pending = await snapshot(page, "neptune");
  assert.equal(pending.lens.id, "normal");
  assert.deepEqual(pending.exterior, before.exterior, "Pending lens must not replace committed material");
  await setNondefaultNeptuneCamera(page, 9, false);
  await clickLens(page, "near-infrared");
  await settled(page, "neptune", "near-infrared");
  const winner = await snapshot(page, "neptune");
  const plan = PREPARED_NEPTUNE_LENSES.controls.find(({ id }) => id === "near-infrared");
  assertAddress(winner.exterior, plan.orbitMaterial.presentations[winner.cameraStats.materialFrame]);
  await page.evaluate(() => window.__runtimeComplexProbe.release());
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const after = await snapshot(page, "neptune");
  assert.equal(after.lens.id, "near-infrared");
  assert.deepEqual(after.exterior, winner.exterior, "Late old row must not overwrite the current material/address");
  assert.equal(after.stable, true);
  assert.equal(after.lifecycle, "paused");
  record.samples.push({ label: "before", ...before }, { label: "held row", ...pending },
    { label: "winner at new camera", ...winner }, { label: "old row completed", ...after });
}

async function neptuneDestroy(page, record) {
  await toggle(page, "shadows", true);
  await setNondefaultNeptuneCamera(page, 63);
  await page.evaluate(() => window.__runtimeComplexProbe.hold("neptune-orbit-material-methane-row-"));
  await clickLens(page, "methane");
  await page.waitForFunction(() => window.__runtimeComplexProbe.pending.length > 0);
  record.samples.push({ label: "held material row", ...await snapshot(page, "neptune") });
  // Exercise the application's owner, never an object diagnostic destroy hook.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await page.evaluate(() => window.__runtimeComplexProbe.release());
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const after = await snapshot(page, "neptune");
  assert.equal(after.lens, null);
  assert.equal(after.stageChildren, 0);
  assert.equal(after.exterior, null);
  assert.equal(after.busy, false);
  assert.equal(await page.locator('button[name="lens"]').evaluateAll((buttons) => buttons.every(({ disabled }) => disabled)), true);
  record.samples.push({ label: "disposed before late completion", ...after });
}

async function saturnCompound(page, record) {
  await page.evaluate(() => window.__saturn.camera.setState({ controlPitch: 59, controlYaw: 24 }));
  const before = await snapshot(page, "saturn");
  await page.evaluate(() => window.__runtimeComplexProbe.hold("saturn-orbit-material-methane"));
  await clickLens(page, "methane");
  await page.waitForFunction(() => window.__runtimeComplexProbe.pending.length > 0);
  await clickLens(page, "cross-section");
  await toggle(page, "rings", false);
  await toggle(page, "shadows", true);
  const pending = await snapshot(page, "saturn");
  assert.equal(pending.lens.id, "normal");
  assert.equal(pending.lens.interior, false);
  assert.deepEqual(pending.exterior, before.exterior);
  assert.equal(pending.busy, true);
  assert.equal(pending.settingsBusy, true);
  await page.evaluate(() => window.__runtimeComplexProbe.release());
  await settled(page, "saturn", "methane");
  const winner = await snapshot(page, "saturn");
  assert.deepEqual(winner.features, { rings: false, shadows: true });
  assert.equal(winner.lens.interior, true);
  assert.equal(winner.view, "interior");
  assert.deepEqual(winner.pressed.sort(), ["cross-section", "methane"]);
  assertAddress(winner.exterior, SATURN.preparedLighting.orbitAtlas.runtimeShards
    .variants["methane-ringless"].presentations[winner.cameraStats.materialFrame]);
  const interiorFrame = Math.round(winner.cameraStats.materialFrame /
    (SATURN.preparedLighting.orbitAtlas.frameCount - 1) * (SATURN.interior.atmosphere.frameCount - 1));
  assertAddress(winner.interior, SATURN.interior.atmosphere.runtimeShards
    .variants["methane-ringless"].presentations[interiorFrame]);
  assert.equal(winner.settingsBusy, false);
  assert.equal(winner.stable, true);
  await page.evaluate(() => window.__runtimeComplexProbe.hold("saturn-orbit-material-thermal-ringless.webp", "fail"));
  await clickLens(page, "thermal");
  await page.waitForFunction(() => window.__runtimeComplexProbe.calls.some((path) => path.includes("saturn-orbit-material-thermal-ringless.webp")));
  await settled(page, "saturn", "methane");
  const failure = await snapshot(page, "saturn");
  assert.deepEqual(failure.exterior, winner.exterior);
  const failedAttempts = await page.evaluate(() => window.__runtimeComplexProbe.calls.filter((path) => path.includes("saturn-orbit-material-thermal")).length);
  await page.evaluate(() => window.__runtimeComplexProbe.release());
  await toggle(page, "rings", true);
  await settled(page, "saturn", "methane");
  const afterToggle = await snapshot(page, "saturn");
  assert.deepEqual(afterToggle.features, { rings: true, shadows: true });
  assert.equal(afterToggle.lens.interior, true);
  assertAddress(afterToggle.exterior, SATURN.preparedLighting.orbitAtlas.runtimeShards
    .variants.methane.presentations[afterToggle.cameraStats.materialFrame]);
  assert.equal(await page.evaluate(() => window.__runtimeComplexProbe.calls.filter((path) => path.includes("saturn-orbit-material-thermal")).length), failedAttempts,
    "An unrelated setting must not implicitly retry a failed material lens");
  assert.equal(afterToggle.stable, true);
  assert.equal(afterToggle.lifecycle, "paused");
  record.samples.push({ label: "before", ...before }, { label: "compound request pending", ...pending },
    { label: "compound winner", ...winner }, { label: "current lens failed", ...failure },
    { label: "unrelated rings toggle", ...afterToggle });
}
