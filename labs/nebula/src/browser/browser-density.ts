import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = process.argv[3] ?? '.local/nebula-lab/density';
const shots = `${output}/screenshots`;
const subjects = JSON.parse(await readFile('labs/nebula/src/subjects.json', 'utf8')) as
  { id: string; directory: string; imagePath?: string; density?: { directory: string; overlays?: string } }[];
const lmc = subjects.find(subject => subject.id === 'lmc-particles');
assert.ok(lmc?.density, 'LMC density subject is unavailable');
assert.ok(lmc.density.overlays, 'LMC overlay catalogue is unavailable');
const lmcOverlays = JSON.parse(await readFile(lmc.density.overlays, 'utf8')) as
  { referenceDistanceUnits?: number; overlays: { id: string; texturePath: string }[] };
const smc = subjects.find(subject => subject.id === 'smc-particles');
assert.ok(smc?.density?.overlays, 'SMC overlay catalogue is unavailable');
const smcOverlays = JSON.parse(await readFile(smc.density.overlays, 'utf8')) as
  { referenceDistanceUnits?: number; overlays: { id: string; texturePath: string }[] };
const densityPath = `/${lmc.density.directory}/`, photoPath = `/${lmc.directory}/`;
const overlayPath = lmc.density.overlays ? `/${lmc.density.overlays.slice(0, lmc.density.overlays.lastIndexOf('/') + 1)}prepared/` : null;
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report: { subjects: unknown[]; transitions: unknown[]; errors: string[]; failedRequests: [number, string][]; passed: boolean; failure?: string } =
  { subjects: [], transitions: [], errors: [], failedRequests: [], passed: false };
const requests: string[] = [];
page.on('pageerror', error => report.errors.push(error.message));
page.on('request', request => requests.push(request.url()));
page.on('response', response => { if (response.status() >= 400) report.failedRequests.push([response.status(), response.url()]); });

async function ready(mode = 'density', subject?: string) {
  await page.waitForFunction(([m, id]) => { const v = document.querySelector<HTMLElement>('#viewer');
    return v?.dataset.ready === 'true' && v.dataset.mode === m && (!id || v.dataset.subject === id); }, [mode, subject], { timeout: 30000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function state() {
  return page.evaluate(() => {
    const roots = [...document.querySelectorAll<HTMLElement>('#viewer > .css-volume-projection')];
    const forbiddenNodes = [...document.querySelectorAll('canvas,svg')].map(node => node.nodeName);
    const forbiddenStyles = [...document.querySelectorAll('*')].flatMap(node => { const s = getComputedStyle(node), bad = [];
      if (s.clipPath !== 'none') bad.push('clip-path'); if (s.maskImage !== 'none' || s.webkitMaskImage !== 'none') bad.push('mask');
      if (s.filter !== 'none') bad.push('filter'); if (s.backgroundImage.includes('gradient')) bad.push('gradient');
      if (s.mixBlendMode !== 'normal') bad.push('blend-mode'); return bad; });
    return { mode: document.querySelector<HTMLElement>('#viewer')?.dataset.mode, pose: (document.querySelector('#camera-pose') as HTMLSelectElement).value,
      distance: document.querySelector<HTMLElement>('#viewer')?.dataset.distance, roots: roots.length,
      imageBanks: document.querySelectorAll('#viewer > .prepared-image-layer-bank').length,
      scenes: document.querySelectorAll('#viewer .css-volume-scene').length, leaves: document.querySelectorAll('#viewer .css-volume-mesh s').length,
      transforms: [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-scene')].map(node => node.style.transform),
      textures: [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-mesh s')].map(node => node.style.backgroundImage),
      forbiddenNodes, forbiddenStyles };
  });
}
function validScene(value: Awaited<ReturnType<typeof state>>, id: string) {
  assert.equal(value.roots, 3, `${id}: expected one three-bank volume`); assert.equal(value.imageBanks, 0, `${id}: photograph bank mounted`);
  assert.equal(value.scenes, 3, `${id}: expected one scene per bank`); assert.ok(value.leaves > 0, `${id}: no prepared geometry`);
  assert.deepEqual(value.forbiddenNodes, [], `${id}: forbidden scene node`); assert.deepEqual(value.forbiddenStyles, [], `${id}: forbidden runtime style`);
}
async function capture(id: string, pose: 'front' | 'y-plus-60') {
  await page.selectOption('#camera-pose', pose); await page.waitForFunction(p => (document.querySelector('#camera-pose') as HTMLSelectElement).value === p, pose);
  const path = `${shots}/${id}-${pose}.png`; await page.locator('#viewer').screenshot({ path });
  const stats = await sharp(path).grayscale().stats(); assert.ok(stats.channels[0]!.mean > .15 && stats.channels[0]!.stdev > .5, `${id}/${pose}: screenshot is blank`);
  const value = await state(); validScene(value, `${id}/${pose}`); return { id, pose, path, leaves: value.leaves, mean: stats.channels[0]!.mean, stdev: stats.channels[0]!.stdev };
}
async function dragAndZoom() {
  const box = await page.locator('#viewer').boundingBox(); assert.ok(box, 'viewer has no bounds'); const before = await state();
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .58, box.y + box.height * .42, { steps: 12 }); await page.mouse.up();
  await page.waitForFunction(() => (document.querySelector('#camera-pose') as HTMLSelectElement).value === 'manual');
  await page.mouse.wheel(0, -450); await page.waitForFunction(d => document.querySelector<HTMLElement>('#viewer')?.dataset.distance !== d, before.distance);
  await page.waitForTimeout(350); const after = await state(); assert.notDeepEqual(after.transforms, before.transforms, 'drag did not change scene transform'); return after;
}

try {
  await page.goto(`${baseURL}/?subject=lmc-particles&tab=density`, { waitUntil: 'domcontentloaded' }); await ready('density', 'lmc-particles');
  await page.waitForFunction(count => document.querySelectorAll('#overlay-choice option').length === count, lmcOverlays.overlays.length);
  const direct = await state(); validScene(direct, 'lmc-particles/direct');
  assert.equal(direct.pose, 'front', 'direct Density did not use the Earth observer pose');
  assert.equal(Number(direct.distance), lmcOverlays.referenceDistanceUnits, 'direct Density did not use the Earth observer distance');
  assert.equal(await page.locator('#image-overlay-panel').isVisible(), true, 'image placement panel is not visible');
  assert.equal(await page.locator('#overlay-choice').inputValue(), lmcOverlays.overlays[0]!.id, 'default selection differs from the overlay manifest');
  assert.equal(await page.locator(`#overlay-${lmcOverlays.overlays[0]!.id}`).isChecked(), false, 'default selection requested image pixels');
  const prepared = requests.filter(url => url.includes('/prepared/')); assert.ok(prepared.length > 0, 'direct density loaded no prepared resources');
  assert.ok(prepared.every(url => url.includes(`${densityPath}prepared/`)), 'direct density loaded non-density prepared resources');
  assert.ok(requests.every(url => !url.includes(`${photoPath}prepared/`) && (!lmc.imagePath || !url.includes(`/${lmc.imagePath}`)) && (!overlayPath || !url.includes(overlayPath))), 'direct density requested photograph resources');
  const referenceTransforms = direct.transforms;
  await page.click('#fit-cloud'); await page.waitForFunction(distance => document.querySelector<HTMLElement>('#viewer')?.dataset.distance !== distance, direct.distance);
  await page.click('#reference-view'); await page.waitForFunction(distance => Number(document.querySelector<HTMLElement>('#viewer')?.dataset.distance) === distance, lmcOverlays.referenceDistanceUnits);
  assert.deepEqual((await state()).transforms, referenceTransforms, 'Reference view did not restore the Earth observer world transform');
  report.subjects.push(await capture('lmc-particles', 'front'));
  assert.equal(await page.locator('[role="tab"]').count(), 2, 'obsolete lab tabs remain');
  assert.equal(await page.locator('#source-tab, #structure-tab').count(), 0, 'removed research tabs remain in the UI');
  await page.goto(`${baseURL}/?subject=lmc-particles&tab=structure`, { waitUntil: 'domcontentloaded' }); await ready('density', 'lmc-particles');
  assert.equal(new URL(page.url()).searchParams.get('tab'), 'alignment', 'legacy Structure URL did not fall back to Alignment');
  await page.selectOption('#axis', 'z'); const max = Number(await page.locator('#layer').getAttribute('max')); assert.ok(max >= 0, 'density has no inspectable slabs');
  await page.locator('#layer').evaluate((node, value) => { (node as HTMLInputElement).value = String(value); node.dispatchEvent(new Event('input', { bubbles: true })); }, Math.floor(max / 2));
  assert.notEqual(await page.locator('#layer').getAttribute('aria-valuetext'), 'All layers', 'density slab selection did not publish'); await page.click('#all-layers'); await page.selectOption('#axis', 'auto');
  report.subjects.push(await capture('lmc-particles', 'y-plus-60')); const retained = await dragAndZoom();
  await page.click('#render-tab'); await ready('photo', 'lmc-particles'); const photo = await state();
  assert.equal(photo.pose, retained.pose); assert.equal(photo.distance, retained.distance); assert.deepEqual(photo.transforms, retained.transforms);
  await page.click('#density-tab'); await ready('density', 'lmc-particles'); const density = await state();
  assert.equal(density.pose, retained.pose); assert.equal(density.distance, retained.distance); assert.deepEqual(density.transforms, retained.transforms);
  report.transitions.push({ from: 'density', through: 'photo', to: 'density', pose: retained.pose, distance: retained.distance });
  await page.selectOption('#subject', 'm31'); await ready('density', 'm31'); assert.match(await page.locator('#status').innerText(), /No independent density field/);
  assert.equal((await state()).roots, 0, 'unavailable density retained a scene'); assert.equal(await page.locator('#source-image').isVisible(), false, 'unavailable density displayed a photograph');
  await page.selectOption('#subject', 'smc-particles'); await ready('density', 'smc-particles');
  await page.waitForFunction(count => document.querySelectorAll('#overlay-choice option').length === count, smcOverlays.overlays.length);
  assert.equal(Number((await state()).distance), smcOverlays.referenceDistanceUnits, 'unseen SMC did not open at its Earth observer distance');
  assert.equal(await page.locator('#overlay-choice').inputValue(), smcOverlays.overlays[0]!.id, 'SMC default selection differs from its manifest');
  report.subjects.push(await capture('smc-particles', 'front'), await capture('smc-particles', 'y-plus-60'));
  await page.route(`**${densityPath}**`, async route => { await new Promise(resolve => setTimeout(resolve, 120)); await route.continue(); });
  await page.goto(`${baseURL}/?subject=lmc-particles&tab=reconstruction`, { waitUntil: 'domcontentloaded' }); await ready('photo', 'lmc-particles');
  await page.click('#density-tab'); await page.click('#render-tab'); await ready('photo', 'lmc-particles'); await page.waitForTimeout(500);
  const final = await state(); validScene(final, 'rapid-switch'); assert.equal(await page.locator('#render-tab').getAttribute('aria-selected'), 'true');
  assert.ok(final.textures.every(url => url.includes(`${photoPath}prepared/`)), 'rapid switch left wrong representation');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedRequests, []); report.transitions.push({ rapid: 'density-to-render', finalMode: final.mode }); report.passed = true;
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); }
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close();
console.log('DENSITY_BROWSER_COMPLETE', JSON.stringify({ passed: report.passed, subjects: report.subjects.length, transitions: report.transitions.length }));
process.exit(report.passed ? 0 : 1);
