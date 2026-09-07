// Mercury lighting and sky geometry, pinned on painted pixels against an
// independent astronomical oracle.
//
// Expected values come from lighting-geometry-oracle.mjs (VSOP87A position,
// IAU pole, obliquity, Hipparcos galactic constants, own vector maths) and the
// painted camera rotation read off `.mercury-scene`. Nothing from src/platform
// or the Mercury runtime is imported; the scene's published Sun, frame and
// registration values are never used as expectations. Measurements are made
// on screenshots from real Chrome.
//
// Usage: node tests/objects/browser/mercury/lighting-geometry-browser.mjs [baseUrl]
// Exit status is non-zero when any check fails; the last stdout line is a
// JSON report listing every check with its measured margin.

import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "playwright";

import * as oracle from "./lighting-geometry-oracle.mjs";
import * as measure from "./lighting-geometry-measure.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";

// Tolerances. Each is set from the measured residual of a correct render
// (see the report's `margin` fields) with headroom, and each is far below the
// effect of the mutations the gate applies (lighting-geometry-mutation-gate).
export const TOLERANCES = Object.freeze({
  // Lit direction of the painted lighting overlay (its shading over a white
  // ground, luminance centroid) against the oracle, degrees.
  litDirectionDegrees: 2,
  // Lit direction of the composite (albedo texture under the overlay): the
  // surface albedo pulls the centroid by several degrees, so this is coarse.
  compositeLitDirectionDegrees: 10,
  // Below this oracle illuminated fraction the composite's lit pixels are a sliver
  // of the limb whose centroid is set by the surface albedo alone (the
  // overlay's own direction is still judged at 2 degrees); not judged.
  compositeMinimumIlluminatedFraction: 0.1,
  // Terminator line (fitted crossings on the overlay) against the oracle.
  terminatorDegrees: 2,
  // Illuminated fraction against (1 + cos phase) / 2. The prepared material
  // has a soft terminator and limb darkening, so a thresholded fraction reads
  // systematically low (about 0.07 at half phase, 0.12 at gibbous); the
  // tolerance covers that bias while a mirrored phase is off by 0.8.
  illuminatedFraction: 0.1,
  // Subsolar latitude recovered from pixels, degrees (physical bound 0.05).
  // With the Sun sprite on screen the whole Sun vector is read off the
  // sprite and the overlay, and the bound is tight. Without it the Sun's
  // depth comes from the illuminated fraction, whose bias above propagates
  // through the pole's depth component; that reading is evaluated only where
  // the phase is moderate (subsolarPhaseSineMinimum) and bounded loosely.
  subsolarLatitudeSpriteDegrees: 3,
  subsolarLatitudeDegrees: 12,
  subsolarPhaseSineMinimum: 0.5,
  // Sun sprite centre against the oracle projection, as a share of the sky
  // focal length (about 1.7 degrees).
  sunSpriteShare: 0.03,
  // Sky vs Sun motion under a drag: pixel direction, and rotation angle
  // about the painted drag axis (sky vs Sun, and Sun vs body).
  translationAngleDegrees: 6,
  translationRateShare: 0.05,
  // Body translation against the drag and against the sky, degrees.
  bodyTranslationAngleDegrees: 15,
  // Milky Way band principal axis against the oracle, degrees.
  bandAngleDegrees: 4,
  // Sky anchors (compact objects) against the oracle, degrees on the sky.
  anchorDegrees: 1,
  // Galactic bulge peak against the galactic centre, degrees.
  bulgeDegrees: 6,
});

const checks = [];
const report = { baseUrl, poses: {}, drags: [], sky: {} };
const dumpDirectory = process.env.MERCURY_GEOMETRY_DUMP ?? null;
if (dumpDirectory) await mkdir(dumpDirectory, { recursive: true });
let dumpCount = 0;
async function dump(name, image) {
  if (!dumpDirectory) return;
  dumpCount += 1;
  await writeFile(`${dumpDirectory}/${String(dumpCount).padStart(2, "0")}-${name}.png`, image);
}

function check(id, ok, detail) {
  checks.push({ id, ok: Boolean(ok), ...detail });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail)}`);
}

const ephemeris = await oracle.loadMercuryEphemeris();
const sky = oracle.buildOracle(ephemeris);
report.oracle = {
  ephemeris: ephemeris.source,
  sunEclipticLatitudeDegrees: sky.sunEclipticLatitudeDegrees,
  subsolarLatitudeDegrees: sky.subsolarLatitudeDegrees,
  poleTiltDegrees: sky.poleTiltDegrees,
  galacticPlaneInclinationDegrees: sky.galacticPlaneInclinationDegrees,
};
check("oracle-subsolar-latitude-physical", Math.abs(sky.subsolarLatitudeDegrees) <= 0.05, {
  value: sky.subsolarLatitudeDegrees,
});

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
// A fresh context: Mercury's asset URLs carry no content hash.
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
try {
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`error: ${message.text()}`);
  });
  const response = await page.goto(new URL("/mercury/", baseUrl).href, {
    waitUntil: "networkidle",
  });
  if (response?.status() !== 200) {
    throw new Error(`Mercury page returned ${response?.status()}.`);
  }
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true &&
    window.__mercury?.ready === true &&
    document.documentElement.dataset.ready === "true");

  // Shadows on, through the user control.
  const shadows = await page.evaluate(() => {
    const control = [...document.querySelectorAll("input[type=checkbox]")]
      .find((element) =>
        /shadow/iu.test(element.closest("label")?.textContent ?? ""));
    if (!control) return { found: false };
    control.checked = true;
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return { found: true };
  });
  // The selection commits once its prepared material is resident.
  if (shadows.found) {
    await page.waitForFunction(() =>
      window.__mercury.runtime.selection().committed.shadows === true);
    shadows.hidden = await page.evaluate(() =>
      document.querySelector(".planet-stage").classList
        .contains("mercury-hide-shadows"));
  }
  await nextPaint(page);
  check("shadows-enabled", shadows.found && shadows.hidden === false, shadows);

  // Freeze the body's spin so surface texture only moves under drags.
  await page.evaluate(() => {
    const input = document.querySelector('input[name="motion"]');
    if (input.checked) input.click();
  });
  await nextPaint(page);

  const geometry = await readGeometry(page);
  report.geometry = geometry;

  // ---------------------------------------------------------------------
  // Lighting at four poses: the default, and three reached by dragging.
  // ---------------------------------------------------------------------
  const defaultPose = await readPose(page);
  const defaultAngles = oracle.scenePitchYawDegrees(defaultPose);
  check("default-pose-is-pitch-40-yaw-0",
    Math.abs(defaultAngles.pitchDegrees - 40) < 0.01 &&
    Math.abs(defaultAngles.yawDegrees) < 0.01, defaultAngles);

  // Screen target for the on-screen Sun, in focal units (tan of the angles
  // off the view axis): right of the body, clear of the visible viewport
  // edge (the shell lays the stage out beside its panel, so the vanishing
  // point is not the viewport's centre) with room for the sprite's glow and
  // the small drags below.
  // Either side of the body serves; the side with the room keeps the same
  // phase the suite was tuned for.
  const visibleRight = Math.min(geometry.stageBox.x + geometry.stageBox.width,
    page.viewportSize().width);
  const visibleLeft = Math.max(geometry.stageBox.x, 0);
  const roomRight = (visibleRight - geometry.stageCentre[0] - 140) / geometry.skyFocalPixels;
  const roomLeft = (geometry.stageCentre[0] - visibleLeft - 140) / geometry.skyFocalPixels;
  const sunOnScreenTarget = roomRight >= roomLeft
    ? [Math.min(0.46, roomRight), 0.1]
    : [-Math.min(0.46, roomLeft), 0.1];
  const litPoses = [
    { id: "default", reach: async () => {} },
    // A rightward drag swings the Sun round toward the camera: gibbous
    // phase, sprite behind the camera.
    { id: "sun-behind-camera", reach: () => dragOnDisc(page, geometry, [200, 0]) },
    // Drags the other way until the Sun stands well beyond the body, left
    // of the field of view: a fat crescent, sprite off screen.
    { id: "sun-beside",
      reach: () => dragSunToScreen(page, geometry, [-0.8, 0.15], "sun-beside") },
    // Drags until the Sun stands beside the body on screen: thin crescent,
    // sprite visible.
    { id: "sun-on-screen",
      reach: () => dragSunToScreen(page, geometry, sunOnScreenTarget, "sun-on-screen") },
  ];
  const litResults = {};
  for (const { id, reach } of litPoses) {
    await resetToDefault(page);
    await reach();
    litResults[id] = await measureLighting(page, geometry, id);
    report.poses[id] = litResults[id];
  }
  const spriteVisibleIds = Object.entries(litResults)
    .filter(([, result]) => result.sprite.visible).map(([id]) => id);
  check("poses-cover-sun-on-screen-and-behind", spriteVisibleIds.length >= 1 &&
    spriteVisibleIds.length < litPoses.length, { spriteVisibleIds });
  const subsolarPoses = checks.filter(({ id }) =>
    id.endsWith("-subsolar-latitude-within-physical-bound")).length;
  check("subsolar-latitude-evaluated-at-three-poses", subsolarPoses >= 3, {
    subsolarPoses,
  });
  check("poses-are-distinct", new Set(Object.values(litResults).map(({ pose }) =>
    pose.map((v) => v.toFixed(3)).join(","))).size === litPoses.length, {});

  // ---------------------------------------------------------------------
  // Sky and Sun translate together under drags; the body the other way.
  // ---------------------------------------------------------------------
  await page.evaluate(() => {
    document.body.dataset.skyContrast = "high";
  });
  await nextPaint(page);
  // Small drags: the sky moves several times faster than the pointer, and
  // the Sun must stay clear of both the body and the viewport edge.
  const dragPixels = 12;
  for (const [name, delta] of [
    ["right", [dragPixels, 0]],
    ["left", [-dragPixels, 0]],
    ["down", [0, dragPixels]],
    ["up", [0, -dragPixels]],
  ]) {
    await resetToDefault(page);
    await dragSunToScreen(page, geometry, sunOnScreenTarget);
    report.drags.push(await measureDragTranslation(page, geometry, name, delta));
  }

  // ---------------------------------------------------------------------
  // The wheel is a dolly: the eye moves along its own axis. Wheel events
  // with the cursor off the disc centre change the distance and nothing
  // else; the painted scene rotation is the same text before and after.
  // ---------------------------------------------------------------------
  report.wheel = [];
  for (const [name, offset, deltaY] of [
    ["disc-out", [0.5, 0.2], 100],
    ["sky-out", [1.8, -0.6], 100],
    ["disc-in", [-0.5, 0.3], -100],
  ]) {
    await resetToDefault(page);
    report.wheel.push(await measureWheelDolly(page, geometry, name, offset, deltaY));
  }

  // ---------------------------------------------------------------------
  // The sky: Milky Way band at two controlled poses, compact anchors at
  // poses that centre each of them.
  // ---------------------------------------------------------------------
  const pitchMap = await calibrateControlPitch(page);
  report.sky.pitchMap = pitchMap;
  for (const [id, controlPitch, controlYaw] of [
    ["away-from-centre", pitchMap.controlForScenePitch(0), 0],
    ["toward-centre", pitchMap.controlForScenePitch(0), 176],
  ]) {
    await setPose(page, { controlPitch, controlYaw, zoom: 1.1 });
    report.sky[id] = await measureBand(page, geometry, id);
  }
  report.sky.anchors = [];
  for (const anchor of oracle.SKY_ANCHORS) {
    const direction = sky.galacticToPresentation([anchor.l, anchor.b]);
    const { pitchDegrees, yawDegrees } = poseCentring(direction);
    await setPose(page, {
      controlPitch: pitchMap.controlForScenePitch(pitchDegrees),
      controlYaw: yawDegrees,
      zoom: 1.1,
    });
    report.sky.anchors.push(await measureAnchor(page, geometry, anchor));
  }
  await page.evaluate(() => {
    delete document.body.dataset.skyContrast;
  });

  check("no-page-errors", problems.length === 0, { problems });
} finally {
  await context.close();
  await browser.close();
}

const failed = checks.filter(({ ok }) => !ok);
// Flushed before exiting: pipe writes are asynchronous on macOS.
await new Promise((resolve) => process.stdout.write(`${JSON.stringify({
  ok: failed.length === 0,
  suite: "mercury-lighting-geometry",
  failed: failed.map(({ id }) => id),
  checks,
  report,
})}\n`, resolve));
process.exit(failed.length === 0 ? 0 : 1);

// -----------------------------------------------------------------------
// Pose measurements
// -----------------------------------------------------------------------

async function measureLighting(page, geometry, id) {
  const pose = await readPose(page);
  const angles = oracle.scenePitchYawDegrees(pose);
  const sunView = sky.view(pose, sky.sunPresentation);
  const poleView = sky.view(pose, sky.polePresentation);
  const expectedLit = oracle.litDirectionDegrees(sunView);
  const expectedFraction = oracle.illuminatedFraction(sunView);

  // Lighting on the body: body and lighting overlay only.
  // The painted disc: its silhouette with the lighting overlay hidden gives
  // the centre and radius every lighting measurement is taken about.
  const discBox = await page.locator(".mercury-material").boundingBox();
  const restoreBody = await isolate(page, [".mercury-camera"]);
  const bodyShot = await page.screenshot({ clip: discBox });
  await restoreBody();
  const disc = await measure.discSilhouette(bodyShot);
  // The lighting overlay by itself, over a white ground: its shading is what
  // is painted, free of the surface albedo underneath.
  const restoreOverlay = await isolate(page, [".mercury-material-root"]);
  await page.evaluate(() => {
    document.querySelector(".planet-stage").style.background = "#fff";
  });
  await nextPaint(page);
  const overlayShot = await page.screenshot({ clip: discBox });
  await page.evaluate(() => {
    document.querySelector(".planet-stage").style.removeProperty("background");
  });
  await restoreOverlay();
  await dump(`${id}-overlay`, overlayShot);
  const overlayLevels = await measure.discLighting(overlayShot, { disc });
  const overlayThreshold = (overlayLevels.percentiles.p10 +
    overlayLevels.percentiles.p995) / 2;
  const overlay = await measure.discLighting(overlayShot, {
    disc,
    threshold: overlayThreshold,
  });
  // Lighting on the body: body and lighting overlay together.
  const restoreDisc = await isolate(page, [".mercury-camera", ".mercury-material-root"]);
  const discShot = await page.screenshot({ clip: discBox });
  await restoreDisc();
  await dump(`${id}-disc`, discShot);
  // The night side of the prepared material paints at luminance 0..5 at
  // every phase (see the report percentiles); pixels above that are lit.
  const threshold = 6;
  const lighting = await measure.discLighting(discShot, { threshold, disc });
  const fraction = await measure.illuminatedShare(discShot, { threshold, disc });
  const litError = oracle.wrapDegrees(overlay.litDirectionDegrees - expectedLit);
  const compositeLitError = oracle.wrapDegrees(
    lighting.litDirectionDegrees - expectedLit,
  );

  // The Sun sprite alone.
  const restoreSprite = await isolate(page, [".mercury-directional-sun"]);
  const spriteShot = await page.screenshot({ clip: geometry.stageBox });
  await restoreSprite();
  await dump(`${id}-sprite`, spriteShot);
  const blob = await measure.brightBlob(spriteShot);
  const projected = oracle.projectDirection(sunView, geometry.skyFocalPixels);
  const expectedSprite = projected && [
    geometry.stageCentre[0] - geometry.stageBox.x + projected[0],
    geometry.stageCentre[1] - geometry.stageBox.y + projected[1],
  ];
  const spriteInside = expectedSprite !== null &&
    expectedSprite[0] > 0 && expectedSprite[0] < geometry.stageBox.width &&
    expectedSprite[1] > 0 && expectedSprite[1] < geometry.stageBox.height;
  const spriteVisible = blob.pixels > 200;
  const spriteError = spriteVisible && expectedSprite
    ? Math.hypot(blob.centre[0] - expectedSprite[0],
      blob.centre[1] - expectedSprite[1]) / geometry.skyFocalPixels
    : null;
  // Sprite direction from the disc centre vs the lit direction, from pixels
  // only.
  const spriteDirection = spriteVisible
    ? Math.atan2(
      -(blob.centre[1] + geometry.stageBox.y - geometry.stageCentre[1]),
      blob.centre[0] + geometry.stageBox.x - geometry.stageCentre[0],
    ) * 180 / Math.PI
    : null;

  // Sun direction recovered from pixels: azimuth from the centroid, cosine
  // of the phase from the illuminated fraction. Subsolar latitude against
  // the oracle's pole.
  const cosPhase = Math.max(-1, Math.min(1, 2 * fraction - 1));
  const sinPhase = Math.sqrt(1 - cosPhase * cosPhase);
  const azimuth = overlay.litDirectionDegrees * Math.PI / 180;
  const sunFromPixels = [
    Math.cos(azimuth) * sinPhase,
    -Math.sin(azimuth) * sinPhase,
    cosPhase,
  ];
  const subsolarLatitude = Math.asin(oracle.dot(sunFromPixels, poleView)) *
    180 / Math.PI;

  check(`${id}-lit-direction-matches-oracle`,
    Math.abs(litError) < TOLERANCES.litDirectionDegrees, {
      measured: overlay.litDirectionDegrees,
      expected: expectedLit,
      margin: TOLERANCES.litDirectionDegrees - Math.abs(litError),
    });
  if (expectedFraction >= TOLERANCES.compositeMinimumIlluminatedFraction) {
    check(`${id}-composite-lit-direction-matches-oracle`,
      Math.abs(compositeLitError) < TOLERANCES.compositeLitDirectionDegrees, {
        measured: lighting.litDirectionDegrees,
        expected: expectedLit,
        margin: TOLERANCES.compositeLitDirectionDegrees - Math.abs(compositeLitError),
      });
  }
  check(`${id}-illuminated-fraction-matches-phase`,
    Math.abs(fraction - expectedFraction) < TOLERANCES.illuminatedFraction, {
      measured: fraction,
      expected: expectedFraction,
      margin: TOLERANCES.illuminatedFraction - Math.abs(fraction - expectedFraction),
    });
  // With the sprite on screen, the Sun vector comes from the sprite's
  // position (depth and azimuth) — a precise reading of the physical bound.
  let subsolarLatitudeFromSprite = null;
  if (spriteVisible) {
    const sunFromSprite = oracle.normalize([
      (blob.centre[0] + geometry.stageBox.x - geometry.stageCentre[0]) /
        geometry.skyFocalPixels,
      (blob.centre[1] + geometry.stageBox.y - geometry.stageCentre[1]) /
        geometry.skyFocalPixels,
      -1,
    ]);
    subsolarLatitudeFromSprite = Math.asin(oracle.dot(sunFromSprite, poleView)) *
      180 / Math.PI;
    check(`${id}-subsolar-latitude-within-physical-bound`,
      Math.abs(subsolarLatitudeFromSprite) < TOLERANCES.subsolarLatitudeSpriteDegrees, {
        measured: subsolarLatitudeFromSprite,
        source: "sun-sprite",
        margin: TOLERANCES.subsolarLatitudeSpriteDegrees - Math.abs(subsolarLatitudeFromSprite),
      });
  }
  // Near new or full phase the illuminated fraction barely constrains the
  // Sun's depth, so the recovered latitude is not meaningful there.
  const phaseSine = Math.sqrt(1 - sunView[2] * sunView[2]);
  if (!spriteVisible && phaseSine >= TOLERANCES.subsolarPhaseSineMinimum) {
    check(`${id}-subsolar-latitude-within-physical-bound`,
      Math.abs(subsolarLatitude) < TOLERANCES.subsolarLatitudeDegrees, {
        measured: subsolarLatitude,
        source: "illuminated-fraction",
        poleViewZ: poleView[2],
        phaseSine,
        margin: TOLERANCES.subsolarLatitudeDegrees - Math.abs(subsolarLatitude),
      });
  }
  check(`${id}-sun-sprite-visibility-matches-oracle`,
    spriteVisible === spriteInside, {
      spriteVisible,
      spriteInside,
      expectedSprite,
      blobPixels: blob.pixels,
    });
  if (spriteVisible) {
    check(`${id}-sun-sprite-position-matches-oracle`,
      spriteError !== null && spriteError < TOLERANCES.sunSpriteShare, {
        measured: blob.centre,
        expected: expectedSprite,
        errorShare: spriteError,
        margin: spriteError === null ? null : TOLERANCES.sunSpriteShare - spriteError,
      });
    const spriteLitError = oracle.wrapDegrees(
      spriteDirection - overlay.litDirectionDegrees,
    );
    check(`${id}-lit-side-faces-sun-sprite`,
      Math.abs(spriteLitError) < TOLERANCES.litDirectionDegrees * 2, {
        spriteDirection,
        litDirection: overlay.litDirectionDegrees,
        margin: TOLERANCES.litDirectionDegrees * 2 - Math.abs(spriteLitError),
      });
  }

  let terminator = null;
  if (id === "default") {
    terminator = await measure.terminatorLine(overlayShot, {
      threshold: overlayThreshold,
      litDirectionDegrees: overlay.litDirectionDegrees,
      disc,
    });
    // The terminator is perpendicular to the Sun's screen direction.
    const expectedTerminator = ((expectedLit + 90) % 180 + 180) % 180;
    const terminatorError = ((terminator.angleDegrees - expectedTerminator) %
      180 + 270) % 180 - 90;
    check("default-terminator-matches-oracle",
      Math.abs(terminatorError) < TOLERANCES.terminatorDegrees, {
        measured: terminator.angleDegrees,
        expected: expectedTerminator,
        residualPixels: terminator.residualPixels,
        margin: TOLERANCES.terminatorDegrees - Math.abs(terminatorError),
      });
    check("default-terminator-near-vertical-sun-left",
      Math.abs(terminator.angleDegrees - 90) < 8 &&
      Math.abs(oracle.wrapDegrees(overlay.litDirectionDegrees - 180)) < 8, {
        terminator: terminator.angleDegrees,
        litDirection: overlay.litDirectionDegrees,
      });
    check("default-half-phase", Math.abs(fraction - 0.5) < 0.1, { fraction });
  }

  return {
    pose,
    angles,
    sunView,
    poleView,
    disc: { ...disc, boxCentre: [discBox.width / 2, discBox.height / 2] },
    overlay: { ...overlay, threshold: overlayThreshold },
    lighting: { ...lighting, threshold, fraction, litError, compositeLitError,
      expectedLit, expectedFraction },
    terminator,
    sprite: { visible: spriteVisible, blob, expectedSprite, spriteError,
      spriteDirection },
    subsolarLatitude,
    subsolarLatitudeFromSprite,
  };
}

async function measureDragTranslation(page, geometry, name, delta) {
  const before = await captureLayers(page, geometry);
  const poseBefore = await readPose(page);
  await dragOnDisc(page, geometry, delta);
  const after = await captureLayers(page, geometry);
  const poseAfter = await readPose(page);

  const sunBefore = await measure.brightBlob(before.sprite);
  const sunAfter = await measure.brightBlob(after.sprite);
  const sunVisible = sunBefore.pixels > 200 && sunAfter.pixels > 200;
  const sunShift = sunVisible
    ? [sunAfter.centre[0] - sunBefore.centre[0],
      sunAfter.centre[1] - sunBefore.centre[1]]
    : null;

  // Stars around the vanishing point, where a small rotation is closest to
  // a pure translation (the body and the shell chrome are hidden in the sky
  // shot). Rates are compared as rotation angles about the painted drag
  // axis, so the sky and the Sun need not share a screen position.
  const origin = [
    geometry.stageCentre[0] - geometry.stageBox.x,
    geometry.stageCentre[1] - geometry.stageBox.y,
  ];
  const skyWindow = windowAround(origin, 240, geometry.stageBox);
  const skyShift = sunVisible ? await measure.estimateShift(
    before.skyOnly, after.skyOnly, {
      window: skyWindow,
      expected: sunShift,
      radius: Math.max(16, Math.hypot(...sunShift) * 0.5),
    }) : null;
  const direction = ([x, y]) => oracle.normalize([
    (x - origin[0]) / geometry.skyFocalPixels,
    (y - origin[1]) / geometry.skyFocalPixels,
    -1,
  ]);
  // The painted drag: rotation the scene matrix took between the shots.
  const dragRotation = oracle.multiplyMatrices(poseAfter, transpose(poseBefore));
  const painted = axisAngle(dragRotation);
  const rotationAbout = (from, shift) => rotationAboutAxis(painted.axis,
    direction(from), direction([from[0] + shift[0], from[1] + shift[1]]));
  const windowCentre = [skyWindow.x + skyWindow.width / 2,
    skyWindow.y + skyWindow.height / 2];
  // The body's surface texture around the disc centre.
  const discCentreInStage = [
    geometry.discCentre[0] - geometry.stageBox.x,
    geometry.discCentre[1] - geometry.stageBox.y,
  ];
  // Well inside the limb: the silhouette does not move, the texture does.
  const bodyShift = await measure.estimateShift(before.bodyOnly, after.bodyOnly, {
    window: windowAround(discCentreInStage, geometry.discRadius * 0.45,
      geometry.stageBox),
    expected: delta,
    radius: Math.hypot(...delta) * 0.8 + 12,
    scale: 1,
  });

  const angleBetween = (a, b) => Math.abs(oracle.wrapDegrees(
    (Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0])) * 180 / Math.PI,
  ));
  check(`drag-${name}-sun-sprite-stays-visible`, sunVisible, {
    before: sunBefore.pixels,
    after: sunAfter.pixels,
  });
  if (sunVisible && skyShift.shift) {
    const angle = angleBetween(sunShift, skyShift.shift);
    const skyRotation = rotationAbout(windowCentre, skyShift.shift);
    const sunRotation = rotationAbout(sunBefore.centre, sunShift);
    const rate = skyRotation / sunRotation;
    const sunRate = sunRotation / painted.angleDegrees;
    check(`drag-${name}-sun-follows-painted-rotation`,
      Math.abs(sunRate - 1) < TOLERANCES.translationRateShare, {
        sunRotation,
        paintedRotation: painted.angleDegrees,
        axis: painted.axis,
        margin: TOLERANCES.translationRateShare - Math.abs(sunRate - 1),
      });
    check(`drag-${name}-sky-moves-with-sun-direction`,
      angle < TOLERANCES.translationAngleDegrees, {
        sunShift,
        skyShift: skyShift.shift,
        angle,
        margin: TOLERANCES.translationAngleDegrees - angle,
        score: skyShift.score,
        distinctness: skyShift.distinctness,
      });
    check(`drag-${name}-sky-moves-with-sun-rate`,
      Math.abs(rate - 1) < TOLERANCES.translationRateShare, {
        skyRotation,
        sunRotation,
        rate,
        margin: TOLERANCES.translationRateShare - Math.abs(rate - 1),
      });
    check(`drag-${name}-sky-correlation-is-distinct`,
      skyShift.score > 0.25 && skyShift.distinctness > 0.1, {
        score: skyShift.score,
        distinctness: skyShift.distinctness,
      });
    const bodyVsSky = bodyShift.shift
      ? angleBetween(bodyShift.shift, skyShift.shift.map((v) => -v))
      : null;
    check(`drag-${name}-body-moves-opposite-sky`,
      bodyVsSky !== null && bodyVsSky < TOLERANCES.bodyTranslationAngleDegrees, {
        bodyShift: bodyShift.shift,
        angle: bodyVsSky,
        margin: bodyVsSky === null ? null : TOLERANCES.bodyTranslationAngleDegrees - bodyVsSky,
        score: bodyShift.score,
      });
  }
  const bodyVsDrag = bodyShift.shift ? angleBetween(bodyShift.shift, delta) : null;
  check(`drag-${name}-body-follows-pointer`,
    bodyVsDrag !== null && bodyVsDrag < TOLERANCES.bodyTranslationAngleDegrees &&
    Math.hypot(...bodyShift.shift) > Math.hypot(...delta) * 0.5, {
      bodyShift: bodyShift.shift,
      drag: delta,
      angle: bodyVsDrag,
      margin: bodyVsDrag === null ? null : TOLERANCES.bodyTranslationAngleDegrees - bodyVsDrag,
      score: bodyShift.score,
      distinctness: bodyShift.distinctness,
    });
  return {
    name,
    delta,
    poseBefore: oracle.scenePitchYawDegrees(poseBefore),
    poseAfter: oracle.scenePitchYawDegrees(poseAfter),
    sunShift,
    skyShift,
    bodyShift,
  };
}

// Six wheel events at a cursor `offset` (in disc radii from the disc centre)
// must move the camera distance and leave the painted scene rotation
// exactly as it was: the matrix3d text is compared, not a tolerance.
async function measureWheelDolly(page, geometry, name, offset, deltaY) {
  const readRotation = () => page.locator(".mercury-scene").evaluate(
    (element) => /matrix3d\([^)]*\)/u.exec(element.style.transform)?.[0] ?? null,
  );
  const readDistance = () => page.evaluate(() => window.__mercury.camera.state().distance);
  const before = await readRotation();
  const distanceBefore = await readDistance();
  const angles = oracle.scenePitchYawDegrees(await readPose(page));
  await page.mouse.move(
    geometry.discCentre[0] + offset[0] * geometry.discRadius,
    geometry.discCentre[1] + offset[1] * geometry.discRadius,
  );
  for (let event = 0; event < 6; event += 1) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(320);
  await nextPaint(page);
  const after = await readRotation();
  const distanceAfter = await readDistance();
  const afterAngles = oracle.scenePitchYawDegrees(await readPose(page));
  const result = {
    name, offset, deltaY, distanceBefore, distanceAfter,
    rotationHeld: before !== null && before === after,
    yawDriftDegrees: afterAngles.yawDegrees - angles.yawDegrees,
    pitchDriftDegrees: afterAngles.pitchDegrees - angles.pitchDegrees,
  };
  check(`wheel-${name}-holds-scene-rotation`,
    result.rotationHeld && distanceAfter !== distanceBefore, result);
  return result;
}

async function measureBand(page, geometry, id) {
  const pose = await readPose(page);
  const angles = oracle.scenePitchYawDegrees(pose);
  const focal = geometry.skyFocalPixels;
  const project = (presentationDirection) => {
    const view = sky.view(pose, presentationDirection);
    const point = oracle.projectDirection(view, focal);
    if (!point) return null;
    return [
      geometry.stageCentre[0] - geometry.stageBox.x + point[0],
      geometry.stageCentre[1] - geometry.stageBox.y + point[1],
    ];
  };
  const planePoints = [];
  for (let longitude = 0; longitude < 360; longitude += 0.25) {
    const point = project(sky.galacticToPresentation([longitude, 0]));
    if (point && point[0] >= 0 && point[0] < geometry.stageBox.width &&
        point[1] >= 0 && point[1] < geometry.stageBox.height) {
      planePoints.push([point[0], point[1], 1]);
    }
  }
  const predictedAngle = oracle.principalAxisDegrees(planePoints);
  const restore = await isolate(page, [".mercury-skybox"]);
  const shot = await page.screenshot({ clip: geometry.stageBox });
  await restore();
  await dump(`band-${id}`, shot);
  const band = await measure.milkyWayBand(shot);
  const measuredAngle = oracle.principalAxisDegrees(band.samples);
  const error = ((measuredAngle - predictedAngle) % 180 + 270) % 180 - 90;
  check(`sky-${id}-band-angle-matches-oracle`,
    band.samples.length > 1000 && Math.abs(error) < TOLERANCES.bandAngleDegrees, {
      measured: measuredAngle,
      predicted: predictedAngle,
      margin: TOLERANCES.bandAngleDegrees - Math.abs(error),
      samples: band.samples.length,
    });
  let bulge = null;
  if (id === "toward-centre") {
    const centre = project(sky.galacticToPresentation([0, 0]));
    const separationDegrees = centre
      ? Math.atan(Math.hypot(band.peak[0] - centre[0], band.peak[1] - centre[1]) /
        focal) * 180 / Math.PI
      : null;
    check("sky-bulge-peak-on-galactic-centre",
      separationDegrees !== null && separationDegrees < TOLERANCES.bulgeDegrees, {
        peak: band.peak,
        centre,
        separationDegrees,
        margin: separationDegrees === null ? null : TOLERANCES.bulgeDegrees - separationDegrees,
      });
    bulge = { peak: band.peak, centre, separationDegrees };
  }
  return { angles, predictedAngle, measuredAngle, error, bulge,
    threshold: band.threshold, samples: band.samples.length };
}

async function measureAnchor(page, geometry, anchor) {
  const pose = await readPose(page);
  const focal = geometry.skyFocalPixels;
  const direction = sky.view(pose, sky.galacticToPresentation([anchor.l, anchor.b]));
  const point = oracle.projectDirection(direction, focal);
  const predicted = point && [
    geometry.stageCentre[0] - geometry.stageBox.x + point[0],
    geometry.stageCentre[1] - geometry.stageBox.y + point[1],
  ];
  const restore = await isolate(page, [".mercury-skybox"]);
  const shot = await page.screenshot({ clip: geometry.stageBox });
  await restore();
  await dump(`anchor-${anchor.name}`, shot);
  const pixelsPerDegree = focal * Math.PI / 180;
  const field = await measure.detailField(shot, {
    narrowSigma: Math.max(1, anchor.extentDegrees * 0.35 * pixelsPerDegree),
    wideSigma: Math.max(4, (anchor.extentDegrees * 0.35 + 4) * pixelsPerDegree),
  });
  const searchRadius = (anchor.extentDegrees / 2 + 3) * pixelsPerDegree;
  const peak = predicted ? field.peakNear(predicted, searchRadius) : null;
  // Back-project the found pixel to a direction and compare on the sky.
  let separationDegrees = null;
  if (peak?.at) {
    const dx = peak.at[0] - (geometry.stageCentre[0] - geometry.stageBox.x);
    const dy = peak.at[1] - (geometry.stageCentre[1] - geometry.stageBox.y);
    const found = oracle.normalize([dx / focal, dy / focal, -1]);
    separationDegrees = oracle.angleBetweenDegrees(found, direction);
  }
  const spread = field.spread();
  const strong = peak !== null && peak.value > spread * 4;
  check(`sky-anchor-${anchor.name}-on-oracle-position`,
    strong && separationDegrees < TOLERANCES.anchorDegrees, {
      predicted,
      found: peak?.at ?? null,
      separationDegrees,
      peakValue: peak?.value ?? null,
      spread,
      margin: separationDegrees === null ? null : TOLERANCES.anchorDegrees - separationDegrees,
    });
  return { name: anchor.name, angles: oracle.scenePitchYawDegrees(pose),
    predicted, found: peak?.at ?? null, separationDegrees,
    peakValue: peak?.value ?? null, spread };
}

// -----------------------------------------------------------------------
// Page helpers
// -----------------------------------------------------------------------

async function readGeometry(page) {
  const stageBox = await page.locator(".planet-stage").boundingBox();
  const discBox = await page.locator(".mercury-material").boundingBox();
  const skyFocalPixels = await page.locator(".mercury-skybox").evaluate(
    (element) => parseFloat(getComputedStyle(element).perspective),
  );
  // The sky's vanishing point: where a direction along the view axis is
  // painted. The Sun sprite and the stars are both far away, so both project
  // from here; the body is laid out beside the shell chrome and need not sit
  // on it.
  const origin = await page.locator(".mercury-skybox").evaluate((element) => {
    const [x, y] = getComputedStyle(element).perspectiveOrigin.split(" ")
      .map(parseFloat);
    const box = element.getBoundingClientRect();
    return [box.x + x, box.y + y];
  });
  return {
    stageBox,
    // Vanishing point in page coordinates.
    stageCentre: origin,
    discCentre: [discBox.x + discBox.width / 2, discBox.y + discBox.height / 2],
    discRadius: discBox.width / 2,
    skyFocalPixels,
  };
}

async function readPose(page) {
  const transform = await page.locator(".mercury-scene").evaluate(
    (element) => element.style.transform,
  );
  return oracle.parseSceneRotation(transform);
}

async function setPose(page, state) {
  await page.evaluate((next) => window.__mercury.camera.setState(next), state);
  await nextPaint(page);
}

async function resetToDefault(page) {
  await page.evaluate(() => {
    const stats = window.__mercury.camera.stats();
    window.__mercury.camera.setState({
      controlPitch: stats.defaultControlPitchDegrees,
      controlYaw: stats.defaultControlYawDegrees,
      zoom: 1.1,
    });
  });
  await nextPaint(page);
}

// Drags from the disc centre; ends at rest so no inertial throw follows.
async function dragOnDisc(page, geometry, [dx, dy]) {
  const [x, y] = geometry.discCentre;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = 16;
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(x + dx * step / steps, y + dy * step / steps);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(320);
  await page.mouse.up();
  await page.waitForTimeout(120);
  await nextPaint(page);
  const first = await readPose(page);
  await page.waitForTimeout(150);
  await nextPaint(page);
  const second = await readPose(page);
  if (first.some((value, index) => Math.abs(value - second[index]) > 1e-9)) {
    throw new Error("Camera still moving after the drag settled.");
  }
}

// Drags until the Sun's view direction projects to `target` (focal units:
// x/-z, y/-z). Only painted poses are read; the drag gain is the trackball's
// pixels-per-radian estimate, corrected by iteration.
async function dragSunToScreen(page, geometry, target, label = "drag") {
  const steps = [];
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const view = sky.view(await readPose(page), sky.sunPresentation);
    if (!(view[2] < -0.2)) {
      // Sun toward the camera: swing it round first.
      await dragOnDisc(page, geometry, [-220, 0]);
      steps.push({ swing: true, view });
      continue;
    }
    const error = [target[0] - view[0] / -view[2], target[1] - view[1] / -view[2]];
    steps.push({ view, error });
    if (Math.abs(error[0]) < 0.02 && Math.abs(error[1]) < 0.02) break;
    // A drag of p pixels turns the scene by about p / radius radians; far
    // directions then move the opposite way on screen.
    const gain = geometry.discRadius * 0.8;
    await dragOnDisc(page, geometry, [
      clampPixels(-error[0] * gain, 220),
      clampPixels(-error[1] * gain, 220),
    ]);
  }
  report.sunDragSteps ??= {};
  report.sunDragSteps[label] = steps;
}

function transpose(matrix) {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8],
  ];
}

function axisAngle(matrix) {
  const trace = matrix[0] + matrix[4] + matrix[8];
  const angle = Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2)));
  const axis = [matrix[7] - matrix[5], matrix[2] - matrix[6], matrix[3] - matrix[1]];
  const length = Math.hypot(...axis);
  return {
    angleDegrees: angle * 180 / Math.PI,
    axis: length > 0 ? axis.map((value) => value / length) : [0, 1, 0],
  };
}

// Signed angle, about `axis`, between the projections of two directions onto
// the plane perpendicular to it.
function rotationAboutAxis(axis, from, to) {
  const p = oracle.subtract(from, oracle.scale(axis, oracle.dot(axis, from)));
  const q = oracle.subtract(to, oracle.scale(axis, oracle.dot(axis, to)));
  const angle = oracle.angleBetweenDegrees(p, q);
  return oracle.dot(oracle.cross(p, q), axis) >= 0 ? angle : -angle;
}

function clampPixels(value, limit) {
  return Math.max(-limit, Math.min(limit, value));
}

async function captureLayers(page, geometry) {
  const layers = {};
  for (const [name, keep] of [
    ["sprite", [".mercury-directional-sun"]],
    ["skyOnly", [".mercury-skybox"]],
    ["bodyOnly", [".mercury-camera"]],
  ]) {
    const restore = await isolate(page, keep);
    layers[name] = await page.screenshot({ clip: geometry.stageBox });
    await restore();
    await dump(`layer-${name}`, layers[name]);
  }
  return layers;
}

// Hides every element that is neither an ancestor nor a descendant of one of
// the kept elements, along their ancestor chains up to the body.
async function isolate(page, keepSelectors) {
  await page.evaluate((selectors) => {
    const kept = selectors.map((selector) => document.querySelector(selector));
    if (kept.some((element) => !element)) {
      throw new Error(`Isolation target missing: ${selectors}`);
    }
    const ancestors = new Set();
    for (const element of kept) {
      let node = element;
      while (node && node !== document.body) {
        ancestors.add(node);
        node = node.parentElement;
      }
    }
    const hidden = [];
    const seen = new Set();
    for (const element of ancestors) {
      for (const sibling of element.parentElement.children) {
        if (ancestors.has(sibling) || seen.has(sibling)) continue;
        seen.add(sibling);
        hidden.push([sibling, sibling.style.visibility]);
        sibling.style.visibility = "hidden";
      }
    }
    window.__mercuryIsolationRestore = () => {
      for (const [element, visibility] of hidden) {
        element.style.visibility = visibility;
      }
      delete window.__mercuryIsolationRestore;
    };
  }, keepSelectors);
  await nextPaint(page);
  return async () => {
    await page.evaluate(() => window.__mercuryIsolationRestore());
    await nextPaint(page);
  };
}

// Control pitch to scene pitch is affine; measure it from two painted poses
// so the suite never encodes the runtime's mapping.
async function calibrateControlPitch(page) {
  const samples = [];
  for (const controlPitch of [89, 34]) {
    await setPose(page, { controlPitch, controlYaw: 0, zoom: 1.1 });
    const { pitchDegrees } = oracle.scenePitchYawDegrees(await readPose(page));
    samples.push([controlPitch, pitchDegrees]);
  }
  const slope = (samples[1][0] - samples[0][0]) / (samples[1][1] - samples[0][1]);
  const controlForScenePitch = (scenePitch) =>
    samples[0][0] + slope * (scenePitch - samples[0][1]);
  return { samples, slope, controlForScenePitch };
}

// Scene pitch and yaw that put a presentation-frame direction on the view
// axis (-z): Rx(p) Ry(y) d = (0, 0, -1).
function poseCentring([x, y, z]) {
  return {
    pitchDegrees: Math.asin(Math.max(-1, Math.min(1, -y))) * 180 / Math.PI,
    yawDegrees: Math.atan2(x, -z) * 180 / Math.PI,
  };
}

function windowAround([cx, cy], halfSize, box) {
  const x = Math.max(0, cx - halfSize);
  const y = Math.max(0, cy - halfSize);
  return {
    x,
    y,
    width: Math.min(box.width, cx + halfSize) - x,
    height: Math.min(box.height, cy + halfSize) - y,
  };
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
