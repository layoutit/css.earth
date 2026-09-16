import { settleCamera } from './browser-camera.ts';
import { chooseLabObject } from './browser-object-picker.ts';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

declare global { interface Window { __overlayLeaves?: Element[]; } }
interface Placement { x: number; y: number; z: number; rotationX: number; rotationY: number; rotationZ: number; scale: number; }
interface Overlay { id: string; label: string; texturePath: string; initialPlacement?: Placement; initialOpacity?: number;
  legacyPlacementBasis?: string; style: { width: string; height: string }; }
interface Catalogue { referenceDistanceUnits?: number; overlays: Overlay[]; }
interface Subject { id: string; density?: { directory: string; overlays?: string }; }
interface ImageWcs { referenceDimension: [number, number]; referencePixel: [number, number]; scaleDeg: [number, number]; rotationDeg: number; }

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = process.argv[3] ?? '.local/nebula-lab/overlays';
const subjects = JSON.parse(await readFile('labs/nebula/packages/lab/src/state/subjects.json', 'utf8')) as Subject[];
const subjectById = (id: string) => {
  const subject = subjects.find(value => value.id === id);
  assert.ok(subject?.density?.overlays, `${id}: overlay catalogue is unavailable`); return subject;
};
const catalogueFor = async (id: string) => JSON.parse(await readFile(subjectById(id).density!.overlays!, 'utf8')) as Catalogue;
const [lmc, smc] = await Promise.all([catalogueFor('lmc-particles'), catalogueFor('smc-particles')]);
const recipe = JSON.parse(await readFile('labs/nebula/models/image-overlays.json', 'utf8')) as
  { targets: { directory: string; images: { id: string; wcs: ImageWcs }[] }[] };
const lmcRecipe = recipe.targets.find(target => target.directory === 'labs/nebula/models/lmc/overlays');
assert.ok(lmcRecipe, 'LMC overlay recipe is unavailable');
assert.ok(lmc.overlays.length >= 3, 'LMC needs three images for the selection race gate');
assert.ok(smc.overlays.length >= 1, 'SMC needs an image for isolation gates');
const identity: Placement = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 };
await mkdir(`${output}/screenshots`, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
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
async function panelReady(subject: string, catalogue: Catalogue) {
  await ready('density', subject); await page.locator('#image-overlay-panel').waitFor({ state: 'visible' });
  await page.waitForFunction(count => document.querySelectorAll('#overlay-choice option').length === count, catalogue.overlays.length);
}
async function state() {
  return page.evaluate(() => {
    const viewer = document.querySelector<HTMLElement>('#viewer')!, planes = [...document.querySelectorAll<HTMLElement>('[data-overlay-mesh] > s')];
    return { pose: JSON.stringify((() => { const m = new DOMMatrix(document.querySelector<HTMLElement>('#viewer .css-volume-scene')!.style.transform); return [[m.m11,m.m12,m.m13],[m.m21,m.m22,m.m23],[m.m31,m.m32,m.m33]].flatMap(row => { const norm = Math.hypot(...row); return row.map(value => Number((value / norm).toFixed(6))); }); })()), distance: viewer.dataset.distance,
      revision: viewer.dataset.cameraRevision, scenes: [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-scene')].map(node => node.style.transform),
      densityTextures: [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-mesh:not([data-overlay-mesh]) > s')].map(node => node.style.backgroundImage),
      planes: planes.map(node => ({ id: node.dataset.overlayLeaf!, transform: node.style.transform,
        visible: getComputedStyle(node).visibility === 'visible' && Number(getComputedStyle(node).opacity) > 0,
        opacity: node.style.opacity, texture: node.style.backgroundImage })) };
  });
}
async function selected(id: string) {
  await page.waitForFunction(value => {
    const panel = document.querySelector<HTMLElement>('#image-overlay-panel'), choice = document.querySelector<HTMLSelectElement>('#overlay-choice');
    const visible = [...document.querySelectorAll<HTMLElement>('[data-overlay-mesh] > s')]
      .filter(node => getComputedStyle(node).visibility === 'visible' && Number(getComputedStyle(node).opacity) > 0);
    return panel?.dataset.selectedOverlay === value && choice?.value === value && visible.length === 3 && visible.every(node => node.dataset.overlayLeaf === value);
  }, id, { timeout: 30000 });
}
async function choose(id: string) { await page.selectOption('#overlay-choice', id); await selected(id); }
async function placementProbe(id: string) {
  return page.evaluate(value => [...document.querySelectorAll<HTMLElement>(`[data-overlay-leaf="${value}"]`)].map(node => node.style.transform), id);
}
async function edit(id: string, key: keyof Placement, value: number) {
  await page.locator(`#placement-${id}-${key}`).fill(String(key === 'scale' ? value * 100 : value));
}
const cameraOnly = (value: Awaited<ReturnType<typeof state>>) =>
  ({ pose: value.pose, distance: value.distance, revision: value.revision, scenes: value.scenes });
async function assertControls(id: string, seeded: boolean) {
  const host = page.locator(`[data-placement-for="${id}"]`); await host.waitFor({ state: 'visible' });
  assert.notEqual(await host.evaluate(node => node.tagName), 'DETAILS', 'placement controls are disclosure-hidden');
  for (const key of ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotationZ', 'scale'] as const) {
    assert.equal(await page.locator(`#placement-${id}-${key}`).isVisible(), true, `${key} number input hidden`);
    assert.equal(await page.locator(`#placement-${id}-${key}-range`).isVisible(), true, `${key} range hidden`);
  }
  assert.equal(await page.locator(`#reset-placement-${id}`).isVisible(), true);
  assert.equal(await page.locator(`#copy-placement-${id}`).isVisible(), true);
  assert.equal(await page.locator(`#original-placement-${id}`).count(), seeded ? 1 : 0);
  const scaleRange = page.locator(`#placement-${id}-scale-range`), scaleNumber = page.locator(`#placement-${id}-scale`);
  assert.deepEqual({ min: await scaleRange.getAttribute('min'), max: await scaleRange.getAttribute('max') }, { min: '1', max: '2000' });
  assert.equal(await scaleNumber.getAttribute('max'), null, 'numeric scale is unexpectedly capped');
  assert.match(await host.locator('.placement-hint').innerText(), /100% is calibrated sky scale/);
  if (seeded) assert.equal(await page.locator(`#original-placement-${id}`).innerText(), 'Calibrated sky');
}
async function screenshot(name: string) { const path = `${output}/screenshots/${name}.png`; await page.locator('#viewer').screenshot({ path }); return path; }
async function imageDifference(a: string, b: string) {
  const [left, right] = await Promise.all([sharp(a).removeAlpha().raw().toBuffer(), sharp(b).removeAlpha().raw().toBuffer()]);
  assert.equal(left.length, right.length); let sum = 0, changed = 0;
  for (let i = 0; i < left.length; i++) { const delta = Math.abs(left[i]! - right[i]!); sum += delta; if (delta > 3) changed++; }
  return { mean: sum / left.length, changedFraction: changed / left.length };
}
async function values(id: string): Promise<Placement> {
  const result = {} as Placement;
  for (const key of ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotationZ', 'scale'] as const) {
    const shown = Number(await page.locator(`#placement-${id}-${key}`).inputValue()); result[key] = key === 'scale' ? shown / 100 : shown;
  }
  return result;
}
function cardinalPixels(overlay: Overlay, wcs: ImageWcs) {
  const width = Number.parseFloat(overlay.style.width), height = Number.parseFloat(overlay.style.height);
  const [sx, sy] = wcs.scaleDeg, angle = wcs.rotationDeg * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const [a, b, c, d] = [sx * cos, -sy * sin, sx * sin, sy * cos], determinant = a * d - b * c;
  const sourceDelta = (east: number, north: number) => [(d * east - b * north) / determinant, (-c * east + a * north) / determinant];
  const ratioX = width / wcs.referenceDimension[0], ratioY = height / wcs.referenceDimension[1];
  const center = [wcs.referencePixel[0] * ratioX, (wcs.referenceDimension[1] - wcs.referencePixel[1]) * ratioY];
  const point = ([dx, dyUp]: number[]) => [center[0]! + dx! * ratioX, center[1]! - dyUp! * ratioY];
  return { center, east: point(sourceDelta(.2, 0)), north: point(sourceDelta(0, .2)) };
}
async function projectedCardinals(id: string, points: ReturnType<typeof cardinalPixels>) {
  return page.evaluate(({ imageId, positions }) => {
    const nodes = [...document.querySelectorAll<HTMLElement>(`[data-overlay-leaf="${imageId}"]`)];
    const node = nodes.sort((left, right) => Number(getComputedStyle(right.closest('.css-volume-projection')!).opacity) -
      Number(getComputedStyle(left.closest('.css-volume-projection')!).opacity))[0]!;
    const projected = Object.fromEntries(Object.entries(positions).map(([key, [x, y]]) => {
      const marker = document.createElement('i'); marker.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:1px;height:1px`;
      node.append(marker); const bounds = marker.getBoundingClientRect(); marker.remove(); return [key, [bounds.x, bounds.y]];
    })) as Record<'center' | 'east' | 'north', [number, number]>;
    return { ...projected, hostTransform: getComputedStyle(document.querySelector('#viewer')!).transform };
  }, { imageId: id, positions: points });
}
async function assertOneActive(id: string) {
  const value = await state(), visible = value.planes.filter(plane => plane.visible);
  assert.equal(visible.length, 3, 'selection did not produce one three-bank image');
  assert.ok(visible.every(plane => plane.id === id), 'selection left another image active');
  for (const image of lmc.overlays) assert.ok(value.planes.filter(plane => plane.id === image.id).length <= 3, `${image.id}: duplicate planes`);
}
async function setTone(target: 'density' | 'image', key: 'brightness' | 'gamma' | 'black' | 'white', value: number) {
  const input = page.locator(`#${target}-tone-${key}`); await input.fill(String(value)); await input.press('Tab');
  await page.locator(`[data-tone-target="${target}"] .tone-status`).filter({ hasText: 'Tone applied' }).waitFor({ timeout: 30000 });
}

try {
  const first = lmc.overlays[0]!, pending = lmc.overlays[1]!, latest = lmc.overlays[2]!;
  const pendingUrl = `**/lmc-overlays/${pending.texturePath}`; let release!: () => void, intercepted!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { intercepted = resolve; });
  await page.route(pendingUrl, async route => { intercepted(); await hold; await route.continue(); });
  await page.goto(`${baseURL}/?subject=lmc-particles&tab=density`, { waitUntil: 'domcontentloaded' }); await panelReady('lmc-particles', lmc);
  assert.equal(await page.locator('#overlay-choice option').count(), lmc.overlays.length, 'LMC selector count differs from manifest');
  assert.equal(await page.locator('#overlay-choice').inputValue(), first.id, 'wrong manifest-default image selection');
  assert.equal(await page.locator('#image-overlay-panel').getAttribute('data-selected-overlay'), first.id);
  const header = page.locator('.lab-header'), headerControls = page.locator('.header-controls');
  assert.equal(await header.isVisible(), true); assert.equal(await headerControls.isVisible(), true);
  for (const selector of ['#subject', '#render-controls', '#density-view-controls']) {
    assert.equal(await page.locator(`${selector}`).evaluate(node => Boolean(node.closest('.header-controls'))), true, `${selector} remains outside the compact header`);
  }
  const [densityPanelBox, imagePanelBox] = await Promise.all([
    page.locator('#density-adjustment-panel').boundingBox(), page.locator('#image-overlay-panel').boundingBox(),
  ]);
  assert.ok(densityPanelBox && imagePanelBox); assert.ok(densityPanelBox.x < 720, 'density adjustments are not on the left');
  assert.ok(imagePanelBox.x > 720, 'image adjustments are not on the right');
  assert.equal(await page.locator(`#overlay-${first.id}`).isChecked(), false, 'default selection unexpectedly loaded pixels');
  assert.deepEqual(lmc.overlays.filter(item => requests.some(url => url.includes(`/lmc-overlays/${item.texturePath}`))).map(item => item.id), [],
    'clean context loaded an unrequested overlay image');
  assert.match(await page.locator('#overlay-status').innerText(), new RegExp(`^1 of ${lmc.overlays.length} images$`));
  assert.equal(Number((await state()).distance), lmc.referenceDistanceUnits, 'initial Density camera is not the Earth observer distance');

  await page.selectOption('#overlay-choice', pending.id); await started;
  await page.selectOption('#overlay-choice', latest.id); await selected(latest.id); release();
  await page.waitForTimeout(150); await assertOneActive(latest.id);
  assert.equal((await state()).planes.filter(plane => plane.id === pending.id).length, 0, 'stale decode mounted a plane');

  const densityOnly = await screenshot('lmc-density'); await choose(first.id); const withOverlay = await screenshot('lmc-selected-image');
  const difference = await imageDifference(densityOnly, withOverlay);
  assert.ok(difference.mean > .1 && difference.changedFraction > .001, 'selected image made no visible difference');
  assert.deepEqual(await values(first.id), first.initialPlacement, 'SMASH did not start at the manifest fit');
  assert.equal(await page.locator('#overlay-opacity').inputValue(), String(Math.round((first.initialOpacity ?? .55) * 100)));
  assert.deepEqual(first.initialPlacement, { x: -1.2, y: -1.7, z: 0, rotationX: 0, rotationY: 0, rotationZ: 39, scale: 3 });
  assert.equal(first.initialOpacity, .29);
  for (const overlay of lmc.overlays) {
    assert.deepEqual(overlay.initialPlacement && { rotationX: overlay.initialPlacement.rotationX, rotationY: overlay.initialPlacement.rotationY,
      rotationZ: overlay.initialPlacement.rotationZ, scale: overlay.initialPlacement.scale }, { rotationX: 0, rotationY: 0, rotationZ: 39, scale: 3 },
    `${overlay.id}: common LMC fit was not transferred over its sky registration`);
    assert.equal(overlay.initialOpacity, .29, `${overlay.id}: common LMC opacity missing`);
  }
  await assertControls(first.id, true);
  const beforeScaleLimit = await placementProbe(first.id);
  await page.locator(`#placement-${first.id}-scale-range`).evaluate(node => {
    (node as HTMLInputElement).value = '2000'; node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal((await values(first.id)).scale, 20, '2000% slider did not publish scale 20');
  assert.notDeepEqual(await placementProbe(first.id), beforeScaleLimit, 'scale 20 did not reach retained planes');
  await page.locator(`#placement-${first.id}-scale`).fill('2500');
  assert.equal((await values(first.id)).scale, 25, 'uncapped numeric scale did not publish above the slider maximum');
  await page.locator(`#reset-placement-${first.id}`).click();
  assert.deepEqual(await values(first.id), first.initialPlacement, 'Reset fit did not recover from extreme scale');

  const firstRecipe = lmcRecipe.images.find(image => image.id === first.id); assert.ok(firstRecipe, 'selected image WCS is unavailable');
  await page.locator(`#original-placement-${first.id}`).click();
  const cardinalPoints = cardinalPixels(first, firstRecipe.wcs);
  const cardinal = await projectedCardinals(first.id, cardinalPoints);
  assert.match(cardinal.hostTransform, /^matrix\(-1, 0, 0, 1, 0, 0\)$/, 'Density host reflection is absent');
  assert.ok(cardinal.east[0] < cardinal.center[0], 'celestial East does not project left');
  assert.ok(cardinal.north[1] < cardinal.center[1], 'celestial North does not project up');
  const box = await page.locator('#viewer').boundingBox(); assert.ok(box);
  await page.waitForFunction(() => document.querySelector('#viewer')?.getAttribute('aria-busy') === 'false');
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .58, box.y + box.height * .42, { steps: 12 }); await page.mouse.up();
  await settleCamera(page);
  const dragged = await projectedCardinals(first.id, cardinalPoints);
  assert.ok(dragged.center[0] > cardinal.center[0], 'rightward drag moved the sky landmark left');
  await page.click('#reference-view'); await settleCamera(page);
  await page.locator(`#reset-placement-${first.id}`).click();

  await page.evaluate(() => { window.__overlayLeaves = [...document.querySelectorAll('#viewer .css-volume-mesh:not([data-overlay-mesh]) > s')]; });
  const neutral = await state(), neutralImageTextures = neutral.planes.filter(plane => plane.id === first.id).map(plane => plane.texture);
  await setTone('density', 'gamma', 1.4); const densityToned = await state();
  assert.notDeepEqual(densityToned.densityTextures, neutral.densityTextures, 'density tone did not replace density resources');
  assert.deepEqual(densityToned.planes.filter(plane => plane.id === first.id).map(plane => plane.texture), neutralImageTextures,
    'density tone changed image resources');
  await setTone('image', 'gamma', 2); const bothToned = await state();
  assert.notDeepEqual(bothToned.planes.filter(plane => plane.id === first.id).map(plane => plane.texture), neutralImageTextures,
    'image tone did not replace image resources');
  assert.deepEqual(bothToned.densityTextures, densityToned.densityTextures, 'image tone changed density resources');
  assert.deepEqual(cameraOnly(bothToned), cameraOnly(neutral), 'tone controls changed the camera');
  assert.equal(await page.evaluate(() => window.__overlayLeaves!.every((node, index) => node === document.querySelectorAll('#viewer .css-volume-mesh:not([data-overlay-mesh]) > s')[index])), true,
    'tone controls remounted density leaves');
  await page.locator('#reset-image-tone').click(); await page.selectOption('#overlay-choice', pending.id); await selected(pending.id);
  await choose(first.id); await page.locator('[data-tone-target="image"] .tone-status').filter({ hasText: 'Tone applied' }).waitFor({ timeout: 30000 });
  assert.deepEqual({ brightness: await page.locator('#image-tone-brightness').inputValue(), gamma: await page.locator('#image-tone-gamma').inputValue(),
    black: await page.locator('#image-tone-black').inputValue(), white: await page.locator('#image-tone-white').inputValue() },
  { brightness: '1', gamma: '1', black: '0', white: '1' }, 'reset/select/return left non-neutral image controls');
  assert.ok((await state()).planes.filter(plane => plane.id === first.id).every(plane =>
    plane.texture.includes('/lmc-overlays/prepared/smash-original.webp') && !plane.texture.includes('/tone-cache/')),
  'cancelled reset left stale toned image resources');
  await setTone('image', 'brightness', 1.25);

  await page.evaluate(() => { window.__overlayLeaves = [...document.querySelectorAll('#viewer .css-volume-mesh:not([data-overlay-mesh]) > s')]; });
  const camera = await state(), untouched = await placementProbe(latest.id); let prior = await placementProbe(first.id);
  for (const [key, next] of [['x', 2], ['y', -1], ['z', .5], ['rotationZ', 90], ['scale', 1.4], ['rotationX', 30], ['rotationY', -20]] as [keyof Placement, number][]) {
    await edit(first.id, key, next); const changed = await placementProbe(first.id);
    assert.notDeepEqual(changed, prior, `${key} did not change selected planes`); prior = changed;
  }
  assert.deepEqual(await placementProbe(latest.id), untouched, 'placement changed another retained image');
  assert.deepEqual(cameraOnly(await state()), cameraOnly(camera), 'image placement changed the Earth-view camera');
  assert.equal(await page.evaluate(() => window.__overlayLeaves!.every((node, index) => node === document.querySelectorAll('#viewer .css-volume-mesh:not([data-overlay-mesh]) > s')[index])), true,
    'image editing remounted density leaves');
  await page.locator('#overlay-opacity').fill('61');
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('[data-overlay-leaf="smash-original"]')].every(node => node.style.opacity === '0.61'));
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL).origin });
  await page.locator(`#copy-placement-${first.id}`).click(); await page.waitForFunction(id => document.querySelector(`#copy-placement-${id}`)?.textContent === 'Copied!', first.id);
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.deepEqual(copied, { schema: 'cssearth-nebula-image-placement@1', subjectId: 'lmc-particles',
    overlayCatalogue: subjectById('lmc-particles').density!.overlays, imageId: first.id,
    positionKpc: { x: 2, y: -1, z: .5 }, rotationDegrees: { x: 30, y: -20, z: 90 }, scale: 1.4, opacity: .61,
    tone: { brightness: 1.25, gamma: 1, black: 0, white: 1 } });

  await page.locator(`#reset-placement-${first.id}`).click(); assert.deepEqual(await values(first.id), first.initialPlacement, 'Reset fit lost the seed');
  const fitted = await placementProbe(first.id); await page.locator(`#original-placement-${first.id}`).click();
  assert.deepEqual(await values(first.id), identity, 'Calibrated sky is not identity');
  assert.notDeepEqual(await placementProbe(first.id), fitted, 'Calibrated sky did not differ from fitted placement');
  await edit(first.id, 'x', 2); const savedFirst = await placementProbe(first.id);

  await choose(pending.id); await assertControls(pending.id, Boolean(pending.initialPlacement));
  await edit(pending.id, 'x', 7); await page.locator('#overlay-opacity').fill('44'); await setTone('image', 'brightness', 1.25);
  const savedPending = await placementProbe(pending.id);
  await page.click('#render-tab'); await ready('photo', 'lmc-particles');
  assert.equal((await state()).planes.length, 0); assert.equal(await page.locator('#image-overlay-panel').isVisible(), false);
  const densityObject = `**/${subjectById('lmc-particles').density!.directory}/object.json`;
  await page.route(densityObject, async route => { await new Promise(resolve => setTimeout(resolve, 250)); await route.continue(); });
  await page.click('#density-tab'); await panelReady('lmc-particles', lmc); await selected(pending.id);
  await page.locator('[data-tone-target="density"] .tone-status').filter({ hasText: 'Tone applied' }).waitFor({ timeout: 30000 });
  await page.unroute(densityObject);
  assert.equal(await page.locator('#density-tone-gamma').inputValue(), '1.4', 'slow photo-to-density lost saved tone');
  assert.ok((await state()).densityTextures.every(url => url.includes('/tone-cache/')), 'saved density tone applied before payload readiness and was skipped');
  assert.equal(await page.locator('#overlay-choice').inputValue(), pending.id); assert.deepEqual(await placementProbe(pending.id), savedPending);
  assert.equal(await page.locator('#overlay-opacity').inputValue(), '44');

  await chooseLabObject(page, 'smc-particles'); await panelReady('smc-particles', smc);
  assert.equal(await page.locator('#overlay-choice option').count(), smc.overlays.length, 'SMC selector count differs from manifest');
  const smcFirst = smc.overlays[0]!; assert.equal(await page.locator('#overlay-choice').inputValue(), smcFirst.id);
  assert.deepEqual(await values(smcFirst.id), smcFirst.initialPlacement ?? identity, 'LMC placement leaked to SMC');
  await page.locator(`#overlay-${smcFirst.id}`).check(); await selected(smcFirst.id); await edit(smcFirst.id, 'x', -3);
  await chooseLabObject(page, 'lmc-particles'); await panelReady('lmc-particles', lmc); await selected(pending.id);
  assert.deepEqual(await placementProbe(pending.id), savedPending, 'subject round trip lost selected placement');
  await choose(first.id); assert.deepEqual(await placementProbe(first.id), savedFirst, 'per-image state was not retained');
  await choose(pending.id);

  await page.reload({ waitUntil: 'domcontentloaded' }); await panelReady('lmc-particles', lmc); await selected(pending.id);
  assert.equal(await page.locator('#overlay-choice').inputValue(), pending.id, 'reload lost selected image');
  assert.deepEqual(await placementProbe(pending.id), savedPending, 'reload lost placement');
  assert.equal(await page.locator('#overlay-opacity').inputValue(), '44', 'reload lost opacity');
  assert.equal(await page.locator('#viewer').getAttribute('data-overlay-storage'), 'saved'); await assertOneActive(pending.id);
  assert.equal(await page.locator('#density-tone-gamma').inputValue(), '1.4', 'reload lost density tone controls');
  assert.equal(await page.locator('#image-tone-brightness').inputValue(), '1.25', 'reload lost image tone controls');
  await page.locator('[data-tone-target="density"] .tone-status').filter({ hasText: 'Tone applied' }).waitFor({ timeout: 30000 });
  await page.locator('[data-tone-target="image"] .tone-status').filter({ hasText: 'Tone applied' }).waitFor({ timeout: 30000 });
  const reloadedTone = await state(); assert.ok(reloadedTone.densityTextures.every(url => url.includes('/tone-cache/')));
  assert.ok(reloadedTone.planes.filter(plane => plane.id === pending.id).every(plane => plane.texture.includes('/tone-cache/')));

  const legacy = lmc.overlays.find(overlay => overlay.legacyPlacementBasis); assert.ok(legacy, 'manifest has no legacy placement basis');
  const legacyPlacement: Placement = { x: 8.35, y: -4.2, z: 1.15, rotationX: 12.5, rotationY: -7.25, rotationZ: 67.5, scale: 6.25 };
  await page.evaluate(({ catalogue, id, basis, placement }) => {
    localStorage.setItem('cssearth-nebula-overlay-state-v1', JSON.stringify({ schema: 'cssearth-nebula-overlay-state@1', catalogues: [[catalogue, [
      { id, enabled: true, opacity: .37, placement, basis },
    ]]] }));
    localStorage.setItem(`cssearth-nebula-selected-overlay:${catalogue}`, id);
    localStorage.setItem('cssearth-nebula-tone-state-v1', JSON.stringify({ schema: 'cssearth-nebula-tone-state@1', values: [[
      `image:lmc-particles:${id}`, { brightness: 1.6, gamma: 1.35, black: .04, white: .92 },
    ]] }));
  }, { catalogue: subjectById('lmc-particles').density!.overlays!, id: legacy.id, basis: legacy.legacyPlacementBasis!, placement: legacyPlacement });
  await page.reload({ waitUntil: 'domcontentloaded' }); await panelReady('lmc-particles', lmc); await selected(legacy.id);
  assert.deepEqual(await values(legacy.id), legacyPlacement, 'new manifest discarded legacy-basis placement');
  assert.equal(await page.locator('#overlay-opacity').inputValue(), '37', 'legacy-basis opacity was not restored');
  assert.deepEqual({ brightness: await page.locator('#image-tone-brightness').inputValue(), gamma: await page.locator('#image-tone-gamma').inputValue(),
    black: await page.locator('#image-tone-black').inputValue(), white: await page.locator('#image-tone-white').inputValue() },
  { brightness: '1.6', gamma: '1.35', black: '0.04', white: '0.92' }, 'legacy placement migration disturbed image tone');
  await page.locator('[data-tone-target="image"] .tone-status').filter({ hasText: 'Tone applied' }).waitFor({ timeout: 30000 });
  await page.reload({ waitUntil: 'domcontentloaded' }); await panelReady('lmc-particles', lmc); await selected(legacy.id);
  assert.deepEqual(await values(legacy.id), legacyPlacement, 'migrated placement did not survive a second reload');
  assert.equal(await page.locator('#image-tone-gamma').inputValue(), '1.35', 'migrated image tone did not survive a second reload');
  await page.screenshot({ path: `${output}/screenshots/lmc-density-controls-final.png`, fullPage: true });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedRequests, []);
  report.checks.push({ subject: 'lmc-particles', manifestImages: lmc.overlays.length, selected: pending.id, ...difference },
    { subject: 'smc-particles', manifestImages: smc.overlays.length, isolated: true },
    { pendingSelectionRace: true, localStorageReload: true, controlsVisible: true }); report.passed = true;
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); }
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close();
console.log('OVERLAY_BROWSER_COMPLETE', JSON.stringify({ passed: report.passed, checks: report.checks.length })); process.exit(report.passed ? 0 : 1);
