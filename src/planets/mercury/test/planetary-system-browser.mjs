// The planetary system around Mercury, pinned on painted pixels against an
// independent astronomical oracle (planetary-system-oracle.mjs).
//
// Nothing from src/platform or the Mercury runtime is imported; the prepared
// system, its rings and the runtime projection are the code under test. The
// page is driven through the object's development diagnostics, screenshots
// come from real Chrome, and every orbit is measured by differencing two
// screenshots (orbit lines on, orbit lines off) so stars and sprites never
// register as line pixels. Each check reports its measured margin.
//
// Usage: node src/planets/mercury/test/planetary-system-browser.mjs [baseUrl]
// Exit status is non-zero when any check fails; the last stdout line is a
// JSON report. MERCURY_SYSTEM_DUMP=<dir> saves the screenshots.

import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "playwright";
import sharp from "sharp";

import * as lighting from "./lighting-geometry-oracle.mjs";
import * as oracle from "./planetary-system-oracle.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";

// Tolerances, each set from the measured residual of a correct render (see
// the report's margins) with headroom, and each far below the effect of the
// mutations in lighting-geometry-mutation-gate.mjs.
export const TOLERANCES = Object.freeze({
  // Painted semi-major axis ratio (pixels alone, (max + min) / 2 about the
  // Sun) against the textbook ratio. The osculating axes differ from the
  // textbook means by up to 0.4 %; the pole-on view foreshortens the tilted
  // orbits by under 1 %.
  ratioShare: 0.03,
  // Semi-major axis recovered by back-projecting the painted line into the
  // oracle's orbital plane, in au, against the textbook value.
  backProjectedShare: 0.025,
  // Painted line against the oracle's predicted ellipse: mean and 95th
  // percentile radial residual, pixels.
  shapeMeanPixels: 1.5,
  shapeP95Pixels: 3,
  // Share of scan rays on which the orbit was found: the trail covers half
  // the orbit and fades, so a bit over a third of the rays carry a line.
  coverage: 0.33,
  // The trail: the line must be found on rays this far behind the body and
  // absent this far ahead of it, and its strength must fall away behind.
  trailBehindDegrees: [12, 45, 90, 120],
  trailAheadDegrees: [12, 45, 90, 150],
  // Line strength (integrated difference across the line, averaged over
  // neighbouring rays) at each sample behind the body must fall to below
  // this share of the sample two steps closer to the body (adjacent samples
  // near the body differ by only a few per cent in weight).
  trailFadeFactor: 0.8,
  // Marker centre against the painted orbit at the marker's angle, pixels.
  markerOnOrbitPixels: 3,
  // Marker back-projected into its orbital plane against the oracle's
  // heliocentric direction, degrees, and distance share.
  markerDirectionDegrees: 1.5,
  markerDistanceShare: 0.03,
  // Sun marker centre against the oracle's projected Sun, pixels.
  sunMarkerPixels: 2,
  // Something painted at a marker: peak luminance within its radius.
  markerLuminance: 24,
  // Illuminated fraction carried by each marker against the oracle's
  // Sun-body-Mercury phase angle.
  illuminatedFraction: 0.005,
  // The phase overlay's darkening (marker with its overlay hidden against
  // shown, at device pixel ratio 2) must centre away from the Sun: angle
  // between the darkening's centroid offset and the Sun direction. The
  // atlas frame shades the whole disc (limb darkening), so the terminator
  // only dominates the centroid below this illuminated fraction; above it
  // the roll is verified on the DOM against the oracle's Sun direction.
  darkeningAwayFromSunDegrees: 120,
  darkeningCentroidBelowFraction: 0.97,
  // Roll of the phase overlay (DOM rotation) against the oracle's on-screen
  // Sun direction from the marker, degrees; frame against the oracle's phase.
  phaseRollDegrees: 1,
  phaseFrames: 2,
  // Mercury's own marker stage against the billboard stage just before it:
  // mean luminance over the disc must not step up by more than this factor.
  markerStageLuminanceStep: 1.6,
});

const checks = [];
const report = { baseUrl, views: {}, fade: null, network: null };
const dumpDirectory = process.env.MERCURY_SYSTEM_DUMP ?? null;
if (dumpDirectory) await mkdir(dumpDirectory, { recursive: true });
let dumpCount = 0;
async function dump(name, image) {
  if (!dumpDirectory) return;
  dumpCount += 1;
  await writeFile(`${dumpDirectory}/${String(dumpCount).padStart(2, "0")}-${name}.png`, image);
}

function check(id, ok, detail) {
  // The detail may carry a body `id`; the check's id wins.
  checks.push({ ...detail, id, ok: Boolean(ok) });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail)}`);
}

const state = await oracle.loadPlanetStateVectors();
const system = oracle.buildSystemOracle(state);
report.oracle = {
  source: state.source,
  semiMajorAxesAu: Object.fromEntries(oracle.PLANETS.map((id) =>
    [id, system.bodies[id].semiMajorAxisAu])),
};

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
// A fresh context: Mercury's asset URLs carry no content hash.
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
try {
  const page = await context.newPage();
  const problems = [];
  const lightingRowRequests = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`error: ${message.text()}`);
  });
  page.on("request", (request) => {
    if (/mercury-lighting-\dx-row-\d+\.webp/u.test(request.url())) {
      lightingRowRequests.push({ url: request.url(), at: Date.now() });
    }
  });
  const response = await page.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`Mercury page returned ${response?.status()}.`);
  await page.waitForFunction(() =>
    window.__cssEarth?.ready === true && window.__mercury?.ready === true &&
    document.documentElement.dataset.ready === "true");

  // Freeze the body's spin and keep the orbit lines on.
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (motion.checked) motion.click();
  });
  await setOrbitLines(page, true);
  await nextPaint(page);

  const geometry = await readGeometry(page);
  report.geometry = geometry;
  const stats = await page.evaluate(() => window.__mercury.camera.stats());
  report.dolly = {
    minimumDistanceKilometers: stats.dolly.minimumDistanceKilometers,
    maximumDistanceKilometers: stats.dolly.maximumDistanceKilometers,
    maximumDistanceAu: stats.dolly.maximumDistanceKilometers / oracle.AU_KILOMETERS,
    wheelNotchesEndToEnd: stats.dolly.wheelNotchesEndToEnd,
    wheelStepPerDelta: stats.dolly.wheelStepPerDelta,
  };
  check("maximum-dolly-reaches-whole-system",
    report.dolly.maximumDistanceAu >= 2.5 * system.bodies.neptune.aphelionAu, report.dolly);
  check("wheel-notches-end-to-end-sane",
    stats.dolly.wheelNotchesEndToEnd >= 18 && stats.dolly.wheelNotchesEndToEnd <= 40, {
      notches: stats.dolly.wheelNotchesEndToEnd,
    });

  // ---------------------------------------------------------------------
  // Near: at the default framing the system is hidden.
  // ---------------------------------------------------------------------
  await resetToDefault(page);
  const near = await readSystemState(page);
  report.views.default = near;
  check("system-hidden-at-default-framing",
    near.opacity === 0 && near.groupOpacity === 0 && near.orbitPieceCount === 0 &&
    near.markerVisibleCount === 0, near);

  // The fade: hidden while Mercury's orbit fills the view, opaque well
  // outside it, and never decreasing on the way out.
  const orbitExtentKm = await page.evaluate(() =>
    window.__mercury.sky.heliocentricView.orbit.maximumExtentUnits *
    window.__mercury.sky.heliocentricView.units.kilometersPerUnit);
  const fade = [];
  for (const share of [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3]) {
    await setPose(page, { distanceKilometers: share * orbitExtentKm });
    const sample = await readSystemState(page);
    fade.push({ share, opacity: sample.opacity, groupOpacity: sample.groupOpacity,
      orbitPieceCount: sample.orbitPieceCount });
  }
  report.fade = fade;
  check("system-fades-in-with-distance",
    fade[0].opacity === 0 && fade.at(-1).opacity === 1 &&
    fade.every((sample, index) => index === 0 || sample.opacity >= fade[index - 1].opacity) &&
    fade.some((sample) => sample.opacity > 0 && sample.opacity < 1) &&
    fade.every((sample) => Math.abs(sample.groupOpacity - sample.opacity) < 1e-6) &&
    fade.every((sample) => (sample.opacity > 0) === (sample.orbitPieceCount > 0)), fade);

  // ---------------------------------------------------------------------
  // Pole-on views: the inner system framed on Jupiter, the whole system
  // framed on Neptune (or the dolly's far bound, whichever is nearer).
  // ---------------------------------------------------------------------
  const calibration = await calibrateControlPitch(page);
  report.pitchCalibration = calibration;
  const poleOnControlPitch = calibration.controlForScenePitch(90);
  const tanVertical = (geometry.stageBox.height / 2) / geometry.skyFocalPixels;
  const sunOffsetAu = Math.hypot(...system.sun) / oracle.AU_KILOMETERS;
  const frameDistanceKm = (id) => 1.15 * (system.bodies[id].aphelionAu + sunOffsetAu) /
    tanVertical * oracle.AU_KILOMETERS;
  const views = [
    { id: "inner", distanceKm: frameDistanceKm("jupiter"),
      measured: ["mercury", "venus", "earth", "mars", "jupiter"], reference: "earth" },
    { id: "outer", distanceKm: Math.min(frameDistanceKm("neptune"), stats.dolly.maximumDistanceKilometers),
      measured: ["jupiter", "saturn", "uranus", "neptune"], reference: "jupiter" },
  ];
  const rowRequestsBeforeFar = lightingRowRequests.length;
  for (const view of views) {
    await setPose(page, { controlPitch: poleOnControlPitch, controlYaw: 0,
      distanceKilometers: view.distanceKm });
    await page.waitForTimeout(150);
    await nextPaint(page);
    report.views[view.id] = await measureView(page, geometry, view);
  }
  // Phase and brightness of the markers: the prepared illumination against
  // the oracle, the marker opacities against the brightness model, and the
  // painted darkening against the Sun's direction.
  report.phases = await measurePhases(page, geometry, poleOnControlPitch, views[1].distanceKm);
  report.mercuryMarker = await measureMercuryMarkerStep(context, geometry);

  // Far views draw the marker stage from the billboard atlas: no lighting
  // rows stream while the system is on screen.
  const farState = await page.evaluate(() => window.__mercury.sky.state().lod);
  report.network = {
    lightingRowRequestsDuringFarViews: lightingRowRequests.length - rowRequestsBeforeFar,
    farStage: farState.stage,
    rowStreaming: farState.rowStreaming,
  };
  check("far-views-stream-no-lighting-rows",
    report.network.lightingRowRequestsDuringFarViews === 0 && farState.stage === "marker" &&
    farState.rowStreaming === false, report.network);

  // Back in close: the system hides again and nothing errored.
  await resetToDefault(page);
  const back = await readSystemState(page);
  check("system-hidden-again-in-close", back.opacity === 0 && back.orbitPieceCount === 0, back);
  check("no-page-errors", problems.length === 0, { problems });
  check("dom-identity-stable", await page.evaluate(() => window.__mercury.assertStableDomIdentity()), {});
} finally {
  await browser.close();
}

const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.id);
console.log(JSON.stringify({ suite: "mercury-planetary-system", ok: failed.length === 0, failed, checks, ...report }));
process.exit(failed.length === 0 ? 0 : 1);

// -----------------------------------------------------------------------

async function measureView(page, geometry, view) {
  const cameraState = await page.evaluate(() => window.__mercury.camera.state());
  const rotation = await readPose(page);
  const rootBox = await page.locator(".mercury-camera").boundingBox();
  const camera = oracle.createCamera({
    principal: geometry.stageCentre,
    rootCentre: [rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2],
    focal: geometry.skyFocalPixels,
    rotation,
    distanceKm: cameraState.distanceKilometers,
  });
  const angles = lighting.scenePitchYawDegrees(rotation);
  const sunPixel = camera.project(system.sun);
  const result = {
    id: view.id,
    requestedDistanceKm: view.distanceKm,
    distanceKm: cameraState.distanceKilometers,
    distanceAu: cameraState.distanceKilometers / oracle.AU_KILOMETERS,
    scenePitchDegrees: angles.pitchDegrees,
    scenePitchDegreesTarget: 90,
    sunPixel,
    orbits: {},
    markers: {},
  };
  check(`${view.id}-distance-honoured`,
    Math.abs(cameraState.distanceKilometers - view.distanceKm) / view.distanceKm < 1e-6 ||
    Math.abs(cameraState.distanceKilometers - report.dolly.maximumDistanceKilometers) < 1, {
      requested: view.distanceKm, actual: cameraState.distanceKilometers,
    });
  check(`${view.id}-pose-pole-on`, Math.abs(angles.pitchDegrees - 90) < 0.5, angles);
  const systemState = await readSystemState(page);
  result.system = systemState;
  // Every measured planet is on screen; in the inner view the outer three
  // are legitimately outside the viewport.
  const expectedVisible = view.measured.filter((id) => id !== "mercury").length;
  check(`${view.id}-system-visible`, systemState.opacity === 1 && systemState.orbitPieceCount > 0 &&
    systemState.markerVisibleCount >= expectedVisible && systemState.sunMarkerVisible &&
    systemState.sunMarkerOpacity === 1, { ...systemState, expectedVisible });

  // Two screenshots, orbit lines on and off; their difference is the lines.
  const withLines = await page.screenshot();
  await dump(`${view.id}-orbits-on`, withLines);
  await setOrbitLines(page, false);
  const withoutLines = await page.screenshot();
  await dump(`${view.id}-orbits-off`, withoutLines);
  await setOrbitLines(page, true);
  const on = await decodeLuminance(withLines);
  const off = await decodeLuminance(withoutLines);
  const diff = new Float32Array(on.width * on.height);
  let linePixels = 0;
  for (let index = 0; index < diff.length; index += 1) {
    diff[index] = Math.abs(on.luminance[index] - off.luminance[index]);
    if (diff[index] > 12) linePixels += 1;
  }
  result.linePixels = linePixels;
  check(`${view.id}-orbit-lines-painted`, linePixels > 500, { linePixels });

  // Radial scan about the oracle's Sun: every crossing of a line on 720 rays.
  const rays = scanRays(diff, on.width, on.height, sunPixel, { angles: 720, step: 0.5, threshold: 12, minRadius: 6 });

  // Each measured orbit: associate crossings with the oracle's prediction,
  // then measure from the pixels.
  const measuredPixelAxes = {};
  for (const id of view.measured) {
    const body = system.bodies[id];
    const predicted = oracle.predictOrbitPolar(camera, body, sunPixel);
    const matched = [];
    const residuals = [];
    for (const ray of rays) {
      const expected = oracle.polarRadiusAt(predicted, ray.angle);
      if (expected === null) continue;
      const window = Math.max(4, 0.06 * expected);
      let best = null;
      for (const radius of ray.crossings) {
        const gap = Math.abs(radius - expected);
        if (gap <= window && (best === null || gap < best.gap)) best = { radius, gap };
      }
      if (best === null) continue;
      matched.push({ angle: ray.angle, radius: best.radius, expected });
      residuals.push(best.radius - expected);
    }
    const coverage = matched.length / rays.length;
    // The semi-major axis from pixels alone: a conic with its focus at the
    // Sun fitted to the painted arc's polar samples.
    const pixelFit = oracle.fitFocalConic(matched.map(({ angle, radius }) => [angle, radius]));
    const pixelAxis = pixelFit?.a ?? null;
    measuredPixelAxes[id] = pixelAxis;
    const absolute = residuals.map(Math.abs).sort((a, b) => a - b);
    const meanResidual = absolute.length ? absolute.reduce((sum, value) => sum + value, 0) / absolute.length : null;
    const p95Residual = absolute.length ? absolute[Math.floor(0.95 * (absolute.length - 1))] : null;
    // Back-projection into the oracle's orbital plane: the semi-major axis
    // from the farthest and nearest painted points about the Sun.
    // Back-projected into the oracle's orbital plane, the same fit in the
    // plane's own polar coordinates about the Sun, in kilometres.
    const planeU = lighting.normalize(lighting.subtract(body.position, system.sun));
    const planeW = lighting.cross(body.normal, planeU);
    const planeSamples = matched.map(({ angle, radius }) => {
      const point = camera.backProject(
        [sunPixel[0] + radius * Math.cos(angle), sunPixel[1] + radius * Math.sin(angle)],
        system.sun,
        body.normal,
      );
      if (point === null) return null;
      const offset = lighting.subtract(point, system.sun);
      return [Math.atan2(lighting.dot(offset, planeW), lighting.dot(offset, planeU)), Math.hypot(...offset)];
    }).filter((value) => value !== null);
    const planeFit = oracle.fitFocalConic(planeSamples);
    const backProjectedAu = planeFit === null ? null : planeFit.a / oracle.AU_KILOMETERS;
    const textbook = oracle.TEXTBOOK_SEMI_MAJOR_AXES_AU[id];
    const orbit = {
      coverage, matchedRays: matched.length, pixelSemiMajorAxis: pixelAxis,
      predictedPixelSemiMajorAxis: predicted.length
        ? (Math.max(...predicted.map((p) => p[1])) + Math.min(...predicted.map((p) => p[1]))) / 2 : null,
      shapeMeanResidualPixels: meanResidual, shapeP95ResidualPixels: p95Residual,
      backProjectedSemiMajorAxisAu: backProjectedAu, textbookAu: textbook,
      backProjectedEccentricity: planeFit?.e ?? null,
      oracleAu: body.semiMajorAxisAu, oracleEccentricity: body.eccentricity,
      backProjectedErrorShare: backProjectedAu === null ? null : backProjectedAu / textbook - 1,
    };
    result.orbits[id] = orbit;
    check(`orbit-coverage-${id}-${view.id}`, coverage >= TOLERANCES.coverage, { id, coverage });
    // The trail: measured against the oracle's direction of motion. The
    // line is found behind the body with strength falling away, and absent
    // ahead of it (beyond the marker's own footprint).
    const trail = measureTrail(rays, camera, body, sunPixel, predicted, id === "mercury" ? 5 : 16);
    result.orbits[id].trail = trail;
    check(`trail-behind-body-${id}-${view.id}`, trail.behind.every((sample) => sample.found), { id, ...trail });
    check(`trail-absent-ahead-${id}-${view.id}`, trail.ahead.every((sample) => !sample.found), { id, ...trail });
    check(`trail-fades-backwards-${id}-${view.id}`, trail.behind.every((sample, index) =>
      index < 2 || sample.strength < TOLERANCES.trailFadeFactor * trail.behind[index - 2].strength), { id, ...trail });
    check(`orbit-shape-${id}-${view.id}`, meanResidual !== null &&
      meanResidual <= TOLERANCES.shapeMeanPixels && p95Residual <= TOLERANCES.shapeP95Pixels, {
        id, meanResidual, p95Residual,
      });
    check(`orbit-axis-backprojected-${id}-${view.id}`, backProjectedAu !== null &&
      Math.abs(backProjectedAu / textbook - 1) <= TOLERANCES.backProjectedShare, {
        id, backProjectedAu, textbook, errorShare: orbit.backProjectedErrorShare,
      });
  }
  // Ratios from pixels alone, against the textbook.
  const referenceAxis = measuredPixelAxes[view.reference];
  result.ratios = {};
  for (const id of view.measured) {
    if (id === view.reference) continue;
    const measuredRatio = measuredPixelAxes[id] === null || !referenceAxis
      ? null : measuredPixelAxes[id] / referenceAxis;
    const textbookRatio = oracle.TEXTBOOK_SEMI_MAJOR_AXES_AU[id] /
      oracle.TEXTBOOK_SEMI_MAJOR_AXES_AU[view.reference];
    const errorShare = measuredRatio === null ? null : measuredRatio / textbookRatio - 1;
    result.ratios[id] = { measuredRatio, textbookRatio, errorShare,
      measuredAuViaReference: measuredRatio === null ? null
        : measuredRatio * oracle.TEXTBOOK_SEMI_MAJOR_AXES_AU[view.reference] };
    check(`orbit-ratio-${id}-over-${view.reference}`,
      errorShare !== null && Math.abs(errorShare) <= TOLERANCES.ratioShare,
      { id, reference: view.reference, measuredRatio, textbookRatio, errorShare });
  }
  // Nesting: on every ray the measured orbits keep their order, innermost
  // first, and the measured radii of consecutive orbits never overlap.
  const order = view.measured;
  let orderViolations = 0;
  let orderedRays = 0;
  const radiiByRay = new Map();
  for (const id of order) {
    const body = system.bodies[id];
    const predicted = oracle.predictOrbitPolar(camera, body, sunPixel);
    for (const ray of rays) {
      const expected = oracle.polarRadiusAt(predicted, ray.angle);
      const window = Math.max(4, 0.06 * expected);
      const radius = ray.crossings.find((value) => Math.abs(value - expected) <= window);
      if (radius === undefined) continue;
      if (!radiiByRay.has(ray.angle)) radiiByRay.set(ray.angle, {});
      radiiByRay.get(ray.angle)[id] = radius;
    }
  }
  for (const radii of radiiByRay.values()) {
    const present = order.filter((id) => radii[id] !== undefined);
    if (present.length < 2) continue;
    orderedRays += 1;
    for (let index = 1; index < present.length; index += 1) {
      if (!(radii[present[index]] > radii[present[index - 1]])) orderViolations += 1;
    }
  }
  result.nesting = { orderedRays, orderViolations };
  check(`orbits-nest-without-crossing-${view.id}`, orderedRays > 60 && orderViolations === 0, result.nesting);

  // Markers: each planet's sprite on its own painted orbit, at the oracle's
  // heliocentric position, with something painted there.
  const markers = await page.evaluate(() => {
    const read = (element) => {
      const box = element.getBoundingClientRect();
      return { visible: getComputedStyle(element).visibility !== "hidden",
        opacity: Number(getComputedStyle(element).opacity),
        centre: [box.x + box.width / 2, box.y + box.height / 2], size: box.width,
        image: getComputedStyle(element).backgroundImage };
    };
    const bodies = {};
    for (const element of document.querySelectorAll(".mercury-system-marker")) {
      bodies[element.dataset.body] = read(element);
    }
    return { bodies, sun: read(document.querySelector(".mercury-sun-marker")),
      mercury: read(document.querySelector(".mercury-body-marker")) };
  });
  for (const id of view.measured) {
    if (id === "mercury") continue;
    const marker = markers.bodies[id];
    const body = system.bodies[id];
    const dx = marker.centre[0] - sunPixel[0];
    const dy = marker.centre[1] - sunPixel[1];
    const angle = Math.atan2(dy, dx);
    const radius = Math.hypot(dx, dy);
    // The painted orbit's radius at the marker's angle. The marker covers
    // the line in both screenshots, so the line is read on the two rays
    // flanking the marker and averaged.
    const onOrbitGap = paintedRadiusGap(rays, angle, radius, marker.size);
    const point = camera.backProject(marker.centre, system.sun, body.normal);
    const heliocentric = point === null ? null : lighting.subtract(point, system.sun);
    const directionError = heliocentric === null ? null
      : oracle.angleDegrees(heliocentric, lighting.subtract(body.position, system.sun));
    const distanceShare = heliocentric === null ? null
      : Math.hypot(...heliocentric) / (body.heliocentricDistanceAu * oracle.AU_KILOMETERS) - 1;
    const luminance = peakLuminance(on, marker.centre, Math.max(2, marker.size / 2));
    const predictedPixel = camera.project(body.position);
    result.markers[id] = { ...marker, onOrbitGapPixels: onOrbitGap, directionErrorDegrees: directionError,
      distanceErrorShare: distanceShare, peakLuminance: luminance, predictedPixel,
      predictedGapPixels: predictedPixel === null ? null
        : Math.hypot(marker.centre[0] - predictedPixel[0], marker.centre[1] - predictedPixel[1]) };
    check(`marker-visible-${id}-${view.id}`, marker.visible && marker.opacity > 0.2 &&
      /planet-markers@2x\.webp/u.test(marker.image), { id, ...marker });
    check(`marker-on-orbit-${id}-${view.id}`, onOrbitGap !== null && onOrbitGap <= TOLERANCES.markerOnOrbitPixels,
      { id, onOrbitGap, radius });
    check(`marker-position-${id}-${view.id}`, directionError !== null &&
      directionError <= TOLERANCES.markerDirectionDegrees &&
      Math.abs(distanceShare) <= TOLERANCES.markerDistanceShare,
      { id, directionError, distanceShare, predictedGapPixels: result.markers[id].predictedGapPixels });
    check(`marker-painted-${id}-${view.id}`, luminance >= TOLERANCES.markerLuminance, { id, luminance });
  }
  // The Sun's marker floors the Sun where the oracle puts it.
  const sunGap = Math.hypot(markers.sun.centre[0] - sunPixel[0], markers.sun.centre[1] - sunPixel[1]);
  result.markers.sun = { ...markers.sun, gapPixels: sunGap,
    peakLuminance: peakLuminance(on, markers.sun.centre, markers.sun.size / 2) };
  check(`sun-marker-position-${view.id}`, markers.sun.visible && markers.sun.opacity > 0.99 &&
    sunGap <= TOLERANCES.sunMarkerPixels, result.markers.sun);
  check(`sun-marker-painted-${view.id}`, result.markers.sun.peakLuminance >= TOLERANCES.markerLuminance,
    result.markers.sun);
  // Mercury itself: its own marker at the camera root's centre, on its own
  // painted orbit (the innermost ring of the inner view).
  if (view.measured.includes("mercury")) {
    const mercuryMarker = markers.mercury;
    const dx = mercuryMarker.centre[0] - sunPixel[0];
    const dy = mercuryMarker.centre[1] - sunPixel[1];
    const angle = Math.atan2(dy, dx);
    const radius = Math.hypot(dx, dy);
    const gap = paintedRadiusGap(rays, angle, radius, mercuryMarker.size);
    result.markers.mercury = { ...mercuryMarker, onOrbitGapPixels: gap };
    check(`marker-on-orbit-mercury-${view.id}`, mercuryMarker.opacity > 0.99 && gap !== null &&
      gap <= TOLERANCES.markerOnOrbitPixels, result.markers.mercury);
  }
  return result;
}

// Every marker's illumination as the runtime reports it (prepared from the
// observer's vantage) against the oracle, the geometric fact that only the
// inner planet can ever show a crescent from Mercury, and the marker
// opacities against the brightness model; then, at device pixel ratio 2, the
// painted darkening of the phase overlay against the Sun's direction.
async function measurePhases(page, geometry, poleOnControlPitch, distanceKm) {
  await setPose(page, { controlPitch: poleOnControlPitch, controlYaw: 0, distanceKilometers: distanceKm });
  await page.waitForTimeout(100);
  await nextPaint(page);
  const runtime = await page.evaluate(() => {
    const sky = window.__mercury.sky.state();
    const markers = {};
    for (const element of document.querySelectorAll(".mercury-system-marker")) {
      const phase = element.querySelector(".planet-heliocentric-marker-phase");
      const box = element.getBoundingClientRect();
      const matrix = phase ? new DOMMatrix(getComputedStyle(phase).transform) : null;
      markers[element.dataset.body] = {
        opacity: Number(getComputedStyle(element).opacity),
        centre: [box.x + box.width / 2, box.y + box.height / 2],
        phaseImage: phase ? getComputedStyle(phase).backgroundImage : null,
        phaseTransform: phase ? phase.style.transform : null,
        // The painted rotation of the overlay, degrees, CSS sense.
        phaseRotationDegrees: matrix ? Math.atan2(matrix.b, matrix.a) * 180 / Math.PI : null,
        phaseFrame: phase ? Number(phase.dataset.frame) : null,
        phaseFrameCount: 256,
      };
    }
    return { bodies: sky.planetarySystem.bodies, markers };
  });
  // The oracle's Sun on screen, for the roll each overlay must carry.
  const cameraState = await page.evaluate(() => window.__mercury.camera.state());
  const rootBox = await page.locator(".mercury-camera").boundingBox();
  const camera = oracle.createCamera({ principal: geometry.stageCentre,
    rootCentre: [rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2],
    focal: geometry.skyFocalPixels, rotation: await readPose(page), distanceKm: cameraState.distanceKilometers });
  const sunPixel = camera.project(system.sun);
  const result = { bodies: {} };
  const opacities = [];
  for (const body of runtime.bodies) {
    const expected = system.illumination[body.id];
    const marker = runtime.markers[body.id];
    result.bodies[body.id] = { ...body.illumination, markerOpacity: marker.opacity,
      oracle: expected, phaseImage: marker.phaseImage, phaseTransform: marker.phaseTransform };
    check(`phase-fraction-matches-oracle-${body.id}`, body.illumination !== undefined &&
      Math.abs(body.illumination.illuminatedFraction - expected.illuminatedFraction) <= TOLERANCES.illuminatedFraction &&
      Math.abs(body.illumination.phaseAngleDegrees - expected.phaseAngleDegrees) <= 0.5,
      { id: body.id, runtime: body.illumination, oracle: expected });
    check(`marker-opacity-is-prepared-brightness-${body.id}`, body.illumination !== undefined &&
      Math.abs(marker.opacity - body.illumination.markerOpacity) < 1e-3 &&
      /billboard/u.test(marker.phaseImage ?? ""), { id: body.id, marker, runtime: body.illumination });
    // The overlay is rolled so its lit side (screen right at zero roll, the
    // atlas's convention verified by the lighting suite on the body itself)
    // faces the Sun: the painted rotation equals the y-up angle of the
    // oracle's Sun direction from the marker. Its frame is the oracle's
    // phase mapped across the atlas.
    const expectedRoll = Math.atan2(-(sunPixel[1] - marker.centre[1]), sunPixel[0] - marker.centre[0]) * 180 / Math.PI;
    const rollError = marker.phaseRotationDegrees === null ? null
      : Math.abs(lighting.wrapDegrees(marker.phaseRotationDegrees - expectedRoll));
    const expectedFrame = Math.round(Math.max(0, Math.min(1, (Math.cos(expected.phaseAngleDegrees * Math.PI / 180) - (-1)) / 2)) *
      (marker.phaseFrameCount - 1));
    result.bodies[body.id].roll = { expectedRoll, painted: marker.phaseRotationDegrees, rollError, expectedFrame, frame: marker.phaseFrame };
    check(`phase-rolled-toward-sun-${body.id}`, rollError !== null && rollError <= TOLERANCES.phaseRollDegrees,
      { id: body.id, ...result.bodies[body.id].roll });
    check(`phase-frame-matches-oracle-${body.id}`, marker.phaseFrame !== null &&
      Math.abs(marker.phaseFrame - expectedFrame) <= TOLERANCES.phaseFrames, { id: body.id, ...result.bodies[body.id].roll });
    opacities.push({ id: body.id, opacity: marker.opacity, magnitudes: expected.magnitudesBelowBrightest });
  }
  // Geometry: from Mercury only Venus can pass between the observer and the
  // Sun; everything beyond stays near full. A crescent on Jupiter would mean
  // the phase maths is wrong (both the runtime's and, independently, the
  // oracle's are asserted).
  const beyondVenus = runtime.bodies.filter((body) => body.id !== "venus");
  check("no-crescent-beyond-venus", beyondVenus.every((body) => body.illumination?.illuminatedFraction >= 0.9) &&
    beyondVenus.filter((body) => ["jupiter", "saturn", "uranus", "neptune"].includes(body.id))
      .every((body) => body.illumination?.illuminatedFraction >= 0.99) &&
    Object.entries(system.illumination).filter(([id]) => id !== "venus")
      .every(([, value]) => value.illuminatedFraction >= 0.9),
    { runtime: Object.fromEntries(beyondVenus.map((body) => [body.id, body.illumination?.illuminatedFraction])) });
  // Brightness: opacity falls with magnitudes below the brightest, the
  // brightest is opaque, the faintest sits on the floor, and they differ.
  const ordered = [...opacities].sort((a, b) => a.magnitudes - b.magnitudes);
  check("marker-brightness-follows-flux", ordered.every((entry, index) =>
    index === 0 || entry.opacity <= ordered[index - 1].opacity + 1e-9) &&
    ordered[0].opacity > 0.99 && ordered.at(-1).opacity < 0.45 && ordered.at(-1).opacity >= 0.25 &&
    ordered[0].id === "venus" && ordered.at(-1).id === "neptune", { ordered });
  result.ordered = ordered;

  // Painted darkening at device pixel ratio 2, for the bodies whose phase
  // overlay darkens more than the limb: the darkening centroid lies on the
  // side away from the Sun.
  const dpr2 = await context.browser().newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    const page2 = await dpr2.newPage();
    await page2.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle" });
    await page2.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true &&
      document.documentElement.dataset.ready === "true");
    await page2.evaluate(() => {
      const motion = document.querySelector('input[name="motion"]');
      if (motion.checked) motion.click();
    });
    await setPose(page2, { controlPitch: poleOnControlPitch, controlYaw: 0, distanceKilometers: distanceKm });
    await page2.waitForTimeout(150);
    await nextPaint(page2);
    const positions = await page2.evaluate(() => {
      const read = (element) => { const box = element.getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2, box.width]; };
      const out = { sun: read(document.querySelector(".mercury-sun-marker")) };
      for (const element of document.querySelectorAll(".mercury-system-marker")) out[element.dataset.body] = read(element);
      return out;
    });
    const shown = await decodeLuminance(await page2.screenshot());
    await dump("phases-dpr2-shown", await page2.screenshot());
    await page2.evaluate(() => {
      for (const element of document.querySelectorAll(".planet-heliocentric-marker-phase")) element.style.visibility = "hidden";
    });
    await nextPaint(page2);
    const hidden = await decodeLuminance(await page2.screenshot());
    await dump("phases-dpr2-hidden", await page2.screenshot());
    await page2.evaluate(() => {
      for (const element of document.querySelectorAll(".planet-heliocentric-marker-phase")) element.style.visibility = "";
    });
    result.darkening = {};
    for (const [id, [cx, cy, size]] of Object.entries(positions)) {
      if (id === "sun") continue;
      const centroid = darkeningCentroid(hidden, shown, [cx * 2, cy * 2], size);
      const toSun = [positions.sun[0] - cx, positions.sun[1] - cy];
      const angle = centroid.offset === null ? null
        : Math.acos(Math.max(-1, Math.min(1, (centroid.offset[0] * toSun[0] + centroid.offset[1] * toSun[1]) /
          (Math.hypot(...centroid.offset) * Math.hypot(...toSun))))) * 180 / Math.PI;
      result.darkening[id] = { ...centroid, angleFromSunDegrees: angle };
      const fraction = system.illumination[id].illuminatedFraction;
      if (fraction < TOLERANCES.darkeningCentroidBelowFraction) {
        check(`phase-darkening-away-from-sun-${id}`, centroid.darkenedShare > 0.005 && angle !== null &&
          angle >= TOLERANCES.darkeningAwayFromSunDegrees, { id, fraction, ...result.darkening[id] });
      }
      // The overlay shades the disc (limb darkening over most of it) without
      // blanking it.
      check(`phase-overlay-darkens-${id}`, centroid.darkenedShare > 0.2 && centroid.darkenedShare < 0.98, { id, ...centroid });
    }
  } finally {
    await dpr2.close();
  }
  return result;
}

// Mercury's own marker: the lighting overlay stays alive over the sprite, so
// the disc's mean luminance at the marker stage matches the billboard stage
// just before it instead of stepping up to the fully lit sprite, and its
// darkening sits away from the Sun (screen left at the default yaw).
async function measureMercuryMarkerStep(context, geometry) {
  const dpr2 = await context.browser().newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    const page2 = await dpr2.newPage();
    await page2.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle" });
    await page2.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true &&
      document.documentElement.dataset.ready === "true");
    await page2.evaluate(() => {
      const motion = document.querySelector('input[name="motion"]');
      if (motion.checked) motion.click();
      const shadows = document.querySelector('input[name="shadows"]');
      shadows.checked = true;
      shadows.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page2.waitForFunction(() => window.__mercury.runtime.selection().committed.shadows === true);
    const samples = {};
    for (const [stage, diameter] of [["billboard", 5.5], ["marker", 4.4]]) {
      await page2.evaluate((next) => {
        const stats = window.__mercury.camera.stats();
        window.__mercury.camera.setState({ controlPitch: stats.defaultControlPitchDegrees,
          controlYaw: stats.defaultControlYawDegrees, zoom: 1.1 * next / 460 });
      }, diameter);
      await page2.waitForTimeout(150);
      await nextPaint(page2);
      const state = await page2.evaluate(() => {
        const box = document.querySelector(".mercury-camera").getBoundingClientRect();
        return { stage: window.__mercury.sky.state().lod.stage, centre: [box.x + box.width / 2, box.y + box.height / 2],
          overlayVisibility: getComputedStyle(document.querySelector(".mercury-material")).visibility,
          markerOpacity: Number(getComputedStyle(document.querySelector(".mercury-body-marker")).opacity) };
      });
      const shownImage = await page2.screenshot();
      const image = await decodeLuminance(shownImage);
      await dump(`mercury-marker-${stage}-dpr2`, shownImage);
      // The overlay's own darkening over the disc: hidden against shown.
      await page2.evaluate(() => { document.querySelector(".mercury-material").style.visibility = "hidden"; });
      await nextPaint(page2);
      const hiddenImage = await decodeLuminance(await page2.screenshot());
      await page2.evaluate(() => { document.querySelector(".mercury-material").style.visibility = ""; });
      await nextPaint(page2);
      const darkening = darkeningCentroid(hiddenImage, image, [state.centre[0] * 2, state.centre[1] * 2], 3);
      samples[stage] = { ...state, ...discLuminance(image, [state.centre[0] * 2, state.centre[1] * 2], 6), darkening };
    }
    const ratio = samples.marker.mean / samples.billboard.mean;
    check("mercury-marker-stage-keeps-lighting", samples.marker.stage === "marker" && samples.billboard.stage === "billboard" &&
      samples.marker.overlayVisibility === "visible" && ratio <= TOLERANCES.markerStageLuminanceStep,
      { ratio, ...samples });
    // The overlay darkens the marker on the side away from the Sun (the Sun
    // stands to the left at the default yaw): the darkening's centroid sits
    // right of the centre, at both stages.
    for (const stage of ["billboard", "marker"]) {
      check(`mercury-${stage}-stage-darkened-away-from-sun`, samples[stage].darkening.darkenedShare > 0.1 &&
        samples[stage].darkening.offset !== null && samples[stage].darkening.offset[0] > 0.3, samples[stage]);
    }
    return { ratio, samples };
  } finally {
    await dpr2.close();
  }
}

// Darkening of a marker by its phase overlay: pixels within the marker's
// footprint that are darker with the overlay shown than hidden, their share
// of the footprint and the centroid of the darkening relative to the centre
// (device pixels, y down).
function darkeningCentroid(hidden, shown, centre, sizeCss) {
  const radius = sizeCss;
  let weight = 0, sumX = 0, sumY = 0, footprint = 0, darkened = 0;
  for (let y = Math.floor(centre[1] - radius); y <= Math.ceil(centre[1] + radius); y += 1) {
    for (let x = Math.floor(centre[0] - radius); x <= Math.ceil(centre[0] + radius); x += 1) {
      if (x < 0 || y < 0 || x >= hidden.width || y >= hidden.height) continue;
      if (Math.hypot(x - centre[0], y - centre[1]) > radius) continue;
      footprint += 1;
      const delta = hidden.luminance[y * hidden.width + x] - shown.luminance[y * shown.width + x];
      if (delta <= 4) continue;
      darkened += 1;
      weight += delta;
      sumX += delta * (x + 0.5 - centre[0]);
      sumY += delta * (y + 0.5 - centre[1]);
    }
  }
  return { footprint, darkenedShare: footprint ? darkened / footprint : 0,
    offset: weight > 0 ? [sumX / weight, sumY / weight] : null };
}

// Mean luminance and lit centroid over a disc, device pixels.
function discLuminance(image, centre, radius) {
  let sum = 0, count = 0, sumX = 0, sumY = 0;
  for (let y = Math.floor(centre[1] - radius); y <= Math.ceil(centre[1] + radius); y += 1) {
    for (let x = Math.floor(centre[0] - radius); x <= Math.ceil(centre[0] + radius); x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      if (Math.hypot(x - centre[0], y - centre[1]) > radius) continue;
      const value = image.luminance[y * image.width + x];
      sum += value; count += 1; sumX += value * (x + 0.5 - centre[0]); sumY += value * (y + 0.5 - centre[1]);
    }
  }
  return { mean: count ? sum / count : 0, centroidOffset: sum > 0 ? [sumX / sum, sumY / sum] : [0, 0] };
}

// Radial scan of a difference image: on each ray from `centre`, the radii at
// which a run of pixels above `threshold` is crossed (its intensity-weighted
// centre), from `minRadius` out to the image edge.
function scanRays(diff, width, height, centre, { angles, step, threshold, minRadius }) {
  const rays = [];
  for (let index = 0; index < angles; index += 1) {
    const angle = index / angles * 2 * Math.PI - Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const crossings = [];
    const strengths = [];
    let runWeight = 0;
    let runMoment = 0;
    let runPeak = 0;
    let inRun = false;
    for (let radius = minRadius; ; radius += step) {
      const x = Math.round(centre[0] + radius * cos);
      const y = Math.round(centre[1] + radius * sin);
      if (x < 0 || y < 0 || x >= width || y >= height) break;
      const value = diff[y * width + x];
      if (value > threshold) {
        inRun = true;
        runWeight += value;
        runMoment += value * radius;
        runPeak = Math.max(runPeak, value);
      } else if (inRun) {
        crossings.push(runMoment / runWeight);
        strengths.push(runWeight);
        inRun = false;
        runWeight = 0;
        runMoment = 0;
        runPeak = 0;
      }
    }
    if (inRun) { crossings.push(runMoment / runWeight); strengths.push(runWeight); }
    rays.push({ angle, crossings, strengths });
  }
  return rays;
}

// The trail against the oracle's motion: the screen-angular direction the
// body moves in about the Sun comes from projecting a step along its
// velocity; rays behind the body (against that direction) must carry the
// line at the predicted radius with falling strength, rays ahead must not.
function measureTrail(rays, camera, body, sunPixel, predicted, markerSize) {
  const here = camera.project(body.position);
  const step = camera.project(lighting.subtract(body.position, lighting.scale(body.velocity, -0.01)));
  const angleOf = (pixel) => Math.atan2(pixel[1] - sunPixel[1], pixel[0] - sunPixel[0]);
  const motionSign = Math.sign(wrapAngle(angleOf(step) - angleOf(here)));
  const bodyAngle = angleOf(here);
  const bodyRadius = Math.hypot(here[0] - sunPixel[0], here[1] - sunPixel[1]);
  // Rays inside the marker's footprint see the marker, not the line.
  const clearance = (markerSize / 2 + 4) / bodyRadius * 180 / Math.PI;
  const sample = (offsetDegrees, direction) => {
    const angle = wrapAngle(bodyAngle + direction * motionSign * offsetDegrees * Math.PI / 180);
    // The five rays nearest the sample angle: found on a majority, strength
    // averaged across them.
    const nearest = rays.map((ray) => ({ ray, gap: Math.abs(wrapAngle(ray.angle - angle)) }))
      .sort((a, b) => a.gap - b.gap).slice(0, 5).map(({ ray }) => ray);
    let hits = 0;
    let strength = 0;
    for (const ray of nearest) {
      const expected = oracle.polarRadiusAt(predicted, ray.angle);
      const window = Math.max(4, 0.06 * expected);
      let best = 0;
      ray.crossings.forEach((radius, index) => {
        if (Math.abs(radius - expected) <= window) best = Math.max(best, ray.strengths[index]);
      });
      if (best > 0) hits += 1;
      strength += best / nearest.length;
    }
    return { offsetDegrees, found: hits >= 3, hits, strength };
  };
  return {
    motionSign,
    behind: TOLERANCES.trailBehindDegrees.map((degrees) => sample(Math.max(degrees, clearance), -1)),
    ahead: TOLERANCES.trailAheadDegrees.map((degrees) => sample(Math.max(degrees, clearance), 1)),
  };
}

// Gap between a marker's radius about the Sun and the painted line at its
// angle: on each side of the marker, the first scanned ray clear of the
// marker's footprint (plus a margin) contributes the crossing nearest the
// marker's radius within 15 % of it; the two are averaged so a curving line
// cancels to first order. Null when neither side has a crossing.
function paintedRadiusGap(rays, angle, radius, markerSize) {
  const clearance = (markerSize / 2 + 4) / radius;
  const sides = [];
  for (const sign of [-1, 1]) {
    const candidates = rays
      .map((ray) => ({ ray, offset: wrapAngle(ray.angle - angle) * sign }))
      .filter(({ offset }) => offset >= clearance)
      .sort((a, b) => a.offset - b.offset);
    for (const { ray } of candidates.slice(0, 3)) {
      const near = ray.crossings.filter((value) => Math.abs(value - radius) <= 0.15 * radius)
        .sort((a, b) => Math.abs(a - radius) - Math.abs(b - radius));
      if (near.length) { sides.push(near[0]); break; }
    }
  }
  if (sides.length === 0) return null;
  const painted = sides.reduce((sum, value) => sum + value, 0) / sides.length;
  return Math.abs(painted - radius);
}

function peakLuminance(image, centre, radius) {
  let peak = 0;
  for (let y = Math.floor(centre[1] - radius); y <= Math.ceil(centre[1] + radius); y += 1) {
    for (let x = Math.floor(centre[0] - radius); x <= Math.ceil(centre[0] + radius); x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      peak = Math.max(peak, image.luminance[y * image.width + x]);
    }
  }
  return peak;
}

async function decodeLuminance(image) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const luminance = new Float32Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * channels;
    luminance[index] = 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
  }
  return { width, height, luminance };
}

async function readSystemState(page) {
  return page.evaluate(() => {
    const sky = window.__mercury.sky.state();
    const group = document.querySelector(".planet-heliocentric-system");
    return {
      opacity: sky.planetarySystem?.opacity ?? null,
      groupOpacity: group ? Number(getComputedStyle(group).opacity) : null,
      orbitPieceCount: sky.planetarySystem?.orbitPieceCount ?? null,
      markerVisibleCount: sky.planetarySystem?.markerVisibleCount ?? null,
      sunMarkerOpacity: sky.planetarySystem?.sunMarkerOpacity ?? null,
      sunMarkerVisible: sky.planetarySystem?.sunMarkerVisible ?? null,
      lodStage: sky.lod?.stage ?? null,
      distanceKilometers: window.__mercury.camera.state().distanceKilometers,
    };
  });
}

async function setOrbitLines(page, enabled) {
  await page.evaluate((next) => {
    const control = document.querySelector('input[name="orbit"]');
    if (control.checked === next) return;
    control.checked = next;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }, enabled);
  await page.waitForFunction((next) =>
    window.__mercury.runtime.selection().committed.orbit === next, enabled);
  await nextPaint(page);
}

async function readGeometry(page) {
  const stageBox = await page.locator(".planet-stage").boundingBox();
  const skyFocalPixels = await page.locator(".mercury-skybox").evaluate(
    (element) => parseFloat(getComputedStyle(element).perspective),
  );
  const origin = await page.locator(".mercury-skybox").evaluate((element) => {
    const [x, y] = getComputedStyle(element).perspectiveOrigin.split(" ").map(parseFloat);
    const box = element.getBoundingClientRect();
    return [box.x + x, box.y + y];
  });
  return { stageBox, stageCentre: origin, skyFocalPixels };
}

async function readPose(page) {
  const transform = await page.locator(".mercury-scene").evaluate((element) => element.style.transform);
  return lighting.parseSceneRotation(transform);
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

// Control pitch to scene pitch is affine; measure it from two painted poses
// so the suite never encodes the runtime's mapping.
async function calibrateControlPitch(page) {
  const samples = [];
  for (const controlPitch of [89, 34]) {
    await setPose(page, { controlPitch, controlYaw: 0, zoom: 1.1 });
    const { pitchDegrees } = lighting.scenePitchYawDegrees(await readPose(page));
    samples.push([controlPitch, pitchDegrees]);
  }
  const slope = (samples[1][0] - samples[0][0]) / (samples[1][1] - samples[0][1]);
  return { samples, slope,
    controlForScenePitch: (scenePitch) => samples[0][0] + slope * (scenePitch - samples[0][1]) };
}

function wrapAngle(angle) {
  return ((angle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
