import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { OBJECTS } from "../objects.mjs";
import { loadPlanetBrowserProfile } from "./load-browser-profile.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const selected = OBJECTS.filter(({ id }) => !process.argv[3] || id === process.argv[3]);
assert.ok(selected.length, "Select an implemented object.");
const output = process.env.CSSEARTH_CAMERA_OUTPUT;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { browser: browser.version(), baseUrl, runs: [] };
try {
  for (const object of selected) for (const dpr of [1, 2]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    const label = `${object.id}/dpr-${dpr}`;
    const captures = [];
    try {
      const profile = await loadPlanetBrowserProfile(object);
      await page.goto(new URL(object.route, baseUrl).href, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__cssEarth?.ready === true);
      await profile.waitForRuntime(page);
      await profile.pause(page);
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      const initial = await profile.camera(page);
      const bounds = await profile.bounds(page);
      const measure = async (name) => {
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done))));
        const state = await page.locator(".polycss-camera").evaluate((camera) => {
          const style = getComputedStyle(camera);
          const matrix = new DOMMatrix(getComputedStyle(camera.querySelector(".polycss-scene")).transform);
          return {
            perspective: Number.parseFloat(style.perspective),
            scale: Number.parseFloat(style.scale),
            depth: matrix.m43,
            sceneScale: Math.hypot(matrix.m11, matrix.m21, matrix.m31),
            matrix: Array.from(matrix.toFloat64Array()),
          };
        });
        assert.ok(Number.isFinite(state.perspective) && state.perspective > 0, `${label}: mounted perspective`);
        assert.equal(state.depth, 0, `${label}: zoom must not translate prepared layers toward the camera`);
        assert.equal(await profile.stable(page), true, `${label}: retained scene identity`);
        if (output) await page.screenshot({ path: resolve(output, `${object.id}-dpr${dpr}-${name}.png`) });
        captures.push({ name, camera: await profile.camera(page), ...state });
        return state;
      };
      const reference = await measure("default");
      const assertProjection = (state, zoom) => {
        assert.equal(state.perspective, reference.perspective, `${label}: preserve prepared perspective`);
        assert.ok(Math.abs(state.sceneScale - reference.sceneScale) < 1e-6, `${label}: preserve prepared scene scale`);
        assert.ok(Math.abs(state.scale / reference.scale - zoom / initial.zoom) < 1e-4,
          `${label}: zoom scales the complete camera`);
      };
      for (const [name, pitch, zoom] of [
        ["rotated", initial.pitch + 80, initial.zoom],
        ["minimum", initial.pitch, bounds.minimumZoom],
        ["maximum", initial.pitch, bounds.maximumZoom],
      ]) {
        await profile.setCamera(page, { pitch, zoom });
        const state = await measure(name);
        assertProjection(state, (await profile.camera(page)).zoom);
        if (name === "rotated") assert.notDeepEqual(state.matrix, reference.matrix, `${label}: rotation reaches the scene`);
      }
      await profile.setCamera(page, initial);
      const box = await page.locator(".polycss-camera").boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const beforeDrag = await measure("restored");
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 100, y + 50, { steps: 12 });
      await page.mouse.up();
      await page.mouse.down();
      await page.mouse.up();
      const afterDrag = await measure("dragged");
      assert.notDeepEqual(afterDrag.matrix, beforeDrag.matrix, `${label}: real pointer drag rotates the scene`);
      assertProjection(afterDrag, (await profile.camera(page)).zoom);
      const beforeWheel = (await profile.camera(page)).zoom;
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, -120);
      await page.waitForFunction((previous) => {
        // Profiles own their diagnostic API; the rendered camera scale is the
        // shared observable for both synchronous and eased wheel controllers.
        return getComputedStyle(document.querySelector(".polycss-camera")).scale !== previous;
      }, String(afterDrag.scale));
      await page.waitForTimeout(600);
      const afterWheel = await measure("wheel");
      const wheelZoom = (await profile.camera(page)).zoom;
      assert.ok(wheelZoom > beforeWheel, `${label}: real wheel input zooms the scene`);
      assertProjection(afterWheel, wheelZoom);
      assert.deepEqual(errors, [], `${label}: browser errors`);
      report.runs.push({ id: object.id, dpr, captures });
      console.log(`${label}: prepared projection, full zoom range, rotation, drag and wheel passed`);
    } catch (error) {
      report.runs.push({ id: object.id, dpr, error: error.stack, errors, captures });
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  if (output) await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
