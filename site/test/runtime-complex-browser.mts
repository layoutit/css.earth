import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import rawNeptune from "../../src/planets/neptune/prepared/runtime.json" with { type: "json" };
import rawSaturn from "../../src/planets/saturn/prepared/runtime.json" with { type: "json" };
import { selectedPreparedVariant, preparedMaterialState } from "../../src/renderers/css/dist/testing.js";
import { waitForAuditPreparedReadiness } from "../../tools/audit-prepared-readiness.mts";

import { parsePreparedObjectRuntime } from '../../src/renderers/css/dist/index.js';
import type { ObjectRuntimeDefinition } from '../../src/renderers/css/runtime/object-runtime-types.ts';
import { required } from './navigation-test-values.mts';
const NEPTUNE = parsePreparedObjectRuntime(rawNeptune), SATURN = parsePreparedObjectRuntime(rawSaturn);
interface DecodeRule { fragment: string; mode: 'hold' | 'fail'; released: boolean; }
interface DecodeProbe { gate: DecodeRule | null; pending: { path: string; resolve(): void; rule: DecodeRule }[];
  calls: string[]; released: number; hold(fragment: string, mode?: 'hold' | 'fail'): void; release(): void; }
declare global { interface Window { __runtimeComplexProbe: DecodeProbe; } }
interface ComplexCase { id: string; name: string; deviceScaleFactor: number; samples: unknown[]; pageErrors: string[]; passed?: boolean; }
type Snapshot = Awaited<ReturnType<typeof snapshot>>;
type LiveSnapshot = Awaited<ReturnType<typeof liveSnapshot>>;
type Address = NonNullable<ReturnType<typeof materialAddresses>[string]>;
const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const selected = process.argv[3] ?? "all";
assert.ok(["all", "saturn", "neptune"].includes(selected));
const output = resolve(process.argv[4] ?? `output/playwright/runtime-complex-${Date.now()}`);
await mkdir(output, { recursive: true });
const report: { capturedAt: string; baseUrl: string; source: Record<string, string>; cases: ComplexCase[]; browser?: string; error?: string } = { capturedAt: new Date().toISOString(), baseUrl, source: {}, cases: [] };
for (const file of ["site/scene-router.mts", "site/packaged-object-runtime.mts",
  "src/renderers/css/dist/index.js", "src/renderers/css/dist/testing.js",
  "src/renderers/css/runtime/object-runtime.ts", "src/renderers/css/rendering/object-selection-runtime.ts",
  "src/renderers/css/rendering/prepared-presentation.ts", "src/renderers/css/rendering/prepared-material.ts",
  ...["saturn", "neptune"].flatMap(id => [`src/planets/${id}/object.json`,
    `src/planets/${id}/prepared/object.json`, `src/planets/${id}/prepared/runtime.json`])]) {
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
  report.error = error instanceof Error ? error.stack ?? error.message : String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify({ output, cases: report.cases.length, error: report.error ?? null }));

async function runCase(id: string, name: string, deviceScaleFactor: number, run: (page: Page, record: ComplexCase) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 },
    deviceScaleFactor, reducedMotion: "no-preference" });
  const page = await createTestPage(context);
  page.setDefaultTimeout(60_000);
  const record: ComplexCase = { id, name, deviceScaleFactor, samples: [], pageErrors: [] };
  report.cases.push(record);
  page.on("pageerror", (error) => record.pageErrors.push(error.message));
  try {
    await installDecodeProbe(page);
    await page.goto(new URL(`/${id}/`, baseUrl).href);
    await page.waitForFunction((objectId) =>
      window.__cssEarth?.ready && window.__cssEarth?.object(objectId)?.ready, id);
    await toggle(page, "motion", false);
    await run(page, record);
    assert.deepEqual(record.pageErrors, [], `${id}: no uncaught or unhandled errors`);
    await page.screenshot({ path: resolve(output, `${id}-${name}-${deviceScaleFactor}.png`) });
    record.passed = true;
  } finally {
    await context.close();
  }
}

async function installDecodeProbe(page: Page) {
  await page.addInitScript(() => {
    const nativeDecode = Image.prototype.decode;
    const probe: DecodeProbe = { gate: null, pending: [], calls: [], released: 0,
      hold(fragment, mode = 'hold') { probe.gate = { fragment, mode, released: false }; },
      release() {
        if (probe.gate) probe.gate.released = true;
        probe.gate = null;
        for (const entry of probe.pending.splice(0)) {
          entry.rule.released = true; entry.resolve(); probe.released += 1;
        }
      },
    };
    // Delay the native decode's completion, not the application or playback
    // policy. The tested image bytes still come from the actual prepared URL.
    Image.prototype.decode = function decodeWithControlledCompletion(...args: Parameters<HTMLImageElement["decode"]>) {
      const path = new URL(this.currentSrc || this.src, location.href).pathname;
      const rule = probe.gate && path.includes(probe.gate.fragment) ? probe.gate : null;
      probe.calls.push(path);
      return nativeDecode.apply(this, args).then(() => {
        if (!rule) return;
        if (rule.mode === "fail") throw new Error(`Injected prepared decode failure: ${path}`);
        if (rule.released) return;
        return new Promise<void>((resolve) => probe.pending.push({ path, resolve, rule }));
      });
    };
    window.__runtimeComplexProbe = probe;
  });
}

async function toggle(page: Page, name: string, checked: boolean) {
  await page.locator(`input[name="${name}"]`).evaluate((input, value) => {
    if (!(input instanceof HTMLInputElement)) throw new Error('Control must be an input.');
    if (input.disabled) throw new Error(`Control ${input.name} is unexpectedly disabled.`);
    if (input.checked !== value) input.click();
  }, checked);
}

async function clickLens(page: Page, id: string) {
  await page.locator(`button[name="lens"][value="${id}"]`).evaluate((button) => { if (!(button instanceof HTMLButtonElement)) throw new Error('Lens must be a button.'); button.click(); });
}

async function settled(page: Page, id: string, lens: string, controls: Record<string, boolean> = {}) {
  await page.waitForFunction(({ objectId, lensId, controls }) => {
    const runtime = window.__cssEarth?.object(objectId);
    const selection = runtime?.runtime.selection();
    return runtime?.lenses.state().id === lensId &&
      selection?.committed?.lensId === lensId && Boolean(selection?.committed) && !selection?.pending &&
      Object.entries(controls).every(([name, value]) => selection?.committed && Reflect.get(selection.committed, name) === value) &&
      !window.__cssearthTest.element(".planet-lenses").classList.contains("is-loading");
  }, { objectId: id, lensId: lens, controls });
}

async function snapshot(page: Page, id: string) {
  return page.evaluate((objectId) => {
    const runtime = window.__cssEarth?.object(objectId);
    const selection = runtime?.runtime.selection(), view = runtime?.runtime.view();
    const stage = window.__cssearthTest.html(".planet-stage");
    const material = (name: string) => {
      const leaf = stage.querySelector(`.${objectId}-${name}-material`);
      return leaf ? { image: window.__cssearthTest.htmlElement(leaf).style.backgroundImage, position: window.__cssearthTest.htmlElement(leaf).style.backgroundPosition,
        size: window.__cssearthTest.htmlElement(leaf).style.backgroundSize } : null;
    };
    return {
      lifecycle: window.__cssearthTest.scene().lifecycle,
      lens: runtime ? runtime.lenses.state() : null,
      selection: selection ? { desired: selection.desired, committed: selection.committed,
        pending: selection.pending, error: selection.error } : null,
      materialView: view ? { controlPitch: view.controlPitch, controlYaw: view.controlYaw,
        sceneMatrix: view.sceneMatrix, levelOfDetail: view.levelOfDetail,
        sunViewDirection: view.sunViewDirection, skySunViewDirection: view.skySunViewDirection,
        reference: { sceneMatrix: view.reference.sceneMatrix, sunViewDirection: view.reference.sunViewDirection,
          skySunViewDirection: view.reference.skySunViewDirection } } : null,
      features: runtime?.features.state() ?? null,
      camera: runtime?.camera.state() ?? null,
      cameraStats: runtime?.camera.stats() ?? null,
      materials: runtime?.material.state() ?? null,
      stable: runtime?.assertStableDomIdentity() ?? null,
      exterior: material("exterior"), interior: material("interior"),
      classes: stage.className, view: window.__cssearthTest.htmlElement(stage).dataset.view ?? null,
      stageChildren: stage.childElementCount,
      busy: window.__cssearthTest.element(".planet-lenses").classList.contains("is-loading"),
      settingsBusy: window.__cssearthTest.element(".planet-settings").classList.contains("is-loading"),
      pressed: [...document.querySelectorAll<HTMLButtonElement>('button[name="lens"][aria-pressed="true"]')].map(({ value }) => value),
      heldDecodes: window.__runtimeComplexProbe.pending.map(({ path }) => path),
    };
  }, id);
}

function assertAddress(actual: Snapshot["exterior"], expected: Address | null) {
  assert.ok(actual && expected, "Both material observations must exist.");
  assert.ok(actual.image.includes(expected.assetUrl), `Actual material image must use ${expected.assetUrl}`);
  assert.equal(actual.position, expected.backgroundPosition, "Actual prepared material address");
  assert.equal(actual.size, expected.backgroundSize, "Actual prepared material scale");
}

async function setNondefaultNeptuneCamera(page: Page, controlPitch: number, waitForRows = true) {
  await page.evaluate((pitch) => window.__cssearthTest.object('neptune').camera.setState({ controlPitch: pitch, controlYaw: 20 }), controlPitch);
  if (waitForRows) await page.waitForFunction(() => window.__cssearthTest.object('neptune').runtime.resources().pools.find(pool => pool.id === "lighting")?.pending === 0);
}

async function neptuneRace(page: Page, record: ComplexCase) {
  await toggle(page, "shadows", true);
  await setNondefaultNeptuneCamera(page, 63);
  const before = await liveSnapshot(page, "neptune");
  assert.notEqual(before.camera.controlPitch, before.cameraStats.defaultControlPitchDegrees);
  await page.evaluate(() => window.__runtimeComplexProbe.hold("neptune-orbit-material-methane-row-"));
  await clickLens(page, "methane");
  await page.waitForFunction(() => window.__runtimeComplexProbe.pending.length > 0);
  const pending = await liveSnapshot(page, "neptune");
  assert.equal(pending.lens.id, "normal");
  assert.deepEqual(pending.exterior, before.exterior, "Pending lens must not replace committed material");
  await setNondefaultNeptuneCamera(page, 9, false);
  await clickLens(page, "near-infrared");
  await settled(page, "neptune", "near-infrared");
  const winner = await liveSnapshot(page, "neptune");
  assertAddress(winner.exterior, materialAddresses(NEPTUNE, winner).lighting);
  await page.evaluate(() => window.__runtimeComplexProbe.release());
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const after = await liveSnapshot(page, "neptune");
  assert.equal(after.lens.id, "near-infrared");
  assert.deepEqual(after.exterior, winner.exterior, "Late old row must not overwrite the current material/address");
  assert.equal(after.stable, true);
  assert.equal(after.lifecycle, "paused");
  record.samples.push({ label: "before", ...before }, { label: "held row", ...pending },
    { label: "winner at new camera", ...winner }, { label: "old row completed", ...after });
}

async function neptuneDestroy(page: Page, record: ComplexCase) {
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
  assert.equal(await page.locator('button[name="lens"]').evaluateAll((buttons) => buttons.every(button => { if (!(button instanceof HTMLButtonElement)) throw new Error('Lens must be a button.'); return button.disabled; })), true);
  record.samples.push({ label: "disposed before late completion", ...after });
}

async function saturnCompound(page: Page, record: ComplexCase) {
  const observe = async (label: string) => {
    const state = await liveSnapshot(page, "saturn");
    record.samples.push({ label, ...state });
    return state;
  };
  await page.evaluate(() => window.__cssearthTest.object('saturn').camera.setState({ controlPitch: 59, controlYaw: 24 }));
  await waitForAuditPreparedReadiness(page, "saturn");
  const before = await observe("before");
  await page.evaluate(() => window.__runtimeComplexProbe.hold("saturn-orbit-material-methane"));
  await clickLens(page, "methane");
  await page.waitForFunction(() => window.__runtimeComplexProbe.pending.length > 0);
  const pending = await observe("methane decode held");
  assert.equal(pending.lens.id, "normal");
  assert.equal(pending.selection.desired.lensId, "methane");
  assert.deepEqual(pending.pressed, ["normal"]);
  assert.deepEqual(pending.exterior, before.exterior);
  assert.equal(pending.busy, true);
  assert.equal(pending.settingsBusy, true);

  // Cross-section replaces methane through the same exclusive lens reducer.
  // It must commit even while the superseded methane decode remains held.
  await clickLens(page, "cross-section");
  await toggle(page, "rings", false);
  await toggle(page, "shadows", true);
  await settled(page, "saturn", "cross-section", { rings: false, shadows: true });
  const winner = await observe("exclusive cross-section winner");
  assert.deepEqual(winner.features, { rings: false, shadows: true });
  assert.equal(winner.view, "interior");
  assert.deepEqual(winner.pressed, ["cross-section"]);
  assert.ok(winner.heldDecodes.length > 0, "Winner must not wait for the superseded decode");
  assertSaturnAddresses(winner);
  assert.equal(winner.settingsBusy, false);
  assert.equal(winner.stable, true);
  await page.evaluate(() => window.__runtimeComplexProbe.release());
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const released = await observe("superseded methane completed");
  assert.equal(released.lens.id, "cross-section");
  assert.deepEqual(released.pressed, ["cross-section"]);
  assert.deepEqual(released.exterior, winner.exterior);
  assert.deepEqual(released.interior, winner.interior);
  assert.deepEqual(released.features, winner.features);

  const thermalUrl = required(saturnAddresses(winner, { ...winner.selection.committed, lensId: "thermal" }).exterior).assetUrl;
  await page.evaluate(url => window.__runtimeComplexProbe.hold(url, "fail"), thermalUrl);
  await clickLens(page, "thermal");
  await page.waitForFunction(url => window.__runtimeComplexProbe.calls.includes(url), thermalUrl);
  await settled(page, "saturn", "cross-section");
  const failure = await observe("thermal decode rejected");
  assert.ok(failure.selection.error, "The injected failure must reach the selection boundary");
  assert.deepEqual(failure.selection.desired, failure.selection.committed);
  assert.deepEqual(failure.pressed, ["cross-section"]);
  assert.equal(failure.view, "interior");
  assert.deepEqual(failure.exterior, winner.exterior);
  assert.deepEqual(failure.interior, winner.interior);
  const failedAttempts = await page.evaluate(() => window.__runtimeComplexProbe.calls.filter((path) => path.includes("saturn-orbit-material-thermal")).length);
  await page.evaluate(() => window.__runtimeComplexProbe.release());
  await toggle(page, "rings", true);
  await settled(page, "saturn", "cross-section", { rings: true, shadows: true });
  const afterToggle = await observe("unrelated rings toggle");
  assert.deepEqual(afterToggle.features, { rings: true, shadows: true });
  assert.deepEqual(afterToggle.pressed, ["cross-section"]);
  assert.equal(afterToggle.view, "interior");
  assertSaturnAddresses(afterToggle);
  assert.equal(await page.evaluate(() => window.__runtimeComplexProbe.calls.filter((path) => path.includes("saturn-orbit-material-thermal")).length), failedAttempts,
    "An unrelated setting must not implicitly retry a failed material lens");
  assert.equal(afterToggle.stable, true);
  assert.equal(afterToggle.lifecycle, "paused");

  await clickLens(page, "thermal");
  await settled(page, "saturn", "thermal");
  const retried = await observe("explicit thermal retry");
  assert.deepEqual(retried.pressed, ["thermal"]);
  assertSaturnAddresses(retried);
  assert.ok(await page.evaluate(() => window.__runtimeComplexProbe.calls.filter((path) => path.includes("saturn-orbit-material-thermal")).length) > failedAttempts);
  assert.equal(retried.stable, true);
}

function saturnAddresses(observation: LiveSnapshot, selection = observation.selection.committed) {
  return materialAddresses(SATURN, observation, selection);
}

function materialAddresses(definition: ObjectRuntimeDefinition, observation: LiveSnapshot, selection = observation.selection.committed) {
  const variant = selectedPreparedVariant(definition, selection);
  return Object.fromEntries(variant.materials.map(selected => {
    const track = required(definition.materials.find(track => track.id === selected.track));
    if (!selected.enabled && selected.clearWhenHidden) return [track.id, null] as const;
    const { address } = preparedMaterialState(track, selected, observation.materialView);
    assert.ok(address, "Expected material address exists in the actual prepared bank");
    const resource = definition.assets.entries.find(entry => entry.key === address.resource);
    assert.ok(resource, "Expected material address belongs to the actual normalized definition");
    return [track.id, { ...address, assetUrl: resource.url }] as const;
  }));
}

function assertSaturnAddresses(observation: LiveSnapshot) {
  const variant = selectedPreparedVariant(SATURN, observation.selection.committed);
  const viewBinding = variant.writes.find(binding => binding.target === -1 && binding.kind === "attribute" && binding.name === "data-view");
  assert.ok(viewBinding?.kind === 'attribute');
  assert.equal(observation.view, viewBinding.value);
  for (const binding of variant.writes.filter(binding => binding.target === -1 && binding.kind === "class")) {
    assert.ok(binding.kind === 'class');
    assert.equal(observation.classes.split(/\s+/).includes(binding.name), binding.value,
      "The retained stage must publish the actual selected class binding");
  }
  for (const [track, address] of Object.entries(saturnAddresses(observation))) {
    assert.ok(track === 'exterior' || track === 'interior', 'Saturn material must be a captured track.');
    if (address) assertAddress(observation[track], address);
    else assert.equal(required(observation[track]).image, "none", "Hidden interior material must be cleared");
  }
}

async function liveSnapshot(page: Page, id: string) {
  const observation = await snapshot(page, id);
  const selection = required(observation.selection);
  return { ...observation, camera: required(observation.camera), cameraStats: required(observation.cameraStats),
    lens: required(observation.lens), selection: { ...selection, committed: required(selection.committed) }, materialView: required(observation.materialView) };
}
