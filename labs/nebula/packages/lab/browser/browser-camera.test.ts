import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { cameraOrientation, earthCamera, gestureCamera, referenceCamera } from './browser-camera.ts';

test('public camera helper drives pointer rotation and Earth restoration without preset controls', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await page.setContent(`<button id="reference-view">Earth</button><div id="viewer" style="width:900px;height:600px"><div class="css-volume-scene" style="transform:rotateY(0deg)"></div></div>`);
    await page.evaluate(() => {
      const scene = document.querySelector<HTMLElement>('.css-volume-scene')!;
      const viewer = document.querySelector<HTMLElement>('#viewer')!;
      let origin: [number, number] | null = null;
      viewer.onpointerdown = event => { origin = [event.clientX, event.clientY]; viewer.setPointerCapture(event.pointerId); };
      viewer.onpointermove = event => { if (origin) scene.style.transform = `rotateY(${(event.clientX - origin[0]) * .3}deg) rotateX(${(event.clientY - origin[1]) * .3}deg)`; };
      viewer.onpointerup = () => { origin = null; };
      document.querySelector<HTMLElement>('#reference-view')!.onclick = () => { scene.style.transform = 'rotateY(0deg)'; };
    });
    const original = await cameraOrientation(page);
    await gestureCamera(page, 'horizontal-positive-wide');
    assert.notEqual(await cameraOrientation(page), original);
    await earthCamera(page); assert.equal(await cameraOrientation(page), original);
    await gestureCamera(page, 'vertical-negative-short');
    assert.notEqual(await cameraOrientation(page), original);
    await page.evaluate(() => { document.querySelector<HTMLElement>('#reference-view')!.id = 'reset'; });
    assert.equal(await referenceCamera(page), 'initial');
    await gestureCamera(page, 'vertical-positive-wide');
    assert.notEqual(await cameraOrientation(page), original);
    await page.evaluate(() => { document.querySelector<HTMLElement>('#viewer')!.onpointermove = null; });
    await assert.rejects(gestureCamera(page, 'horizontal-positive-short'), /did not rotate/);
  } finally { await browser.close(); }
});
