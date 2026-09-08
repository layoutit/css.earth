import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { serveBuiltFixture } from '../../../../tools/test-built-server.mjs';
import { parseSharedView } from '../../../../src/renderers/css/dist/index.js';

const option = (key, fallback) => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const built = resolve(option('built', 'dist'));
const output = resolve(option('output', `output/playwright/touch-pinch-${Date.now()}`));
const object = option('object', 'earth');
assert.match(object, /^[a-z][a-z-]*$/);
await mkdir(output, { recursive: true });
const source = await readFile(new URL(import.meta.url));
await writeFile(resolve(output, 'captured-harness.mjs'), source);
const fixture = await serveBuiltFixture(built);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: fixture.launchArgs });
const report = { built, output, object, browser: browser.version(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  harnessSha256: createHash('sha256').update(source).digest('hex'),
  qualification: 'Chrome at 800 by 900 CSS pixels with emulated touch; not a physical phone or trackpad.', cases: [] };
const save = () => writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 800, height: 900 }, deviceScaleFactor: dpr, hasTouch: true });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    const row = { dpr, states: [], errors: [] }; report.cases.push(row);
    page.on('pageerror', error => row.errors.push(error.message));
    await page.addInitScript(() => {
      window.__touchReceipt = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) addEventListener(type, event => {
        if (event.pointerType !== 'touch') return;
        window.__touchReceipt.push({ type, trusted: event.isTrusted, id: event.pointerId,
          scene: Boolean(event.target.closest?.('.planet-input-surface')) });
      }, { capture: true, passive: true });
    });
    const pause = ms => page.waitForTimeout(ms);
    const state = async name => {
      const visible = await page.evaluate(() => ({ url: location.href, scrollY,
        scenes: document.querySelectorAll('.polycss-scene').length }));
      const camera = parseSharedView(new URL(visible.url).search)?.camera;
      assert.ok(camera); assert.equal(visible.scenes, 1);
      const current = { name, ...visible, camera }; row.states.push(current); return current;
    };
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    try {
      await page.goto(`${fixture.url}/${object}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 120000 });
      const rect = await page.locator('.polycss-camera').boundingBox(); assert.ok(rect);
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      for (const dx of [-90, 0, 90]) assert.ok(await page.evaluate(({ x, y }) =>
        Boolean(document.elementFromPoint(x, y)?.closest('.planet-input-surface')), { x: x + dx, y }));
      // A visible drag gives the public URL a saved camera before touch starts.
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + 30, y, { steps: 12 }); await pause(120); await page.mouse.up(); await pause(500);
      const before = await state('before-pinch');
      await page.screenshot({ path: resolve(output, `dpr${dpr}-before.png`) });
      const points = span => [1, 2].map((id, i) => ({ id, x: x + (i ? 1 : -1) * span / 2, y, radiusX: 4, radiusY: 4, force: 1 }));
      await touch('touchStart', points(120)); await pause(100);
      for (let step = 1; step <= 20; step++) { await touch('touchMove', points(120 + 24 * step / 20)); await pause(30); }
      await touch('touchEnd', []); await pause(500);
      const after = await state('after-pinch');
      assert.ok(after.camera.distanceKilometers < before.camera.distanceKilometers, 'Spreading two fingers must zoom in');
      assert.equal(after.camera.pose.scene, before.camera.pose.scene, 'Pinch must not turn the globe');
      assert.equal(after.scrollY, before.scrollY);
      await page.screenshot({ path: resolve(output, `dpr${dpr}-after.png`) });
      // A cancellation must release ownership; the next pinch can zoom out.
      await touch('touchStart', points(144)); await pause(50); await touch('touchCancel', []); await pause(100);
      assert.deepEqual((await state('after-cancel')).camera, after.camera);
      await touch('touchStart', points(144)); await pause(90);
      for (let step = 1; step <= 20; step++) { await touch('touchMove', points(144 - 24 * step / 20)); await pause(30); }
      await touch('touchEnd', []); await pause(500);
      const reversed = await state('after-reversal');
      assert.ok(Math.abs(reversed.camera.distanceKilometers / before.camera.distanceKilometers - 1) < 1e-6);
      assert.equal(reversed.camera.pose.scene, before.camera.pose.scene);
      await page.mouse.move(x, y); await page.mouse.wheel(0, 100 * dpr); await pause(500);
      const scrolled = await state('ordinary-page-scroll');
      assert.deepEqual(scrolled.camera, reversed.camera);
      assert.ok(scrolled.scrollY > reversed.scrollY, 'Ordinary wheel still scrolls the narrow page');
      row.events = await page.evaluate(() => window.__touchReceipt);
      assert.ok(row.events.length > 40 && row.events.every(event => event.trusted && event.scene));
      assert.deepEqual(row.errors, []); row.passed = true;
      console.log(`PASS ${object} DPR ${dpr}: pinch, cancellation, reversal, page scrolling`);
    } catch (error) {
      row.error = String(error); report.error = String(error);
      await page.screenshot({ path: resolve(output, `dpr${dpr}-failure.png`) }).catch(() => {});
      console.error(row.error);
      throw error;
    } finally { await save(); await context.close(); row.closed = true; }
  }
} catch { process.exitCode = 1; }
finally {
  report.scripts = [...new Map(fixture.requests.filter(request => request.sha256).map(request => [request.path, request])).values()];
  for (const script of report.scripts) assert.equal(script.sha256,
    createHash('sha256').update(await readFile(resolve(built, `.${script.path}`))).digest('hex'));
  await save(); await browser.close(); await fixture.close(); report.closed = true; await save();
}
