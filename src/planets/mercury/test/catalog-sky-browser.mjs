// The catalogue sky over Mercury, measured on painted pixels in real Chrome
// and held to the reference engine's acceptance criterion (galaxio
// `labels/labelVisibility.test.ts`): at every distance decade AND every
// camera orientation, stars are drawn where the catalogue puts them, at
// least one drawn star subtends a usable number of pixels, at least one
// caption is drawn, no two captions overlap, and no star caption overlaps a
// body caption. Both axes are swept because the altitude-only version of
// this check has shipped orientation bugs in the reference.
//
// The oracle is the vendored HYG catalogue read here, in Node, through the
// catalogue package: each star's ICRS direction is projected in the page
// through the runtime's own published scene matrix and the prepared sky
// registration (the same chain the photographic sky rides), never through
// the layer under test. The photographic sky is cross-checked the other way
// round: with the points hidden, the photograph's brightest blob near each
// predicted bright star is located on a screenshot, which measures the
// double image a point over its photographic star leaves.
//
// The layer is mounted by this suite through its integration hook (it is
// not wired into the Mercury client yet), fed every publication from the
// object's diagnostics, and given the heliocentric view's accepted body
// captions as reserved boxes.
//
// Usage: node src/planets/mercury/test/catalog-sky-browser.mjs [baseUrl]
//   [--mutation <id>]   (ids in catalog-sky-mutations.mjs)
// The last stdout line is a JSON report. CATALOG_SKY_DUMP=<dir> saves
// screenshots (default captures/catalog-sky).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import { readVendoredCatalog } from "../../../platform/catalog-package.mjs";
import { CATALOG_SKY_MUTATIONS } from "./catalog-sky-mutations.mjs";

const baseUrl = process.argv.find((argument) => /^https?:/u.test(argument)) ?? "http://127.0.0.1:4210";
const mutationIndex = process.argv.indexOf("--mutation");
const mutation = mutationIndex === -1 ? null : process.argv[mutationIndex + 1];
const MUTATIONS = CATALOG_SKY_MUTATIONS;
if (mutation !== null && !(mutation in MUTATIONS)) throw new Error(`Unknown mutation ${mutation}.`);

export const TOLERANCES = Object.freeze({
  // A painted star's centre against the oracle's projection, CSS pixels.
  placementPixels: 0.75,
  // The photograph's blob against the oracle, CSS pixels (0.5 degrees at
  // the 60-degree, 1440 px view is 12 px; the registration's anchor
  // residuals are 0.08-0.27 degrees).
  photoMedianPixels: 12,
  // Fewest stars painted inside the viewport at any pose.
  minimumStarsInView: 25,
  // Fewest painted pixels across a usable star (a magnitude-4 disc is 2 px).
  usableStarPixels: 2,
  // Frame publication budget the performance suite holds the object to.
  frameP95Milliseconds: 35,
});

// Distances (km) from the surface to the dolly's far bound, and eight
// headings at four pitches: the two axes.
const DISTANCES_KM = [1e4, 2e9, 2e10, 4.4e10];
const HEADINGS = 8;
const PITCHES_SCENE = [90, 45, 0, -50];

const checks = [];
const report = { baseUrl, mutation, sweep: [] };
const dumpDirectory = process.env.CATALOG_SKY_DUMP ?? resolve(import.meta.dirname, "../../../../captures/catalog-sky");
await mkdir(dumpDirectory, { recursive: true });

function check(id, ok, detail) {
  checks.push({ ...detail, id, ok: Boolean(ok) });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail).slice(0, 700)}`);
}

// The oracle: the brightest catalogue stars, by Hipparcos number, with
// their ICRS unit directions and apparent magnitudes.
const { catalog } = await readVendoredCatalog("catalogs/stars-hyg");
const oracle = (() => {
  const position = catalog.numeric("posPc");
  const absolute = catalog.numeric("absMag");
  const hip = catalog.numeric("hip");
  const names = catalog.strings("name");
  const rows = [];
  for (let index = 0; index < catalog.count; index += 1) {
    const x = position[index * 3], y = position[index * 3 + 1], z = position[index * 3 + 2];
    const distance = Math.hypot(x, y, z);
    if (!(distance > 0) || hip[index] === 0) continue;
    const magnitude = absolute[index] + 5 * Math.log10(distance) - 5;
    if (magnitude > 5) continue;
    rows.push({ hip: hip[index], magnitude, direction: [x / distance, y / distance, z / distance], name: names[index] });
  }
  rows.sort((a, b) => a.magnitude - b.magnitude);
  if (mutation === "oracle-rotated") {
    const angle = 1.5 * Math.PI / 180;
    for (const row of rows) {
      const [x, y, z] = row.direction;
      row.direction = [x * Math.cos(angle) - z * Math.sin(angle), y, x * Math.sin(angle) + z * Math.cos(angle)];
    }
  }
  return rows;
})();
report.oracleCount = oracle.length;

const stylesheet = await readFile(new URL("../../../platform/catalog-sky.css", import.meta.url), "utf8");

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`error: ${message.text()}`); });
  await openMercury(page);
  const mounted = await mountLayer(page, { stylesheet, mutation });
  report.mounted = mounted;
  check("layer-mounted-retained", mounted.starCount === 1599 && mounted.addedNodes === mounted.expectedNodes &&
    mounted.labelCount === 12 && mounted.zeroWidthNames === 0,
    mounted);
  const stats = await page.evaluate(() => window.__mercury.camera.stats());
  const calibration = await calibrateControlPitch(page);
  const controlFor = (scenePitch) => calibration.controlForScenePitch(scenePitch);

  // ---------------------------------------------------------------------
  // The two-axis sweep: placement, coverage, size, captions at every cell.
  // ---------------------------------------------------------------------
  const cells = [];
  let cellsWithDrops = 0;
  for (const distanceKm of DISTANCES_KM) {
    for (const scenePitch of PITCHES_SCENE) {
      for (let heading = 0; heading < HEADINGS; heading += 1) {
        const controlYaw = heading * 360 / HEADINGS;
        await setPose(page, { controlPitch: controlFor(scenePitch), controlYaw,
          distanceKilometers: Math.min(distanceKm, stats.dolly.maximumDistanceKilometers) });
        // Let the caption alpha ramps settle (bounded steps per publication).
        for (let step = 0; step < 12; step += 1) await setPose(page, { controlYaw });
        await nextPaint(page);
        const cell = await readCell(page, oracle.slice(0, 600));
        cell.distanceKm = distanceKm;
        cell.scenePitch = scenePitch;
        cell.heading = heading;
        cells.push(cell);
      }
    }
  }
  report.sweep = cells.map((cell) => ({
    distanceKm: cell.distanceKm, scenePitch: cell.scenePitch, heading: cell.heading,
    starsInView: cell.starsInView, placement: cell.placement, largestStarPixels: cell.largestStarPixels,
    captions: cell.captions.visible.map((entry) => entry.text), overlaps: cell.captions.overlaps,
    bodyOverlaps: cell.captions.bodyOverlaps, reserved: cell.captions.reservedCount,
  }));
  for (const cell of cells) {
    const tag = `${cell.distanceKm.toExponential(0)}km-p${cell.scenePitch}-h${cell.heading}`;
    check(`star-placement-${tag}`, cell.placement.checked >= 6 && cell.placement.maxPixels <= TOLERANCES.placementPixels,
      { tag, ...cell.placement });
    check(`stars-cover-${tag}`, cell.starsInView >= TOLERANCES.minimumStarsInView, { tag, starsInView: cell.starsInView });
    check(`usable-star-${tag}`, cell.largestStarPixels >= TOLERANCES.usableStarPixels,
      { tag, largestStarPixels: cell.largestStarPixels });
    const captions = cell.captions;
    check(`caption-shown-${tag}`, captions.visible.length >= 1 && captions.outside === 0,
      { tag, visible: captions.visible.map((entry) => entry.text), outside: captions.outside });
    check(`captions-do-not-overlap-${tag}`, captions.overlaps.length === 0, { tag, overlaps: captions.overlaps });
    check(`captions-clear-body-captions-${tag}`, captions.bodyOverlaps.length === 0, { tag, bodyOverlaps: captions.bodyOverlaps });
    check(`captions-above-stars-${tag}`, captions.belowStar.length === 0, { tag, belowStar: captions.belowStar });
    // The reference's ordinary budget bounds what is drawn (a caption on
    // its way out may still be fading).
    const budget = captions.ordinaryLimit + captions.fading.length;
    check(`caption-pool-bounded-${tag}`, captions.visible.length <= budget && captions.visible.length <= captions.policy.poolSize,
      { tag, count: captions.visible.length, ordinaryLimit: captions.ordinaryLimit, fading: captions.fading.length });
    // The pass recomputed here with an independent greedy implementation
    // of the reference rule over the runtime's own candidates and the
    // reserved body boxes, then the ordinary budget in priority order:
    // accepted sets must agree.
    const greedy = greedyDeclutter(captions.candidates, captions.reserved, captions.policy.spacingPixels);
    const expected = new Set([...greedy].slice(0, captions.ordinaryLimit));
    const runtimeAccepted = new Set(captions.candidates.filter((candidate) => candidate.accepted).map((candidate) => candidate.key));
    const drawn = captions.visible.map((entry) => entry.occupant);
    check(`declutter-matches-reference-rule-${tag}`, setsEqual(expected, runtimeAccepted) &&
      drawn.every((key) => runtimeAccepted.has(key) || captions.fading.includes(key)),
      { tag, expected: [...expected], runtime: [...runtimeAccepted], drawn, fading: captions.fading });
    if (captions.candidates.length > greedy.size) cellsWithDrops += 1;
  }
  check("declutter-drops-something-somewhere", cellsWithDrops > 0, { cellsWithDrops, cells: cells.length });
  const sparsest = cells.reduce((worst, cell) => Math.min(worst, cell.starsInView), Number.POSITIVE_INFINITY);
  report.sparsestCellStars = sparsest;
  report.worstPlacementPixels = cells.reduce((worst, cell) => Math.max(worst, cell.placement.maxPixels), 0);
  // The dolly does not move the field: at one orientation the painted
  // positions agree across every distance decade.
  const byPose = new Map();
  for (const cell of cells) {
    const key = `${cell.scenePitch}:${cell.heading}`;
    const first = byPose.get(key);
    if (!first) byPose.set(key, cell);
    else {
      const drift = driftBetween(first.placement.samples, cell.placement.samples);
      check(`field-at-infinity-${key}-${cell.distanceKm.toExponential(0)}km`, drift.compared > 5 && drift.maxPixels <= 0.5,
        { pose: key, distanceKm: cell.distanceKm, ...drift });
    }
  }
  // Size hierarchy: Sirius against a magnitude-4.5 star in the same view.
  const hierarchy = await sizeHierarchy(page, oracle, controlFor);
  report.sizeHierarchy = hierarchy;
  check("size-hierarchy-sirius-over-faint", hierarchy.faintPixels !== null && hierarchy.brightPixels > hierarchy.faintPixels * 1.3 &&
    hierarchy.brightPixels >= 8, hierarchy);

  // ---------------------------------------------------------------------
  // The photographic cross-check, three poses, and the screenshots.
  // ---------------------------------------------------------------------
  const photo = [];
  for (const [index, pose] of [[90, 2], [0, 5], [-50, 7]].entries()) {
    const [scenePitch, heading] = pose;
    await setPose(page, { controlPitch: controlFor(scenePitch), controlYaw: heading * 360 / HEADINGS, distanceKilometers: 2e10 });
    await nextPaint(page);
    const predicted = await page.evaluate(({ rows }) => window.__catalogSky.predict(rows), { rows: oracle.slice(0, 200) });
    const inView = predicted.filter((entry) => entry.inView && entry.margin > 24).slice(0, 12);
    const pointsImage = await page.screenshot();
    await writeFile(`${dumpDirectory}/points-${index}.png`, pointsImage);
    // The photograph alone, in the shell's high-contrast sky (its standard
    // presentation carries the point detail at 0.4 gain, too faint to
    // locate on a screenshot): the points and captions hidden.
    await page.evaluate(() => {
      window.__catalogSky.layer.root.style.visibility = "hidden";
      window.__catalogSky.layer.overlay.style.visibility = "hidden";
      document.body.dataset.skyContrast = "high";
    });
    await page.waitForFunction(() => [...document.querySelectorAll(".mercury-skybox-face")].every((face) => {
      const url = getComputedStyle(face).backgroundImage;
      return !url.includes("-standard");
    }));
    await page.waitForTimeout(400);
    await nextPaint(page);
    const photoImage = await page.screenshot();
    await page.evaluate(() => {
      window.__catalogSky.layer.root.style.visibility = "";
      window.__catalogSky.layer.overlay.style.visibility = "";
      delete document.body.dataset.skyContrast;
    });
    await nextPaint(page);
    await writeFile(`${dumpDirectory}/photo-only-${index}.png`, photoImage);
    const offsets = await photographicOffsets(photoImage, inView);
    const found = offsets.filter((entry) => entry.found);
    const sorted = found.map((entry) => entry.offsetPixels).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const pixelsPerDegree = predicted.find((entry) => entry.pixelsPerDegree)?.pixelsPerDegree ?? null;
    const facesCarryStampedStars = await page.evaluate(() => Boolean(window.__mercury.sky.state().catalogueStars?.stampedCount > 0));
    const record = { scenePitch, heading, facesCarryStampedStars, stars: offsets, found: found.length, medianOffsetPixels: median,
      medianOffsetDegrees: median === null || pixelsPerDegree === null ? null : Number((median / pixelsPerDegree).toFixed(3)), pixelsPerDegree };
    photo.push(record);
    check(`photo-registration-p${scenePitch}-h${heading}`, found.length >= 3 && median !== null && median <= TOLERANCES.photoMedianPixels, record);
  }
  report.photographicCrossCheck = photo;

  // ---------------------------------------------------------------------
  // Typography follows the shell rail; the knobs are live; the frame cost.
  // ---------------------------------------------------------------------
  await setPose(page, { controlPitch: controlFor(0), controlYaw: 90, distanceKilometers: 2e10 });
  for (let step = 0; step < 12; step += 1) await setPose(page, { controlYaw: 90 });
  await nextPaint(page);
  const typography = await page.evaluate(() => {
    const rail = getComputedStyle(document.querySelector(".scale-stop:not([aria-current]) .scale-label") ?? document.querySelector(".scale-label"));
    const shellSecondary = getComputedStyle(document.documentElement).getPropertyValue("--shell-text-secondary").trim();
    const label = [...document.querySelectorAll(".mercury-catalog-label")].find((element) => element.style.visibility !== "hidden");
    const style = label ? getComputedStyle(label) : null;
    const state = window.__catalogSky.layer.state();
    return {
      rail: { fontSize: rail.fontSize, fontWeight: rail.fontWeight, fontFamily: rail.fontFamily, opacity: rail.opacity, color: rail.color },
      label: style ? { fontSize: style.fontSize, fontWeight: style.fontWeight, fontFamily: style.fontFamily, color: style.color, opacity: style.opacity, text: label.textContent } : null,
      shellSecondary,
      maxSlotAlpha: Math.max(...state.labels.slots.map((slot) => slot.alpha)),
      policy: state.labels.policy,
    };
  });
  report.typography = typography;
  check("captions-match-shell-rail-typography", typography.label !== null &&
    typography.label.fontSize === typography.rail.fontSize && typography.label.fontWeight === typography.rail.fontWeight &&
    typography.label.fontFamily === typography.rail.fontFamily &&
    typography.label.color === cssColor(typography.shellSecondary) &&
    Math.abs(typography.maxSlotAlpha - Number(typography.rail.opacity)) < 1e-6 &&
    typography.policy.maxAlpha === Number(typography.rail.opacity),
    typography);

  const knobs = await page.evaluate(() => {
    const layer = window.__catalogSky.layer;
    const before = layer.state();
    layer.setMagnitudeLimit(3);
    const limited = layer.state();
    const limitedVisible = [...document.querySelectorAll(".mercury-catalog-sky .planet-catalog-sky-band")]
      .filter((band) => !band.hidden).reduce((total, band) => total + band.childElementCount, 0);
    layer.setMagnitudeLimit(before.magnitudeLimit);
    const captionsBefore = layer.state().labels.acceptedCount;
    layer.setLabelPolicy({ magnitudeLimit: -10 });
    window.__catalogSky.publish();
    const none = layer.state().labels.candidateCount;
    layer.setLabelPolicy({ magnitudeLimit: before.labels.magnitudeLimit });
    window.__catalogSky.publish();
    const restored = layer.state();
    // The ordinary budget raised to six: more captions, still decluttered.
    const ordinaryBefore = restored.labels.ordinaryLimit;
    layer.setLabelPolicy({ ordinaryLimit: 6 });
    for (let step = 0; step < 12; step += 1) window.__catalogSky.publish();
    const raised = layer.state().labels;
    const raisedPainted = [...document.querySelectorAll(".mercury-catalog-label")].filter((element) => element.style.visibility !== "hidden").length;
    layer.setLabelPolicy({ ordinaryLimit: ordinaryBefore });
    for (let step = 0; step < 12; step += 1) window.__catalogSky.publish();
    const halo = layer.setStarPresentation({ haloAlpha: 0.3 });
    const haloVar = getComputedStyle(layer.root).getPropertyValue("--planet-catalog-star-halo-alpha").trim();
    layer.setStarPresentation({ haloAlpha: before.halo.alpha });
    return { before: { visibleBandCount: before.visibleBandCount, visibleStarCount: before.visibleStarCount, magnitudeLimit: before.magnitudeLimit, ordinaryLimit: ordinaryBefore },
      limited: { visibleBandCount: limited.visibleBandCount, visibleStarCount: limited.visibleStarCount, painted: limitedVisible },
      captionsBefore, noneWhenLimited: none, restoredVisibleStars: restored.visibleStarCount, restoredCaptions: restored.labels.acceptedCount,
      raised: { ordinaryLimit: raised.ordinaryLimit, accepted: raised.acceptedCount, painted: raisedPainted, candidates: raised.candidateCount },
      halo: { applied: halo.alpha, variable: haloVar } };
  });
  report.knobs = knobs;
  check("magnitude-limit-knob-is-live", knobs.before.visibleStarCount === 1599 && knobs.limited.visibleBandCount === 3 &&
    knobs.limited.visibleStarCount === 175 && knobs.limited.painted === 175 && knobs.restoredVisibleStars === 1599, knobs);
  check("caption-limit-knob-is-live", knobs.captionsBefore > 0 && knobs.noneWhenLimited === 0 && knobs.restoredCaptions > 0, knobs);
  check("ordinary-caption-budget-is-the-reference-one-and-live", knobs.before.ordinaryLimit === 1 && knobs.restoredCaptions === 1 &&
    knobs.raised.ordinaryLimit === 6 && knobs.raised.accepted > 1 && knobs.raised.accepted <= 6 && knobs.raised.painted === knobs.raised.accepted, knobs);
  check("halo-knob-is-live", knobs.halo.applied === 0.3 && knobs.halo.variable === "0.3", knobs);

  // The exposure knob, live, and what it does to the sky on pixels: mean
  // and peak luminance of the visible sky at one pose (heliocentric overlays
  // and captions hidden) with the prepared exposure and with a less
  // dark-adapted eye, then the prepared exposure restored.
  await setPose(page, { controlPitch: controlFor(0), controlYaw: 90, distanceKilometers: 2e10 });
  await nextPaint(page);
  const skyBefore = await skyLuminance(page);
  const exposureKnob = await page.evaluate(() => {
    const layer = window.__catalogSky.layer;
    const before = layer.state().exposure;
    const faintIndex = layer.plan.count - 1;
    const alphaBefore = Number(document.querySelectorAll(".mercury-catalog-sky .planet-catalog-star")[faintIndex].style.opacity);
    const applied = layer.setExposure({ adaptationLuminanceCdM2: 0.2 });
    const alphaAfter = Number(document.querySelectorAll(".mercury-catalog-sky .planet-catalog-star")[faintIndex].style.opacity);
    return { before, applied, alphaBefore, alphaAfter };
  });
  await nextPaint(page);
  const skyAfter = await skyLuminance(page);
  const restored = await page.evaluate(() => window.__catalogSky.layer.setExposure({
    adaptationLuminanceCdM2: window.__catalogSky.layer.plan.photometry.exposure.adaptationLuminanceCdM2 }));
  report.exposure = { prepared: exposureKnob.before, session: exposureKnob.applied, restored,
    faintestStarAlpha: { prepared: exposureKnob.alphaBefore, session: exposureKnob.alphaAfter },
    sky: { prepared: skyBefore, session: skyAfter } };
  check("exposure-knob-is-live", exposureKnob.before.source === "prepared" && exposureKnob.applied.adaptationLuminanceCdM2 === 0.2 &&
    exposureKnob.alphaAfter < exposureKnob.alphaBefore && skyAfter.mean < skyBefore.mean && skyAfter.litPixels < skyBefore.litPixels &&
    restored.adaptationLuminanceCdM2 === exposureKnob.before.adaptationLuminanceCdM2, report.exposure);

  const frames = await page.evaluate(async () => {
    const samples = [];
    for (let index = 0; index < 90; index += 1) {
      const start = performance.now();
      window.__mercury.camera.setState({ controlPitch: index / 89 * 89, controlYaw: index / 89 * 360, zoom: 1.1 });
      window.__catalogSky.publish();
      await new Promise((done) => requestAnimationFrame(done));
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return { samples: samples.length, p50: samples[45], p95: samples[85], maximum: samples.at(-1) };
  });
  report.framePublicationMilliseconds = frames;
  check("frame-cost-within-budget", frames.p95 <= TOLERANCES.frameP95Milliseconds, frames);

  const stability = await page.evaluate(() => window.__catalogSky.assertStable());
  check("retained-dom-stable-across-sweep", stability.stable, stability);

  // ---------------------------------------------------------------------
  // Device pixel ratio 2: placement again, and a crop for the record.
  // ---------------------------------------------------------------------
  const dpr2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    const page2 = await dpr2.newPage();
    page2.on("pageerror", (error) => problems.push(`pageerror(dpr2): ${error.message}`));
    await openMercury(page2);
    await mountLayer(page2, { stylesheet, mutation });
    const calibration2 = await calibrateControlPitch(page2);
    await setPose(page2, { controlPitch: calibration2.controlForScenePitch(0), controlYaw: 5 * 360 / HEADINGS, distanceKilometers: 2e10 });
    for (let step = 0; step < 12; step += 1) await setPose(page2, { controlYaw: 5 * 360 / HEADINGS });
    await nextPaint(page2);
    const cell = await readCell(page2, oracle.slice(0, 400));
    report.dpr2 = { placement: cell.placement, starsInView: cell.starsInView, captions: cell.captions.visible.map((entry) => entry.text),
      overlaps: cell.captions.overlaps, largestStarPixels: cell.largestStarPixels };
    check("star-placement-dpr2", cell.placement.checked >= 10 && cell.placement.maxPixels <= TOLERANCES.placementPixels, cell.placement);
    check("captions-do-not-overlap-dpr2", cell.captions.overlaps.length === 0 && cell.captions.visible.length >= 1,
      { overlaps: cell.captions.overlaps, visible: cell.captions.visible.length });
    const image = await page2.screenshot();
    await writeFile(`${dumpDirectory}/points-dpr2.png`, image);
    const crop = cell.captions.visible[0]?.box;
    if (crop) {
      await sharp(image).extract({ left: Math.max(0, Math.round(crop.x * 2) - 160), top: Math.max(0, Math.round(crop.y * 2) - 120),
        width: 480, height: 320 }).toFile(`${dumpDirectory}/points-dpr2-crop.png`);
    }
  } finally {
    await dpr2.close();
  }
  check("no-page-errors", problems.length === 0, { problems });
} finally {
  await browser.close();
}

const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.id);
await writeFile(`${dumpDirectory}/report${mutation ? `-${mutation}` : ""}.json`,
  `${JSON.stringify({ suite: "mercury-catalog-sky", ok: failed.length === 0, failed, checks, ...report }, null, 2)}\n`);
await new Promise((resolve) => process.stdout.write(
  `${JSON.stringify({ suite: "mercury-catalog-sky", ok: failed.length === 0, failed, checks, ...report })}\n`, resolve));
process.exit(failed.length === 0 ? 0 : 1);

// -----------------------------------------------------------------------

async function openMercury(page) {
  await page.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true &&
    document.documentElement.dataset.ready === "true");
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (motion?.checked) motion.click();
  });
}

// Mounts the layer through its integration hook, with the stylesheet the
// shell would bundle, and installs the publication bridge.
async function mountLayer(page, { stylesheet: css, mutation: id }) {
  return page.evaluate(async ({ css: styles, mutationId }) => {
    const style = document.createElement("style");
    style.textContent = styles;
    document.head.appendChild(style);
    const [{ mountRetainedCatalogSky }, { PREPARED_MERCURY_CATALOG_SKY }] = await Promise.all([
      import("/src/platform/catalog-sky-runtime.mjs"),
      import("/src/planets/mercury/runtime/preparedCatalogSky.mjs"),
    ]);
    let plan = PREPARED_MERCURY_CATALOG_SKY;
    const options = {};
    if (mutationId === "mirror-placement") {
      plan = { ...plan, stars: { ...plan.stars, rotateYDegrees: plan.stars.rotateYDegrees.map((value) => -value) } };
    } else if (mutationId === "flat-sizes") {
      plan = { ...plan, stars: { ...plan.stars, radiusPx: plan.stars.radiusPx.map(() => plan.photometry.minRadiusPx) } };
    } else if (mutationId === "no-captions") {
      options.labelMagnitudeLimit = -10;
    } else if (mutationId === "bands-hidden") {
      options.magnitudeLimit = -10;
    } else if (mutationId === "no-declutter") {
      options.ordinaryLabelLimit = 12;
      options.services = {
        createLabelDeclutter: () => {
          const candidates = [];
          return { reset() { candidates.length = 0; }, add(candidate) { candidates.push(candidate); return true; },
            resolve() { return candidates; }, accepted() { return true; }, get count() { return candidates.length; } };
        },
      };
    }
    const stage = document.querySelector(".planet-stage");
    const before = stage.querySelectorAll("*").length;
    const layer = mountRetainedCatalogSky({ host: stage, plan, objectId: "mercury", ...options });
    const nodes = [...stage.querySelectorAll("*")];
    const parents = nodes.map((node) => node.parentNode);
    const reserved = () => (window.__mercury.sky.state().captions?.candidates ?? []).filter((candidate) => candidate.accepted);
    const publish = () => layer.publish(window.__mercury.runtime.view(), { reservedCaptions: reserved() });
    window.__catalogSky = {
      layer,
      publish,
      assertStable() {
        const current = [...stage.querySelectorAll("*")];
        const stable = current.length === nodes.length && current.every((node, index) => node === nodes[index] && node.parentNode === parents[index]);
        return { stable, nodes: nodes.length, now: current.length };
      },
      // The oracle's projection through the runtime's published scene
      // matrix and the prepared sky registration, with the sky root's own
      // perspective and centre: nothing from the layer under test.
      predict(rows) {
        const view = window.__mercury.runtime.view();
        const skybox = new DOMMatrix(view.sceneMatrix).multiply(new DOMMatrix(window.__mercury.sky.sceneRegistration));
        const skyRoot = document.querySelector(".mercury-skybox");
        const focal = parseFloat(getComputedStyle(skyRoot).perspective);
        const bounds = skyRoot.getBoundingClientRect();
        const centreX = bounds.x + bounds.width / 2;
        const centreY = bounds.y + bounds.height / 2;
        // The visible window: the stage clipped by the browser viewport (the
        // shell lays the stage out beside its chrome).
        const visible = window.__catalogSky.visibleWindow();
        return rows.map((row) => {
          const eye = skybox.transformPoint(new DOMPoint(row.direction[0], row.direction[1], row.direction[2], 0));
          const depth = -eye.z;
          if (!(depth > 0.05)) return { hip: row.hip, inView: false };
          const x = centreX + focal * eye.x / depth;
          const y = centreY + focal * eye.y / depth;
          const margin = Math.min(x - visible.x, visible.right - x, y - visible.y, visible.bottom - y);
          return { hip: row.hip, name: row.name, magnitude: row.magnitude, x, y, inView: margin > 0, margin,
            pixelsPerDegree: focal * Math.PI / 180 };
        });
      },
      visibleWindow() {
        const stage = document.querySelector(".planet-stage").getBoundingClientRect();
        const x = Math.max(0, stage.x), y = Math.max(0, stage.y);
        const right = Math.min(window.innerWidth, stage.right), bottom = Math.min(window.innerHeight, stage.bottom);
        return { x, y, right, bottom, width: right - x, height: bottom - y };
      },
    };
    publish();
    const state = layer.state();
    return {
      starCount: layer.retainedStarCount, labelCount: layer.retainedLabelCount,
      addedNodes: nodes.length - before,
      // Root, cube, orientation, the bands, the stars, the overlay and its pool.
      expectedNodes: 3 + plan.bands.length + plan.count + 1 + plan.labels.policy.poolSize,
      zeroWidthNames: Object.values(state.labels.widthPerCapHeight).filter((width) => !(width > 0)).length,
      namedCount: state.labels.namedCount,
    };
  }, { css, mutationId: id });
}

async function setPose(page, next) {
  await page.evaluate((state) => { window.__mercury.camera.setState(state); window.__catalogSky.publish(); }, next);
}

// Everything measured at one pose: painted star centres against the
// oracle, coverage, the largest painted star, and the captions.
async function readCell(page, rows) {
  return page.evaluate(({ rows: oracleRows, spacing }) => {
    const stage = window.__catalogSky.visibleWindow();
    const predicted = window.__catalogSky.predict(oracleRows);
    const byHip = new Map();
    for (const element of document.querySelectorAll(".mercury-catalog-sky .planet-catalog-star")) byHip.set(Number(element.dataset.hip), element);
    const errors = [];
    const samples = [];
    let checked = 0;
    let largest = 0;
    for (const entry of predicted) {
      if (!entry.inView || entry.margin < 8) continue;
      const element = byHip.get(entry.hip);
      if (!element || element.closest("[hidden]")) continue;
      const box = element.getBoundingClientRect();
      if (!(box.width > 0)) continue;
      const error = Math.hypot(box.x + box.width / 2 - entry.x, box.y + box.height / 2 - entry.y);
      errors.push(error);
      samples.push({ hip: entry.hip, x: box.x + box.width / 2, y: box.y + box.height / 2 });
      largest = Math.max(largest, Math.min(box.width, box.height));
      checked += 1;
    }
    errors.sort((a, b) => a - b);
    let starsInView = 0;
    for (const element of document.querySelectorAll(".mercury-catalog-sky .planet-catalog-sky-band:not([hidden]) .planet-catalog-star")) {
      const box = element.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      if (box.width > 0 && x >= stage.x && x <= stage.right && y >= stage.y && y <= stage.bottom) starsInView += 1;
    }
    // Captions.
    const state = window.__catalogSky.layer.state().labels;
    const elements = [...document.querySelectorAll(".mercury-catalog-label")];
    const fading = state.slots.filter((slot) => slot.occupant !== null && slot.target === 0).map((slot) => slot.occupant);
    const visible = [];
    elements.forEach((element, index) => {
      const slot = state.slots[index];
      if (!slot || slot.occupant === null || element.style.visibility === "hidden" || Number(element.style.opacity) <= 0) return;
      const box = element.getBoundingClientRect();
      visible.push({ text: element.textContent, occupant: slot.occupant, alpha: slot.alpha,
        box: { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom },
        anchor: slot.anchor, bottomOffsetPx: slot.bottomOffsetPx });
    });
    const overlaps = [];
    for (let a = 0; a < visible.length; a += 1) {
      for (let b = a + 1; b < visible.length; b += 1) {
        if (rectsOverlap(visible[a].box, visible[b].box)) overlaps.push([visible[a].text, visible[b].text]);
      }
    }
    const bodyCaptions = [...document.querySelectorAll(".mercury-caption")]
      .filter((element) => element.style.visibility !== "hidden" && Number(element.style.opacity) > 0)
      .map((element) => ({ text: element.textContent, box: rect(element.getBoundingClientRect()) }));
    const bodyOverlaps = [];
    for (const label of visible) {
      for (const body of bodyCaptions) if (rectsOverlap(label.box, body.box)) bodyOverlaps.push([label.text, body.text]);
    }
    // Each caption sits above its star: its bottom is at least the gap
    // above the star's painted centre.
    const root = document.querySelector(".mercury-camera").getBoundingClientRect();
    const belowStar = [];
    for (const label of visible) {
      const element = byHip.get(Number(label.occupant.slice("star:".length)));
      const star = element ? element.getBoundingClientRect() : null;
      const starY = star ? star.y + star.height / 2 : root.y + root.height / 2 + label.anchor[1];
      const starX = star ? star.x + star.width / 2 : root.x + root.width / 2 + label.anchor[0];
      if (label.box.bottom > starY - state.policy.gapPixels + 1 || Math.abs((label.box.x + label.box.width / 2) - starX) > 1.5) {
        belowStar.push({ text: label.text, bottom: label.box.bottom, starY, centreX: label.box.x + label.box.width / 2, starX });
      }
    }
    // Captions are whole inside the runtime's viewport, the camera root's
    // box (the shell may lay part of it beyond the window).
    const viewport = document.querySelector(".mercury-camera").getBoundingClientRect();
    const outside = visible.filter((label) => label.box.x < viewport.x - 1 || label.box.right > viewport.right + 1 ||
      label.box.y < viewport.y - 1 || label.box.bottom > viewport.bottom + 1).length;
    const reserved = (window.__mercury.sky.state().captions?.candidates ?? []).filter((candidate) => candidate.accepted);
    return {
      starsInView,
      largestStarPixels: largest,
      placement: { checked, medianPixels: errors[Math.floor(errors.length / 2)] ?? null, maxPixels: errors.at(-1) ?? 0, samples },
      captions: { visible, overlaps, bodyOverlaps, belowStar, outside, fading, policy: state.policy, ordinaryLimit: state.ordinaryLimit,
        candidates: state.candidates, reserved, reservedCount: state.reservedCount },
    };
    function rect(box) { return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom }; }
    function rectsOverlap(a, b) {
      return Math.min(a.right, b.right) - Math.max(a.x, b.x) > -spacing && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > -spacing;
    }
  }, { rows, spacing: 0 });
}

// Sirius against a star near magnitude 4.5, both painted: the painted
// widths, at the pose that shows Sirius nearest the centre.
async function sizeHierarchy(page, rows, controlFor) {
  const sirius = rows.find((row) => row.name === "Sirius");
  const faint = rows.filter((row) => row.magnitude > 4.3 && row.magnitude < 4.7);
  let best = null;
  for (const scenePitch of PITCHES_SCENE) {
    for (let heading = 0; heading < HEADINGS; heading += 1) {
      await setPose(page, { controlPitch: controlFor(scenePitch), controlYaw: heading * 360 / HEADINGS, distanceKilometers: 2e10 });
      const [predicted] = await page.evaluate((entries) => window.__catalogSky.predict(entries), [sirius]);
      if (predicted.inView && (best === null || predicted.margin > best.margin)) best = { ...predicted, scenePitch, heading };
    }
  }
  await setPose(page, { controlPitch: controlFor(best.scenePitch), controlYaw: best.heading * 360 / HEADINGS, distanceKilometers: 2e10 });
  await nextPaint(page);
  // Painted pixels: the captions and the heliocentric overlays (orbit
  // lines, markers, their captions, the Sun) hidden, the lit area (mean
  // channel above a threshold) within a box around each star's predicted
  // centre. The faint star is one with no other bright star nearby.
  const predicted = await page.evaluate((entries) => window.__catalogSky.predict(entries), [sirius, ...faint, ...rows.slice(0, 600)]);
  const neighbours = predicted.slice(1 + faint.length).filter((entry) => entry.inView);
  const faintEntry = predicted.slice(1, 1 + faint.length).find((entry) => entry.inView && entry.margin > 40 &&
    neighbours.every((other) => other.hip === entry.hip || Math.hypot(other.x - entry.x, other.y - entry.y) > 30));
  const hide = (hidden, layer) => page.evaluate(({ value, layerValue }) => {
    window.__catalogSky.layer.overlay.style.visibility = value;
    window.__catalogSky.layer.root.style.visibility = layerValue;
    // The sky cube's own retained catalogue points (the cubic sky may carry
    // a bright band of its own) are hidden too: at a bright star they sit
    // under this layer's point and would saturate the difference.
    for (const selector of [".mercury-orbit", ".mercury-sun-camera", ".mercury-material-root", ".mercury-skybox-stars"]) {
      const element = document.querySelector(selector);
      if (element) element.style.visibility = value;
    }
  }, { value: hidden ? "hidden" : "", layerValue: layer ? "" : "hidden" });
  // The layer's own light: the screenshot with the layer minus the one
  // without it, so whatever the faces carry at the same positions (the
  // photograph, or stars stamped into them) does not count.
  await hide(true, true);
  await nextPaint(page);
  const image = await page.screenshot();
  await hide(true, false);
  await nextPaint(page);
  const without = await page.screenshot();
  await hide(false, true);
  await writeFile(`${dumpDirectory}/size-hierarchy.png`, image);
  const bright = await litArea(image, without, predicted[0]);
  const faintArea = faintEntry ? await litArea(image, without, faintEntry) : null;
  return { pose: { scenePitch: best.scenePitch, heading: best.heading }, brightHip: sirius.hip, brightPixels: bright,
    faintHip: faintEntry?.hip ?? null, faintMagnitude: faintEntry?.magnitude ?? null, faintPixels: faintArea };
}

// Pixels the layer lit (mean channel raised by more than 24 over the
// screenshot without it) within 6 CSS px of a predicted centre.
async function litArea(image, without, entry) {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: base } = await sharp(without).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / 1440;
  const centreX = Math.round(entry.x * scale);
  const centreY = Math.round(entry.y * scale);
  const radius = Math.round(6 * scale);
  let lit = 0;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centreX + dx, y = centreY + dy;
      if (x < 0 || y < 0 || x >= info.width || y >= info.height) continue;
      const offset = (y * info.width + x) * 3;
      const lift = (data[offset] + data[offset + 1] + data[offset + 2] - base[offset] - base[offset + 1] - base[offset + 2]) / 3;
      if (lift > 24) lit += 1;
    }
  }
  return lit / (scale * scale);
}

// The photograph's brightest blob near each predicted star, on a
// screenshot with the points hidden: local mean over a 3 px box, searched
// within 16 px of the prediction, in CSS pixels.
async function photographicOffsets(image, predicted) {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / 1440;
  const luminance = (x, y) => {
    if (x < 1 || y < 1 || x >= info.width - 1 || y >= info.height - 1) return 0;
    let total = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const offset = ((y + dy) * info.width + (x + dx)) * 3;
        total += data[offset] + data[offset + 1] + data[offset + 2];
      }
    }
    return total / 27;
  };
  const search = Math.round(16 * scale);
  return predicted.map((entry) => {
    const centreX = Math.round(entry.x * scale);
    const centreY = Math.round(entry.y * scale);
    let peak = -1;
    let peakX = centreX;
    let peakY = centreY;
    for (let dy = -search; dy <= search; dy += 1) {
      for (let dx = -search; dx <= search; dx += 1) {
        const value = luminance(centreX + dx, centreY + dy);
        if (value > peak) { peak = value; peakX = centreX + dx; peakY = centreY + dy; }
      }
    }
    // The blob must stand above the ring around the search box, or the
    // photograph shows nothing there.
    let ring = 0;
    let ringCount = 0;
    for (let dy = -search - 4; dy <= search + 4; dy += 2) {
      for (let dx = -search - 4; dx <= search + 4; dx += 2) {
        if (Math.abs(dx) <= search && Math.abs(dy) <= search) continue;
        ring += luminance(centreX + dx, centreY + dy);
        ringCount += 1;
      }
    }
    const background = ringCount ? ring / ringCount : 0;
    return { hip: entry.hip, name: entry.name, magnitude: Number(entry.magnitude.toFixed(2)),
      offsetPixels: Number((Math.hypot(peakX - centreX, peakY - centreY) / scale).toFixed(2)),
      peakLuminance: Number(peak.toFixed(1)), background: Number(background.toFixed(1)), found: peak > background + 12 };
  });
}

// Mean luminance, peak and count of lit pixels (mean channel above 96) of
// the visible stage with the heliocentric overlays and captions hidden.
async function skyLuminance(page) {
  const toggle = (value) => page.evaluate((visibility) => {
    for (const selector of [".mercury-orbit", ".mercury-sun-camera", ".mercury-material-root", ".mercury-catalog-labels"]) {
      const element = document.querySelector(selector);
      if (element) element.style.visibility = visibility;
    }
    return window.__catalogSky.visibleWindow();
  }, value);
  const window_ = await toggle("hidden");
  await nextPaint(page);
  const image = await page.screenshot();
  await toggle("");
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / 1440;
  let total = 0, peak = 0, lit = 0, count = 0;
  for (let y = Math.round(window_.y * scale); y < Math.round(window_.bottom * scale); y += 1) {
    for (let x = Math.round(window_.x * scale); x < Math.round(window_.right * scale); x += 1) {
      const offset = (y * info.width + x) * 3;
      const value = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      total += value;
      count += 1;
      if (value > peak) peak = value;
      if (value > 96) lit += 1;
    }
  }
  return { mean: Number((total / count).toFixed(3)), peak, litPixels: lit / (scale * scale), pixels: count / (scale * scale) };
}

function driftBetween(first, second) {
  const byHip = new Map(first.map((sample) => [sample.hip, sample]));
  let compared = 0;
  let maxPixels = 0;
  for (const sample of second) {
    const other = byHip.get(sample.hip);
    if (!other) continue;
    compared += 1;
    maxPixels = Math.max(maxPixels, Math.hypot(sample.x - other.x, sample.y - other.y));
  }
  return { compared, maxPixels };
}

// The reference rule, independently: reserved boxes first (all accepted,
// as their own pass left them), then candidates by priority, each accepted
// only if it keeps `spacing` from every accepted box.
function greedyDeclutter(candidates, reserved, spacing) {
  const accepted = reserved.map((entry) => box(entry));
  const keys = new Set();
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  for (const candidate of sorted) {
    const own = box(candidate);
    const blocked = accepted.some((other) =>
      Math.min(Math.min(own.right, other.right) - Math.max(own.left, other.left),
        Math.min(own.bottom, other.bottom) - Math.max(own.top, other.top)) > -spacing);
    if (blocked) continue;
    accepted.push(own);
    keys.add(candidate.key);
  }
  return keys;
  function box(entry) {
    return { left: entry.anchor[0] - entry.widthPx / 2, right: entry.anchor[0] + entry.widthPx / 2,
      top: entry.anchor[1] - entry.topOffsetPx, bottom: entry.anchor[1] - entry.bottomOffsetPx };
  }
}

function setsEqual(a, b) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function cssColor(hex) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  return `rgb(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)})`;
}

async function calibrateControlPitch(page) {
  const samples = [];
  for (const controlPitch of [89, 34]) {
    await page.evaluate((next) => window.__mercury.camera.setState(next), { controlPitch, controlYaw: 0, zoom: 1.1 });
    const transform = await page.locator(".mercury-scene").evaluate((element) => element.style.transform);
    const values = /matrix3d\(([^)]+)\)/u.exec(transform)[1].split(",").map(Number);
    const pitch = Math.atan2(-values[9], values[10]) * 180 / Math.PI;
    samples.push([controlPitch, pitch]);
  }
  const slope = (samples[1][0] - samples[0][0]) / (samples[1][1] - samples[0][1]);
  return { samples, slope, controlForScenePitch: (scenePitch) => samples[0][0] + slope * (scenePitch - samples[0][1]) };
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
