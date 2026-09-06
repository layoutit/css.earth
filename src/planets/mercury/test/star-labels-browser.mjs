// The expected stars come from HYG; geometry comes from the independent
// astronomy oracle. No label-selection or photometry implementation imports.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { readCatalog } from "@cssearth/catalog";
import * as geometry from "./lighting-geometry-oracle.mjs";

const baseUrl = process.argv.find(argument => /^https?:/u.test(argument)) ?? "http://127.0.0.1:4210";
const output = resolve(process.env.STAR_LABELS_DUMP ?? ".local/star-labels-browser");
await mkdir(output, { recursive: true });
const source = await readFile(resolve(import.meta.dirname, "../../../../data/catalogs/stars-hyg/v1/stars-hyg.gxct"));
const catalogue = readCatalog(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
const names = catalogue.strings("name"), positions = catalogue.numeric("posPc"), absolute = catalogue.numeric("absMag");
const sourceStars = [];
for (let index = 0; index < catalogue.count; index += 1) {
  const position = [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]];
  const distance = Math.hypot(...position);
  if (distance > 0) sourceStars.push({ name: names[index], magnitude: absolute[index] + 5 * Math.log10(distance) - 5,
    direction: position.map(value => value / distance) });
}
const skyOracle = geometry.buildOracle(await geometry.loadMercuryEphemeris());
const checks = [], poses = [], errors = [];
const check = (id, ok, detail = {}) => { checks.push({ id, ok: Boolean(ok), ...detail }); if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail)}`); };
const close = (actual, expected, tolerance = 0.03) => Math.abs(actual - expected) <= tolerance;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", timeout: 20000 });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForFunction(() => window.__mercury?.ready === true && document.documentElement.dataset.ready === "true", null, { timeout: 20000 })
    .catch(error => { throw new Error(`Mercury did not become ready: ${errors.join("; ") || error.message}`); });
  const initial = await read(page);
  check("cold-start-adopts-visible-star", initial.stars.accepted && initial.stars.slots[0].alpha === 0.55 && initial.publications === 1,
    { star: initial.stars.candidate?.name, alpha: initial.stars.slots[0].alpha, publications: initial.publications });
  await verifyPixels(page, "default");
  await page.screenshot({ path: resolve(output, "default.png") });
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (motion?.checked) motion.click();
    window.__starCaptionIdentity = document.querySelector(".mercury-star-caption");
  });
  const camera = await page.evaluate(() => ({ state: window.__mercury.camera.state(), stats: window.__mercury.camera.stats() }));
  const inputs = [null, ...[45, 90, 135, 180, 225, 270, 315].map(controlYaw => ({ controlYaw })),
    { controlYaw: 90, controlPitch: 5 }, { controlYaw: 270, controlPitch: 70 }];
  let best = null, bestImage = null;
  for (let index = 0; index < inputs.length; index += 1) {
    if (inputs[index]) await page.evaluate(next => window.__mercury.camera.setState(next),
      { controlPitch: camera.state.controlPitch, distanceKilometers: camera.state.distanceKilometers, ...inputs[index] });
    await settle(page);
    const sample = await read(page);
    const expected = expectedStars(sample);
    const candidate = sample.stars.candidate;
    check(`brightest-proper-name-${index}`, candidate?.id === expected[0]?.id && candidate?.name === expected[0]?.name,
      { actual: candidate?.name, expected: expected[0]?.name, eligible: expected.length });
    if (candidate && expected[0]) check(`independent-projection-${index}`, close(candidate.anchor[0], expected[0].anchor[0]) && close(candidate.anchor[1], expected[0].anchor[1]),
      { actual: candidate.anchor, expected: expected[0].anchor });
    verifySharedPass(sample, index);
    verifyPaint(sample, index);
    poses.push({ input: inputs[index], name: candidate?.name, id: candidate?.id, eligible: expected.length,
      accepted: sample.stars.accepted, pointGap: sample.point && candidate ? Math.hypot(sample.point.x - sample.center[0] - candidate.anchor[0], sample.point.y - sample.center[1] - candidate.anchor[1]) : null });
    if (sample.stars.accepted && (!best || candidate.magnitude < best.magnitude)) {
      best = { ...candidate, state: sample.camera };
      bestImage = await page.screenshot();
    }
  }
  check("orientation-sweep-is-nonvacuous", poses.length === 10 && new Set(poses.map(pose => pose.name).filter(Boolean)).size >= 4,
    { poses: poses.length, names: [...new Set(poses.map(pose => pose.name))] });
  if (bestImage) await writeFile(resolve(output, "bright-star.png"), bestImage);
  assert.ok(best, "the sweep never painted an accepted star label");
  await page.evaluate(next => window.__mercury.camera.setState(next), best.state);
  for (const distanceKilometers of [2e9, camera.stats.dolly.maximumDistanceKilometers]) {
    await page.evaluate(next => window.__mercury.camera.setState({ distanceKilometers: next }), distanceKilometers);
    await settle(page);
    const sample = await read(page);
    const expected = expectedStars(sample);
    check(`dolly-keeps-star-identity-${distanceKilometers}`, sample.stars.candidate?.id === best.id && sample.stars.candidate?.id === expected[0]?.id,
      { actual: sample.stars.candidate?.name, expected: best.name });
    verifyPaint(sample, `dolly-${distanceKilometers}`);
    verifySharedPass(sample, `dolly-${distanceKilometers}`);
    if (sample.stars.accepted) await verifyPixels(page, `dolly-${distanceKilometers}`);
  }

  // Deliberately crowd the existing shared pass using its public spacing
  // knob. The focused body wins; another eligible star must not be promoted.
  await page.evaluate(() => window.__mercury.labelPolicy({ spacingPixels: 10000 }));
  await settle(page);
  const crowded = await read(page);
  const eligible = expectedStars(crowded);
  check("shared-body-star-rejection-does-not-promote-runner-up", eligible.length > 1 && crowded.stars.candidate?.id === eligible[0].id &&
    !crowded.stars.accepted && crowded.candidates.filter(candidate => candidate.owner === 3).length === 1 && crowded.label.hidden,
  { eligible: eligible.length, selected: crowded.stars.candidate?.name, accepted: crowded.stars.accepted, hidden: crowded.label.hidden });
  verifySharedPass(crowded, "crowded");
  await page.evaluate(() => window.__mercury.labelPolicy(null));
  await settle(page);

  const continuity = await page.evaluate(async () => {
    const samples = [window.__mercury.sky.state().captions.stars.slots[0]];
    window.__mercury.starExposure({ exposureScale: 0.000001 });
    samples.push(window.__mercury.sky.state().captions.stars.slots[0]);
    const publications = window.__mercury.camera.stats().publications;
    for (let frame = 0; frame < 15; frame += 1) {
      await new Promise(requestAnimationFrame);
      samples.push(window.__mercury.sky.state().captions.stars.slots[0]);
    }
    return { samples, publications, afterPublications: window.__mercury.camera.stats().publications,
      candidate: window.__mercury.sky.state().captions.stars.candidate };
  });
  const worstStep = Math.max(...continuity.samples.slice(1).map((sample, index) => Math.abs(sample.alpha - continuity.samples[index].alpha)));
  check("exposure-change-finishes-bounded-fade-with-camera-at-rest", continuity.samples[0].alpha > 0 && worstStep <= 0.1 + 1e-9 &&
    continuity.samples.at(-1).alpha === 0 && continuity.samples.at(-1).occupant === null && continuity.candidate === null &&
    continuity.publications === continuity.afterPublications, { worstStep, alphas: continuity.samples.map(sample => sample.alpha), ...continuity });
  await page.evaluate(() => window.__mercury.starExposure(null));
  await settle(page);
  const restored = await read(page);
  check("exposure-reset-restores-star-with-retained-label", restored.stars.candidate?.id === best.id && restored.stars.slots[0].alpha > 0 && restored.retained,
    { name: restored.stars.candidate?.name, alpha: restored.stars.slots[0].alpha, retained: restored.retained });
  check("no-browser-errors", errors.length === 0, { errors });
} catch (error) {
  check("browser-run-completed", false, { error: error.stack ?? String(error), errors });
} finally {
  await browser.close();
}
const failed = checks.filter(check => !check.ok).map(check => check.id);
const report = { suite: "mercury-star-labels", ok: failed.length === 0, failed, checks, poses };
await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
process.exitCode = failed.length ? 1 : 0;

async function settle(page) {
  await page.waitForFunction(() => {
    const stars = window.__mercury.sky.state().captions.stars;
    const slot = stars.slots[0];
    return slot.alpha === slot.target && (stars.accepted ? slot.occupant === `3:${stars.candidate.id}` : slot.occupant === null);
  }, null, { timeout: 3000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function read(page) {
  return page.evaluate(() => {
    const rectangle = element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const captions = window.__mercury.sky.state().captions;
    const element = document.querySelector(".mercury-star-caption"), css = getComputedStyle(element), box = rectangle(element);
    const camera = document.querySelector(".mercury-camera").getBoundingClientRect();
    const point = [...document.querySelectorAll(".planet-cubic-sky-star")].find(point => point.dataset.name === captions.stars.candidate?.name);
    const bounds = point ? rectangle(point) : null;
    const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
    context.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    const metrics = context.measureText("H");
    return { stars: captions.stars, candidates: captions.candidates, policy: captions.policy,
      camera: window.__mercury.camera.state(), scene: document.querySelector(".mercury-scene").style.transform,
      center: [camera.x + camera.width / 2, camera.y + camera.height / 2],
      viewport: { width: innerWidth, height: innerHeight },
      label: { ...box, text: element.textContent, opacity: Number(css.opacity), hidden: css.visibility === "hidden" || Number(css.opacity) === 0,
        capHeight: Math.abs(metrics.actualBoundingBoxAscent) + Math.abs(metrics.actualBoundingBoxDescent), lineHeight: Number.parseFloat(css.lineHeight) },
      point: bounds && { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      retained: !window.__starCaptionIdentity || element === window.__starCaptionIdentity,
      count: document.querySelectorAll(".mercury-star-caption").length, publications: window.__mercury.camera.stats().publications };
  });
}

function expectedStars(sample) {
  const pose = geometry.parseSceneRotation(sample.scene);
  // Source preparation uses the fixed 60-degree field, factor1, dark floor.
  // Runtime eligibility uses Galaxio's .4px raw-radius inverse at live size.
  const magnitudeLimit = magnitudeAtRadius(0.4, Math.min(1.5, Math.max(0.7, Math.min(sample.viewport.width, sample.viewport.height) / 600)));
  const drawn = sourceStars.filter(star => star.magnitude <= magnitudeAtRadius(0.25, 1))
    .map(star => ({ ...star, magnitude: Number(star.magnitude.toFixed(3)) })).sort((a, b) => a.magnitude - b.magnitude);
  const candidates = [];
  for (let index = 0; index < drawn.length; index += 1) {
    const star = drawn[index];
    if (!star.name || star.magnitude > magnitudeLimit) continue;
    const direction = skyOracle.view(pose, skyOracle.icrfToPresentation(star.direction));
    const projected = geometry.projectDirection(direction, sample.camera.focal);
    if (!projected) continue;
    const anchor = projected.map((value, axis) => value + sample.camera.principalOffset[axis]);
    const r = sample.camera.visibleRect;
    if (anchor[0] < r.left || anchor[0] > r.right || anchor[1] < r.top || anchor[1] > r.bottom) continue;
    candidates.push({ id: `star:${index}`, name: star.name, magnitude: star.magnitude, anchor });
  }
  return candidates;
}

function magnitudeAtRadius(radius, factor) {
  const display = (radius / (1.0727 * factor)) ** (1 / 0.55);
  const luminance = Math.expm1(display * Math.log1p(2.2 * 0.052) / 2) / 2.2;
  return -2.5 * Math.log10(luminance / (2.53016e-6 / 1.66138e-6));
}

function verifySharedPass(sample, tag) {
  const accepted = [];
  for (const candidate of [...sample.candidates].sort((a, b) => b.priority - a.priority)) {
    const box = { ...candidate, left: candidate.anchor[0] - candidate.widthPx / 2, right: candidate.anchor[0] + candidate.widthPx / 2,
      top: candidate.anchor[1] - candidate.topOffsetPx, bottom: candidate.anchor[1] - candidate.bottomOffsetPx };
    if (!accepted.some(other => Math.min(Math.min(box.right, other.right) - Math.max(box.left, other.left),
      Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top)) > -sample.policy.spacingPixels)) accepted.push(box);
  }
  check(`shared-declutter-${tag}`, JSON.stringify(accepted.map(candidate => candidate.key).sort()) ===
    JSON.stringify(sample.candidates.filter(candidate => candidate.accepted).map(candidate => candidate.key).sort()),
  { expected: accepted.map(candidate => candidate.key), actual: sample.candidates.filter(candidate => candidate.accepted).map(candidate => candidate.key) });
}

function verifyPaint(sample, tag) {
  check(`single-retained-label-${tag}`, sample.count === 1 && sample.retained, { count: sample.count, retained: sample.retained });
  if (!sample.stars.accepted) return;
  const star = sample.stars.candidate, box = sample.label;
  const expectedX = sample.center[0] + star.anchor[0], expectedY = sample.center[1] + star.anchor[1];
  check(`painted-name-and-opacity-${tag}`, !box.hidden && box.text === star.name && close(box.opacity, star.alpha, 1e-4),
    { text: box.text, expected: star.name, opacity: box.opacity, alpha: star.alpha });
  check(`label-above-rendered-star-${tag}`, sample.point !== null && close(sample.point.x, expectedX, 0.7) && close(sample.point.y, expectedY, 0.7) &&
    close(box.x + box.width / 2, sample.point.x, 0.7) && close(box.y + box.height, expectedY - star.radiusPx - 7, 0.03),
  { point: sample.point, anchor: [expectedX, expectedY], labelBottom: box.y + box.height, expectedBottom: expectedY - star.radiusPx - 7 });
  check(`cap-and-line-height-${tag}`, close(box.capHeight, 12, 1.5) && close(box.height, 12 / 0.72 * 1.6, 0.05),
    { cap: box.capHeight, height: box.height, lineHeight: box.lineHeight });
}

async function verifyPixels(page, tag) {
  const element = page.locator(".mercury-star-caption");
  const rect = await element.boundingBox();
  const viewport = page.viewportSize();
  const x = Math.max(0, Math.floor(rect.x - 3)), y = Math.max(0, Math.floor(rect.y - 3));
  const clip = { x, y, width: Math.min(viewport.width, Math.ceil(rect.x + rect.width + 3)) - x,
    height: Math.min(viewport.height, Math.ceil(rect.y + rect.height + 3)) - y };
  const painted = await page.screenshot({ clip });
  const previous = await element.evaluate(element => { const previous = element.style.visibility; element.style.visibility = "hidden"; return previous; });
  let hidden;
  try { hidden = await page.screenshot({ clip }); }
  finally { await element.evaluate((element, previous) => { element.style.visibility = previous; }, previous); }
  const a = await sharp(painted).ensureAlpha().raw().toBuffer();
  const b = await sharp(hidden).ensureAlpha().raw().toBuffer();
  let changedPixels = 0;
  for (let pixel = 0; pixel < a.length; pixel += 4) {
    if (Math.max(Math.abs(a[pixel] - b[pixel]), Math.abs(a[pixel + 1] - b[pixel + 1]), Math.abs(a[pixel + 2] - b[pixel + 2])) > 3) changedPixels += 1;
  }
  await writeFile(resolve(output, `${tag}-caption.png`), painted);
  check(`star-caption-paints-pixels-${tag}`, changedPixels >= 40, { changedPixels, clip });
}
