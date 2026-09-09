import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/shared-camera-viewport';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${origin}/sun/?overview=solar-system&v=QMY-Wp0Ui2g9eAAAAAAAAAAAwhaDLpsLNZhBQsczQAAAAD_WST4rO1jov9dbC19kads_3S3JdnPBsgABAAAAAAAAAAA`);
    await page.waitForFunction(() => window.__cssEarth?.ready);
    for (const id of ['haumea', 'saturn', 'mars', 'sun']) {
      // Include the shared projection probes after handoff: changing FOV must
      // be prepared before teardown, not force layout from the incoming mount.
      await page.evaluate(() => {
        window.__cameraMountReads = [];
        window.__mountedInput = document.querySelector('.planet-input-surface');
        window.__mountedRegions = ['.planet-sidebar-frame', '.planet-viewport', '.planet-scene-overlays']
          .map(selector => ({ selector, node: document.querySelector(selector) }));
        const read = Element.prototype.getBoundingClientRect, style = window.getComputedStyle;
        window.__restoreCameraReadProbes = () => { Element.prototype.getBoundingClientRect = read; window.getComputedStyle = style; };
        const record = (element, operation) => {
          const requested = performance.getEntriesByName('cssEarth:navigation:requested').at(-1);
          const handoff = performance.getEntriesByName('cssEarth:navigation:handoff').at(-1);
          const attaching = requested && handoff && handoff.startTime >= requested.startTime;
          const projectionProbe = attaching && element.parentElement?.matches('.planet-stage') && element.style.perspective;
          if ((projectionProbe || element.matches?.('.polycss-camera, .planet-cubic-sky, .planet-chart')) && !window.__cssEarth?.ready)
            if (window.__cameraMountReads.length < 3) window.__cameraMountReads.push({ operation, className: element.className, stack: new Error().stack });
        };
        Element.prototype.getBoundingClientRect = function () { record(this, 'bounds'); return read.call(this); };
        window.getComputedStyle = function (element, pseudo) { record(element, 'style'); return style.call(this, element, pseudo); };
      });
      await page.evaluate(id => document.querySelector(`.planet-object-link[data-object-id="${id}"]`).click(), id);
      await page.waitForFunction(id => location.pathname === `/${id}/` && window.__cssEarth?.ready, id, { timeout: 30000 });
      const mounted = await page.evaluate(id => {
        window.__restoreCameraReadProbes();
        const root = document.querySelector('.planet-stage');
        return { id, reads: window.__cameraMountReads, scenes: root.querySelectorAll('.polycss-camera').length,
          inputRetained: window.__mountedInput === document.querySelector('.planet-input-surface'),
          regionsRetained: window.__mountedRegions.every(({selector, node}) => node && node === document.querySelector(selector)) };
      }, id);
      assert.deepEqual(mounted.reads, [], `${id}: incoming camera must consume shared measurements`);
      assert.equal(mounted.scenes, 1); assert.equal(mounted.inputRetained, true);
      assert.equal(mounted.regionsRetained, true, `${id}: shell regions survive navigation`);
      for (const size of [{ width: 1440, height: 1000 }, { width: 700, height: 1000 }, { width: 1600, height: 900 }]) {
        await page.setViewportSize(size);
        await page.waitForTimeout(200);
        const measured = await page.evaluate(id => {
          const stage = document.querySelector('.planet-stage'), camera = stage.querySelector('.polycss-camera');
          const bounds = camera.getBoundingClientRect(), actual = stage.getBoundingClientRect();
          const expected = parseFloat(getComputedStyle(camera).perspective);
          const runtime = window[`__${id}`].camera.state();
          return { focal: runtime.focal, expected, camera: [bounds.x,bounds.y,bounds.width,bounds.height],
            stage: [actual.x,actual.y,actual.width,actual.height] };
        }, id);
        assert.deepEqual(measured.camera, measured.stage, `${id}: shared physical viewport geometry`);
        assert.ok(Math.abs(measured.focal - measured.expected) < .01, `${id}: refreshed authored focal length`);
        results.push({ dpr, id, size, ...measured });
      }
    }
    // A stationary pointer must not remeasure the camera after every wheel
    // publication merely to choose the cursor's surface/sky appearance.
    await page.mouse.move(1200, 500);
    await page.evaluate(() => {
      const original = Element.prototype.getBoundingClientRect;
      window.__wheelCameraReads = 0;
      window.__restoreWheelProbe = () => { Element.prototype.getBoundingClientRect = original; };
      Element.prototype.getBoundingClientRect = function () {
        if (this.matches?.('.polycss-camera')) window.__wheelCameraReads++;
        return original.call(this);
      };
    });
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(350);
    const wheelReads = await page.evaluate(() => { window.__restoreWheelProbe(); return window.__wheelCameraReads; });
    assert.equal(wheelReads, 0, `DPR ${dpr}: cursor picking consumes the published viewport`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
}
console.log(`SHARED CAMERA VIEWPORT PASS: ${results.length} object/viewport/DPR samples`);
