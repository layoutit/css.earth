import assert from "node:assert/strict";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

import { OBJECTS } from "../objects.mjs";
import { MOBILE_TOUCH_ACTION, WHEEL_ZOOM_SPEED_MULTIPLIER, WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER,
  WHEEL_ZOOM_USE_SCROLL_DISTANCE } from "../runtime-policy.mjs";
import { loadPlanetBrowserProfile, assertRenderedObjectControls } from "./load-browser-profile.mjs";
import { proveSkyboxPointerBoundary } from "./skybox-pointer-boundary.mjs";
import { proveWheelZoomDistance, wheelWithReceipt } from "./wheel-zoom-distance.mjs";
import { GOOGLE_EARTH_SURFACE_FLY_TO } from
  "../../src/platform/google-earth-surface-fly-to.mjs";
import { GOOGLE_EARTH_DRAG_INERTIA } from
  "../../src/platform/google-earth-drag-inertia.mjs";
import { PREPARED_WHEEL_ZOOM } from "../../src/platform/prepared-wheel-zoom.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const requestedId = process.argv[3] ?? null;
const densityOnly = process.env.CSSEARTH_DENSITY_ONLY === "1";
const CASE_TIMEOUT_MS = 120_000;
const REQUEST_START_TIMEOUT_MS = 30_000;
const evidenceDirectory = process.env.CSSEARTH_CONFORMANCE_OUTPUT
  ? resolve(process.env.CSSEARTH_CONFORMANCE_OUTPUT)
  : null;
if (evidenceDirectory) {
  assert.ok(evidenceDirectory.startsWith(resolve("output/playwright") + "/"),
    "Browser evidence must stay under output/playwright.");
  await mkdir(evidenceDirectory, { recursive: true });
}
const implemented = OBJECTS;
const selected = requestedId
  ? implemented.filter(({ id }) => id === requestedId)
  : implemented;
assert.ok(selected.length > 0, `No implemented planet selected: ${requestedId}.`);

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
const reports = [];
try {
  for (const planet of selected) {
    const profile = await loadPlanetBrowserProfile(planet);
    if (densityOnly) {
      reports.push(await runCase(planet, "dpr-1", () => provePreparedDensity(browser, planet, profile, 1)));
      reports.push(await runCase(planet, "dpr-2", () => provePreparedDensity(browser, planet, profile, 2)));
      continue;
    }
    reports.push(await runCase(planet, "initial-shell", () => proveInitialShell(browser, planet, profile)));
    reports.push(await runCase(planet, "desktop", () => proveDesktop(browser, planet, profile)));
    reports.push(await runCase(planet, "mobile", () => proveMobile(browser, planet, profile)));
    for (const motionRequested of [false, true]) {
      for (const hidden of [true, false]) {
        reports.push(await runCase(planet, `pre-ready-${hidden ? "hidden" : "visible"}-motion-${motionRequested ? "on" : "off"}`,
          () => provePreReadyTarget(browser, planet, profile, hidden, motionRequested)));
      }
    }
    reports.push(await runCase(planet, "dpr-1", () => provePreparedDensity(browser, planet, profile, 1)));
    reports.push(await runCase(planet, "dpr-2", () => provePreparedDensity(browser, planet, profile, 2)));
    if (profile.rootLensIds.length > 1) {
      reports.push(await runCase(planet, "lens-race", () => proveLensRace(browser, planet, profile)));
      reports.push(await runCase(planet, "lens-reacquire", () => proveLensReacquire(browser, planet, profile)));
      reports.push(await runCase(planet, "lens-rejection", () => proveLensRejection(browser, planet, profile)));
      reports.push(await runCase(planet, "lens-destroy", () => proveLensDestroy(browser, planet, profile)));
    }
  }
} finally {
  await browser.close();
}

async function runCase(planet, name, prove) {
  const label = `${planet.id}/${name}`;
  const startedAt = performance.now();
  console.error(`[conformance] START ${label}`);
  try {
    const report = await within(prove(), CASE_TIMEOUT_MS, `${label}: case exceeded ${CASE_TIMEOUT_MS}ms`);
    console.error(`[conformance] PASS ${label} (${Math.round(performance.now() - startedAt)}ms)`);
    return report;
  } catch (error) {
    console.error(`[conformance] FAIL ${label}: ${error.message}`);
    throw error;
  }
}

async function within(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

function observed(promise) {
  // A parallel gated selection can reject before its eventual joined await,
  // especially when a timeout closes the page. Keep that outcome observed.
  promise.catch(() => {});
  return promise;
}

async function proveInitialShell(browser, planet, profile) {
  // With scripting disabled, no object binder can mask an enabled SSR control.
  const page = await browser.newPage({ javaScriptEnabled: false });
  try {
    const response = await page.goto(new URL(planet.route, baseUrl).href, {
      waitUntil: "domcontentloaded",
    });
    assert.ok(response?.ok(), `${planet.id}: initial shell must load successfully`);
    const speed = page.locator('input[name="speed"][type="range"]');
    const supportsSpeed = profile.objectControls.settings?.controls.some(
      ({ name }) => name === "speed",
    ) ?? false;
    assert.equal(await speed.count(), Number(supportsSpeed),
      `${planet.id}: initial shell must render only supported speed controls`);
    if (supportsSpeed) {
      assert.equal(await speed.isDisabled(), true,
        `${planet.id}: initial HTML must disable speed before object binding`);
    }
    return { id: planet.id, viewport: "initial-shell", speedDisabled: supportsSpeed };
  } finally { await page.close(); }
}

async function provePreReadyTarget(browser, planet, profile, finalHidden, motionRequested) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const evidence = observePage(page, baseUrl, profile);
  let releaseAssets;
  let markStarted;
  const gate = new Promise((resolve) => { releaseAssets = resolve; });
  const started = new Promise((resolve) => { markStarted = resolve; });
  let intercepted = false;
  await page.route(new RegExp(`/scenes/${planet.id}/`), async (route) => {
    if (!intercepted) {
      intercepted = true;
      markStarted();
    }
    await gate;
    await route.continue();
  });
  try {
    await page.goto(new URL(planet.route, baseUrl).href, {
      waitUntil: "domcontentloaded",
    });
    await within(started, REQUEST_START_TIMEOUT_MS,
      `${planet.id}: no startup request reached /scenes/${planet.id}/`);
    await assertRenderedObjectControls(page, profile);
    assert.equal(await page.evaluate(() => window.__cssEarth?.lifecycle), "loading",
      `${planet.id}: gated preparation must remain loading`);
    if (profile.objectControls.lenses?.controls.length && profile.audit.lensRace?.preReadyDisabled) {
      await page.waitForFunction(() =>
        [...document.querySelectorAll('button[name="lens"]')].every(
          (button) => button.disabled,
        ));
    } else if (profile.objectControls.lenses?.controls.length) {
      const testId = profile.audit.lensRace?.slowId ?? profile.objectControls.lenses.defaultLens;
      await page.locator(
        `button[name="lens"][value="${testId}"]`,
      ).evaluate((button) => button.click());
      assert.equal(await page.locator(
        'button[name="lens"][aria-pressed="true"]',
      ).getAttribute("value"), profile.objectControls.lenses.defaultLens,
      `${planet.id}: pre-ready lens input must not publish a selection`);
    }
    if (profile.objectControls.settings?.controls.some(({ name }) => name === "speed")) {
      assert.equal(await page.locator('input[name="speed"][type="range"]').isDisabled(), true,
        `${planet.id}: speed must be disabled until runtime binding`);
    }
    await page.locator('input[name="motion"]').evaluate((input, requested) => {
      if (input.checked !== requested) input.click();
    }, motionRequested);
    await setDocumentVisibility(page, true);
    if (!finalHidden) await setDocumentVisibility(page, false);
    assert.notEqual(await page.evaluate(() =>
      document.documentElement.dataset.playing), "true",
    `${planet.id}: pre-ready resume must not publish mounted playback state`);
    releaseAssets();
    await page.waitForFunction(() => window.__cssEarth?.ready === true);
    await profile.waitForRuntime(page);
    const expectedPlaying = motionRequested && !finalHidden;
    const lifecycle = await page.evaluate(() => window.__cssEarth.lifecycle);
    assert.equal(lifecycle, expectedPlaying ? "mounted" : "paused",
      `${planet.id}: readiness must apply the latest shared Motion and visibility`);
    assert.equal(await page.locator('input[name="motion"]').isChecked(), motionRequested,
      `${planet.id}: visibility changes must preserve Motion intent`);
    // Motion permission owns the prepared object; context hover/fade transitions
    // can run independently and are not planetary playback.
    const animationStates = await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect?.target?.closest(".planet-render-root")).map(({ playState }) => playState));
    assert.ok(expectedPlaying
      ? animationStates.length === 0 || animationStates.includes("running")
      : animationStates.every((state) => state === "paused"),
    `${planet.id}: actual animations must obey the latest ready playback permission`);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: pre-ready lifecycle must preserve retained identity`);
    assertEvidence(evidence, planet.id);
    return {
      id: planet.id,
      viewport: `pre-ready-${finalHidden ? "hidden" : "visible"}-motion-${motionRequested ? "on" : "off"}`,
      animationCount: animationStates.length,
    };
  } finally {
    releaseAssets?.();
    await page.close();
  }
}

async function installDecodeGate(page, assetPath) {
  await page.addInitScript((pathname) => {
    const decode = Image.prototype.decode;
    globalThis.__preparedImageDecodes = Object.create(null);
    const probe = globalThis.__preparedDecodeGate = {
      pathname, holding: true, started: false, pending: [],
    };
    Image.prototype.decode = function preparedDecode(...arguments_) {
      const path = new URL(this.currentSrc || this.src, location.href).pathname;
      globalThis.__preparedImageDecodes[path] =
        (globalThis.__preparedImageDecodes[path] ?? 0) + 1;
      // Decode the actual prepared bytes first. Holding HTTP itself while an
      // owner clears src can leave Chrome's canceled decode unsettled forever.
      // This gate controls completion and can always release retired work.
      return decode.apply(this, arguments_).then((value) => {
        if (path !== probe.pathname || !probe.holding) return value;
        probe.started = true;
        return new Promise((resolve) => probe.pending.push(() => resolve(value)));
      });
    };
  }, new URL(assetPath, baseUrl).pathname);
}

async function waitForDecodeGate(page, planet, race) {
  try {
    await page.waitForFunction(() => globalThis.__preparedDecodeGate?.started,
      undefined, { timeout: REQUEST_START_TIMEOUT_MS });
  } catch (cause) {
    throw new Error(`${planet.id}: ${race.slowId} did not reach prepared decode gate ${race.slowAsset}`, { cause });
  }
}

async function releaseDecodeGate(page) {
  if (page.isClosed()) return;
  await page.evaluate(() => {
    const probe = globalThis.__preparedDecodeGate;
    if (!probe) return;
    probe.holding = false;
    for (const release of probe.pending.splice(0)) release();
  });
}

async function proveLensRace(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl, profile);
  const race = profile.audit.lensRace;
  await installDecodeGate(page, race.slowAsset);
  try {
    await loadPlanet(page, planet, profile);
    const slowSelection = observed(profile.selectLens(page, race.slowId));
    await waitForDecodeGate(page, planet, race);
    const repeatedSlowSelection = observed(profile.selectLens(page, race.slowId));
    // Both A requests overlap the same live entry. A later committed winner
    // may retire it; coalescing does not imply reusing a retired decode.
    await within(profile.selectLens(page, race.winnerId), REQUEST_START_TIMEOUT_MS,
      `${planet.id}: winning lens ${race.winnerId} did not settle while ${race.slowId} was gated`);
    await releaseDecodeGate(page);
    await within(Promise.all([slowSelection, repeatedSlowSelection]), REQUEST_START_TIMEOUT_MS,
      `${planet.id}: retired ${race.slowId} selections did not settle after releasing ${race.slowAsset}`);
    await assertLensConsistency(page, planet, profile, race.winnerId);
    const slowPath = new URL(race.slowAsset, baseUrl).pathname;
    const slowDecodeCount = await page.evaluate((pathname) =>
      globalThis.__preparedImageDecodes[pathname] ?? 0, slowPath);
    assert.equal(slowDecodeCount, 1,
      `${planet.id}: repeated pending selection must share one image decode`);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: a lens race must preserve retained nodes`);
    assertEvidence(evidence, planet.id);
    return {
      id: planet.id,
      viewport: "lens-race",
      lens: race.winnerId,
      slowDecodeCount,
    };
  } finally {
    await releaseDecodeGate(page);
    await page.close();
  }
}

async function proveLensReacquire(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl, profile);
  const race = profile.audit.lensRace;
  await installDecodeGate(page, race.slowAsset);
  try {
    await loadPlanet(page, planet, profile);
    const first = observed(profile.selectLens(page, race.slowId));
    await waitForDecodeGate(page, planet, race);
    await profile.selectLens(page, race.winnerId);
    await assertLensConsistency(page, planet, profile, race.winnerId);
    const reacquired = observed(profile.selectLens(page, race.slowId));
    await page.waitForFunction(() => {
      const root = document.querySelector(".planet-lenses");
      return root?.getAttribute("aria-busy") === "true" || root?.classList.contains("is-loading");
    });
    await releaseDecodeGate(page);
    await Promise.all([first, reacquired]);
    await assertLensConsistency(page, planet, profile, race.slowId);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: A/B/A reacquisition must preserve retained nodes`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, viewport: "lens-reacquire", lens: race.slowId };
  } finally { await releaseDecodeGate(page); await page.close(); }
}

async function proveLensRejection(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl, profile);
  const race = profile.audit.lensRace;
  await page.route(`**${race.slowAsset}`, (route) => route.fulfill({
    status: 200,
    contentType: "image/webp",
    headers: { "cache-control": "no-store" },
    body: "invalid prepared image",
  }));
  try {
    await loadPlanet(page, planet, profile);
    await assert.rejects(profile.selectLens(page, race.slowId));
    await assertLensConsistency(page, planet, profile, race.defaultId, false);
    const rejected = await page.evaluate(id => window[`__${id}`].runtime.selection(), planet.id);
    assert.equal(rejected.ready, true,
      `${planet.id}: a rejected lens must preserve the ready committed material`);
    assert.equal(rejected.pending, false,
      `${planet.id}: rejection must finish the pending selection`);
    assert.ok(rejected.error,
      `${planet.id}: rejection must remain observable until explicit retry`);
    await page.unroute(`**${race.slowAsset}`);
    await profile.selectLens(page, race.slowId);
    await assertLensConsistency(page, planet, profile, race.slowId);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: rejection and same-URL retry must preserve retained nodes`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, viewport: "lens-rejection-retry", lens: race.slowId };
  } finally {
    await page.close();
  }
}

async function proveLensDestroy(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl, profile);
  const race = profile.audit.lensRace;
  await installDecodeGate(page, race.slowAsset);
  try {
    await loadPlanet(page, planet, profile);
    const selection = observed(profile.selectLens(page, race.slowId));
    await waitForDecodeGate(page, planet, race);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await releaseDecodeGate(page);
    await selection;
    await waitFrames(page);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.childElementCount), 0,
    `${planet.id}: destroy during lens preparation must empty the stage`);
    assert.equal(await profile.runtimePresent(page), false,
      `${planet.id}: destroy during lens preparation must remove diagnostics`);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.hasAttribute("data-lens") || stage.hasAttribute("data-view")), false,
    `${planet.id}: destroyed lens work must not publish presentation state`);
    assert.equal(await page.locator(".planet-lenses").evaluate((root) =>
      root.classList.contains("is-loading")), false,
    `${planet.id}: destroy must clear lens loading state`);
    assert.equal(await page.locator('button[name="lens"]').evaluateAll((buttons) =>
      buttons.every((button) => button.disabled)), true,
    `${planet.id}: destroy must disable lens controls`);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.style.length), 0,
    `${planet.id}: destroy must clear object-owned inline stage presentation`);
    assert.equal(await page.evaluate(() =>
      document.documentElement.hasAttribute("data-playing")), false,
    `${planet.id}: destroy must clear playback publication`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, viewport: "lens-destroy" };
  } finally {
    await releaseDecodeGate(page);
    await page.close();
  }
}

async function assertLensConsistency(page, planet, profile, expectedId, ready = true) {
  const state = await profile.lens(page);
  assert.equal(state.id, expectedId,
    `${planet.id}: runtime lens state must match the winning request`);
  assert.equal(state.ready, ready,
    `${planet.id}: lens readiness must distinguish success from a rejected request`);
  assert.equal(await profile.visibleLens(page), expectedId,
    `${planet.id}: visible material must match runtime lens state`);
  assert.equal(await profile.pressedLens(page), expectedId,
    `${planet.id}: selected control must match the visible material`);
}
console.log(JSON.stringify({ ok: true, reports }, null, 2));
if (evidenceDirectory) {
  await writeFile(resolve(evidenceDirectory, "report.json"), JSON.stringify({
    ok: true, browser: browser.version(), baseUrl,
    capturedAt: new Date().toISOString(),
    qualification: "Natural-clock browser interaction checks; no native parity claim.",
    reports,
  }, null, 2));
}

async function proveDesktop(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const evidence = observePage(page, baseUrl, profile);
  try {
    await loadPlanet(page, planet, profile);
    await enableMotion(page, planet.id);
    const projectiveTextureReport = await page.locator(".planet-stage")
      .evaluate((stage) => {
        const leaves = [...stage.querySelectorAll(".polycss-scene :is(s,u)")]
          .filter(leaf => getComputedStyle(leaf).backgroundImage !== "none");
        return {
          texturedLeafCount: leaves.length,
          nestedProjectiveTextureCount: stage.querySelectorAll(".polycss-projective-texture").length,
          finiteTextureBounds: leaves.every(leaf => {
            const bounds = leaf.getBoundingClientRect();
            return [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite);
          }),
        };
      });
    assert.ok(projectiveTextureReport.texturedLeafCount > 0,
      `${planet.id}: actual prepared surface pixels must be mounted`);
    assert.equal(projectiveTextureReport.nestedProjectiveTextureCount, 0,
      `${planet.id}: surface pixels must use a single prepared projection plane`);
    assert.equal(projectiveTextureReport.finiteTextureBounds, true,
      `${planet.id}: prepared texture bounds must remain finite`);
    const baseline = await sceneState(page, profile);
    assertSceneStructure(baseline, planet.id);
    const retainedReport = await profile.retainedReport(page);
    assert.equal(retainedReport.initialNodeCount, baseline.stageElements,
      `${planet.id}: object package must report every initially mounted scene node`);
    assert.equal(retainedReport.stableNodeCount, baseline.stageElements,
      `${planet.id}: object stability set must contain every initial node`);
    await beginRetainedProbe(page);
    const bounds = await profile.bounds(page);
    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });

    await drag(page, profile.inputSelector, 0, 150);
    const downward = await profile.camera(page);
    assert.ok(downward.pitch > bounds.defaultPitch,
      `${planet.id}: dragging down must move toward top-down`);
    await waitFrames(page);
    const downwardThrow = await profile.camera(page);
    assert.ok(downwardThrow.pitch > downward.pitch,
      `${planet.id}: a fast release must continue with Google Earth drag inertia (${JSON.stringify({downward,downwardThrow,stats:await interactionStats(page,planet.id)})})`);

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    await drag(page, profile.inputSelector, 0, -150);
    const upward = await profile.camera(page);
    assert.ok(upward.pitch < bounds.defaultPitch,
      `${planet.id}: dragging up must move toward the lower view`);

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    await drag(page, profile.inputSelector, 180, 0);
    const horizontal = await profile.camera(page);
    assert.ok(Math.abs(horizontal.pitch - bounds.defaultPitch) < 0.001,
      `${planet.id}: horizontal drag must not change vertical orbit`);

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    const dolly = await wheelDolly(page, planet.id);
    await beginZoomPublicationProbe(page);
    await wheel(page, profile.inputSelector, -240);
    const zoomPublication = await finishZoomPublicationProbe(page);
    const zoomed = await profile.camera(page);
    assert.ok(zoomed.zoom > bounds.defaultZoom,
      `${planet.id}: wheel toward the user must zoom in`);
    if (dolly) {
      assert.ok(["skyCube", "skyOrientation"].every((key) =>
        (zoomPublication[key] ?? 0) === 0),
      `${planet.id}: a wheel dolly must not turn the sky at infinity`);
    } else {
      assert.ok(Object.values(zoomPublication).every((count) => count > 0),
        `${planet.id}: off-centre wheel zoom must preserve its surface anchor`);
    }

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    const flyCoordinates = await surfaceFlyCoordinates(page);
    const beforeFlyTo = await profile.camera(page);
    await page.mouse.move(flyCoordinates.surface.x, flyCoordinates.surface.y);
    await page.mouse.down({ clickCount:1 });
    await page.mouse.up({ clickCount:1 });
    await page.mouse.down({ clickCount:2 });
    const secondPressFlight = await interactionStats(page, planet.id);
    assert.equal(secondPressFlight.surfaceFlyTo.active, true,
      `${planet.id}: the second press must launch flight before mouse-up`);
    await page.mouse.up({ clickCount:2 });
    assert.equal((await interactionStats(page, planet.id)).surfaceFlyTo.starts,
      secondPressFlight.surfaceFlyTo.starts, `${planet.id}: double-click release must not restart flight`);
    await page.waitForTimeout(
      GOOGLE_EARTH_SURFACE_FLY_TO.durationMilliseconds + 100,
    );
    const afterFlyTo = await profile.camera(page);
    assert.ok(Math.abs(afterFlyTo.pitch - beforeFlyTo.pitch) > 0.01,
      `${planet.id}: off-centre surface double click must recenter the camera`);
    assert.ok(afterFlyTo.zoom > beforeFlyTo.zoom,
      `${planet.id}: surface double click must fly toward the body`);

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    const beforeEmptyDoubleClick = await profile.camera(page);
    await page.mouse.dblclick(
      flyCoordinates.empty.x,
      flyCoordinates.empty.y,
      { delay: 45 },
    );
    await waitFrames(page);
    assert.deepEqual(
      await profile.camera(page),
      beforeEmptyDoubleClick,
      `${planet.id}: double click outside the projected body must do nothing`,
    );

    await profile.setCamera(page, {
      pitch: bounds.maximumPitch + 100,
      zoom: bounds.maximumZoom + 100,
    });
    const maximum = await profile.camera(page);
    assert.equal(maximum.pitch, bounds.pitchBounded === false
      ? bounds.maximumPitch + 100
      : bounds.maximumPitch, bounds.pitchBounded === false
      ? `${planet.id}: free pitch must cross the prepared reference maximum`
      : `${planet.id}: pitch must clamp at the prepared maximum`);
    assert.equal(maximum.zoom, bounds.maximumZoom,
      `${planet.id}: zoom must clamp at the prepared maximum`);
    await profile.setCamera(page, {
      pitch: bounds.minimumPitch - 100,
      zoom: bounds.minimumZoom - 100,
    });
    const minimum = await profile.camera(page);
    assert.equal(minimum.pitch, bounds.pitchBounded === false
      ? bounds.minimumPitch - 100
      : bounds.minimumPitch, bounds.pitchBounded === false
      ? `${planet.id}: free pitch must cross the prepared reference minimum`
      : `${planet.id}: pitch must clamp at the prepared minimum`);
    assert.equal(minimum.zoom, bounds.minimumZoom,
      `${planet.id}: zoom must clamp at the prepared minimum`);

    const afterInteraction = await sceneState(page, profile);
    assert.equal(afterInteraction.stageElements, baseline.stageElements,
      `${planet.id}: interaction must not grow the retained DOM`);
    assert.equal(afterInteraction.stageChildren, baseline.stageChildren,
      `${planet.id}: interaction must not remount scene roots`);
    assert.equal(afterInteraction.stable, true,
      `${planet.id}: retained node identity must remain stable`);

    await proveBreakpointCrossings(page, planet, profile, bounds, baseline);
    await exerciseRetainedInteractions(page, planet, profile);

    const runningBeforePause = await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect?.target?.closest(".planet-render-root")).filter(({ playState }) => playState === "running").length);
    await setDocumentVisibility(page, true);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect?.target?.closest(".planet-render-root")).every(
        ({ playState }) => playState === "paused",
      )), true, `${planet.id}: pause must stop every scene animation`);
    await setDocumentVisibility(page, false);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect?.target?.closest(".planet-render-root")).filter(({ playState }) => playState === "running").length),
      runningBeforePause, `${planet.id}: resume must restore the previously running animations`);

    const retainedProof = await finishRetainedProbe(
      page,
      profile.audit.retained.allowedMountSelectors,
    );
    assert.equal(retainedProof.initialNodesIntact, true,
      `${planet.id}: independent observation must retain every initial node`);
    assert.equal(retainedProof.shellTextNodesIntact, true,
      `${planet.id}: camera debug output must retain its text nodes`);
    assert.deepEqual(retainedProof.undeclaredAddedRoots, [],
      `${planet.id}: interactions must not add undeclared scene roots`);
    assert.deepEqual(retainedProof.undeclaredRemovedRoots, [],
      `${planet.id}: interactions must not remove undeclared scene roots`);
    for (const mount of retainedProof.allowedMounts) {
      assert.equal(mount.uniqueRootCount, 1,
        `${planet.id}: ${mount.selector} must reuse one prepared root`);
    }

    await page.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pagehide"));
    });
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.childElementCount), 0, `${planet.id}: destroy must empty the stage`);
    assert.equal(await profile.runtimePresent(page), false,
      `${planet.id}: destroy must remove the diagnostic handle`);
    assertEvidence(evidence, planet.id);
    return {
      id: planet.id,
      viewport: "desktop",
      surfaceFlyTo: {
        pitchDelta: afterFlyTo.pitch - beforeFlyTo.pitch,
        zoomRatio: afterFlyTo.zoom / beforeFlyTo.zoom,
      },
      zoomPublication,
      projectiveTextureReport,
      ...baseline,
      retainedProof,
    };
  } finally {
    await page.close();
  }
}

async function surfaceFlyCoordinates(page) {
  const bounds = await page.locator(".polycss-camera").boundingBox();
  assert.ok(bounds, "retained camera bounds must be measurable");
  const size = Math.min(bounds.width, bounds.height);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const viewport = page.viewportSize();
  const outsideOffset = size * 0.4;
  const direction = viewport.width - centerX > outsideOffset + 2 ? 1 : -1;
  return Object.freeze({
    surface: Object.freeze({
      x: centerX + direction * size * 0.11,
      y: centerY + size * 0.11,
    }),
    empty: Object.freeze({
      x: centerX + direction * outsideOffset,
      y: centerY,
    }),
  });
}

async function beginRetainedProbe(page) {
  await page.evaluate(() => {
    const stage = document.querySelector(".planet-stage");
    const initialNodes = [...stage.querySelectorAll("*")];
    const initialParents = initialNodes.map((node) => node.parentNode);
    const addedRoots = [];
    const removedRoots = [];
    const shellTextNodes = [
      document.querySelector(".planet-camera-coordinates")?.firstChild,
      document.querySelector(".planet-camera-copy")?.firstChild,
    ].filter(Boolean);
    const shellTextParents = shellTextNodes.map((node) => node.parentNode);
    let maximumNodeCount = initialNodes.length;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) addedRoots.push(node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof Element) removedRoots.push(node);
        }
      }
      maximumNodeCount = Math.max(
        maximumNodeCount,
        stage.querySelectorAll("*").length,
      );
    });
    observer.observe(stage, { childList: true, subtree: true });
    globalThis.__retainedConformance = {
      stage,
      initialNodes,
      initialParents,
      shellTextNodes,
      shellTextParents,
      addedRoots,
      removedRoots,
      observer,
      maximumNodeCount: () => maximumNodeCount,
    };
  });
}

async function exerciseRetainedInteractions(page, planet, profile) {
  const retained = profile.audit.retained;
  await assertRenderedObjectControls(page, profile);
  const lensIds = (retained.lensIds ?? []).filter(id => profile.rootLensIds.includes(id));
  for (const id of lensIds) {
    await page.locator(`button[name="lens"][value="${id}"]`).click();
    await page.waitForFunction(() => {
      const root = document.querySelector(".planet-lenses");
      return root?.getAttribute("aria-busy") !== "true" && !root?.classList.contains("is-loading");
    });
    await assertLensConsistency(page, planet, profile, id);
  }
  if (lensIds.length) {
    await profile.selectLens(page, lensIds[0]);
    await assertLensConsistency(page, planet, profile, lensIds[0]);
  }

  if (!profile.objectControls.settings?.controls.some(({ name }) => name === "speed")) return;

  // A destination lens can deliberately pause motion. Re-establish the speed
  // scenario's playback precondition through the shared control.
  if (!await page.locator(".planet-motion-setting").isChecked()) await enableMotion(page, planet.id);
  const speed = page.locator('input[name="speed"][type="range"]');
  assert.equal(await speed.count(), 1, `${planet.id}: speed control must exist`);
  const speedStates = Object.freeze([
    Object.freeze({ label: "fast", rate: 2 }),
    Object.freeze({ label: "fastest", rate: 3 }),
    Object.freeze({ label: "superfast", rate: 4 }),
    Object.freeze({ label: "off", rate: 0 }),
    Object.freeze({ label: "normal", rate: 1 }),
  ]);
  assert.equal(retained.speedClicks, speedStates.length,
    `${planet.id}: speed proof must exercise the complete Saturn cycle`);
  assert.equal(await speed.getAttribute("data-state"), "normal",
    `${planet.id}: speed control must begin at normal`);
  for (const state of speedStates) {
    await speed.evaluate((input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, state.rate);
    await waitFrames(page);
    assert.equal(await speed.getAttribute("data-state"), state.label,
      `${planet.id}: speed control must publish ${state.label}`);
    const animations = await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).filter(({ effect }) => effect?.target?.closest(".planet-render-root")).map((animation) => ({
        currentTime: animation.currentTime,
        playbackRate: animation.playbackRate,
        playState: animation.playState,
      })));
    assert.ok(animations.length > 0,
      `${planet.id}: speed control must own scene animations`);
    if (state.rate === 0) {
      assert.ok(animations.every(({ playbackRate, playState }) =>
        playbackRate === 0 || playState === "paused"),
      `${planet.id}: off must make every animation stationary`);
      await setDocumentVisibility(page, true);
      await setDocumentVisibility(page, false);
      await waitFrames(page);
      const afterResume = await page.locator(".planet-stage").evaluate((stage) =>
        stage.getAnimations({ subtree: true }).filter(({ effect }) => effect?.target?.closest(".planet-render-root")).map((animation) => ({
          currentTime: animation.currentTime,
          playbackRate: animation.playbackRate,
          playState: animation.playState,
        })));
      assert.equal(afterResume.length, animations.length,
        `${planet.id}: pause and resume must preserve animation ownership`);
      for (let index = 0; index < animations.length; index += 1) {
        assert.ok(Math.abs(
          Number(afterResume[index].currentTime) -
          Number(animations[index].currentTime),
        ) < 0.1, `${planet.id}: off must survive pause and resume`);
        assert.ok(afterResume[index].playbackRate === 0 ||
          afterResume[index].playState === "paused",
        `${planet.id}: resumed off state must remain stationary`);
      }
    } else {
      assert.ok(animations.some(({ playbackRate, playState }) =>
        playbackRate === state.rate && playState === "running"),
      `${planet.id}: ${state.label} must keep scene motion running`);
      assert.ok(animations.every(({ playbackRate, playState }) =>
        playState === "paused" || playbackRate === state.rate),
      `${planet.id}: ${state.label} must use effective rate ${state.rate}`);
    }
  }

  await waitFrames(page);
}

async function finishRetainedProbe(page, allowedSelectors) {
  return page.evaluate((selectors) => {
    const probe = globalThis.__retainedConformance;
    probe.observer.takeRecords();
    probe.observer.disconnect();
    const rootFor = (node, selector) => node.matches(selector)
      ? node
      : node.closest(selector);
    const allowedRoot = (node) => selectors.some((selector) =>
      Boolean(rootFor(node, selector)));
    const describe = (node) => node.className || node.localName;
    const allowedMounts = selectors.map((selector) => {
      const roots = [
        ...probe.addedRoots,
        ...probe.removedRoots,
      ].map((node) => rootFor(node, selector)).filter(Boolean);
      return {
        selector,
        uniqueRootCount: new Set(roots).size,
        addEvents: probe.addedRoots.filter((node) =>
          Boolean(rootFor(node, selector))).length,
        removeEvents: probe.removedRoots.filter((node) =>
          Boolean(rootFor(node, selector))).length,
      };
    });
    const result = {
      initialNodeCount: probe.initialNodes.length,
      currentNodeCount: probe.stage.querySelectorAll("*").length,
      maximumNodeCount: probe.maximumNodeCount(),
      initialNodesIntact: probe.initialNodes.every((node, index) =>
        node.isConnected && node.parentNode === probe.initialParents[index]),
      shellTextNodesIntact: probe.shellTextNodes.every((node, index) =>
        node.isConnected && node.parentNode === probe.shellTextParents[index]),
      undeclaredAddedRoots: probe.addedRoots.filter((node) =>
        !allowedRoot(node)).map(describe),
      undeclaredRemovedRoots: probe.removedRoots.filter((node) =>
        !allowedRoot(node)).map(describe),
      allowedMounts,
    };
    delete globalThis.__retainedConformance;
    return result;
  }, allowedSelectors);
}

async function provePreparedDensity(browser, planet, profile, density) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: density,
    ...(evidenceDirectory ? { recordVideo: {
      dir: evidenceDirectory, size: { width: 1200, height: 800 },
    } } : {}),
  });
  const page = await context.newPage();
  const evidence = observePage(page, baseUrl, profile);
  const requestedPaths = new Set();
  page.on("request", (request) => {
    requestedPaths.add(new URL(request.url()).pathname);
  });
  try {
    await loadPlanet(page, planet, profile);
    await profile.pause(page);
    if (evidenceDirectory) await page.evaluate(() => {
      const label = document.createElement("div");
      label.id = "camera-conformance-label";
      label.style.cssText = "position:fixed;right:20px;bottom:48px;padding:10px 16px;" +
        "background:#17191b;color:white;font:16px sans-serif;pointer-events:none;z-index:9999";
      label.textContent = "Sky and planet input boundaries";
      document.body.append(label);
      const pointer = document.createElement("div");
      pointer.style.cssText = "position:fixed;width:16px;height:16px;border:2px solid white;" +
        "border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:9999";
      document.body.append(pointer);
      document.addEventListener("pointermove", event => {
        pointer.style.left = `${event.clientX}px`;
        pointer.style.top = `${event.clientY}px`;
      }, true);
      document.addEventListener("pointerdown", () => pointer.style.background = "#ffb14e", true);
      document.addEventListener("pointerup", () => pointer.style.background = "transparent", true);
    });
    assert.equal(await profile.selectedDensity(page), 2,
      `${planet.id}: DPR ${density} must select the canonical high-density bank`);
    const canonicalAssets = profile.audit.canonicalPreparedAssets ?? [];
    assert.ok(Array.isArray(canonicalAssets));
    for (const url of canonicalAssets) {
      assert.ok(requestedPaths.has(url),
        `${planet.id}: DPR ${density} must request canonical ${url}`);
    }
    // The shared universe owns the visible sky. Per-object cubemaps retain
    // camera orientation handles only and must not download either density.
    const dormantSkyAssets = new Set(profile.dormantSkyAssets ?? []);
    if (dormantSkyAssets.size) {
      assert.equal(await page.locator('.prepared-universe').count(), 1);
      assert.equal(await page.locator('.prepared-point-field').count(), 1);
      assert.equal(await page.locator('.planet-cubic-sky-face').count(), 0);
      for (const path of dormantSkyAssets) assert.equal(requestedPaths.has(path), false,
        `${planet.id}: shared sky must not also load object cubemap ${path}`);
    }
    for (const pair of profile.audit.preparedAssetPairs) {
      if (dormantSkyAssets.has(pair.one) && dormantSkyAssets.has(pair.two)) continue;
      const selectedAsset = pair.two;
      const rejectedAsset = pair.one;
      assert.ok(requestedPaths.has(selectedAsset),
        `${planet.id}: DPR ${density} must request canonical ${selectedAsset}`);
      assert.equal(requestedPaths.has(rejectedAsset), false,
        `${planet.id}: DPR ${density} must not request low-density ${rejectedAsset}`);
    }
    const skyboxPointerBoundary = await proveSkyboxPointerBoundary(
      page,
      planet,
      profile,
    );
    if (WHEEL_ZOOM_USE_SCROLL_DISTANCE) await proveWheelZoomDistance(page, planet, profile);
    const interactionInterruptions = await proveInteractionInterruptions(
      page,
      planet,
      profile,
    );
    const wheelTakeover = await proveWheelTakeover(page, planet, profile);
    const releasePosition = await proveReleasePosition(page, planet, profile);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: the full interaction sequence must preserve retained nodes`);
    if (densityOnly) {
      assert.deepEqual(evidence.externalRequests, [],
        `${planet.id}: browser must make no undeclared external requests`);
      assert.deepEqual(evidence.problems.filter(problem => problem.startsWith("pageerror:")), [],
        `${planet.id}: interaction proof must have no runtime exceptions`);
    } else {
      assertEvidence(evidence, planet.id);
    }
    if (evidenceDirectory) console.error(`${planet.id} DPR ${density}: interactions passed`);
    return {
      id: planet.id,
      viewport: `dpr-${density}`,
      selectedDensity: 2,
      requestedCanonicalAssets: [...canonicalAssets].sort(),
      skyboxPointerBoundary,
      interactionInterruptions,
      wheelTakeover,
      releasePosition,
      ...(evidenceDirectory ? { video: `${planet.id}-dpr-${density}.webm` } : {}),
      ...(densityOnly
        ? { browserProblemsOutsideDensityProof: evidence.problems }
        : {}),
    };
  } finally {
    const video = page.video();
    await context.close();
    if (video && evidenceDirectory) await rename(await video.path(),
      resolve(evidenceDirectory, `${planet.id}-dpr-${density}.webm`));
  }
}

async function proveReleasePosition(page, planet, profile) {
  await showInteractionPhase(page, "Release without an extra drag step");
  const bounds = await profile.bounds(page);
  await profile.setCamera(page, { pitch: bounds.defaultPitch, zoom: bounds.defaultZoom });
  const coordinates = await surfaceFlyCoordinates(page);
  const { x, y } = coordinates.surface;
  const cdp = await page.context().newCDPSession(page);
  try {
    for (const paused of [false, true]) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (const offset of paused ? [8, 20, 38] : [10, 20, 30]) {
        await page.waitForTimeout(35);
        await page.mouse.move(x + offset, y);
      }
      if (paused) await page.waitForTimeout(160);
      else await page.waitForTimeout(35);
      const before = await cameraPose(page, planet.id);
      const starts = (await interactionStats(page, planet.id)).starts;
      // A moved mouse-up is a distinct input, not another mouse-move event.
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased",
        x: x + (paused ? 64 : 40), y, button: "left", buttons: 0, clickCount: 1 });
      await page.mouse.up();
      await waitFrames(page);
      assert.deepEqual(await cameraPose(page, planet.id), before,
        `${planet.id}: ${paused ? "paused" : "constant-speed"} release must retain the last drag pose`);
      assert.equal((await interactionStats(page, planet.id)).starts, starts,
        `${planet.id}: release must not manufacture an inertial throw`);
      assert.equal((await interactionStats(page, planet.id)).activeMode, "idle");
    }
  } finally { await cdp.detach(); }
  return { nonLaunchingReleaseRetainsDragPose: true, pausedReleaseCannotRestartMotion: true };
}

async function proveWheelTakeover(page, planet, profile) {
  const bounds = await profile.bounds(page);
  const reset = () => profile.setCamera(page, {
    pitch: bounds.defaultPitch, zoom: bounds.defaultZoom,
  });
  await reset();
  const coordinates = await surfaceFlyCoordinates(page);
  const startWheel = async () => {
    await page.mouse.move(coordinates.surface.x, coordinates.surface.y);
    await page.mouse.wheel(0, -40);
    await page.waitForTimeout(35);
    assert.equal((await interactionStats(page, planet.id)).wheelZoom.active, true,
      `${planet.id}: takeover must begin during the shared wheel interval`);
  };
  await showInteractionPhase(page, "Grab during wheel zoom: the camera must stop");
  await startWheel();
  await page.mouse.down();
  const pressed = await cameraPose(page, planet.id);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  assert.deepEqual(await cameraPose(page, planet.id), pressed,
    `${planet.id}: grabbing the body must stop wheel zoom and anchor rotation immediately`);
  assert.equal((await interactionStats(page, planet.id)).wheelZoom.active, false,
    `${planet.id}: grabbing must cancel the pending wheel frame`);
  await page.mouse.up();

  await showInteractionPhase(page, "Sky press must stop wheel motion");
  await reset();
  await startWheel();
  // Use the viewport corner: zoom can expand a large body's limb over the
  // point that was just outside its disc before the wheel gesture began.
  await page.mouse.move(page.viewportSize().width - 32, 96);
  await page.mouse.down();
  assert.equal((await interactionStats(page, planet.id)).pendingPointer, true,
    `${planet.id}: the sky press must reserve an orbit drag`);
  const skyPress = await cameraPose(page, planet.id);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  assert.deepEqual(await cameraPose(page, planet.id), skyPress,
    `${planet.id}: a sky press must stop wheel motion immediately`);
  await page.mouse.up();

  await showInteractionPhase(page, "Reset during wheel zoom: no delayed motion");
  await reset();
  await startWheel();
  await reset();
  const resetPose = await cameraPose(page, planet.id);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  assert.deepEqual(await cameraPose(page, planet.id), resetPose,
    `${planet.id}: resetting the camera must cancel pending wheel publications`);
  assert.equal((await interactionStats(page, planet.id)).wheelZoom.active, false,
    `${planet.id}: reset must cancel the pending wheel frame`);
  await showInteractionPhase(page, "Held-button wheel cancels the grab");
  await reset();
  const cameraBounds = await page.locator(".planet-stage .polycss-camera").boundingBox();
  const x = cameraBounds.x + cameraBounds.width / 2;
  const y = cameraBounds.y + cameraBounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const heldPose = await cameraPose(page, planet.id);
  await page.mouse.wheel(0, -40);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  const zoomedWhileHeld = await cameraPose(page, planet.id);
  assert.deepEqual(zoomedWhileHeld, heldPose,
    `${planet.id}: scrolling while held must not zoom`);
  assert.equal((await interactionStats(page, planet.id)).pendingPointer, false);
  await page.mouse.move(x + 40, y);
  const heldDrag = await cameraPose(page, planet.id);
  assert.deepEqual(heldDrag, heldPose,
    `${planet.id}: movement after held-wheel cancellation must wait for a new press`);
  await page.waitForTimeout(GOOGLE_EARTH_DRAG_INERTIA.releaseFreshnessMilliseconds + 20);
  await page.mouse.up();
  await page.evaluate(({ id, state }) => window[`__${id}`].camera.setState(state),
    { id:planet.id, state:zoomedWhileHeld });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y);
  const freshDrag = await cameraPose(page, planet.id);
  assert.notDeepEqual(freshDrag.pose, heldPose.pose,
    `${planet.id}: a new press must restore dragging after wheel cancellation`);
  await page.waitForTimeout(GOOGLE_EARTH_DRAG_INERTIA.releaseFreshnessMilliseconds + 20);
  await page.mouse.up();
  return { bodyPressStopsWheel: true, skyPressStopsWheel: true,
    resetStopsWheel: true, heldWheelCancelsGrab: true };
}

async function proveInteractionInterruptions(page, planet, profile) {
  await showInteractionPhase(page, "Drag, coast, then wheel interruption");
  const bounds = await profile.bounds(page);
  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });

  const throwInput = await drag(page, profile.inputSelector, 90, 150);
  const inertiaBeforeWheel = await interactionStats(page, planet.id);
  assert.equal(inertiaBeforeWheel.activeMode, "inertia",
    `${planet.id}: fast release must enter inertia before wheel interruption (${JSON.stringify({ input:throwInput, interaction:inertiaBeforeWheel })})`);
  assert.equal(inertiaBeforeWheel.activeMotionCount, 1,
    `${planet.id}: inertia must be the only active camera motion`);
  await wheel(page, profile.inputSelector, -40);
  const inertiaAfterWheel = await interactionStats(page, planet.id);
  assert.equal(inertiaAfterWheel.activeMode, "idle",
    `${planet.id}: wheel zoom must interrupt rotational inertia`);
  assert.equal(inertiaAfterWheel.activeMotionCount, 0,
    `${planet.id}: wheel interruption must leave no rotational motion owner`);
  assert.equal(
    inertiaAfterWheel.interruptions.wheel,
    inertiaBeforeWheel.interruptions.wheel + 1,
    `${planet.id}: wheel interruption must be recorded once`,
  );
  assert.equal(inertiaAfterWheel.cancels, inertiaBeforeWheel.cancels + 1,
    `${planet.id}: wheel input must cancel inertia exactly once`);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 30);
  const poseAfterWheel = await cameraPose(page, planet.id);
  await waitFrames(page);
  assert.deepEqual(await cameraPose(page, planet.id), poseAfterWheel,
    `${planet.id}: camera must stay still after the wheel interval ends`);

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  const anchorCoordinates = await surfaceFlyCoordinates(page);
  const dolly = await wheelDolly(page, planet.id);
  const beforeAnchorWheel = await cameraPose(page, planet.id);
  const distanceBefore = dolly ? await cameraDistance(page, planet.id) : null;
  await page.mouse.move(anchorCoordinates.surface.x, anchorCoordinates.surface.y);
  const anchorScrollPixels = await wheelWithReceipt(page, -40);
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 80);
  const afterAnchorWheel = await cameraPose(page, planet.id);
  const wheelZoomRatio = afterAnchorWheel.zoom / beforeAnchorWheel.zoom;
  if (dolly) {
    // A perspective dolly: the prepared step per wheel delta moves the eye
    // along its axis, and there is no surface anchor to hold.
    const distanceRatio = (await cameraDistance(page, planet.id)) / distanceBefore;
    const kind = await page.evaluate(id => window[`__${id}`].camera.stats().dragInertia.wheelZoom.inputKind, planet.id);
    const gain = kind === "wheel" ? WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER : WHEEL_ZOOM_SPEED_MULTIPLIER;
    assert.ok(Math.abs(distanceRatio - Math.exp(anchorScrollPixels * dolly.wheelStepPerDelta * gain)) < 1e-6,
      `${planet.id}: prepared wheel dolly step drifted (ratio ${distanceRatio})`);
    assert.equal(afterAnchorWheel.pose.scene, beforeAnchorWheel.pose.scene,
      `${planet.id}: a wheel dolly must not turn the scene`);
  } else {
    const anchorInputKind = await page.evaluate(id =>
      window[`__${id}`].camera.stats().dragInertia.wheelZoom.inputKind, planet.id);
    const anchorSpeed = WHEEL_ZOOM_USE_SCROLL_DISTANCE && anchorInputKind === "wheel"
      ? WHEEL_ZOOM_DISCRETE_SPEED_MULTIPLIER : WHEEL_ZOOM_SPEED_MULTIPLIER;
    // Camera publication rounds zoom to four decimal places on each frame.
    assert.ok(Math.abs(wheelZoomRatio - Math.exp(
      PREPARED_WHEEL_ZOOM.screenLogScalePerMillisecond *
        anchorSpeed * PREPARED_WHEEL_ZOOM.intervalMilliseconds *
        (WHEEL_ZOOM_USE_SCROLL_DISTANCE
          ? -anchorScrollPixels / 100 : 1))) < 0.002,
    `${planet.id}: shared wheel response drifted (ratio ${wheelZoomRatio})`);
    assert.notEqual(afterAnchorWheel.pose.scene, beforeAnchorWheel.pose.scene,
      `${planet.id}: off-centre wheel zoom must apply anchor rotation`);
  }

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  await drag(page, profile.inputSelector, 90, 150);

  await showInteractionPhase(page, "Click to stop, then one-pixel drag");
  const stopCoordinates = await surfaceFlyCoordinates(page);
  const inertiaBeforePointer = await interactionStats(page, planet.id);
  assert.equal(inertiaBeforePointer.activeMode, "inertia",
    `${planet.id}: rotation must still be active before the stop press`);
  await page.mouse.move(
    stopCoordinates.surface.x,
    stopCoordinates.surface.y,
  );
  await page.mouse.down();
  const inertiaAfterPointer = await interactionStats(page, planet.id);
  assert.equal(inertiaAfterPointer.activeMode, "idle",
    `${planet.id}: pointer-down must stop inertia before pointer-up`);
  assert.equal(inertiaAfterPointer.activeMotionCount, 0,
    `${planet.id}: a surface pointer must leave no camera motion owner`);
  assert.equal(inertiaAfterPointer.pendingPointer, true,
    `${planet.id}: the stop press must remain available for a new drag`);
  assert.equal(
    inertiaAfterPointer.cancels,
    inertiaBeforePointer.cancels + 1,
    `${planet.id}: a surface pointer must cancel inertia exactly once`,
  );
  assert.equal(
    inertiaAfterPointer.interruptions.pointer,
    inertiaBeforePointer.interruptions.pointer + 1,
    `${planet.id}: a surface pointer interruption must be recorded once`,
  );
  assert.deepEqual(inertiaAfterPointer.lastInterruption, {
    from: "inertia",
    to: "pointer",
  }, `${planet.id}: a surface pointer must own the inertia interruption`);
  const stoppedPose = await cameraPose(page, planet.id);
  await waitFrames(page);
  assert.deepEqual(await cameraPose(page, planet.id), stoppedPose,
    `${planet.id}: both axes must stay stopped while the pointer is held`);
  await page.mouse.move(
    stopCoordinates.surface.x + 1,
    stopCoordinates.surface.y + 1,
  );
  const tinyDragPose = await cameraPose(page, planet.id);
  assert.notDeepEqual(tinyDragPose, stoppedPose,
    `${planet.id}: a one-pixel drag must respond immediately after stopping coast`);
  await page.mouse.up();
  await waitFrames(page);
  const releasedPointer = await interactionStats(page, planet.id);
  assert.deepEqual(await cameraPose(page, planet.id), tinyDragPose,
    `${planet.id}: releasing a tiny drag must not restart rotation (${JSON.stringify(releasedPointer)})`);
  assert.equal(releasedPointer.pendingPointer, false,
    `${planet.id}: pointer-up must clear the pending press`);
  assert.equal(releasedPointer.activeMotionCount, 0,
    `${planet.id}: pointer-up after a tiny drag must remain idle`);
  assert.equal(releasedPointer.starts, inertiaBeforePointer.starts,
    `${planet.id}: pointer-up after a tiny drag must not launch another throw`);

  const input = page.locator(profile.inputSelector);
  await showInteractionPhase(page, "Release pointer capture outside the planet");
  await input.evaluate((node) => node.addEventListener("pointerdown", (event) => {
    node.__testPointerId = event.pointerId;
  }, { once: true }));
  await page.mouse.down();
  await page.mouse.move(stopCoordinates.surface.x + 60,
    stopCoordinates.surface.y + 25, { steps: 6 });
  assert.equal((await interactionStats(page, planet.id)).activeMode, "drag",
    `${planet.id}: capture-loss scenario must begin during a drag`);
  const poseAtCaptureLoss = await cameraPose(page, planet.id);
  await input.evaluate((node) => {
    node.releasePointerCapture(node.__testPointerId);
    delete node.__testPointerId;
  });
  const sidebar = await page.locator(".planet-sidebar").boundingBox();
  await page.mouse.move(sidebar.x + 40, sidebar.y + 120);
  await page.mouse.up();
  await page.mouse.move(stopCoordinates.surface.x, stopCoordinates.surface.y);
  await page.mouse.move(stopCoordinates.surface.x + 40,
    stopCoordinates.surface.y + 20, { steps: 4 });
  await waitFrames(page);
  assert.deepEqual(await cameraPose(page, planet.id), poseAtCaptureLoss,
    `${planet.id}: capture loss and release outside must not turn hover into drag`);
  const afterCaptureLoss = await interactionStats(page, planet.id);
  assert.equal(afterCaptureLoss.activeMode, "idle",
    `${planet.id}: capture loss must stop the drag`);
  assert.equal(afterCaptureLoss.pendingPointer, false,
    `${planet.id}: capture loss must clear the pointer`);
  assert.equal(afterCaptureLoss.starts, releasedPointer.starts,
    `${planet.id}: capture loss must not launch inertia`);

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  let flyCoordinates = await surfaceFlyCoordinates(page);
  await showInteractionPhase(page, "Drag, coast, then double-click fly-to");
  await drag(page, profile.inputSelector, 90, 150);
  assert.equal((await interactionStats(page, planet.id)).activeMode, "inertia",
    `${planet.id}: the fly-to sequence must begin during coast`);
  const poseBeforeFly = await cameraPose(page, planet.id);
  await page.mouse.dblclick(
    flyCoordinates.surface.x,
    flyCoordinates.surface.y,
    { delay: 45 },
  );
  await waitFrames(page);
  const activeFly = await interactionStats(page, planet.id);
  assert.equal(activeFly.activeMode, "fly-to",
    `${planet.id}: surface double click must enter fly-to`);
  assert.equal(activeFly.activeMotionCount, 1,
    `${planet.id}: fly-to must be the only active camera motion`);
  await page.waitForTimeout(180);
  const poseDuringFly = await cameraPose(page, planet.id);
  assert.notEqual(poseDuringFly.pose.scene, poseBeforeFly.pose.scene,
    `${planet.id}: surface fly-to must visibly rotate the camera`);
  assert.ok(poseDuringFly.zoom > poseBeforeFly.zoom,
    `${planet.id}: surface fly-to must visibly increase zoom`);
  const zoomBeforeFlyWheel = (await profile.camera(page)).zoom;
  await showInteractionPhase(page, "Wheel zoom during fly-to");
  await wheel(page, profile.inputSelector, -40);
  const flyAfterWheel = await interactionStats(page, planet.id);
  assert.equal(flyAfterWheel.activeMode, "idle",
    `${planet.id}: wheel must cancel fly-to before zooming`);
  assert.equal(flyAfterWheel.activeMotionCount, 0,
    `${planet.id}: wheel must leave no pending fly-to callback`);
  assert.equal(flyAfterWheel.surfaceFlyTo.cancels, activeFly.surfaceFlyTo.cancels + 1,
    `${planet.id}: wheel must cancel exactly one flight`);
  assert.deepEqual(flyAfterWheel.lastInterruption, { from: "fly-to", to: "wheel" });
  await page.waitForTimeout(PREPARED_WHEEL_ZOOM.intervalMilliseconds + 50);
  assert.notEqual((await profile.camera(page)).zoom, zoomBeforeFlyWheel,
    `${planet.id}: wheel must still change zoom after stopping the flight`);
  const wheelRest = await cameraPose(page, planet.id);
  await page.waitForTimeout(250);
  assert.deepEqual(await cameraPose(page, planet.id), wheelRest,
    `${planet.id}: fly-to must not resume after wheel zoom stops`);
  assert.equal((await interactionStats(page, planet.id)).surfaceFlyTo.frames,
    flyAfterWheel.surfaceFlyTo.frames, `${planet.id}: canceled flight cannot publish more frames`);

  // Exercise direct pointer interruption separately from wheel takeover.
  await profile.setCamera(page, { pitch: bounds.defaultPitch, zoom: bounds.defaultZoom });
  flyCoordinates = await surfaceFlyCoordinates(page);
  await page.mouse.dblclick(flyCoordinates.surface.x, flyCoordinates.surface.y, { delay: 45 });
  await page.waitForTimeout(180);
  const flyBeforePointer = await interactionStats(page, planet.id);
  assert.equal(flyBeforePointer.activeMode, "fly-to");
  await page.mouse.move(
    flyCoordinates.surface.x,
    flyCoordinates.surface.y,
  );
  await showInteractionPhase(page, "Grab control during fly-to");
  await page.mouse.down();
  await page.mouse.move(
    flyCoordinates.surface.x + 32,
    flyCoordinates.surface.y,
    { steps: 4 },
  );
  await page.waitForTimeout(
    GOOGLE_EARTH_DRAG_INERTIA.releaseFreshnessMilliseconds + 20,
  );
  await page.mouse.up();
  const flyAfterDrag = await interactionStats(page, planet.id);
  assert.equal(flyAfterDrag.activeMode, "idle",
    `${planet.id}: a settled direct drag must replace fly-to`);
  assert.equal(flyAfterDrag.activeMotionCount, 0,
    `${planet.id}: drag interruption must leave no competing fly-to`);
  assert.equal(
    flyAfterDrag.surfaceFlyTo.cancels,
    flyBeforePointer.surfaceFlyTo.cancels + 1,
    `${planet.id}: drag must cancel exactly one active fly-to`,
  );
  assert.deepEqual(flyAfterDrag.lastInterruption, {
    from: "fly-to",
    to: "pointer",
  }, `${planet.id}: pointer-down must own the fly-to interruption`);

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  flyCoordinates = await surfaceFlyCoordinates(page);
  await showInteractionPhase(page, "Repeated double-click through full arrival");
  const flyBeforeRepeat = await interactionStats(page, planet.id);
  await page.mouse.dblclick(
    flyCoordinates.surface.x,
    flyCoordinates.surface.y,
    { delay: 45 },
  );
  await waitFrames(page);
  await page.mouse.dblclick(
    flyCoordinates.surface.x,
    flyCoordinates.surface.y,
    { delay: 45 },
  );
  await waitFrames(page);
  const repeatedFly = await interactionStats(page, planet.id);
  assert.equal(
    repeatedFly.surfaceFlyTo.starts,
    flyBeforeRepeat.surfaceFlyTo.starts + 2,
    `${planet.id}: repeated double click must restart fly-to from current state`,
  );
  assert.equal(
    repeatedFly.surfaceFlyTo.cancels,
    flyBeforeRepeat.surfaceFlyTo.cancels + 1,
    `${planet.id}: repeated double click must cancel only the prior fly-to`,
  );
  assert.equal(repeatedFly.activeMode, "fly-to",
    `${planet.id}: the newest repeated double click must own the camera`);
  assert.equal(repeatedFly.activeMotionCount, 1,
    `${planet.id}: repeated double click must keep one fly-to only`);
  await page.waitForFunction(id =>
    !window[`__${id}`].camera.stats().dragInertia.surfaceFlyTo.active,
  planet.id, { timeout: GOOGLE_EARTH_SURFACE_FLY_TO.durationMilliseconds + 2000 });
  const completedFly = await interactionStats(page, planet.id);
  assert.equal(completedFly.surfaceFlyTo.completions,
    flyBeforeRepeat.surfaceFlyTo.completions + 1,
  `${planet.id}: the replacement fly-to must run through completion`);
  const completedPose = await cameraPose(page, planet.id);
  await waitFrames(page);
  assert.deepEqual(await cameraPose(page, planet.id), completedPose,
    `${planet.id}: completed fly-to must leave the camera at rest`);
  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  const settled = await interactionStats(page, planet.id);
  assert.equal(settled.activeMode, "idle",
    `${planet.id}: programmatic reset must interrupt the final fly-to`);
  assert.equal(settled.activeMotionCount, 0,
    `${planet.id}: reset must leave no scheduled camera motion`);

  return {
    wheelInterruptedInertia: true,
    throwInput,
    wheelZoomRatio,
    wheelAnchorRotationApplied: true,
    pointerStoppedInertia: true,
    captureLossStoppedDrag: true,
    wheelCoexistedWithFlyTo: true,
    dragInterruptedFlyTo: true,
    repeatedDoubleClickRestartedFlyTo: true,
    flyToCompletedAndRested: true,
    activeMotionCount: settled.activeMotionCount,
  };
}

function showInteractionPhase(page, label) {
  if (!evidenceDirectory) return;
  return page.evaluate(text => {
    document.querySelector("#camera-conformance-label").textContent = text;
  }, label);
}

function interactionStats(page, objectId) {
  return page.evaluate((id) =>
    globalThis[`__${id}`].camera.stats().dragInertia, objectId);
}

// The object's prepared wheel dolly when its camera is the shared
// perspective projection; null for the scale camera.
function wheelDolly(page, objectId) {
  return page.evaluate((id) => {
    const stats = globalThis[`__${id}`].camera.stats();
    return stats.projection?.model === "css-perspective-shared-with-sky"
      ? stats.dolly
      : null;
  }, objectId);
}

function cameraDistance(page, objectId) {
  return page.evaluate((id) => {
    const camera = globalThis[`__${id}`].camera, state = camera.state();
    return camera.stats().dolly?.distanceOrigin === 'surface'
      ? state.distance * (1 - 1 / state.distanceRadii) : state.distance;
  }, objectId);
}

function cameraPose(page, objectId) {
  return page.evaluate((id) => {
    const camera = globalThis[`__${id}`].camera.state();
    return {
      controlPitch: camera.controlPitch,
      controlYaw: camera.controlYaw,
      // Anchor reprojection can leave sub-nanounit zoom round-off at rest.
      // Rotation and the rendered pose still require exact equality below.
      zoom: Number(camera.zoom.toFixed(9)),
      pose: camera.pose,
    };
  }, objectId);
}

async function proveBreakpointCrossings(page, planet, profile, bounds, baseline) {
  const camera = await page.locator(".polycss-camera").elementHandle();
  assert.ok(camera, `${planet.id}: retained camera must exist`);
  const requestedState = {
    pitch: bounds.defaultPitch +
      (bounds.maximumPitch - bounds.defaultPitch) * 0.2,
    zoom: Math.min(bounds.maximumZoom, bounds.defaultZoom + 0.2),
  };
  await profile.setCamera(page, requestedState);
  await waitFrames(page);
  const expected = await profile.camera(page);
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.setViewportSize({ width: 820, height: 900 });
    await waitFrames(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `${planet.id}: 820x900 must not overflow horizontally`);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: 820px mobile mode must preserve camera state`);
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: 820px must enable vertical page flow`);
    await wheel(page, profile.inputSelector, -240);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: 820px mobile mode must keep wheel disabled`);

    await page.setViewportSize({ width: 864, height: 901 });
    await waitFrames(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `${planet.id}: 864x901 must not overflow horizontally`);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: portrait mobile mode must preserve camera state`);
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: portrait viewport must preserve vertical page flow`);

    await page.setViewportSize({ width: 821, height: 720 });
    await waitFrames(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `${planet.id}: 821x720 must not overflow horizontally`);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: 821px landscape desktop mode must preserve camera state`);
    assert.notEqual(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: 821px landscape must restore desktop touch policy`);
    await wheel(page, profile.inputSelector, -240);
    assert.ok((await profile.camera(page)).zoom > expected.zoom,
      `${planet.id}: 821px landscape desktop mode must restore wheel zoom`);
    await profile.setCamera(page, expected);
  }
  assert.equal(await page.evaluate(({ node }) =>
    node === document.querySelector(".polycss-camera"), { node: camera }), true,
  `${planet.id}: breakpoint changes must preserve camera identity`);
  const after = await sceneState(page, profile);
  assert.equal(after.stageElements, baseline.stageElements,
    `${planet.id}: breakpoint changes must not grow retained DOM`);
  assert.equal(after.stageChildren, baseline.stageChildren,
    `${planet.id}: breakpoint changes must not remount scene roots`);
  assert.equal(after.stable, true,
    `${planet.id}: breakpoint changes must preserve retained identity`);
}

async function proveMobile(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const evidence = observePage(page, baseUrl, profile);
  try {
    await loadPlanet(page, planet, profile);
    const state = await sceneState(page, profile);
    assertSceneStructure(state, planet.id);
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: narrow screens must preserve vertical page flow`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390,
      `${planet.id}: narrow screens must not overflow horizontally`);

    const bounds = await profile.bounds(page);
    const current = await profile.camera(page);
    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: current.zoom,
    });
    await wheel(page, profile.inputSelector, -240);
    const afterWheel = await profile.camera(page);
    assert.equal(afterWheel.zoom, current.zoom,
      `${planet.id}: narrow screens must not claim wheel zoom`);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: mobile input policy must preserve retained nodes`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, viewport: "mobile", ...state };
  } finally {
    await page.close();
  }
}

async function loadPlanet(page, planet, profile) {
  const response = await page.goto(new URL(planet.route, baseUrl).href, {
    waitUntil: "networkidle",
  });
  assert.equal(response?.status(), 200, `${planet.id}: route must return 200`);
  await assertRenderedObjectControls(page, profile);
  await page.waitForFunction(() => window.__cssEarth?.ready === true);
  await profile.waitForRuntime(page);
  await assertStandaloneMoonContract(page, planet);
}

async function assertStandaloneMoonContract(page, planet) {
  const evidence = await page.evaluate(({ id }) => {
    const stage = document.querySelector(".planet-stage");
    return {
      moonControlCount: document.querySelectorAll('input[name="moons"]').length,
      embeddedMoonNodeCount: id === "moon" ? 0 : stage?.querySelectorAll(
        '[class*="moon"], [data-moon-id], [data-moon]',
      ).length ?? 0,
      moonSceneRequests: id === "moon" ? [] : performance
        .getEntriesByType("resource")
        .map(({ name }) => new URL(name).pathname)
        .filter((pathname) =>
          pathname.startsWith(`/scenes/${id}/`) && /moon/iu.test(pathname)),
    };
  }, { id: planet.id });
  assert.equal(evidence.moonControlCount, 0,
    `${planet.id}: satellites are standalone objects, not parent-scene controls`);
  assert.equal(evidence.embeddedMoonNodeCount, 0,
    `${planet.id}: parent scenes must not mount embedded moon DOM`);
  assert.deepEqual(evidence.moonSceneRequests, [],
    `${planet.id}: parent scenes must not request moon presentation assets`);
}

async function enableMotion(page, id) {
  const panel = page.locator(".planet-settings-panel");
  const action = page.locator(".planet-settings-action");
  const motion = page.locator(".planet-motion-setting");
  await action.click();
  assert.equal(await panel.isVisible(), true,
    `${id}: settings action must open the settings panel`);
  assert.equal(await motion.isChecked(), false,
    `${id}: desktop motion must be off by default`);
  await page.locator(".planet-motion-setting-control").click();
  await page.waitForFunction(() => window.__cssEarth?.lifecycle === "mounted");
  assert.equal(await motion.isChecked(), true,
    `${id}: motion setting must resume the scene`);
  await page.locator(".explorer-rail-explore").click();
}

async function sceneState(page, profile) {
  const state = await page.evaluate(() => {
    const stage = document.querySelector(".planet-stage");
    return {
      mountedPlanets: window.__cssEarth?.mountedObjectCount,
      stageCount: document.querySelectorAll(".planet-stage").length,
      cameraCount: stage?.querySelectorAll(".polycss-camera").length,
      canvasCount: document.querySelectorAll("canvas").length,
      sceneSvgCount: stage?.querySelectorAll("svg").length,
      stageChildren: stage?.childElementCount,
      stageElements: stage?.querySelectorAll("*").length,
    };
  });
  return { ...state, stable: await profile.stable(page) };
}

function assertSceneStructure(state, id) {
  assert.equal(state.mountedPlanets, 1, `${id}: exactly one planet must mount`);
  assert.equal(state.stageCount, 1, `${id}: exactly one stage must exist`);
  assert.equal(state.cameraCount, 1, `${id}: exactly one camera must exist`);
  assert.equal(state.canvasCount, 0, `${id}: canvas is forbidden`);
  assert.equal(state.sceneSvgCount, 0, `${id}: scene SVG is forbidden`);
  assert.equal(state.stable, true, `${id}: retained nodes must be stable`);
}

async function drag(page, selector, deltaX, deltaY) {
  assert.ok(await page.locator(selector).isVisible(),
    `Input surface is not visible: ${selector}.`);
  const box = await page.locator(".planet-stage .polycss-camera").boundingBox();
  assert.ok(box, "Retained camera must be visible for a planet drag.");
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.5;
  await page.evaluate(() => {
    const events = [];
    const lifetime = new AbortController();
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
      document.addEventListener(type, event => {
        events.push({ type, at:event.timeStamp, receivedAt:performance.now(),
          x:event.clientX, y:event.clientY, trusted:event.isTrusted });
      }, { capture:true, signal:lifetime.signal });
    }
    window.__conformanceDragReceipt = () => { lifetime.abort(); return events; };
  });
  await page.mouse.move(x, y);
  const input = await page.context().newCDPSession(page);
  try {
    await input.send("Input.dispatchMouseEvent", {
      type:"mousePressed", x, y, button:"left", buttons:1, clickCount:1,
    });
    // A changing final movement launches a throw; uniform steps do not.
    for (let step = 1; step <= 10; step++) {
      await input.send("Input.dispatchMouseEvent", {
        type:"mouseMoved", x:x + deltaX * .7 * step / 10,
        y:y + deltaY * .7 * step / 10, button:"left", buttons:1,
      });
      await page.waitForTimeout(16);
    }
    // Native release does not wait for the renderer to acknowledge the move.
    // One CDP channel preserves send order; Playwright's mouse.move waits for
    // animation frames and can otherwise send a concurrent mouse.up first.
    await Promise.all([
      input.send("Input.dispatchMouseEvent", {
        type:"mouseMoved", x:x + deltaX, y:y + deltaY, button:"left", buttons:1,
      }),
      input.send("Input.dispatchMouseEvent", {
        type:"mouseReleased", x:x + deltaX, y:y + deltaY,
        button:"left", buttons:0, clickCount:1,
      }),
    ]);
  } finally { await input.detach(); }
  const receipt = await page.evaluate(() => {
    const events = window.__conformanceDragReceipt();
    delete window.__conformanceDragReceipt;
    return events;
  });
  const release = receipt.at(-1);
  const lastMove = receipt.findLast(event => event.type === "pointermove");
  assert.ok(receipt.every(event => event.trusted) && release?.type === "pointerup" &&
    lastMove && release.at >= lastMove.at &&
    release.at - lastMove.at <= GOOGLE_EARTH_DRAG_INERTIA.releaseFreshnessMilliseconds,
    `The drag driver must deliver an ordered, fresh browser release: ${JSON.stringify(receipt)}`);
  return receipt;
}

async function wheel(page, selector, deltaY) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `Input surface is not visible: ${selector}.`);
  // A viewport fraction can land in empty sky for a small object. Exercise
  // the surface anchor using the same measured on-disc point as fly-to.
  const { surface } = await surfaceFlyCoordinates(page);
  await page.mouse.move(surface.x, surface.y);
  await page.mouse.wheel(0, deltaY);
  await waitFrames(page);
}

async function beginZoomPublicationProbe(page) {
  await page.evaluate(() => {
    const targets = Object.freeze(Object.fromEntries(Object.entries({
      directionalSun: document.querySelector(".planet-directional-sun"),
      skyCube: document.querySelector(".planet-cubic-sky-cube"),
      skyOrientation: document.querySelector(
        ".planet-cubic-sky-orientation",
      ),
    }).filter(([, node]) => node !== null)));
    const counts = Object.fromEntries(
      Object.keys(targets).map((key) => [key, 0]),
    );
    const consume = (records) => {
      for (const record of records) {
        const key = Object.entries(targets).find(
          ([, target]) => target === record.target,
        )?.[0];
        if (key) counts[key] += 1;
      }
    };
    const observer = new MutationObserver(consume);
    observer.observe(document.querySelector(".planet-stage"), {
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "style"],
    });
    window.__zoomPublicationProbe = { observer, consume, counts };
  });
}

async function finishZoomPublicationProbe(page) {
  return page.evaluate(() => {
    const probe = window.__zoomPublicationProbe;
    probe.consume(probe.observer.takeRecords());
    probe.observer.disconnect();
    delete window.__zoomPublicationProbe;
    return probe.counts;
  });
}

function waitFrames(page) {
  return page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function observePage(page, localBaseUrl, profile) {
  const problems = [];
  const externalRequests = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    const localUrl = new URL(localBaseUrl);
    if (requestUrl.origin !== localUrl.origin &&
        !profile.preparedRemoteRoots?.some(root => request.url().startsWith(root))) {
      externalRequests.push(request.url());
    }
  });
  return { problems, externalRequests };
}

function assertEvidence({ problems, externalRequests }, id) {
  assert.deepEqual(problems, [], `${id}: browser must report no problems`);
  assert.deepEqual(externalRequests, [], `${id}: browser must make no undeclared external requests`);
}

function setDocumentVisibility(page, hidden) {
  return page.evaluate((nextHidden) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: nextHidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}
