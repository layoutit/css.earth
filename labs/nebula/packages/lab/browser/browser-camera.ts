import assert from 'node:assert/strict';
import type { Page } from 'playwright';

/** Read the rendered rotation, independent of object translation or framing scale. */
export async function cameraOrientation(page: Page): Promise<string> {
  return page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>('#viewer .css-volume-scene');
    if (!scene) throw new Error('No rendered camera scene.');
    const m = new DOMMatrix(scene.style.transform || getComputedStyle(scene).transform);
    return JSON.stringify([[m.m11,m.m12,m.m13],[m.m21,m.m22,m.m23],[m.m31,m.m32,m.m33]]
      .flatMap(row => { const norm = Math.hypot(...row); return row.map(value => Number((value / norm).toFixed(6))); }));
  });
}
export async function settleCamera(page: Page): Promise<void> {
  await page.evaluate(async () => {
    let previous = '', stable = 0;
    for (let frame = 0; frame < 180; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const current = [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-scene')]
        .map(scene => scene.style.transform || getComputedStyle(scene).transform).join('|');
      stable = current === previous ? stable + 1 : 0; previous = current;
      if (stable >= 3) return;
    }
    throw new Error('Camera transform did not settle.');
  });
}
export async function earthCamera(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>('#reference-view');
    return Boolean(button && !button.disabled && button.getAttribute('aria-disabled') !== 'true');
  });
  await page.locator('#reference-view').click();
  await settleCamera(page);
}
/** Prefer the configured Earth reference; otherwise use the public initial-camera reset. */
export async function referenceCamera(page: Page): Promise<'earth' | 'initial'> {
  await page.waitForFunction(() => ['#reference-view', '#reset'].some(selector => {
    const button = document.querySelector<HTMLButtonElement>(selector);
    return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
  }));
  if (await page.locator('#reference-view').count()) { await earthCamera(page); return 'earth'; }
  await page.locator('#reset').click(); await settleCamera(page); return 'initial';
}
/** Screenshot names describe input gestures, never inferred physical angles. */
export async function gestureCamera(page: Page, view: string): Promise<void> {
  await referenceCamera(page);
  if (view === 'reference') return;
  const box = await page.locator('#viewer').boundingBox(); assert.ok(box);
  const before = await cameraOrientation(page);
  const vertical = view.startsWith('vertical'), negative = view.includes('negative');
  const travel = view.includes('wide') ? .28 : view.includes('long') ? .4 : .14;
  const delta = (negative ? -1 : 1) * travel;
  const x = box.x + box.width * .5, y = box.y + box.height * .5;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + (vertical ? 0 : box.width * delta), y + (vertical ? box.height * delta : 0), { steps: 20 });
  await page.mouse.up(); await settleCamera(page);
  assert.notEqual(await cameraOrientation(page), before, `${view}: pointer drag did not rotate the scene`);
}
