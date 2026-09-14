import { createTestPage } from './browser-observations.mts';
import type { Page } from 'playwright';
// Exercise the real pointer, wheel, settings, address bar and reload path.
// Diagnostics only measure the camera and the retained native animations.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { parseSharedView } from "../../src/platform/view-url.mts";
import { wheelWithReceipt } from "./wheel-zoom-distance.mts";

const baseUrl = process.argv.find(argument => /^https?:/u.test(argument)) ?? "http://127.0.0.1:4210";
const output = resolve(process.env.VIEW_URL_DUMP ?? ".local/view-url-browser");
await mkdir(output, { recursive: true });
type Snapshot = Awaited<ReturnType<typeof read>>;
type EncodedCamera = { distanceKilometers: number; pose: { scene: string } };
const checks: { id: string; ok: boolean; [key: string]: unknown }[] = [], errors: string[] = [], warnings: string[] = [],
  snapshots: Partial<Record<string, Snapshot>> = {};
// Shared views restore the physical vault. The shell's open information or
// settings panel is separate UI state; leave its rail and navigation out.
const vaultClip = { x: 360, y: 80, width: 1080, height: 790 };
const check = (id: string, ok: unknown, detail: Record<string, unknown> = {}) => {
  checks.push({ id, ok: Boolean(ok), ...detail });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail)}`);
};
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-12);
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", timeout: 20000 });
try {
  const page = await createTestPage(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
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
  await page.waitForFunction(() => window.__cssearthTest.object('mercury').runtime.playback().animations.some(animation => animation.mode === "motion" && animation.running && typeof animation.currentTime === "number" && animation.currentTime > 150));
  await motion.click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await settled(page);
  await savedUrl(page);
  snapshots.saved = await read(page);
  const savedUrlA = page.url(), savedA = decode(savedUrlA);
  const urlA = new URL(savedUrlA);
  check("url-preserves-object-route-hash-and-other-parameters", urlA.pathname === initialUrl.pathname && urlA.hash === "#camera" && urlA.searchParams.get("campaign") === "shared-view");
  const token = urlA.searchParams.get("v"); assert.ok(token);
  const bytes = Buffer.from(token, "base64url");
  check("url-has-one-tiny-versioned-payload", urlA.searchParams.getAll("v").length === 1 && bytes.readUInt16BE(0) >>> 12 === 3 && token.length <= 80,
    { tokenCharacters: token.length, bytes: bytes.length, actualUrlCharacters: savedUrlA.length });
  check("url-stores-one-physical-pose-and-distance", Object.keys(savedA.camera).sort().join() === "distanceKilometers,pose" &&
    savedA.camera.pose.schema === "cssearth-camera-pose@2" && Object.keys(savedA.camera.pose).sort().join() === "scene,schema");
  compareEncodedCamera("url-captures-real-camera", savedA.camera, snapshots.saved.camera);
  check("url-captures-paused-nonzero-native-playback", !savedA.playback.motionRequested && savedA.playback.times.length > 0 && savedA.playback.times.some(time => time > 150) &&
    JSON.stringify(savedA.playback.times) === JSON.stringify(snapshots.saved.playback.times), { times: savedA.playback.times });
  check("astronomical-epoch-is-fixed-separately-from-visual-time", savedA.preparedEpochJdTt === 2461286.5 && savedA.playback.times.some(time => time !== savedA.preparedEpochJdTt));
  check("interaction-retains-scene-dom", snapshots.saved.stable && snapshots.saved.nodeCount === snapshots.initial.nodeCount);
  const savedPixels = await page.screenshot({ path: resolve(output, "saved.png"), clip: vaultClip });

  await page.reload({ waitUntil: "networkidle" });
  await ready(page);
  await settled(page);
  snapshots.reloaded = await read(page);
  compareRenderedView("reload-restores-real-camera", snapshots.reloaded, snapshots.saved);
  verifyPlayback("reload-restores-paused-native-playback", snapshots.reloaded, savedA.playback);
  check("reload-preserves-saved-url", page.url() === savedUrlA);
  check("reload-has-one-retained-object", snapshots.reloaded.stable && snapshots.reloaded.mountedObjectCount === 1 && snapshots.reloaded.nodeCount === snapshots.saved.nodeCount);
  const reloadedPixels = await page.screenshot({ path: resolve(output, "reloaded.png"), clip: vaultClip });
  await comparePixels("reload-restores-rendered-pixels", reloadedPixels, savedPixels);

  // The application deliberately uses replaceState. Add one normal history
  // entry so Back/Forward can exercise its popstate restoration listener.
  await page.evaluate(() => history.pushState({ viewUrlProbe: true }, "", location.href));
  await drag(page, [990, 390], [850, 505]);
  await page.mouse.move(960, 500);
  await wheelWithReceipt(page, -70);
  await settled(page);
  await savedUrl(page, savedUrlA);
  const savedUrlB = page.url(), savedB = decode(savedUrlB);
  snapshots.second = await read(page);
  check("second-real-view-is-distinct", savedB.camera.pose.scene !== savedA.camera.pose.scene && savedB.camera.distanceKilometers !== savedA.camera.distanceKilometers);
  await page.goBack();
  await restored(page, savedA.camera.distanceKilometers);
  snapshots.back = await read(page);
  compareRenderedView("history-back-restores-camera", snapshots.back, snapshots.saved);
  verifyPlayback("history-back-restores-native-times", snapshots.back, savedA.playback);
  await page.goForward();
  await restored(page, savedB.camera.distanceKilometers);
  snapshots.forward = await read(page);
  compareRenderedView("history-forward-restores-camera", snapshots.forward, snapshots.second);
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
  compareEncodedCamera("real-input-replaces-malformed-token-with-current-camera", repaired.camera, snapshots.repaired.camera);
  check("no-browser-errors", errors.length === 0, { errors });
} catch (error) {
  errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
  check("browser-run-completed", false, { error: error instanceof Error ? error.message : String(error) });
} finally {
  await browser.close();
  const report = { passed: checks.filter(item => item.ok).length, total: checks.length, checks, errors, warnings, snapshots };
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}
assert.ok(checks.length >= 25 && checks.every(item => item.ok) && errors.length === 0, `Shared view browser proof failed; see ${resolve(output, "report.json")}`);
console.log(`Shared view browser proof passed: ${checks.length}/${checks.length}; real drag, wheel, reload, history and malformed URL.`);

async function ready(page: Page) {
  await page.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true && document.documentElement.dataset.ready === "true", null, { timeout: 20000 });
}
async function settled(page: Page) {
  await page.waitForFunction(() => {
    const state = window.__cssearthTest.object('mercury').camera.stats().dragInertia;
    return !state.active && !state.wheelZoom.active;
  }, null, { timeout: 10000 });
  await page.waitForTimeout(220);
}
async function drag(page: Page, from: readonly [number, number], to: readonly [number, number]) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 10 });
  // Release after a stationary hold, avoiding a throw beyond the tested pose.
  await page.waitForTimeout(180);
  await page.mouse.up();
  await settled(page);
}
async function savedUrl(page: Page, previous: string | null = null) {
  await page.waitForFunction(before => new URLSearchParams(location.search).has("v") && (!before || location.href !== before), previous);
}
function decode(url: string) {
  const view = parseSharedView(`v=${new URL(url).searchParams.get("v")}`);
  assert.ok(view); assert.equal(view.camera.pose.schema, 'cssearth-camera-pose@2');
  assert.ok(typeof view.camera.distanceKilometers === 'number');
  return { ...view, camera: { distanceKilometers: view.camera.distanceKilometers, pose: view.camera.pose } };
}
async function restored(page: Page, distanceKilometers: number) {
  await page.waitForFunction(expected => Math.abs((window.__mercury?.camera.state().distanceKilometers ?? Infinity) - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-12), distanceKilometers);
  await settled(page);
}
async function read(page: Page) {
  return page.evaluate(() => {
    const api = window.__cssearthTest.object("mercury"), camera = window.__cssearthTest.physicalCamera("mercury"), playback = api.runtime.playback();
    const sky = api.sky.state(), lighting = window.__cssearthTest.record(api.material.state().lighting, "lighting material");
    const matrix = (selector: string) => Array.from(new DOMMatrix(window.__cssearthTest.html(selector).style.transform).toFloat64Array());
    const material = window.__cssearthTest.html(".mercury-material");
    return { camera: { controlPitch: camera.controlPitch, controlYaw: camera.controlYaw, zoom: camera.zoom,
      distanceKilometers: camera.distanceKilometers, pose: camera.pose },
    derivedSky: window.__cssearthTest.required(api.runtime.view(), "published view").skyboxMatrix,
    rendered: { scene: matrix(".mercury-scene"), sky: matrix(".mercury-skybox-orientation"),
      sun: { direction: window.__cssearthTest.required(sky.sunViewDirection, "sun direction"), visible: sky.sunVisible },
      lighting: { bank: lighting.bank, frame: lighting.frame, image: material.style.backgroundImage, transform: material.style.transform } },
    playback: { times: playback.animations.filter(animation => animation.mode === "motion").map(animation => window.__cssearthTest.number(animation.currentTime, "motion animation time")),
      speed: playback.speed, motionRequested: window.__cssearthTest.scene().playback.motionRequested,
      running: playback.animations.some(animation => animation.mode === "motion" && animation.running) },
    nodeCount: window.__cssearthTest.element(".planet-stage").querySelectorAll("*").length,
    stable: api.assertStableDomIdentity(), mountedObjectCount: window.__cssearthTest.scene().mountedObjectCount };
  });
}
function compareEncodedCamera(id: string, actual: EncodedCamera, expected: EncodedCamera) {
  check(`${id}-distanceKilometers`, close(actual.distanceKilometers, expected.distanceKilometers), { actual: actual.distanceKilometers, expected: expected.distanceKilometers });
  const values = (value: string) => value.slice(9, -1).split(",").map(Number);
  compareNumbers(`${id}-scene`, values(actual.pose.scene), values(expected.pose.scene));
}
function compareNumbers(id: string, actual: readonly number[], expected: readonly number[], tolerance = 1e-10) {
  const maximumError = Math.max(...actual.map((value, index) => Math.abs(value - expected[index])));
  check(id, actual.length === expected.length && maximumError <= tolerance, { maximumError });
}
function compareRenderedView(id: string, actual: Snapshot, expected: Snapshot) {
  compareEncodedCamera(id, actual.camera, expected.camera);
  check(`${id}-zoom-derived-from-distance`, close(actual.camera.zoom, expected.camera.zoom), { actual: actual.camera.zoom, expected: expected.camera.zoom });
  // The scene pose owns the sky registration and Sun. Input-control angles
  // and the unused independent Sun matrix are not the rendered camera.
  compareNumbers(`${id}-derived-sky`, actual.derivedSky.slice(9, -1).split(",").map(Number), expected.derivedSky.slice(9, -1).split(",").map(Number));
  compareNumbers(`${id}-rendered-scene`, actual.rendered.scene, expected.rendered.scene);
  compareNumbers(`${id}-rendered-sky`, actual.rendered.sky, expected.rendered.sky);
  compareNumbers(`${id}-actual-sun-direction`, actual.rendered.sun.direction, expected.rendered.sun.direction);
  check(`${id}-actual-sun-projection`, samePresentation(actual.rendered.sun, expected.rendered.sun), { actual: actual.rendered.sun, expected: expected.rendered.sun });
  check(`${id}-actual-lighting`, samePresentation(actual.rendered.lighting, expected.rendered.lighting), { actual: actual.rendered.lighting, expected: expected.rendered.lighting });
}
function samePresentation(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "number" && typeof expected === "number") return close(actual, expected);
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return actual === expected;
  return Object.keys(actual).length === Object.keys(expected).length && Object.keys(actual).every(key => samePresentation(Reflect.get(actual, key), Reflect.get(expected, key)));
}
async function comparePixels(id: string, actualPng: Buffer, expectedPng: Buffer) {
  const [actual, expected] = await Promise.all([actualPng, expectedPng].map(png => sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  let absoluteError = 0, changedPixels = 0;
  for (let index = 0; index < actual.data.length; index += 3) {
    let maximumChannelError = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const error = Math.abs(actual.data[index + channel] - expected.data[index + channel]);
      absoluteError += error;
      maximumChannelError = Math.max(maximumChannelError, error);
    }
    if (maximumChannelError > 10) changedPixels += 1;
  }
  const meanChannelError = absoluteError / actual.data.length, changedFraction = changedPixels / (actual.info.width * actual.info.height);
  check(id, actual.info.width === expected.info.width && actual.info.height === expected.info.height && meanChannelError <= 0.1 && changedFraction <= 0.001,
    { meanChannelError, changedFraction, changedPixels });
}
function verifyPlayback(id: string, actual: Snapshot, expected: ReturnType<typeof decode>["playback"]) {
  check(id, !actual.playback.running && actual.playback.motionRequested === expected.motionRequested && actual.playback.speed === expected.speed &&
    actual.playback.times.length === expected.times.length && actual.playback.times.every((time, index) => close(time, expected.times[index])),
  { actual: actual.playback, expected });
}
