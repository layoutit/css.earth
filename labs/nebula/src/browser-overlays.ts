import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

declare global { interface Window { __overlayLeaves?: Element[]; __overlayPlanes?: Element[]; __overlayScenes?: Element[]; } }
const baseURL = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = process.argv[3] ?? '.local/nebula-lab/overlays';
await mkdir(`${output}/screenshots`, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const requests: string[] = [], report: { checks: unknown[]; errors: string[]; failedRequests: [number, string][]; passed: boolean; failure?: string } =
  { checks: [], errors: [], failedRequests: [], passed: false };
page.on('request', request => requests.push(request.url()));
page.on('pageerror', error => report.errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) report.failedRequests.push([response.status(), response.url()]); });

async function ready(mode: 'photo' | 'density', subject: string) {
  await page.waitForFunction(([m, id]) => { const v = document.querySelector<HTMLElement>('#viewer');
    return v?.dataset.ready === 'true' && v.dataset.mode === m && v.dataset.subject === id; }, [mode, subject], { timeout: 30000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function state() {
  return page.evaluate(() => {
    const viewer = document.querySelector<HTMLElement>('#viewer')!, planes = [...document.querySelectorAll<HTMLElement>('[data-overlay-mesh] > s')];
    return { pose: (document.querySelector('#camera-pose') as HTMLSelectElement).value, distance: viewer.dataset.distance,
      revision: viewer.dataset.cameraRevision, scenes: [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-scene')].map(node => node.style.transform),
      leaves: document.querySelectorAll('#viewer .css-volume-mesh:not([data-overlay-mesh]) > s').length,
      planes: planes.length, visiblePlanes: planes.filter(node => getComputedStyle(node).visibility === 'visible' && Number(getComputedStyle(node).opacity) > 0).length,
      textures: planes.map(node => node.style.backgroundImage), localTransforms: planes.map(node => node.style.transform) };
  });
}
async function screenshot(name: string) { const path = `${output}/screenshots/${name}.png`; await page.locator('#viewer').screenshot({ path }); return path; }
async function imageDifference(a: string, b: string) {
  const [left, right] = await Promise.all([sharp(a).removeAlpha().raw().toBuffer(), sharp(b).removeAlpha().raw().toBuffer()]);
  assert.equal(left.length, right.length); let sum = 0, changed = 0;
  for (let i = 0; i < left.length; i++) { const delta = Math.abs(left[i]! - right[i]!); sum += delta; if (delta > 3) changed++; }
  return { mean: sum / left.length, changedFraction: changed / left.length };
}
async function toggle(id: string, opacity: number) {
  const checkbox = page.locator(`#overlay-${id}`); await checkbox.check();
  await page.waitForFunction(value => [...document.querySelectorAll<HTMLElement>('[data-overlay-mesh] > s')].filter(node => node.style.backgroundImage.includes(`/${value}.webp`)).length === 3, id);
  await checkbox.evaluate((node, value) => { const slider = node.parentElement!.querySelector<HTMLInputElement>('input[type="range"]')!;
    slider.value = String(value); slider.dispatchEvent(new Event('input', { bubbles: true })); }, opacity);
  await page.waitForFunction(([value, alpha]) => [...document.querySelectorAll<HTMLElement>('[data-overlay-mesh] > s')]
    .filter(node => node.style.backgroundImage.includes(`/${value}.webp`)).every(node => node.style.opacity === String(Number(alpha) / 100)), [id, opacity]);
}
async function identitiesHold() {
  return page.evaluate(() => { const leaves = [...document.querySelectorAll('#viewer .css-volume-mesh:not([data-overlay-mesh]) > s')];
    return Boolean(window.__overlayLeaves?.length && window.__overlayLeaves.length === leaves.length && window.__overlayLeaves.every((node, i) => node === leaves[i])); });
}
async function placementProbe(id: string) {
  return page.evaluate(value => {
    const node = document.querySelector<HTMLElement>(`[data-overlay-leaf="${value}"]`)!;
    const matrix = new DOMMatrix(node.style.transform), width = parseFloat(node.style.width), height = parseFloat(node.style.height);
    const point = (x: number, y: number) => { const p = new DOMPoint(x, y).matrixTransform(matrix); return [p.x / p.w, p.y / p.w, p.z / p.w]; };
    return { center: point(width / 2, height / 2), corner: point(0, 0), transform: node.style.transform };
  }, id);
}
async function editPlacement(key: string, value: number) {
  await page.locator(`#placement-vista-infrared-${key}`).fill(String(value));
}
async function visualSubject(id: string, overlays: [string, number][]) {
  await page.waitForFunction(count => document.querySelectorAll('#overlay-options .overlay-option').length === count, overlays.length);
  const baseline = await screenshot(`${id}-density`); for (const overlay of overlays) await toggle(...overlay);
  const overlaid = await screenshot(`${id}-overlays`), difference = await imageDifference(baseline, overlaid), value = await state();
  assert.equal(value.planes, overlays.length * 3); assert.ok(value.visiblePlanes >= overlays.length, `${id}: no visible overlay plane`);
  assert.ok(difference.mean > .1 && difference.changedFraction > .001, `${id}: overlays made no visible pixel difference`);
  report.checks.push({ id, overlays: overlays.length, leaves: value.leaves, ...difference }); return { baseline, overlaid };
}

try {
  await page.goto(`${baseURL}/?subject=lmc-particles&tab=density`, { waitUntil: 'domcontentloaded' }); await ready('density', 'lmc-particles');
  await page.waitForFunction(() => document.querySelectorAll('#overlay-options .overlay-option').length === 3);
  assert.equal(requests.filter(url => /\/lmc-overlays\/prepared\/.*\.webp(?:$|\?)/.test(url)).length, 0, 'direct density downloaded overlay pixels');
  const smashPath = '**/lmc-overlays/prepared/smash-original.webp'; let release!: () => void, intercepted!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { intercepted = resolve; });
  await page.route(smashPath, async route => { intercepted(); await hold; await route.continue(); });
  await page.locator('#overlay-smash-original').check(); await started; await page.locator('#overlay-smash-original').uncheck();
  const response = page.waitForResponse(value => value.url().endsWith('/lmc-overlays/prepared/smash-original.webp') && value.ok()); release(); await response; await page.unroute(smashPath);
  await page.waitForTimeout(100); assert.equal((await state()).visiblePlanes, 0, 'disabled pending overlay appeared after decode');
  await toggle('smash-original', 55); assert.deepEqual({ planes: (await state()).planes, visible: (await state()).visiblePlanes }, { planes: 3, visible: 3 });
  await page.locator('#overlay-smash-original').uncheck(); await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('[data-overlay-mesh] > s')].every(node => getComputedStyle(node).visibility === 'hidden'));
  await page.evaluate(() => { window.__overlayLeaves = [...document.querySelectorAll('#viewer .css-volume-mesh:not([data-overlay-mesh]) > s')]; });
  const camera = await state(); const lmc = await visualSubject('lmc', [['smash-original', 35], ['vista-infrared', 60], ['smash-extracted', 80]]);
  const toggled = await state(); assert.equal(await identitiesHold(), true, 'overlay toggle remounted density leaves');
  assert.deepEqual({ pose: toggled.pose, distance: toggled.distance, revision: toggled.revision, scenes: toggled.scenes },
    { pose: camera.pose, distance: camera.distance, revision: camera.revision, scenes: camera.scenes }, 'overlay toggle changed camera');
  await page.locator('#overlay-smash-original').uncheck(); await page.locator('#overlay-smash-extracted').uncheck();
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('[data-overlay-mesh] > s')].filter(node => getComputedStyle(node).visibility === 'visible').length === 3);
  const vista = await screenshot('lmc-vista-only'), switched = await imageDifference(lmc.overlaid, vista); assert.ok(switched.mean > .1 && switched.changedFraction > .001, 'switching overlays made no visible difference');
  await page.locator('[data-placement-for="vista-infrared"] > summary').click();
  const originalPlacement = await placementProbe('vista-infrared'), unaffected = await placementProbe('smash-original');
  const stillCamera = await state();
  await editPlacement('x', 2); await editPlacement('y', -1); await editPlacement('z', .5);
  await editPlacement('rotationZ', 90); await editPlacement('scale', 140);
  const placed = await placementProbe('vista-infrared');
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < .001, `${a} differs from ${b}`);
  placed.center.forEach((value, axis) => near(value, originalPlacement.center[axis]! + [100, -50, 25][axis]!));
  const beforeVector = originalPlacement.corner.map((value, axis) => value - originalPlacement.center[axis]!);
  const expectedVector = [-beforeVector[1]! * 1.4, beforeVector[0]! * 1.4, beforeVector[2]! * 1.4];
  placed.corner.forEach((value, axis) => near(value - placed.center[axis]!, expectedVector[axis]!));
  assert.deepEqual(await placementProbe('smash-original'), unaffected, 'placement changed another image');
  assert.equal(await identitiesHold(), true);
  assert.deepEqual((await state()).scenes, stillCamera.scenes, 'placement moved the density camera');
  const edited = await screenshot('lmc-manual-placement'); assert.ok((await imageDifference(vista, edited)).mean > .1);
  await page.locator('[data-placement-for="vista-infrared"] .overlay-tilt > summary').click();
  await editPlacement('rotationX', 30); await editPlacement('rotationY', -20);
  const tilted = await placementProbe('vista-infrared');
  tilted.center.forEach((value, axis) => near(value, placed.center[axis]!));
  assert.ok(Math.abs(tilted.corner[2]! - placed.corner[2]!) > 1, '3D tilt did not move image depth');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL).origin });
  await page.locator('#copy-placement-vista-infrared').click();
  await page.waitForFunction(() => document.querySelector('#copy-placement-vista-infrared')?.textContent === 'Copied!');
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.deepEqual(copied, { schema: 'cssearth-nebula-image-placement@1', subjectId: 'lmc-particles',
    overlayCatalogue: 'labs/nebula/models/lmc-overlays/overlays.json', imageId: 'vista-infrared',
    positionKpc: { x: 2, y: -1, z: .5 }, rotationDegrees: { x: 30, y: -20, z: 90 }, scale: 1.4, opacity: .6 });
  assert.deepEqual(await placementProbe('vista-infrared'), tilted, 'copy moved the image');
  await page.locator('#reset-placement-vista-infrared').click();
  assert.deepEqual(await placementProbe('vista-infrared'), originalPlacement, 'reset changed the original sky placement');
  await editPlacement('x', 2); const savedPlacement = await placementProbe('vista-infrared');
  await page.evaluate(() => { window.__overlayPlanes = [...document.querySelectorAll('[data-overlay-mesh] > s')]; window.__overlayScenes = window.__overlayPlanes.map(node => node.closest('.css-volume-scene')!); });
  const beforeDrag = await state(), box = await page.locator('#viewer').boundingBox(); assert.ok(box); await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .58, box.y + box.height * .42, { steps: 12 }); await page.mouse.up(); await page.waitForFunction(() => (document.querySelector('#camera-pose') as HTMLSelectElement).value === 'manual');
  const afterDrag = await state(); assert.notDeepEqual(afterDrag.scenes, beforeDrag.scenes); assert.deepEqual(afterDrag.localTransforms, beforeDrag.localTransforms);
  assert.equal(await identitiesHold(), true); assert.equal(await page.evaluate(() => window.__overlayPlanes!.every((node, i) => node === document.querySelectorAll('[data-overlay-mesh] > s')[i] && node.closest('.css-volume-scene') === window.__overlayScenes![i])), true, 'overlay plane detached from camera scene');
  await page.click('#render-tab'); await ready('photo', 'lmc-particles'); assert.equal((await state()).planes, 0); assert.equal(await page.locator('#overlay-controls').isVisible(), false);
  await page.click('#density-tab'); await ready('density', 'lmc-particles'); await page.waitForFunction(() => document.querySelectorAll('#overlay-options .overlay-option').length === 3);
  const restored = await state(); assert.deepEqual({ planes: restored.planes, visible: restored.visiblePlanes }, { planes: 3, visible: 3 }, 'density remount did not restore Vista');
  assert.equal(await page.locator('#overlay-vista-infrared').isChecked(), true); assert.equal(await page.locator('label[for="overlay-vista-infrared"] + input + input').inputValue(), '60');
  assert.deepEqual(await placementProbe('vista-infrared'), savedPlacement, 'tab switch lost manual placement');
  assert.equal(await page.locator('#placement-vista-infrared-x').inputValue(), '2');
  await page.selectOption('#subject', 'smc-particles'); await ready('density', 'smc-particles'); await page.selectOption('#camera-pose', 'front');
  await page.waitForFunction(() => (document.querySelector('#camera-pose') as HTMLSelectElement).value === 'front'); await visualSubject('smc', [['smash-original', 40], ['vista-infrared', 70]]);
  assert.equal(await page.locator('#placement-vista-infrared-x').inputValue(), '0', 'LMC placement leaked to SMC');
  await page.selectOption('#subject', 'lmc-particles'); await ready('density', 'lmc-particles');
  assert.deepEqual(await placementProbe('vista-infrared'), savedPlacement, 'subject round trip lost manual placement');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedRequests, []); report.passed = true;
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); }
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close();
console.log('OVERLAY_BROWSER_COMPLETE', JSON.stringify({ passed: report.passed, checks: report.checks.length })); process.exit(report.passed ? 0 : 1);
