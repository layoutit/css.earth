// Captions above Mercury's far-view markers, held to the reference engine's
// acceptance criterion (galaxio `labels/labelVisibility.test.ts`): at every
// distance decade AND every camera orientation, at least one caption is
// drawn inside the stage; no two drawn captions overlap; each sits above its
// own marker; the pool is never exceeded; and the painted capitals land at
// the policy's cap height. Both axes are swept because an altitude-only
// version of this check has shipped orientation bugs in the reference.
//
// Usage: node src/planets/mercury/test/label-field-browser.mjs [baseUrl]
// The last stdout line is a JSON report. LABEL_FIELD_DUMP=<dir> saves
// screenshots.

import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.argv.find((argument) => /^https?:/u.test(argument)) ?? "http://127.0.0.1:4210";

export const TOLERANCES = Object.freeze({
  // Painted cap height against the policy (12 px): system-ui faces' cap
  // heights span 0.70-0.73 em against the 0.72 the policy assumes.
  capHeightPixels: 1.5,
  // A caption's bottom edge must clear its marker's centre by the gap.
  gapPixels: 0,
});

// Distances (km) with the system on screen: every decade from the fade-in
// to the dolly's far bound. Orientations: eight headings at three pitches.
const DISTANCES_KM = [2e9, 6e9, 2e10, 4.4e10];
const HEADINGS = 8;
const PITCHES_SCENE = [90, 45, 0];

const checks = [];
const report = { baseUrl, sweep: [] };
const dumpDirectory = process.env.LABEL_FIELD_DUMP ?? null;
if (dumpDirectory) await mkdir(dumpDirectory, { recursive: true });

function check(id, ok, detail) {
  checks.push({ ...detail, id, ok: Boolean(ok) });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail).slice(0, 700)}`);
}

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`error: ${message.text()}`); });
  await page.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true &&
    document.documentElement.dataset.ready === "true");
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (motion.checked) motion.click();
  });
  const stats = await page.evaluate(() => window.__mercury.camera.stats());
  const policy = await page.evaluate(() => window.__mercury.sky.state().captions?.policy ?? null);
  report.policy = policy;
  check("captions-configured", policy !== null && policy.poolSize > 0, { policy });
  const stage = await page.locator(".planet-stage").boundingBox();

  // Control pitch is affine in scene pitch: measured from two poses.
  const calibration = await calibrateControlPitch(page);
  const controlFor = (scenePitch) => calibration.controlForScenePitch(scenePitch);

  // ---------------------------------------------------------------------
  // The two-axis sweep.
  // ---------------------------------------------------------------------
  const cells = [];
  let cellsWithDrops = 0;
  for (const distanceKm of DISTANCES_KM) {
    for (const scenePitch of PITCHES_SCENE) {
      for (let heading = 0; heading < HEADINGS; heading += 1) {
        const controlYaw = heading * 360 / HEADINGS;
        await page.evaluate((next) => window.__mercury.camera.setState(next),
          { controlPitch: controlFor(scenePitch), controlYaw, distanceKilometers: Math.min(distanceKm, stats.dolly.maximumDistanceKilometers) });
        // Let the slots' alpha ramps settle (bounded steps per publication).
        for (let step = 0; step < 12; step += 1) {
          await page.evaluate((yaw) => window.__mercury.camera.setState({ controlYaw: yaw }), controlYaw);
        }
        await nextPaint(page);
        const cell = await readCaptions(page);
        cell.distanceKm = distanceKm;
        cell.scenePitch = scenePitch;
        cell.heading = heading;
        cells.push(cell);
      }
    }
  }
  report.sweep = cells.map((cell) => ({ distanceKm: cell.distanceKm, scenePitch: cell.scenePitch, heading: cell.heading,
    visible: cell.visible.map((entry) => entry.text), overlaps: cell.overlaps, belowMarker: cell.belowMarker,
    outside: cell.outside, sunShown: cell.sunShown }));
  // At every cell: at least one caption inside the stage.
  for (const cell of cells) {
    const tag = `${cell.distanceKm.toExponential(0)}km-p${cell.scenePitch}-h${cell.heading}`;
    check(`caption-shown-${tag}`, cell.visible.length >= 1 && cell.outside === 0,
      { tag, visible: cell.visible.map((entry) => entry.text), outside: cell.outside });
    check(`captions-do-not-overlap-${tag}`, cell.overlaps.length === 0, { tag, overlaps: cell.overlaps });
    check(`captions-above-markers-${tag}`, cell.belowMarker.length === 0, { tag, belowMarker: cell.belowMarker });
    check(`caption-pool-bounded-${tag}`, cell.visible.length <= policy.poolSize, { tag, count: cell.visible.length });
    // The pass itself, recomputed here from the runtime's own candidates
    // with an independent implementation of the reference rule (priority
    // order, boxes kept `spacing` apart): the accepted sets must agree, and
    // what is drawn must be a subset of what was accepted.
    const expected = greedyDeclutter(cell.candidates, policy.spacingPixels);
    const runtimeAccepted = new Set(cell.candidates.filter((candidate) => candidate.accepted).map((candidate) => candidate.key));
    const drawnKeys = cell.visible.map((entry) => entry.occupant);
    check(`declutter-matches-reference-rule-${tag}`, setsEqual(expected, runtimeAccepted) &&
      drawnKeys.every((key) => runtimeAccepted.has(key) || cell.fading.includes(key)),
      { tag, expected: [...expected], runtime: [...runtimeAccepted], drawn: drawnKeys, fading: cell.fading });
    if (cell.candidates.length > expected.size) cellsWithDrops += 1;
  }
  check("declutter-drops-something-somewhere", cellsWithDrops > 0, { cellsWithDrops, cells: cells.length });
  const headingsWithCaptions = new Set(cells.filter((cell) => cell.visible.length > 0).map((cell) => `${cell.distanceKm}:${cell.heading}`));
  check("every-decade-and-heading-shows-a-caption", headingsWithCaptions.size === DISTANCES_KM.length * HEADINGS,
    { covered: headingsWithCaptions.size, expected: DISTANCES_KM.length * HEADINGS });
  // Continuity: across the sweep no slot's alpha ever stepped by more than
  // the policy's bound (read from the runtime between publications).
  const continuity = await page.evaluate(async (step) => {
    const stats = window.__mercury.camera.stats();
    window.__mercury.camera.setState({ distanceKilometers: stats.dolly.maximumDistanceKilometers, controlYaw: 0 });
    let worst = 0;
    let previous = window.__mercury.sky.state().captions.slots.map((slot) => slot.alpha);
    for (let i = 1; i <= 120; i += 1) {
      window.__mercury.camera.setState({ controlYaw: i * 3, distanceKilometers: stats.dolly.maximumDistanceKilometers / (1 + (i % 40) / 10) });
      const now = window.__mercury.sky.state().captions.slots.map((slot) => slot.alpha);
      for (let s = 0; s < now.length; s += 1) worst = Math.max(worst, Math.abs(now[s] - previous[s]));
      previous = now;
    }
    return { worst, bound: step };
  }, policy.maxAlphaStep);
  check("caption-alpha-steps-bounded", continuity.worst <= continuity.bound + 1e-9, continuity);

  // ---------------------------------------------------------------------
  // Cap height on pixels, at device pixel ratio 2: the ink height of a
  // capital-only caption ("SUN" is not available; "Mars" has no ascender
  // beyond its capital and no descender) measured in the label's box.
  // ---------------------------------------------------------------------
  const dpr2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    const page2 = await dpr2.newPage();
    await page2.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle" });
    await page2.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true &&
      document.documentElement.dataset.ready === "true");
    await page2.evaluate(() => { const motion = document.querySelector('input[name="motion"]'); if (motion.checked) motion.click(); });
    await page2.evaluate((next) => window.__mercury.camera.setState(next), { controlPitch: controlFor(90), controlYaw: 0, distanceKilometers: 6e9 });
    for (let step = 0; step < 12; step += 1) await page2.evaluate(() => window.__mercury.camera.setState({ controlYaw: 0 }));
    await nextPaint(page2);
    const captions = await readCaptions(page2);
    const target = captions.visible.find((entry) => /^[A-Z][a-z]*$/u.test(entry.text) && !/[gjpqy]/u.test(entry.text) && !/[bdfhklt]/u.test(entry.text.slice(1)))
      ?? captions.visible[0];
    const image = await page2.screenshot();
    if (dumpDirectory) await writeFile(`${dumpDirectory}/captions-dpr2.png`, image);
    let hiddenImage = null;
    if (target) {
      const element = page2.locator(".mercury-caption").filter({ hasText: new RegExp(`^${target.text}$`, "u") });
      const previous = await element.evaluate(element => { const value = element.style.visibility; element.style.visibility = "hidden"; return value; });
      try { hiddenImage = await page2.screenshot(); }
      finally { await element.evaluate((element, value) => { element.style.visibility = value; }, previous); }
    }
    const ink = target ? await inkHeight(image, hiddenImage, target.box, 2) : null;
    report.capHeight = { target: target?.text ?? null, box: target?.box ?? null, inkHeightCssPixels: ink === null ? null : ink / 2 };
    check("caption-cap-height-on-pixels", ink !== null && Math.abs(ink / 2 - policy.capPixels) <= TOLERANCES.capHeightPixels,
      report.capHeight);
  } finally {
    await dpr2.close();
  }
  check("no-page-errors", problems.length === 0, { problems });
} finally {
  await browser.close();
}

const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.id);
await new Promise((resolve) => process.stdout.write(
  `${JSON.stringify({ suite: "mercury-label-field", ok: failed.length === 0, failed, checks, ...report })}\n`, resolve));
process.exit(failed.length === 0 ? 0 : 1);

// -----------------------------------------------------------------------

// Every caption currently painted: its text, its box on the page, the
// marker it belongs to, and the geometry checks between them.
async function readCaptions(page) {
  return page.evaluate((spacing) => {
    const stage = document.querySelector(".planet-stage").getBoundingClientRect();
    const captions = window.__mercury.sky.state().captions;
    const elements = [...document.querySelectorAll(".mercury-caption")];
    // Slots on their way out (target zero) are still painted while fading.
    const fading = captions.slots.filter((slot) => slot.occupant !== null && slot.target === 0).map((slot) => slot.occupant);
    const visible = [];
    elements.forEach((element, index) => {
      const slot = captions.slots[index];
      if (!slot || slot.occupant === null || getComputedStyle(element).visibility === "hidden" ||
          Number(getComputedStyle(element).opacity) <= 0) return;
      const box = element.getBoundingClientRect();
      visible.push({ text: element.textContent, occupant: slot.occupant, alpha: slot.alpha,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        // The anchor is centre-relative to the camera root; back to page.
        anchor: null });
    });
    const root = document.querySelector(".mercury-camera").getBoundingClientRect();
    const markers = {};
    for (const element of document.querySelectorAll(".mercury-system-marker")) {
      const box = element.getBoundingClientRect();
      markers[`2:${element.dataset.body}`] = { x: box.x + box.width / 2, y: box.y + box.height / 2, hidden: getComputedStyle(element).visibility === "hidden" };
    }
    const sun = document.querySelector(".mercury-sun-marker").getBoundingClientRect();
    markers["1:sun"] = { x: sun.x + sun.width / 2, y: sun.y + sun.height / 2, hidden: getComputedStyle(document.querySelector(".mercury-sun-marker")).visibility === "hidden" };
    markers["0:mercury"] = { x: root.x + root.width / 2, y: root.y + root.height / 2, hidden: false };
    let outside = 0;
    const belowMarker = [];
    for (const entry of visible) {
      const marker = markers[entry.occupant];
      entry.anchor = marker ? [marker.x, marker.y] : null;
      // The caption's anchor (its marker) lies inside the stage; the text
      // itself may run past the edge, as the reference's frustum test is
      // on the anchor.
      const inside = marker && marker.x >= stage.x && marker.x <= stage.x + stage.width &&
        marker.y >= stage.y && marker.y <= stage.y + stage.height;
      if (!inside) outside += 1;
      // The caption's bottom edge sits above the marker's centre.
      if (marker && !(entry.box.y + entry.box.height < marker.y)) belowMarker.push({ text: entry.text, bottom: entry.box.y + entry.box.height, markerY: marker.y });
    }
    const overlaps = [];
    for (let a = 0; a < visible.length; a += 1) {
      for (let b = a + 1; b < visible.length; b += 1) {
        const p = visible[a].box, q = visible[b].box;
        const width = Math.min(p.x + p.width, q.x + q.width) - Math.max(p.x, q.x);
        const height = Math.min(p.y + p.height, q.y + q.height) - Math.max(p.y, q.y);
        if (Math.min(width, height) > -spacing) overlaps.push([visible[a].text, visible[b].text, Math.min(width, height)]);
      }
    }
    return { visible, outside, belowMarker, overlaps, fading,
      candidates: captions.candidates,
      sunMarkerVisible: !markers["1:sun"].hidden && Number(getComputedStyle(document.querySelector(".mercury-sun-marker")).opacity) > 0.5,
      sunShown: visible.some((entry) => entry.occupant === "1:sun") };
  }, DEFAULT_SPACING());
}

function DEFAULT_SPACING() { return 4; }

// The reference rule, written independently: candidates in descending
// priority; each is accepted unless its box comes within `spacing` of a box
// already accepted. Boxes are centred on the anchor and span
// [anchorY - top, anchorY - bottom] (+y down).
function greedyDeclutter(candidates, spacing) {
  const ordered = [...candidates].sort((a, b) => b.priority - a.priority);
  const accepted = [];
  for (const candidate of ordered) {
    const box = { left: candidate.anchor[0] - candidate.widthPx / 2, right: candidate.anchor[0] + candidate.widthPx / 2,
      top: candidate.anchor[1] - candidate.topOffsetPx, bottom: candidate.anchor[1] - candidate.bottomOffsetPx };
    const blocked = accepted.some((other) => {
      const width = Math.min(box.right, other.right) - Math.max(box.left, other.left);
      const height = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
      return Math.min(width, height) > -spacing;
    });
    if (!blocked) accepted.push({ ...box, key: candidate.key });
  }
  return new Set(accepted.map((entry) => entry.key));
}

function setsEqual(a, b) {
  return a.size === b.size && [...a].every((key) => b.has(key));
}

// Only pixels changed by this caption count as ink. Neutral orbit and star
// pixels underneath it otherwise inflate the measured capital height.
async function inkHeight(image, hiddenImage, box, dpr) {
  const rectangle = {
    left: Math.max(0, Math.floor(box.x * dpr)), top: Math.max(0, Math.floor(box.y * dpr)),
    width: Math.ceil(box.width * dpr), height: Math.ceil(box.height * dpr),
  };
  const { data, info } = await sharp(image).extract(rectangle).raw().toBuffer({ resolveWithObject: true });
  const hidden = await sharp(hiddenImage).extract(rectangle).raw().toBuffer();
  const rowPeaks = [];
  for (let y = 0; y < info.height; y += 1) {
    let peak = 0;
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const [r, g, b] = [0, 1, 2].map(channel => data[offset + channel] - hidden[offset + channel]);
      peak = Math.max(peak, 0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    rowPeaks.push(peak);
  }
  const brightest = Math.max(...rowPeaks);
  if (!(brightest > 60)) return null;
  let first = -1, last = -1;
  // Above seven tenths of the brightest row: the letters' bodies, not the
  // anti-aliased fringe above and below them.
  rowPeaks.forEach((peak, y) => { if (peak > brightest * 0.7) { if (first < 0) first = y; last = y; } });
  return first < 0 ? null : last - first + 1;
}

async function calibrateControlPitch(page) {
  const samples = [];
  for (const controlPitch of [89, 34]) {
    await page.evaluate((next) => window.__mercury.camera.setState(next), { controlPitch, controlYaw: 0, zoom: 1.1 });
    const transform = await page.locator(".mercury-scene").evaluate((element) => element.style.transform);
    const values = /matrix3d\(([^)]+)\)/u.exec(transform)[1].split(",").map(Number);
    // Rx(p) Ry(y): the image of +z is (sin y cos p?, -sin p, cos p cos y); pitch from column 3.
    const pitch = Math.atan2(-values[9], values[10]) * 180 / Math.PI;
    samples.push([controlPitch, pitch]);
  }
  const slope = (samples[1][0] - samples[0][0]) / (samples[1][1] - samples[0][1]);
  return { samples, slope, controlForScenePitch: (scenePitch) => samples[0][0] + slope * (scenePitch - samples[0][1]) };
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
