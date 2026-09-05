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
  // Share of scan rays on which the orbit was found.
  coverage: 0.9,
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
    const radii = matched.map((entry) => entry.radius);
    const pixelAxis = radii.length ? (Math.max(...radii) + Math.min(...radii)) / 2 : null;
    measuredPixelAxes[id] = pixelAxis;
    const absolute = residuals.map(Math.abs).sort((a, b) => a - b);
    const meanResidual = absolute.length ? absolute.reduce((sum, value) => sum + value, 0) / absolute.length : null;
    const p95Residual = absolute.length ? absolute[Math.floor(0.95 * (absolute.length - 1))] : null;
    // Back-projection into the oracle's orbital plane: the semi-major axis
    // from the farthest and nearest painted points about the Sun.
    const focusDistancesKm = matched.map(({ angle, radius }) => {
      const point = camera.backProject(
        [sunPixel[0] + radius * Math.cos(angle), sunPixel[1] + radius * Math.sin(angle)],
        system.sun,
        body.normal,
      );
      return point === null ? null : Math.hypot(...lighting.subtract(point, system.sun));
    }).filter((value) => value !== null);
    const backProjectedAu = focusDistancesKm.length
      ? (Math.max(...focusDistancesKm) + Math.min(...focusDistancesKm)) / 2 / oracle.AU_KILOMETERS
      : null;
    const textbook = oracle.TEXTBOOK_SEMI_MAJOR_AXES_AU[id];
    const orbit = {
      coverage, matchedRays: matched.length, pixelSemiMajorAxis: pixelAxis,
      predictedPixelSemiMajorAxis: predicted.length
        ? (Math.max(...predicted.map((p) => p[1])) + Math.min(...predicted.map((p) => p[1]))) / 2 : null,
      shapeMeanResidualPixels: meanResidual, shapeP95ResidualPixels: p95Residual,
      backProjectedSemiMajorAxisAu: backProjectedAu, textbookAu: textbook,
      oracleAu: body.semiMajorAxisAu,
      backProjectedErrorShare: backProjectedAu === null ? null : backProjectedAu / textbook - 1,
    };
    result.orbits[id] = orbit;
    check(`orbit-coverage-${id}-${view.id}`, coverage >= TOLERANCES.coverage, { id, coverage });
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
  check(`orbits-nest-without-crossing-${view.id}`, orderedRays > 600 && orderViolations === 0, result.nesting);

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
    check(`marker-visible-${id}-${view.id}`, marker.visible && marker.opacity > 0.99 &&
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
    let runWeight = 0;
    let runMoment = 0;
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
      } else if (inRun) {
        crossings.push(runMoment / runWeight);
        inRun = false;
        runWeight = 0;
        runMoment = 0;
      }
    }
    if (inRun) crossings.push(runMoment / runWeight);
    rays.push({ angle, crossings });
  }
  return rays;
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
