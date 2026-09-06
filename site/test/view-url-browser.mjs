// Exercise the real pointer, wheel, settings, address bar and reload path.
// Diagnostics only measure the camera and the retained native animations.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { parseSharedView } from "../../src/platform/view-url.mjs";
import { wheelWithReceipt } from "./wheel-zoom-distance.mjs";

const baseUrl = process.argv.find(argument => /^https?:/u.test(argument)) ?? "http://127.0.0.1:4210";
const output = resolve(process.env.VIEW_URL_DUMP ?? ".local/view-url-browser");
await mkdir(output, { recursive: true });
const checks = [], errors = [], warnings = [], snapshots = {};
const check = (id, ok, detail = {}) => {
  checks.push({ id, ok: Boolean(ok), ...detail });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail)}`);
};
const close = (a, b) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-12);
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", timeout: 20000 });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.goto(new URL("/mercury/?campaign=shared-view#camera", baseUrl).href, { waitUntil: "networkidle" });
  await ready(page);
  const initialUrl = new URL(page.url());
  snapshots.initial = await read(page);

  await drag(page, [875, 405], [1035, 315]);
  await drag(page, [1060, 615], [970, 510]);
  await page.mouse.move(980, 480);
  const wheelDelta = await wheelWithReceipt(page, 180);
  await settled(page);
  snapshots.rotated = await read(page);
  check("real-multi-axis-drag-changes-camera", snapshots.rotated.camera.pose.scene !== snapshots.initial.camera.pose.scene);
  // A reset reconstructed from the two controls is Rx(pitch) Ry(yaw), whose
  // m21 is always zero. An off-axis tumble with nonzero m21 needs the pose.
  const m21 = Number(snapshots.rotated.camera.pose.scene.slice(9, -1).split(",")[4]);
  check("saved-pose-cannot-be-rebuilt-from-two-euler-controls", Math.abs(m21) > 0.01, { m21 });
  check("real-wheel-changes-physical-camera-distance", wheelDelta > 0 && snapshots.rotated.camera.distanceKilometers > snapshots.initial.camera.distanceKilometers,
    { receivedDelta: wheelDelta, before: snapshots.initial.camera.distanceKilometers, after: snapshots.rotated.camera.distanceKilometers });

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const motion = page.locator(".planet-motion-setting-control");
  await motion.click();
  await page.waitForFunction(() => window.__mercury.runtime.playback().animations.some(animation => animation.mode === "motion" && animation.running && animation.currentTime > 150));
  await motion.click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await settled(page);
  await savedUrl(page);
  snapshots.saved = await read(page);
  const savedUrlA = page.url(), savedA = decode(savedUrlA);
  const urlA = new URL(savedUrlA);
  check("url-preserves-object-route-hash-and-other-parameters", urlA.pathname === initialUrl.pathname && urlA.hash === "#camera" && urlA.searchParams.get("campaign") === "shared-view");
  check("url-has-one-bounded-versioned-payload", urlA.searchParams.getAll("v").length === 1 && Buffer.from(urlA.searchParams.get("v"), "base64url").length <= 4096);
  compare("url-captures-real-camera", savedA.camera, snapshots.saved.camera);
  check("url-captures-paused-nonzero-native-playback", !savedA.playback.motionRequested && savedA.playback.times.length > 0 && savedA.playback.times.some(time => time > 150) &&
    JSON.stringify(savedA.playback.times) === JSON.stringify(snapshots.saved.playback.times), { times: savedA.playback.times });
  check("astronomical-epoch-is-fixed-separately-from-visual-time", savedA.preparedEpochJdTt === 2461286.5 && savedA.playback.times.some(time => time !== savedA.preparedEpochJdTt));
  check("interaction-retains-scene-dom", snapshots.saved.stable && snapshots.saved.nodeCount === snapshots.initial.nodeCount);
  await page.screenshot({ path: resolve(output, "saved.png") });

  await page.reload({ waitUntil: "networkidle" });
  await ready(page);
  await settled(page);
  snapshots.reloaded = await read(page);
  compare("reload-restores-real-camera", snapshots.reloaded.camera, savedA.camera);
  verifyPlayback("reload-restores-paused-native-playback", snapshots.reloaded, savedA.playback);
  check("reload-preserves-saved-url", page.url() === savedUrlA);
  check("reload-has-one-retained-object", snapshots.reloaded.stable && snapshots.reloaded.mountedObjectCount === 1 && snapshots.reloaded.nodeCount === snapshots.saved.nodeCount);
  await page.screenshot({ path: resolve(output, "reloaded.png") });

  // The application deliberately uses replaceState. Add one normal history
  // entry so Back/Forward can exercise its popstate restoration listener.
  await page.evaluate(() => history.pushState({ viewUrlProbe: true }, "", location.href));
  await drag(page, [990, 390], [850, 505]);
  await page.mouse.move(960, 500);
  await wheelWithReceipt(page, -70);
  await settled(page);
  await savedUrl(page, savedUrlA);
  const savedUrlB = page.url(), savedB = decode(savedUrlB);
  check("second-real-view-is-distinct", savedB.camera.pose.scene !== savedA.camera.pose.scene && savedB.camera.distanceKilometers !== savedA.camera.distanceKilometers);
  await page.goBack();
  await page.waitForFunction(expected => window.__mercury?.camera.state().controlYaw === expected, savedA.camera.controlYaw);
  snapshots.back = await read(page);
  compare("history-back-restores-camera", snapshots.back.camera, savedA.camera);
  verifyPlayback("history-back-restores-native-times", snapshots.back, savedA.playback);
  await page.goForward();
  await page.waitForFunction(expected => window.__mercury?.camera.state().controlYaw === expected, savedB.camera.controlYaw);
  snapshots.forward = await read(page);
  compare("history-forward-restores-camera", snapshots.forward.camera, savedB.camera);
  verifyPlayback("history-forward-restores-native-times", snapshots.forward, savedB.playback);
  check("history-restoration-retains-dom", snapshots.back.stable && snapshots.forward.stable && snapshots.forward.nodeCount === snapshots.saved.nodeCount);

  const malformed = new URL(savedUrlA);
  malformed.searchParams.set("v", "malformed");
  await page.goto(malformed.href, { waitUntil: "networkidle" });
  await ready(page);
  snapshots.malformed = await read(page);
  check("malformed-view-leaves-one-usable-scene", snapshots.malformed.mountedObjectCount === 1 && snapshots.malformed.stable && page.url() === malformed.href);
  check("malformed-view-reports-a-bounded-validation-warning", warnings.length > 0, { warnings });
  await drag(page, [900, 440], [1000, 380]);
  await settled(page);
  await savedUrl(page, malformed.href);
  const repaired = decode(page.url());
  snapshots.repaired = await read(page);
  compare("real-input-replaces-malformed-token-with-current-camera", repaired.camera, snapshots.repaired.camera);
  check("no-browser-errors", errors.length === 0, { errors });
} catch (error) {
  errors.push(error.stack ?? error.message);
  check("browser-run-completed", false, { error: error.message });
} finally {
  await browser.close();
  const report = { passed: checks.filter(item => item.ok).length, total: checks.length, checks, errors, warnings, snapshots };
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}
assert.ok(checks.length >= 25 && checks.every(item => item.ok) && errors.length === 0, `Shared view browser proof failed; see ${resolve(output, "report.json")}`);
console.log(`Shared view browser proof passed: ${checks.length}/${checks.length}; real drag, wheel, reload, history and malformed URL.`);

async function ready(page) {
  await page.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true && document.documentElement.dataset.ready === "true", null, { timeout: 20000 });
}
async function settled(page) {
  await page.waitForFunction(() => {
    const state = window.__mercury.camera.stats().dragInertia;
    return !state.active && !state.wheelZoom.active;
  }, null, { timeout: 10000 });
  await page.waitForFunction(() => {
    const stars = window.__mercury.sky.state().captions.stars, slot = stars.slots[0];
    return slot.alpha === slot.target && (stars.accepted ? slot.occupant === `3:${stars.candidate.id}` : slot.occupant === null);
  }, null, { timeout: 3000 });
  await page.waitForTimeout(220);
}
async function drag(page, from, to) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 10 });
  // Release after a stationary hold, avoiding a throw beyond the tested pose.
  await page.waitForTimeout(180);
  await page.mouse.up();
  await settled(page);
}
async function savedUrl(page, previous = null) {
  await page.waitForFunction(before => new URLSearchParams(location.search).has("v") && (!before || location.href !== before), previous);
}
function decode(url) { return parseSharedView(`v=${new URL(url).searchParams.get("v")}`); }
async function read(page) {
  return page.evaluate(() => {
    const api = window.__mercury, camera = api.camera.state(), playback = api.runtime.playback();
    return { camera: { controlPitch: camera.controlPitch, controlYaw: camera.controlYaw, zoom: camera.zoom,
      distanceKilometers: camera.distanceKilometers, pose: camera.pose },
    playback: { times: playback.animations.filter(animation => animation.mode === "motion").map(animation => animation.currentTime),
      speed: playback.speed, motionRequested: window.__cssEarth.playback.motionRequested,
      running: playback.animations.some(animation => animation.mode === "motion" && animation.running) },
    nodeCount: document.querySelector(".planet-stage").querySelectorAll("*").length,
    stable: api.assertStableDomIdentity(), mountedObjectCount: window.__cssEarth.mountedObjectCount };
  });
}
function compare(id, actual, expected) {
  for (const key of ["controlPitch", "controlYaw", "zoom", "distanceKilometers"]) check(`${id}-${key}`, close(actual[key], expected[key]), { actual: actual[key], expected: expected[key] });
  for (const key of ["scene", "skybox", "sunView"]) {
    const values = value => value.slice(9, -1).split(",").map(Number);
    const a = values(actual.pose[key]), b = values(expected.pose[key]);
    const maximumError = Math.max(...a.map((value, index) => Math.abs(value - b[index])));
    // Restore must avoid the CSS parser's roughly seven-decimal truncation.
    // The numeric DOMMatrix constructor preserves this saved matrix precision.
    check(`${id}-${key}`, maximumError <= 1e-10, { maximumError });
  }
}
function verifyPlayback(id, actual, expected) {
  check(id, !actual.playback.running && actual.playback.motionRequested === expected.motionRequested && actual.playback.speed === expected.speed &&
    actual.playback.times.length === expected.times.length && actual.playback.times.every((time, index) => close(time, expected.times[index])),
  { actual: actual.playback, expected });
}
