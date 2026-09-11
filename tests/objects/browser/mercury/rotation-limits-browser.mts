// Measures where Mercury's camera rotation actually stops, in real Chrome,
// by dragging continuously in each direction and reading the painted pose
// after every drag; then pins that it never stops. Nothing here trusts the
// camera plan's declared bounds: the pose is read off `.mercury-scene`'s
// painted matrix and the control angles off the runtime's own state.
//
// Usage: node tests/objects/browser/mercury/rotation-limits-browser.mts [baseUrl]
//   [--measure-only]
// The last stdout line is a JSON report; the exit status is non-zero when a
// direction saturates (unless --measure-only).

import { chromium, type Page } from "playwright";

import * as oracle from "./lighting-geometry-oracle.mts";

const baseUrl = process.argv.find((argument) => /^https?:/u.test(argument)) ?? "http://127.0.0.1:4210";
const measureOnly = process.argv.includes("--measure-only");

// Each drag: a 240 px stroke at rest, with the runtime's inertia let settle.
const STROKE_PIXELS = 240;
const STROKES = 24;

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const checks: { id: string; ok: boolean }[] = [];
type Sample = Awaited<ReturnType<typeof readSample>>;
type Direction = { samples: Sample[]; steps: number[]; lastMovingStroke: number; saturated: boolean; extremes: Record<string, number>; meanStepDegrees: number };
const report: { baseUrl: string; directions: Record<string, Direction>; declared?: Record<string, number | boolean>; tumble?: Record<string, Record<string, ReturnType<typeof rotationBetween>>> } = { baseUrl, directions: {} };
try {
  const page = await context.newPage();
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`error: ${message.text()}`); });
  const response = await page.goto(new URL("/mercury/", baseUrl).href, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`Mercury page returned ${response?.status()}.`);
  await page.waitForFunction(() => window.__cssEarth?.ready === true && window.__mercury?.ready === true &&
    document.documentElement.dataset.ready === "true");
  await page.evaluate(() => {
    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
    function requiredInput(value: Element | null): HTMLInputElement { if (!(value instanceof HTMLInputElement)) throw new Error("Expected required HTMLInputElement"); return value; }

    const motion = requiredInput(document.querySelector('input[name="motion"]'));
    if (motion.checked) motion.click();
  });
  const stats = await page.evaluate(() => {
    function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__mercury).camera.stats(); });
  if (!stats.dolly) throw new Error("Mercury dolly diagnostics missing");
  report.declared = {
    pitchBounded: stats.pitchBounded, yawBounded: stats.yawBounded,
    minimumPitchDegrees: stats.minimumPitchDegrees, maximumPitchDegrees: stats.maximumPitchDegrees,
  };
  const geometry = await page.locator(".mercury-camera").boundingBox();
  if (!geometry) throw new Error("Mercury camera bounds missing");
  const centre = [geometry.x + geometry.width / 2, geometry.y + geometry.height / 2];

  for (const [name, delta] of [["up", [0, -STROKE_PIXELS]], ["down", [0, STROKE_PIXELS]],
    ["left", [-STROKE_PIXELS, 0]], ["right", [STROKE_PIXELS, 0]]] as const) {
    await page.evaluate(() => {
      function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

      const current = requiredDiagnostics(window.__mercury).camera.stats();
      requiredDiagnostics(window.__mercury).camera.setState({ controlPitch: current.defaultControlPitchDegrees,
        controlYaw: current.defaultControlYawDegrees, zoom: 1.1 });
    });
    await nextPaint(page);
    const samples = [await readSample(page)];
    for (let stroke = 0; stroke < STROKES; stroke += 1) {
      await drag(page, centre, delta);
      samples.push(await readSample(page));
    }
    // Where it stopped: the last stroke that still moved the painted pose.
    const steps = samples.slice(1).map((sample, index) => {
      const previous = samples[index];
      return Math.abs(oracle.wrapDegrees(sample.scenePitch - previous.scenePitch)) +
        Math.abs(oracle.wrapDegrees(sample.sceneYaw - previous.sceneYaw));
    });
    const lastMoving = steps.reduce((last, step, index) => (step > 0.5 ? index + 1 : last), 0);
    const saturated = lastMoving < STROKES;
    const extremes = {
      scenePitchMin: Math.min(...samples.map((s) => s.scenePitch)),
      scenePitchMax: Math.max(...samples.map((s) => s.scenePitch)),
      controlPitchMin: Math.min(...samples.map((s) => s.controlPitch)),
      controlPitchMax: Math.max(...samples.map((s) => s.controlPitch)),
      controlYawMin: Math.min(...samples.map((s) => s.controlYaw)),
      controlYawMax: Math.max(...samples.map((s) => s.controlYaw)),
      totalScenePitchTravel: samples.slice(1).reduce((sum, s, i) => sum + Math.abs(oracle.wrapDegrees(s.scenePitch - samples[i].scenePitch)), 0),
      totalSceneYawTravel: samples.slice(1).reduce((sum, s, i) => sum + Math.abs(oracle.wrapDegrees(s.sceneYaw - samples[i].sceneYaw)), 0),
    };
    // Each stroke must keep moving the painted pose by a comparable amount:
    // no saturation, no snap-back (the accumulated travel keeps growing).
    const meanStep = steps.reduce((sum, step) => sum + step, 0) / steps.length;
    const lateSteps = steps.slice(-4);
    report.directions[name] = { samples, steps, lastMovingStroke: lastMoving, saturated, extremes, meanStepDegrees: meanStep };
    check(`drag-${name}-never-saturates`, !saturated && lateSteps.every((step) => step > 0.4 * meanStep),
      { name, lastMoving, meanStep, lateSteps, extremes });
  }
  // Tumble everywhere: a stroke starting far from the body's centre (where
  // a virtual trackball twists about the view axis) must rotate the scene
  // about the screen axes by about as much as one from the centre, at the
  // default framing and at the dolly's far bound. The rotation between the
  // painted matrices is decomposed into an axis and an angle; the axis's
  // view-axis component is the roll share.
  report.tumble = {};
  for (const [view, state] of [["default", { zoom: 1.1 }], ["far", { distanceKilometers: stats.dolly.maximumDistanceKilometers }]] as const) {
    report.tumble[view] = {};
    for (const [name, start, delta] of [
      ["centre-right", centre, [STROKE_PIXELS, 0]],
      ["offcentre-right", [centre[0] + 420, centre[1] + 300], [STROKE_PIXELS, 0]],
      ["offcentre-up", [centre[0] + 420, centre[1] + 300], [0, -STROKE_PIXELS]],
      ["corner-right", [centre[0] - 500, centre[1] - 380], [STROKE_PIXELS, 0]],
    ] as const) {
      await page.evaluate((next) => {
        function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }

        const current = requiredDiagnostics(window.__mercury).camera.stats();
        requiredDiagnostics(window.__mercury).camera.setState({ controlPitch: current.defaultControlPitchDegrees,
          controlYaw: current.defaultControlYawDegrees, ...next });
      }, state);
      await nextPaint(page);
      const before = await readMatrix(page);
      await drag(page, start, delta);
      const after = await readMatrix(page);
      report.tumble[view][name] = rotationBetween(before, after);
    }
    const reference = report.tumble[view]["centre-right"].angle;
    for (const name of ["offcentre-right", "offcentre-up", "corner-right"]) {
      const { angle, rollShare } = report.tumble[view][name];
      check(`drag-${view}-${name}-tumbles`, angle >= 0.6 * reference && rollShare !== null && rollShare < 0.2,
        { view, name, angle, reference, rollShare });
    }
  }
  check("no-page-errors", problems.length === 0, { problems });
} finally {
  await browser.close();
}

const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.id);
// Flushed before exiting: pipe writes are asynchronous on macOS.
await new Promise<void>((resolve, reject) => process.stdout.write(
  `${JSON.stringify({ suite: "mercury-rotation-limits", ok: failed.length === 0, failed, checks, ...report })}\n`, error => error ? reject(error) : resolve()));
process.exit(measureOnly || failed.length === 0 ? 0 : 1);

function check(id: string, ok: boolean, detail: Record<string, unknown>) {
  checks.push({ ...detail, id, ok: Boolean(ok) });
  if (!ok) console.error(`FAIL ${id}: ${JSON.stringify(detail).slice(0, 600)}`);
}

async function readMatrix(page: Page) {
  return oracle.parseSceneRotation(await page.locator(".mercury-scene").evaluate((element) => element.style.transform));
}

// The rotation taking pose `a` to pose `b` as an angle and the view-axis
// share of its axis.
function rotationBetween(a: readonly number[], b: readonly number[]) {
  const transpose = [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
  const r = oracle.multiplyMatrices(b, transpose);
  const angle = Math.acos(Math.max(-1, Math.min(1, (r[0] + r[4] + r[8] - 1) / 2))) * 180 / Math.PI;
  const raw = [r[7] - r[5], r[2] - r[6], r[3] - r[1]];
  const length = Math.hypot(...raw);
  return { angle, rollShare: length > 1e-9 ? Math.abs(raw[2] / length) : null };
}

async function readSample(page: Page) {
  const state = await page.evaluate(() => {
    function requiredDiagnostics<T>(value: T | undefined): T { if (value === undefined) throw new Error("Expected mounted development diagnostics"); return value; }
return requiredDiagnostics(window.__mercury).camera.state(); });
  const transform = await page.locator(".mercury-scene").evaluate((element) => element.style.transform);
  const { pitchDegrees, yawDegrees } = oracle.scenePitchYawDegrees(oracle.parseSceneRotation(transform));
  return { controlPitch: state.controlPitch, controlYaw: state.controlYaw, scenePitch: pitchDegrees, sceneYaw: yawDegrees };
}

// A stroke from the body's centre, ending at rest so no inertial throw
// follows, then the runtime's settle time.
async function drag(page: Page, [x, y]: readonly number[], [dx, dy]: readonly number[]) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = 12;
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(x + dx * step / steps, y + dy * step / steps);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await nextPaint(page);
}

async function nextPaint(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
