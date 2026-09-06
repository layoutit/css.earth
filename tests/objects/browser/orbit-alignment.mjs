import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const output = '.local/orbit-alignment';
const savedVenusView = 'QEY-akjjVyWQ6T5ZSN8zDLexwREdZEHdtDpBQsczQAAAAL-ujGPkfZBOv6Z-6tf3t7m_26IwwaGJCwABAAAAAAAAAAA';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const receipts = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) for (const id of ['venus', 'mercury']) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.goto(`${origin}/${id}/${id === 'venus' ? `?v=${savedVenusView}` : ''}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(id => window.__cssEarth?.ready && window[`__${id}`]?.ready, id, { timeout: 30000 });
    // The exact desktop URL is the reported failure. Keep portrait and Mercury
    // at the same visible detail size while preserving their observer direction.
    if (id === 'mercury' || viewport.width < 821) await page.evaluate(({ id, width }) => {
      const camera = window[`__${id}`].camera;
      const state = camera.state();
      camera.setState({ distance: state.distance / state.distanceRadii * 46.334513854017324 * width / 1440 });
    }, { id, width: viewport.width });
    const measured = await page.evaluate(id => {
      const root = document.querySelector('.polycss-camera');
      const scene = root.querySelector('.polycss-scene');
      const orbit = document.querySelector('.planet-heliocentric-orbit');
      const marker = orbit.querySelector('.planet-heliocentric-body-marker');
      const rect = element => element.getBoundingClientRect();
      const centre = element => { const box = rect(element); return [box.x + box.width / 2, box.y + box.height / 2]; };
      const layout = element => ({ left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight });
      const bodyCentre = centre(scene), orbitalPosition = centre(marker);
      return { id, bodyCentre, orbitalPosition,
        viewport: { width: innerWidth, height: innerHeight },
        centreErrorPixels: Math.hypot(...bodyCentre.map((value, axis) => value - orbitalPosition[axis])),
        cameraBounds: rect(root).toJSON(), orbitBounds: rect(orbit).toJSON(),
        orbitLayout: layout(orbit),
        renderRoots: [...document.querySelectorAll('.planet-stage > .planet-render-root')]
          .map(element => ({ className: element.className, layout: layout(element) })),
        camera: window[`__${id}`].camera.state(),
        visibleOrbitPieces: [...orbit.querySelectorAll('.planet-heliocentric-orbit-piece')]
          .filter(piece => getComputedStyle(piece).visibility === 'visible' && Number(getComputedStyle(piece).opacity) > 0).length };
    }, id);
    receipts.push(measured);
    await page.screenshot({ path: `${output}/${id}-${viewport.width}-alignment.png` });
    await writeFile(`${output}/alignment.json`, JSON.stringify(receipts, null, 2));
    assert.equal(measured.camera.levelOfDetail.stage, 'geometry', `${id}: exercise the detailed body`);
    assert.ok(measured.visibleOrbitPieces > 0, `${id}: exercise visible orbit geometry`);
    assert.ok(measured.centreErrorPixels < 0.1,
      `${id}: detailed body differs from its projected orbital position by ${measured.centreErrorPixels}px`);
    assert.deepEqual(measured.cameraBounds, measured.orbitBounds,
      `${id}: geometry and orbit projection must share the same CSS root box`);
    assert.ok(measured.renderRoots.length >= 5, `${id}: include material, Sun and celestial roots`);
    // Material roots have a runtime silhouette transform; compare their native
    // layout boxes before that intentional projection/scale is applied.
    for (const root of measured.renderRoots) assert.deepEqual(root.layout, measured.orbitLayout,
      `${id}: ${root.className} must retain the common projection origin`);
    await page.close();
  }
  console.log(JSON.stringify({ status: 'passed', objects: receipts.map(({ id, viewport, centreErrorPixels }) => ({ id, viewport, centreErrorPixels })) }));
} finally { await browser.close(); }
