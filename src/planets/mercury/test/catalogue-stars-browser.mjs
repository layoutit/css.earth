// Catalogue stars in Mercury's sky, pinned on painted pixels against the
// catalogue itself: bright named stars are painted where their ICRS
// directions project through the same camera the lighting oracle uses for
// the Sun and the sky anchors; magnitude reads as size; the faint bands are
// present in the faces (photographic, at registered positions); and the
// photograph no longer paints the retained stars, so nothing is drawn twice. Orientation is swept, since stars are at infinity
// and the dolly cannot move them.
//
// The oracle here decodes the HYG catalogue on its own (through the vendored
// reader) and imports nothing from the prepared sky or the runtime.
//
// Usage: node src/planets/mercury/test/catalogue-stars-browser.mjs [baseUrl]

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import * as lighting from "./lighting-geometry-oracle.mjs";

const baseUrl = process.argv.find((argument) => /^https?:/u.test(argument)) ?? "http://127.0.0.1:4210";
const projectRoot = resolve(import.meta.dirname, "../../../..");

export const TOLERANCES = Object.freeze({
  // A named star's painted point against the oracle's projection, pixels.
  positionPixels: 3,
  // The brightest brilliant star's painted diameter against the lower
  // quartile of the bright-band diameters in the same view (at least 2.5
  // magnitudes apart); the quartile shrugs off a neighbour inside the
  // measuring window, which inflates a crowded star's extent.
  sizeOrderRatio: 1.4,
  // Faint stamped stars in a 240 px window away from retained ones.
  faintStarsInWindow: 5,
  // Retained stars (m <= 3.5, 290 over the sky) visible in one view once the
  // chrome and the disc are excluded: a few.
  retainedInView: 2,
  // Peak luminance the photograph may keep at a retained star's position
  // once the points are hidden: its image is removed, its diffuse light
  // (the sigma-nine smear) stays, measured at 2-56 against 150-plus for the
  // photographic image itself.
  photographPeakAtStar: 90,
});

// Bright stars the sweep looks up, by their HYG names.
const NAMED_STARS = ["Sirius", "Canopus", "Arcturus", "Vega", "Capella", "Rigel", "Procyon",
  "Achernar", "Betelgeuse", "Hadar", "Altair", "Aldebaran", "Spica", "Antares", "Pollux", "Fomalhaut", "Deneb", "Regulus"];
const HEADINGS = 8;
const PITCHES_SCENE = [60, 20, -30];

const checks = [];
const report = { baseUrl };
function check(id, ok, detail) {
  checks.push({ ...detail, id, ok: Boolean(ok) });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail).slice(0, 600)}`);
}

// The oracle's catalogue: the HYG file decoded here, named stars' unit ICRS
// directions and apparent magnitudes.
const { readCatalog } = await import("@cssearth/catalog");
const bytes = await readFile(resolve(projectRoot, "data/catalogs/stars-hyg/v1/stars-hyg.gxct"));
const catalogue = readCatalog(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const names = catalogue.strings("name");
const position = catalogue.numeric("posPc");
const absMag = catalogue.numeric("absMag");
const oracleStars = new Map();
for (let index = 0; index < catalogue.count; index += 1) {
  if (!NAMED_STARS.includes(names[index])) continue;
  const d = Math.hypot(position[3 * index], position[3 * index + 1], position[3 * index + 2]);
  oracleStars.set(names[index], {
    direction: [position[3 * index] / d, position[3 * index + 1] / d, position[3 * index + 2] / d],
    magnitude: absMag[index] + 5 * Math.log10(d) - 5,
  });
}
check("oracle-has-the-named-stars", oracleStars.size === NAMED_STARS.length, { found: [...oracleStars.keys()] });
const ephemeris = await lighting.loadMercuryEphemeris();
const sky = lighting.buildOracle(ephemeris);

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`error: ${message.text()}`); });
  await page.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true &&
    document.documentElement.dataset.ready === "true");
  await page.evaluate(() => { const motion = document.querySelector('input[name="motion"]'); if (motion.checked) motion.click(); });
  const geometry = await page.evaluate(() => {
    const skybox = document.querySelector(".mercury-skybox");
    const [x, y] = getComputedStyle(skybox).perspectiveOrigin.split(" ").map(parseFloat);
    const box = skybox.getBoundingClientRect();
    const stage = document.querySelector(".planet-stage").getBoundingClientRect();
    // Where the sky is actually visible: the stage within the viewport,
    // less the shell's panel and header (which paint over it) and the
    // body's disc (which occludes it).
    const rects = [...document.querySelectorAll(".planet-sidebar, .planet-header, header, nav")]
      .map((element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }));
    const disc = document.querySelector(".mercury-material").getBoundingClientRect();
    return { principal: [box.x + x, box.y + y], focal: parseFloat(getComputedStyle(skybox).perspective),
      stage: { x: stage.x, y: stage.y, width: stage.width, height: stage.height },
      viewport: { width: innerWidth, height: innerHeight }, chrome: rects,
      disc: { x: disc.x + disc.width / 2, y: disc.y + disc.height / 2, radius: disc.width / 2 },
      retained: document.querySelectorAll(".mercury-skybox-stars .planet-cubic-sky-star").length,
      plan: window.__mercury.sky.catalogueStars ?? null };
  });
  const visible = (pixel, margin = 20) => {
    const [px, py] = pixel;
    if (px < Math.max(geometry.stage.x, 0) + margin || px > Math.min(geometry.stage.x + geometry.stage.width, geometry.viewport.width) - margin ||
        py < Math.max(geometry.stage.y, 0) + margin || py > Math.min(geometry.stage.y + geometry.stage.height, geometry.viewport.height) - margin) return false;
    if (geometry.chrome.some((rect) => px > rect.x - margin && px < rect.x + rect.width + margin && py > rect.y - margin && py < rect.y + rect.height + margin)) return false;
    if (Math.hypot(px - geometry.disc.x, py - geometry.disc.y) < geometry.disc.radius + margin) return false;
    return true;
  };
  report.geometry = geometry;
  check("retained-stars-mounted", geometry.retained > 100 && geometry.retained < 1000, { retained: geometry.retained });

  const calibration = await calibrateControlPitch(page);
  const sweep = [];
  let namedChecked = 0;
  let sizePairs = 0;
  for (const scenePitch of PITCHES_SCENE) {
    for (let heading = 0; heading < HEADINGS; heading += 1) {
      const controlYaw = heading * 360 / HEADINGS;
      await page.evaluate((next) => window.__mercury.camera.setState(next),
        { controlPitch: calibration.controlForScenePitch(scenePitch), controlYaw, zoom: 1.1 });
      await nextPaint(page);
      const pose = lighting.parseSceneRotation(await page.locator(".mercury-scene").evaluate((element) => element.style.transform));
      // Every retained star inside the stage, from the DOM.
      // A star behind the camera still has a client rect, projected through
      // a negative depth; only stars in the front hemisphere (their ICRS
      // direction, through the painted pose, pointing into the screen) count.
      const painted = (await page.evaluate(() => [...document.querySelectorAll(".mercury-skybox-stars .planet-cubic-sky-star")]
        .map((element) => { const box = element.getBoundingClientRect(); return { name: element.dataset.name ?? null,
          direction: element.dataset.direction.split(",").map(Number),
          magnitude: Number(element.dataset.magnitude), x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width }; })))
        .filter((star) => sky.view(pose, sky.icrfToPresentation(star.direction))[2] < -0.2)
        .filter((star) => visible([star.x, star.y], 12));
      const cell = { scenePitch, heading, painted: painted.length, named: [] };
      // Named stars in view: the oracle's projection against the painted
      // point and against the pixels.
      const image = painted.length ? await decodeLuminance(await page.screenshot()) : null;
      for (const [name, star] of oracleStars) {
        const presentation = sky.icrfToPresentation(star.direction);
        const view = sky.view(pose, presentation);
        const projected = lighting.projectDirection(view, geometry.focal);
        if (projected === null) continue;
        const pixel = [geometry.principal[0] + projected[0], geometry.principal[1] + projected[1]];
        if (!visible(pixel)) continue;
        const dom = painted.find((entry) => entry.name === name);
        const domGap = dom ? Math.hypot(dom.x - pixel[0], dom.y - pixel[1]) : null;
        const blob = image ? blobCentroid(image, pixel, 8, 2) : null;
        const blobGap = blob ? Math.hypot(blob.x - pixel[0], blob.y - pixel[1]) : null;
        cell.named.push({ name, magnitude: star.magnitude, pixel, domGap, blobGap, peak: blob?.peak ?? null, domWidth: dom?.width ?? null });
        namedChecked += 1;
        check(`star-${name}-painted-at-oracle-p${scenePitch}-h${heading}`, domGap !== null && domGap <= TOLERANCES.positionPixels &&
          blobGap !== null && blobGap <= TOLERANCES.positionPixels && blob.peak > 120,
          { name, scenePitch, heading, pixel, domGap, blobGap, peak: blob?.peak ?? null });
      }
      // Size: in a cell with both a brilliant (m < 1.5) and a bright-band
      // (2.5 < m < 3.5) star in view, the brilliant one's painted disc is
      // wider.
      const brilliant = painted.filter((star) => star.magnitude < 1.5).sort((a, b) => a.magnitude - b.magnitude);
      const bright = painted.filter((star) => star.magnitude > 2.5 && star.magnitude < 3.5);
      if (image && brilliant.length && bright.length >= 2 && bright[0].magnitude - brilliant[0].magnitude >= 2.5) {
        const a = inkDiameter(image, [brilliant[0].x, brilliant[0].y], 2);
        const diameters = bright.map((star) => inkDiameter(image, [star.x, star.y], 2)).filter((value) => value !== null).sort((p, q) => p - q);
        const b = diameters.length ? diameters[Math.floor((diameters.length - 1) / 4)] : null;
        cell.size = { brilliant: brilliant[0].magnitude, brilliantDiameter: a, brightQuartileDiameter: b, brightDiameters: diameters };
        sizePairs += 1;
        check(`star-size-follows-magnitude-p${scenePitch}-h${heading}`, a !== null && b !== null && a >= TOLERANCES.sizeOrderRatio * b, cell.size);
      }
      // Faint stars: a 240 px window of sky clear of retained stars must
      // still show compact points (the photograph's own).
      if (image) {
        const window = findClearWindow(geometry, visible, painted, 240);
        if (window !== null) {
          const count = compactPoints(image, window, 2);
          cell.faint = { window, count };
          check(`faint-stars-present-p${scenePitch}-h${heading}`, count >= TOLERANCES.faintStarsInWindow, cell.faint);
        }
      }
      sweep.push(cell);
      check(`retained-stars-in-view-p${scenePitch}-h${heading}`, painted.length >= TOLERANCES.retainedInView, { scenePitch, heading, painted: painted.length });
    }
  }
  report.sweep = sweep;
  check("named-stars-were-checked", namedChecked >= 12, { namedChecked });
  check("size-pairs-were-checked", sizePairs >= 3, { sizePairs });

  // No double draw: with the retained points hidden, the diffuse-only
  // photograph keeps no compact peak at a bright star's position. The pose
  // is the first heading with a brilliant star in the visible sky.
  let pose = null;
  for (const [scenePitch, yaw] of [[20, 180], [20, 0], [20, 90], [20, 270], [60, 45], [-30, 135], [20, 45], [20, 225]]) {
    await page.evaluate((next) => window.__mercury.camera.setState(next), { controlPitch: calibration.controlForScenePitch(scenePitch), controlYaw: yaw, zoom: 1.1 });
    await nextPaint(page);
    pose = lighting.parseSceneRotation(await page.locator(".mercury-scene").evaluate((element) => element.style.transform));
    const brilliantVisible = [...oracleStars.values()].some((star) => star.magnitude <= 1.5 &&
      (() => { const projected = lighting.projectDirection(sky.view(pose, sky.icrfToPresentation(star.direction)), geometry.focal);
        return projected !== null && visible([geometry.principal[0] + projected[0], geometry.principal[1] + projected[1]]); })());
    if (brilliantVisible) break;
  }
  await page.evaluate(() => { document.querySelector(".mercury-skybox-stars").style.visibility = "hidden"; });
  await nextPaint(page);
  const bare = await decodeLuminance(await page.screenshot());
  await page.evaluate(() => { document.querySelector(".mercury-skybox-stars").style.visibility = ""; });
  const doubles = [];
  for (const [name, star] of oracleStars) {
    if (star.magnitude > 1.5) continue;
    const projected = lighting.projectDirection(sky.view(pose, sky.icrfToPresentation(star.direction)), geometry.focal);
    if (projected === null) continue;
    const pixel = [geometry.principal[0] + projected[0], geometry.principal[1] + projected[1]];
    if (!visible(pixel)) continue;
    const peak = brightestPeak(bare, pixel, 6, 2);
    doubles.push({ name, peak: peak?.peak ?? 0 });
    check(`photograph-does-not-repaint-${name}`, (peak?.peak ?? 0) < TOLERANCES.photographPeakAtStar, { name, peak: peak?.peak ?? 0 });
  }
  report.doubles = doubles;
  check("double-draw-was-checked", doubles.length >= 1, { doubles });
  check("no-page-errors", problems.length === 0, { problems });
} finally {
  await browser.close();
}

const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.id);
await new Promise((resolve) => process.stdout.write(
  `${JSON.stringify({ suite: "mercury-catalogue-stars", ok: failed.length === 0, failed, checks, ...report })}\n`, resolve));
process.exit(failed.length === 0 ? 0 : 1);

// -----------------------------------------------------------------------

async function decodeLuminance(image) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  const luminance = new Float32Array(info.width * info.height);
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * info.channels;
    luminance[index] = 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
  }
  return { width: info.width, height: info.height, luminance };
}

// The luminance-weighted centroid of the pixels above half the local peak
// within `radius` CSS px of a position, with that peak; null without one.
function blobCentroid(image, centre, radius, dpr) {
  const peak = brightestPeak(image, centre, radius, dpr);
  if (!peak || peak.peak < 40) return null;
  const threshold = peak.peak / 2;
  let weight = 0, sumX = 0, sumY = 0;
  for (let y = Math.floor((centre[1] - radius) * dpr); y <= Math.ceil((centre[1] + radius) * dpr); y += 1) {
    for (let x = Math.floor((centre[0] - radius) * dpr); x <= Math.ceil((centre[0] + radius) * dpr); x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const value = image.luminance[y * image.width + x];
      if (value < threshold) continue;
      weight += value; sumX += value * (x + 0.5); sumY += value * (y + 0.5);
    }
  }
  return { peak: peak.peak, x: sumX / weight / dpr, y: sumY / weight / dpr };
}

// The brightest pixel within `radius` CSS px of a CSS-pixel position, in
// CSS pixels (the screenshot is at `dpr`).
function brightestPeak(image, centre, radius, dpr) {
  let best = null;
  for (let y = Math.floor((centre[1] - radius) * dpr); y <= Math.ceil((centre[1] + radius) * dpr); y += 1) {
    for (let x = Math.floor((centre[0] - radius) * dpr); x <= Math.ceil((centre[0] + radius) * dpr); x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const value = image.luminance[y * image.width + x];
      if (best === null || value > best.peak) best = { peak: value, x: (x + 0.5) / dpr, y: (y + 0.5) / dpr };
    }
  }
  return best;
}

// Painted diameter of a point at a CSS position: the extent of pixels above
// a third of the local peak, in CSS pixels.
function inkDiameter(image, centre, dpr) {
  const peak = brightestPeak(image, centre, 6, dpr);
  if (!peak || peak.peak < 60) return null;
  const threshold = peak.peak / 3;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = Math.floor((peak.y - 8) * dpr); y <= Math.ceil((peak.y + 8) * dpr); y += 1) {
    for (let x = Math.floor((peak.x - 8) * dpr); x <= Math.ceil((peak.x + 8) * dpr); x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      if (image.luminance[y * image.width + x] < threshold) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return Math.max(maxX - minX + 1, maxY - minY + 1) / dpr;
}

// A square window of visible sky with no retained star inside it (all four
// corners and the centre visible, clear of chrome and of the body).
function findClearWindow(geometry, visible, painted, size) {
  const { stage } = geometry;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const x = stage.x + 30 + ((attempt * 173) % Math.max(1, stage.width - size - 60));
    const y = stage.y + 30 + ((attempt * 97) % Math.max(1, stage.height - size - 60));
    const corners = [[x, y], [x + size, y], [x, y + size], [x + size, y + size], [x + size / 2, y + size / 2]];
    if (!corners.every((corner) => visible(corner, 4))) continue;
    const clear = !painted.some((star) => star.x > x - 10 && star.x < x + size + 10 && star.y > y - 10 && star.y < y + size + 10);
    if (clear) return { x, y, size };
  }
  return null;
}

// Compact bright points (local maxima above a luminance floor, brighter
// than their surroundings) in a window, CSS coordinates at `dpr`.
function compactPoints(image, window, dpr) {
  let count = 0;
  const x0 = Math.floor(window.x * dpr), y0 = Math.floor(window.y * dpr), n = Math.floor(window.size * dpr);
  for (let y = y0 + 3; y < y0 + n - 3; y += 1) {
    for (let x = x0 + 3; x < x0 + n - 3; x += 1) {
      const value = image.luminance[y * image.width + x];
      if (value < 18) continue;
      let maximum = true;
      let ring = 0;
      for (let dy = -3; dy <= 3 && maximum; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const other = image.luminance[(y + dy) * image.width + x + dx];
          if (other > value) { maximum = false; break; }
          if (Math.abs(dx) === 3 || Math.abs(dy) === 3) ring += other;
        }
      }
      if (maximum && value - ring / 24 > 9) count += 1;
    }
  }
  return count;
}

async function calibrateControlPitch(page) {
  const samples = [];
  for (const controlPitch of [89, 34]) {
    await page.evaluate((next) => window.__mercury.camera.setState(next), { controlPitch, controlYaw: 0, zoom: 1.1 });
    const { pitchDegrees } = lighting.scenePitchYawDegrees(lighting.parseSceneRotation(
      await page.locator(".mercury-scene").evaluate((element) => element.style.transform)));
    samples.push([controlPitch, pitchDegrees]);
  }
  const slope = (samples[1][0] - samples[0][0]) / (samples[1][1] - samples[0][1]);
  return { samples, slope, controlForScenePitch: (scenePitch) => samples[0][0] + slope * (scenePitch - samples[0][1]) };
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
