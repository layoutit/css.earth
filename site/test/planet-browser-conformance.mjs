import assert from "node:assert/strict";
import { chromium } from "playwright";

import { OBJECTS } from "../objects.mjs";
import { MOBILE_TOUCH_ACTION } from "../runtime-policy.mjs";
import { loadPlanetBrowserProfile } from "./load-browser-profile.mjs";
import { GOOGLE_EARTH_SURFACE_FLY_TO } from
  "../../src/platform/google-earth-surface-fly-to.mjs";
import { GOOGLE_EARTH_DRAG_INERTIA } from
  "../../src/platform/google-earth-drag-inertia.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const requestedId = process.argv[3] ?? null;
const renderOnly = process.env.CSSEARTH_RENDER_ONLY === "1";
const densityOnly = process.env.CSSEARTH_DENSITY_ONLY === "1";
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
      reports.push(await provePreparedDensity(browser, planet, profile, 1));
      reports.push(await provePreparedDensity(browser, planet, profile, 2));
      continue;
    }
    reports.push(await proveDesktop(browser, planet, profile));
    reports.push(await proveMobile(browser, planet, profile));
    reports.push(await provePreReadyTarget(browser, planet, profile, true));
    reports.push(await provePreReadyTarget(browser, planet, profile, false));
    reports.push(await provePreparedDensity(browser, planet, profile, 1));
    reports.push(await provePreparedDensity(browser, planet, profile, 2));
    reports.push(await proveLensRace(browser, planet, profile));
    reports.push(await proveLensRejection(browser, planet, profile));
    reports.push(await proveLensDestroy(browser, planet, profile));
  }
} finally {
  await browser.close();
}

async function provePreReadyTarget(browser, planet, profile, finalHidden) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const evidence = observePage(page, baseUrl);
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
    await started;
    assert.equal(await page.evaluate(() => window.__cssEarth?.lifecycle), "loading",
      `${planet.id}: gated preparation must remain loading`);
    const preReadyButtons = page.locator('button[name="lens"]');
    if (profile.audit.lensRace.preReadyDisabled) {
      await page.waitForFunction(() =>
        [...document.querySelectorAll('button[name="lens"]')].every(
          (button) => button.disabled,
        ));
    } else {
      await page.locator(
        `button[name="lens"][value="${profile.audit.lensRace.slowId}"]`,
      ).evaluate((button) => button.click());
      assert.equal(await page.locator(
        'button[name="lens"][aria-pressed="true"]',
      ).getAttribute("value"), profile.audit.lensRace.defaultId,
      `${planet.id}: pre-ready lens input must not publish a selection`);
    }
    await setDocumentVisibility(page, true);
    if (!finalHidden) await setDocumentVisibility(page, false);
    assert.notEqual(await page.evaluate(() =>
      document.documentElement.dataset.playing), "true",
    `${planet.id}: pre-ready resume must not publish mounted playback state`);
    releaseAssets();
    await page.waitForFunction(() => window.__cssEarth?.ready === true);
    await profile.waitForRuntime(page);
    const lifecycle = await page.evaluate(() => window.__cssEarth.lifecycle);
    assert.equal(lifecycle, "paused",
      `${planet.id}: default motion-off state must survive pre-ready visibility`);
    const animationStates = await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).map(({ playState }) => playState));
    assert.ok(animationStates.every((state) => state === "paused"),
      `${planet.id}: pre-ready completion must preserve motion off`);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: pre-ready lifecycle must preserve retained identity`);
    assertEvidence(evidence, planet.id);
    return {
      id: planet.id,
      viewport: finalHidden
        ? "pre-ready-hidden-motion-off"
        : "pre-ready-visible-motion-off",
      animationCount: animationStates.length,
    };
  } finally {
    releaseAssets?.();
    await page.close();
  }
}

async function proveLensRace(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl);
  const race = profile.audit.lensRace;
  await page.addInitScript(() => {
    const decode = Image.prototype.decode;
    globalThis.__preparedImageDecodes = Object.create(null);
    Image.prototype.decode = function preparedDecode(...arguments_) {
      const pathname = new URL(this.currentSrc || this.src).pathname;
      globalThis.__preparedImageDecodes[pathname] =
        (globalThis.__preparedImageDecodes[pathname] ?? 0) + 1;
      return decode.apply(this, arguments_);
    };
  });
  let releaseSlow;
  let markSlowStarted;
  const slowGate = new Promise((resolve) => { releaseSlow = resolve; });
  const slowStarted = new Promise((resolve) => { markSlowStarted = resolve; });
  await page.route(`**${race.slowAsset}`, async (route) => {
    markSlowStarted();
    await slowGate;
    await route.continue();
  });
  try {
    await loadPlanet(page, planet, profile);
    const slowSelection = profile.selectLens(page, race.slowId);
    await slowStarted;
    await profile.selectLens(page, race.winnerId);
    const repeatedSlowSelection = profile.selectLens(page, race.slowId);
    await profile.selectLens(page, race.winnerId);
    releaseSlow();
    await Promise.all([slowSelection, repeatedSlowSelection]);
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
    releaseSlow?.();
    await page.close();
  }
}

async function proveLensRejection(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl);
  const race = profile.audit.lensRace;
  await page.route(`**${race.slowAsset}`, (route) => route.fulfill({
    status: 200,
    contentType: "image/webp",
    body: "invalid prepared image",
  }));
  try {
    await loadPlanet(page, planet, profile);
    await assert.rejects(profile.selectLens(page, race.slowId));
    await assertLensConsistency(page, planet, profile, race.defaultId);
    assert.equal(await profile.stable(page), true,
      `${planet.id}: a rejected lens must preserve retained nodes`);
    assertEvidence(evidence, planet.id);
    return { id: planet.id, viewport: "lens-rejection", lens: race.defaultId };
  } finally {
    await page.close();
  }
}

async function proveLensDestroy(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const evidence = observePage(page, baseUrl);
  const race = profile.audit.lensRace;
  let releaseSlow;
  let markSlowStarted;
  const slowGate = new Promise((resolve) => { releaseSlow = resolve; });
  const slowStarted = new Promise((resolve) => { markSlowStarted = resolve; });
  await page.route(`**${race.slowAsset}`, async (route) => {
    markSlowStarted();
    await slowGate;
    await route.continue();
  });
  try {
    await loadPlanet(page, planet, profile);
    const selection = profile.selectLens(page, race.slowId);
    await slowStarted;
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    releaseSlow();
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
    releaseSlow?.();
    await page.close();
  }
}

async function assertLensConsistency(page, planet, profile, expectedId) {
  const state = await profile.lens(page);
  assert.equal(state.id, expectedId,
    `${planet.id}: runtime lens state must match the winning request`);
  assert.equal(state.ready, true,
    `${planet.id}: winning lens state must be ready`);
  assert.equal(await profile.visibleLens(page), expectedId,
    `${planet.id}: visible material must match runtime lens state`);
  assert.equal(await profile.pressedLens(page), expectedId,
    `${planet.id}: selected control must match the visible material`);
}
console.log(JSON.stringify({ ok: true, reports }, null, 2));

async function proveDesktop(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const evidence = observePage(page, baseUrl);
  try {
    await loadPlanet(page, planet, profile);
    await enableMotion(page, planet.id);
    let introductionLines = null;
    if (!renderOnly) {
      const introduction = await page.locator(".planet-introduction").evaluate(
        (element) => {
          const style = getComputedStyle(element);
          const lineHeight = Number.parseFloat(style.lineHeight);
          const height = element.getBoundingClientRect().height;
          const contentHeight = height -
            Number.parseFloat(style.paddingTop) -
            Number.parseFloat(style.paddingBottom) -
            Number.parseFloat(style.borderTopWidth) -
            Number.parseFloat(style.borderBottomWidth);
          return {
            height,
            contentHeight,
            lineHeight,
            lineRatio: contentHeight / lineHeight,
          };
        },
      );
      introductionLines = Math.round(introduction.lineRatio);
      assert.ok(Math.abs(introduction.lineRatio - 4) < 0.01,
        `${planet.id}: desktop introduction must occupy exactly four lines`);
    }
    const projectiveTextureReport = await page.locator(".planet-stage")
      .evaluate((stage) => {
        const directProjectiveLeaves = [...stage.querySelectorAll("s")]
          .filter((leaf) => {
            const matrix = new DOMMatrix(leaf.style.transform || "none");
            return !leaf.querySelector(":scope > .polycss-projective-texture") &&
              (Math.abs(matrix.m14) > 1e-10 || Math.abs(matrix.m24) > 1e-10);
          });
        const textures = [...stage.querySelectorAll(
          ".polycss-projective-texture",
        )];
        return {
          directProjectiveLeafCount: directProjectiveLeaves.length,
          flattenedTextureCount: textures.length,
          allTexturesFlat: textures.every((texture) =>
            texture.style.transformStyle === "flat"),
          allFramesAffine: textures.every((texture) => {
            const matrix = new DOMMatrix(
              texture.parentElement.style.transform || "none",
            );
            return Math.abs(matrix.m14) <= 1e-10 &&
              Math.abs(matrix.m24) <= 1e-10;
          }),
        };
      });
    assert.equal(projectiveTextureReport.directProjectiveLeafCount, 0,
      `${planet.id}: no texture leaf may retain the exploding projective frame`);
    assert.ok(projectiveTextureReport.flattenedTextureCount > 0,
      `${planet.id}: prepared projective textures must be mounted`);
    assert.equal(projectiveTextureReport.allTexturesFlat, true,
      `${planet.id}: prepared projective textures must rasterize flat`);
    assert.equal(projectiveTextureReport.allFramesAffine, true,
      `${planet.id}: prepared texture frames must remain affine`);
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
      `${planet.id}: a fast release must continue with Google Earth drag inertia`);

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
    await beginZoomPublicationProbe(page);
    await wheel(page, profile.inputSelector, -240);
    const zoomPublication = await finishZoomPublicationProbe(page);
    const zoomed = await profile.camera(page);
    assert.ok(zoomed.zoom > bounds.defaultZoom,
      `${planet.id}: wheel toward the user must zoom in`);
    assert.deepEqual(zoomPublication, {
      directionalSun: 0,
      skyCube: 0,
      skyOrientation: 0,
    }, `${planet.id}: zoom must not republish orientation-dependent layers`);

    await profile.setCamera(page, {
      pitch: bounds.defaultPitch,
      zoom: bounds.defaultZoom,
    });
    const flyCoordinates = await surfaceFlyCoordinates(page);
    const beforeFlyTo = await profile.camera(page);
    await page.mouse.dblclick(
      flyCoordinates.surface.x,
      flyCoordinates.surface.y,
      { delay: 45 },
    );
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

    await setDocumentVisibility(page, true);
    assert.equal(await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).every(
        ({ playState }) => playState === "paused",
      )), true, `${planet.id}: pause must stop every scene animation`);
    await setDocumentVisibility(page, false);
    assert.ok(await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).some(
        ({ playState }) => playState === "running",
      )), `${planet.id}: resume must restart scene animation`);

    const retainedProof = await finishRetainedProbe(
      page,
      profile.audit.retained.allowedMountSelectors,
    );
    assert.equal(retainedProof.initialNodesIntact, true,
      `${planet.id}: independent observation must retain every initial node`);
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
      introductionLines,
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
      addedRoots,
      removedRoots,
      observer,
      maximumNodeCount: () => maximumNodeCount,
    };
  });
}

async function exerciseRetainedInteractions(page, planet, profile) {
  const retained = profile.audit.retained;
  for (const id of retained.lensIds) {
    await profile.selectLens(page, id);
    await assertLensConsistency(page, planet, profile, id);
  }
  await profile.selectLens(page, retained.lensIds[0]);
  await assertLensConsistency(page, planet, profile, retained.lensIds[0]);

  const speed = page.locator('button[name="speed"]');
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
    await speed.evaluate((button) => button.click());
    await waitFrames(page);
    assert.equal(await speed.getAttribute("data-state"), state.label,
      `${planet.id}: speed control must publish ${state.label}`);
    const animations = await page.locator(".planet-stage").evaluate((stage) =>
      stage.getAnimations({ subtree: true }).map((animation) => ({
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
        stage.getAnimations({ subtree: true }).map((animation) => ({
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
  });
  const page = await context.newPage();
  const evidence = observePage(page, baseUrl);
  const requestedPaths = new Set();
  page.on("request", (request) => {
    requestedPaths.add(new URL(request.url()).pathname);
  });
  try {
    await loadPlanet(page, planet, profile);
    assert.equal(await profile.selectedDensity(page), 2,
      `${planet.id}: DPR ${density} must select the canonical high-density bank`);
    for (const pair of profile.audit.preparedAssetPairs) {
      const selectedAsset = pair.two;
      const rejectedAsset = pair.one;
      assert.ok(requestedPaths.has(selectedAsset),
        `${planet.id}: DPR ${density} must request canonical ${selectedAsset}`);
      assert.equal(requestedPaths.has(rejectedAsset), false,
        `${planet.id}: DPR ${density} must not request low-density ${rejectedAsset}`);
    }
    const interactionInterruptions = await proveInteractionInterruptions(
      page,
      planet,
      profile,
    );
    if (densityOnly) {
      assert.deepEqual(evidence.externalRequests, [],
        `${planet.id}: browser must make no external requests`);
    } else {
      assertEvidence(evidence, planet.id);
    }
    return {
      id: planet.id,
      viewport: `dpr-${density}`,
      selectedDensity: 2,
      interactionInterruptions,
      ...(densityOnly
        ? { browserProblemsOutsideDensityProof: evidence.problems }
        : {}),
    };
  } finally {
    await context.close();
  }
}

async function proveInteractionInterruptions(page, planet, profile) {
  const bounds = await profile.bounds(page);
  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });

  await drag(page, profile.inputSelector, 0, 150);
  const inertiaBeforeWheel = await interactionStats(page, planet.id);
  assert.equal(inertiaBeforeWheel.activeMode, "inertia",
    `${planet.id}: fast release must enter inertia before wheel interruption`);
  assert.equal(inertiaBeforeWheel.activeMotionCount, 1,
    `${planet.id}: inertia must be the only active camera motion`);
  await wheel(page, profile.inputSelector, -40);
  const inertiaAfterWheel = await interactionStats(page, planet.id);
  assert.equal(inertiaAfterWheel.activeMode, "inertia",
    `${planet.id}: wheel zoom must coexist with drag inertia`);
  assert.equal(inertiaAfterWheel.activeMotionCount, 1,
    `${planet.id}: wheel zoom must not add a camera animation owner`);
  assert.equal(
    inertiaAfterWheel.wheelCoexistences,
    inertiaBeforeWheel.wheelCoexistences + 1,
    `${planet.id}: wheel coexistence must be recorded once`,
  );
  const pitchAfterWheel = (await profile.camera(page)).pitch;
  await waitFrames(page);
  assert.ok(Math.abs(
    (await profile.camera(page)).pitch - pitchAfterWheel,
  ) > 0.001, `${planet.id}: rotational inertia must continue through wheel zoom`);

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  let flyCoordinates = await surfaceFlyCoordinates(page);
  const flyBeforeDrag = await interactionStats(page, planet.id);
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
  const zoomBeforeFlyWheel = (await profile.camera(page)).zoom;
  await wheel(page, profile.inputSelector, -40);
  const flyAfterWheel = await interactionStats(page, planet.id);
  assert.equal(flyAfterWheel.activeMode, "fly-to",
    `${planet.id}: wheel zoom must coexist with fly-to`);
  assert.equal(flyAfterWheel.activeMotionCount, 1,
    `${planet.id}: wheel during fly-to must keep one animation owner`);
  assert.equal(
    flyAfterWheel.wheelCoexistences,
    activeFly.wheelCoexistences + 1,
    `${planet.id}: fly-to wheel coexistence must be recorded once`,
  );
  assert.equal(
    flyAfterWheel.wheelTargetRebases,
    activeFly.wheelTargetRebases + 1,
    `${planet.id}: wheel during fly-to must rebase its target once`,
  );
  await page.waitForTimeout(120);
  assert.notEqual((await profile.camera(page)).zoom, zoomBeforeFlyWheel,
    `${planet.id}: rebased fly-to must continue changing zoom`);
  await page.mouse.move(
    flyCoordinates.surface.x,
    flyCoordinates.surface.y,
  );
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
    flyBeforeDrag.surfaceFlyTo.cancels + 1,
    `${planet.id}: drag must cancel exactly one active fly-to`,
  );
  assert.deepEqual(flyAfterDrag.lastInterruption, {
    from: "fly-to",
    to: "drag",
  }, `${planet.id}: drag must own the fly-to interruption`);

  await profile.setCamera(page, {
    pitch: bounds.defaultPitch,
    zoom: bounds.defaultZoom,
  });
  flyCoordinates = await surfaceFlyCoordinates(page);
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
    wheelCoexistedWithInertia: true,
    wheelCoexistedWithFlyTo: true,
    dragInterruptedFlyTo: true,
    repeatedDoubleClickRestartedFlyTo: true,
    activeMotionCount: settled.activeMotionCount,
  };
}

function interactionStats(page, objectId) {
  return page.evaluate((id) =>
    globalThis[`__${id}`].camera.stats().dragInertia, objectId);
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
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: 820px mobile mode must preserve camera state`);
    assertResponsiveShell(
      await responsiveShellState(page),
      "mobile",
      `${planet.id}: 820px`,
    );
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: 820px must enable vertical page flow`);
    const mobilePreviewGeometry = await page.evaluate(() => {
      const stage = document.querySelector(".planet-stage").getBoundingClientRect();
      const sidebar = document.querySelector(".planet-sidebar")
        .getBoundingClientRect();
      return {
        sceneCenter: stage.top + stage.height / 2,
        previewCenter: sidebar.top / 2,
      };
    });
    assert.ok(
      Math.abs(
        mobilePreviewGeometry.sceneCenter -
          mobilePreviewGeometry.previewCenter,
      ) <= 0.1,
      `${planet.id}: mobile scene must be centered above the sheet`,
    );
    await wheel(page, profile.inputSelector, -240);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: 820px mobile mode must keep wheel disabled`);

    await page.setViewportSize({ width: 864, height: 901 });
    await waitFrames(page);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: portrait mobile mode must preserve camera state`);
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: portrait viewport must preserve vertical page flow`);
    assertResponsiveShell(
      await responsiveShellState(page),
      "mobile",
      `${planet.id}: 864x901 portrait`,
    );

    await page.setViewportSize({ width: 821, height: 720 });
    await waitFrames(page);
    assert.deepEqual(await profile.camera(page), expected,
      `${planet.id}: 821px landscape desktop mode must preserve camera state`);
    assert.notEqual(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: 821px landscape must restore desktop touch policy`);
    const compactDesktopShell = await responsiveShellState(page);
    assertResponsiveShell(
      compactDesktopShell,
      "desktop",
      `${planet.id}: 821x720 landscape`,
    );
    assert.equal(compactDesktopShell.navigation, false,
      `${planet.id}: compact desktop must hide the whole planet navigation`);
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

async function responsiveShellState(page) {
  return page.evaluate(() => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      return element !== null && getComputedStyle(element).display !== "none";
    };
    return {
      wordmark: visible(".planet-wordmark"),
      version: visible(".planet-wordmark-version"),
      search: visible(".planet-sidebar-search-card"),
      information: visible(".planet-information-panel"),
      navigation: visible(".planetary-navigation"),
      navigationToggle: visible(".planetary-navigation-toggle"),
      legacySunCount: document.querySelectorAll(".scale-sun").length,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

function assertResponsiveShell(state, profile, label) {
  assert.equal(state.wordmark, true, `${label}: wordmark must be visible`);
  assert.equal(state.version, true, `${label}: version must be visible`);
  assert.equal(state.search, true, `${label}: object search must be visible`);
  assert.equal(state.information, true,
    `${label}: information panel must be visible`);
  assert.equal(state.navigationToggle, profile === "mobile",
    `${label}: navigation control must match the responsive profile`);
  assert.equal(state.legacySunCount, 0,
    `${label}: legacy Sun navigation must not render`);
  assert.equal(state.overflow, false,
    `${label}: shell must not overflow horizontally`);
}

async function proveMobile(browser, planet, profile) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const evidence = observePage(page, baseUrl);
  try {
    await loadPlanet(page, planet, profile);
    const state = await sceneState(page, profile);
    assertSceneStructure(state, planet.id);
    assert.equal(await page.locator(profile.inputSelector).evaluate((node) =>
      getComputedStyle(node).touchAction), MOBILE_TOUCH_ACTION,
    `${planet.id}: narrow screens must preserve vertical page flow`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390,
      `${planet.id}: narrow screens must not overflow horizontally`);
    assertResponsiveShell(
      await responsiveShellState(page),
      "mobile",
      `${planet.id}: 390x844 mobile`,
    );

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
  assert.equal(await panel.getAttribute("open"), "",
    `${id}: settings action must open the settings panel`);
  assert.equal(await motion.isChecked(), false,
    `${id}: desktop motion must be off by default`);
  await page.locator(".planet-motion-setting-control").click();
  await page.waitForFunction(() => window.__cssEarth?.lifecycle === "mounted");
  assert.equal(await motion.isChecked(), true,
    `${id}: motion setting must resume the scene`);
  await action.click();
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
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `Input surface is not visible: ${selector}.`);
  const x = box.x + box.width * 0.72;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 12 });
  await page.mouse.up();
}

async function wheel(page, selector, deltaY) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `Input surface is not visible: ${selector}.`);
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5);
  await page.mouse.wheel(0, deltaY);
  await waitFrames(page);
}

async function beginZoomPublicationProbe(page) {
  await page.evaluate(() => {
    const targets = Object.freeze({
      directionalSun: document.querySelector(".planet-directional-sun"),
      skyCube: document.querySelector(".planet-cubic-sky-cube"),
      skyOrientation: document.querySelector(
        ".planet-cubic-sky-orientation",
      ),
    });
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

function observePage(page, localBaseUrl) {
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
    if (requestUrl.origin !== localUrl.origin) externalRequests.push(request.url());
  });
  return { problems, externalRequests };
}

function assertEvidence({ problems, externalRequests }, id) {
  assert.deepEqual(problems, [], `${id}: browser must report no problems`);
  assert.deepEqual(externalRequests, [], `${id}: browser must make no external requests`);
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
