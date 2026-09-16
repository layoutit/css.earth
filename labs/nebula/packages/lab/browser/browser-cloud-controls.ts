import { gestureCamera } from './browser-camera.ts';
import { chooseLabObject } from './browser-object-picker.ts';
/** Focused real-browser checks of retained prepared cloud parts and display attenuation. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

declare global { interface Window { __cloudControlLeaves?: Element[]; } }
const baseURL = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = process.argv[3] ?? '.local/nebula-lab/filled-review/cloud-controls';
const selectors = { panel: '#cloud-controls-panel', defaults: '#cloud-default', none: '#cloud-none',
  parts: 'input[data-cloud-part-id]', solo: 'button[data-cloud-solo]', brightness: '#cloud-brightness-' };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors: string[] = [], failedRequests: [number, string][] = [], requests: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedRequests.push([response.status(), response.url()]); });
page.on('request', request => requests.push(request.url()));
const report: { passed: boolean; checks: unknown[]; screenshots: string[]; errors: string[];
  failedRequests: [number, string][]; failure?: string } = { passed: false, checks: [], screenshots: [], errors, failedRequests };
const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function ready(subject = 'lmc-clouds', mode = 'photo') {
  await page.waitForFunction(([id, target]) => { const host = document.querySelector<HTMLElement>('#viewer');
    return host?.dataset.ready === 'true' && host.dataset.subject === id && host.dataset.mode === target;
  }, [subject, mode], { timeout: 60000 });
  await frame();
}
async function state() {
  return page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('#viewer')!;
    const roots = [...host.querySelectorAll<HTMLElement>('.css-volume-projection')];
    const leaves = [...host.querySelectorAll<HTMLElement>('.css-volume-mesh s')];
    const forbidden: string[] = [];
    for (const node of [host, ...host.querySelectorAll<HTMLElement>('*')]) {
      const style = getComputedStyle(node);
      if (['CANVAS', 'SVG'].includes(node.tagName)) forbidden.push(node.tagName);
      if (style.filter !== 'none' || style.clipPath !== 'none' || style.maskImage !== 'none' ||
          style.webkitMaskImage !== 'none' || style.mixBlendMode !== 'normal' || style.backgroundImage.includes('gradient'))
        forbidden.push(node.tagName + ':forbidden-style');
    }
    const parts: Record<string, number> = {};
    for (const leaf of leaves) if (leaf.dataset.cloudPart && getComputedStyle(leaf).visibility !== 'hidden')
      parts[leaf.dataset.cloudPart] = (parts[leaf.dataset.cloudPart] ?? 0) + 1;
    return { subject: host.dataset.subject, mode: host.dataset.mode, revision: host.dataset.cameraRevision,
      distance: host.dataset.distance, selection: host.dataset.cloudSelection, brightness: host.dataset.cloudBrightness,
      opacity: Number(host.dataset.cloudOpacity), computedOpacity: Number(getComputedStyle(host.querySelector('.nebula-cloud-surface') ?? host).opacity),
      rootCount: roots.length, scenes: host.querySelectorAll('.css-volume-scene').length, leaves: leaves.length,
      retained: Boolean(window.__cloudControlLeaves && leaves.length === window.__cloudControlLeaves.length &&
        leaves.every((node, i) => node === window.__cloudControlLeaves![i])),
      geometry: leaves.map(leaf => leaf.style.transform),
      scenesTransform: [...host.querySelectorAll<HTMLElement>('.css-volume-scene')].map(node => node.style.transform),
      textures: leaves.map(leaf => leaf.style.backgroundImage), parts,
      banks: roots.map(root => ({ opacity: Number(getComputedStyle(root).opacity), visible: getComputedStyle(root).visibility !== 'hidden' })), forbidden };
  });
}
type State = Awaited<ReturnType<typeof state>>;
function retained(before: State, after: State, label: string) {
  assert.equal(after.retained, true, label + ': prepared leaves were replaced');
  assert.deepEqual(after.geometry, before.geometry, label + ': geometry changed');
  assert.deepEqual(after.textures, before.textures, label + ': prepared texture URLs changed');
  assert.deepEqual(after.scenesTransform, before.scenesTransform, label + ': camera transform changed');
  assert.equal(after.distance, before.distance, label + ': camera distance changed');
  assert.equal(after.revision, before.revision, label + ': camera revision changed');
}
async function capture(name: string) {
  await frame(); const path = `${output}/${name}.png`;
  // Hide sibling controls only for image evidence; they otherwise occlude the viewer's screenshot rectangle.
  const bytes = await page.locator('#viewer').screenshot({ path, style: '.floating-panel, .image-overlay-panel { visibility: hidden !important; }' }); report.screenshots.push(path);
  const raw = await sharp(bytes).removeAlpha().raw().toBuffer();
  return { raw, mean: raw.reduce((sum, value) => sum + value, 0) / raw.length };
}
function difference(a: Buffer, b: Buffer) {
  assert.equal(a.length, b.length); let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / a.length;
}
async function control(axis: string, value: number) {
  const slider = page.locator(selectors.brightness + axis);
  assert.equal(await slider.getAttribute('min'), '0'); assert.equal(await slider.getAttribute('max'), '100');
  await slider.fill(String(value * 100)); await slider.dispatchEvent('input'); await slider.dispatchEvent('change'); await frame();
}
async function defaults() { await page.click(selectors.defaults); await frame(); }
async function parts() {
  return page.locator(selectors.parts).evaluateAll(nodes => nodes.map(node => { const input = node as HTMLInputElement;
    return { id: input.dataset.cloudPartId!, checked: input.checked, label: input.closest('label')?.textContent ?? input.getAttribute('aria-label') ?? '' }; }));
}
async function none() { await page.click(selectors.none); await frame(); }
function weightedOpacity(s: State, gains: number[], overall: number) {
  let transmission = 1, gain = 0;
  for (let i = s.banks.length - 1; i >= 0; i--) {
    const alpha = s.banks[i]!.visible ? s.banks[i]!.opacity : 0;
    gain += alpha * transmission * gains[i]!; transmission *= 1 - alpha;
  }
  return overall * gain;
}
try {
  await page.goto(`${baseURL}/?subject=lmc-clouds&tab=reconstruction`, { waitUntil: 'domcontentloaded' });
  await ready(); await page.locator(selectors.panel).waitFor({ state: 'visible', timeout: 60000 });
  if (await page.locator('#cloud-stars-enabled').isVisible()) await page.locator('#cloud-stars-enabled').uncheck();
  await page.waitForFunction(selector => document.querySelectorAll(selector).length >= 3, selectors.parts);
  await defaults(); await gestureCamera(page, 'reference'); await frame();
  for (const axis of ['overall', 'x', 'y', 'z']) await control(axis, 1);
  await page.evaluate(() => { window.__cloudControlLeaves = [...document.querySelectorAll('#viewer .css-volume-mesh s')]; });
  const fullPage = `${output}/full-page-controls.png`;
  await page.screenshot({ path: fullPage, fullPage: true }); report.screenshots.push(fullPage);
  const initial = await state(), baseline = await capture('default');
  assert.equal(initial.rootCount, 3, 'Expected one retained XYZ scene bank'); assert.equal(initial.scenes, 3);
  assert.ok(initial.leaves > 0 && baseline.mean > .05, 'Default cloud is empty'); assert.deepEqual(initial.forbidden, []);
  assert.ok(initial.textures.every(value => value.includes('/prepared/')), 'Unprepared texture entered the scene');
  const choices = await parts(), selected = choices.filter(p => p.checked);
  assert.ok(selected.length > 1, 'Individual extended pieces are unavailable');
  const requestCount = requests.length;
  const first = selected[0]!;
  await page.locator(`${selectors.parts}[data-cloud-part-id="${first.id}"]`).uncheck(); await frame();
  const off = await state(); retained(initial, off, 'one piece off');
  assert.equal(off.parts[first.id] ?? 0, 0, 'Unchecked piece leaves remain visible');
  assert.ok(difference(baseline.raw, (await capture('one-piece-off')).raw) > .0001, 'Piece toggle did not change the image');
  const solo = selected[1]!;
  await page.locator(`${selectors.solo}[data-cloud-solo="${solo.id}"]`).click(); await frame();
  assert.deepEqual((await parts()).filter(p => p.checked).map(p => p.id), [solo.id], 'Solo did not isolate one piece');
  const soloState = await state(); retained(initial, soloState, 'solo');
  assert.deepEqual(Object.keys(soloState.parts), [solo.id], 'Solo left other prepared parts visible');
  assert.ok((await capture('solo')).mean > .001, 'Solo image is empty');
  await none(); const empty = await state(); retained(initial, empty, 'all off');
  assert.deepEqual(Object.keys(empty.parts), [], 'All-off retained visible prepared parts');
  const dark = await capture('all-off'); assert.ok(dark.mean < .01, 'All-off viewer is not empty');
  await defaults(); retained(initial, await state(), 'restore default');
  assert.equal(difference(baseline.raw, (await capture('restored-default')).raw), 0, 'Default did not restore the original image');
  for (const kind of ['compact', 'diffuse']) {
    const choice = choices.find(p => (p.id + ' ' + p.label).toLowerCase().includes(kind));
    assert.ok(choice, `${kind} light type is missing`); await none();
    await page.locator(`${selectors.parts}[data-cloud-part-id="${choice.id}"]`).check(); await frame();
    const lit = await state(); retained(initial, lit, kind);
    assert.ok((lit.parts[choice.id] ?? 0) > 0, `${kind} did not enable prepared leaves`);
    assert.ok((await capture(kind)).mean > .001, `${kind} selected image is empty`);
  }
  assert.deepEqual(requests.slice(requestCount).filter(url => url.includes('/prepared/')), [], 'Selection fetched new prepared textures instead of using the retained bank');
  await defaults(); await control('overall', .5);
  const halfState = await state(); retained(initial, halfState, 'overall brightness');
  assert.ok(Math.abs(halfState.computedOpacity - .5) < 1e-6, 'Overall attenuation was not applied after the 3D scene');
  const half = await capture('overall-half'), ratio = half.mean / baseline.mean;
  assert.ok(Math.abs(ratio - .5) < .06, `Half brightness did not halve screenshot signal: ${ratio}`);
  await control('overall', 1);
  for (const [axis, value] of [['x', .2], ['y', .5], ['z', .8]] as const) await control(axis, value);
  retained(initial, await state(), 'axis brightness');
  for (const pose of ['reference', 'vertical-positive-short', 'vertical-positive-wide', 'vertical-positive-long', 'horizontal-positive-short', 'horizontal-positive-long']) {
    await gestureCamera(page, pose); await frame(); const s = await state();
    const expected = weightedOpacity(s, [.2, .5, .8], 1);
    assert.ok(Math.abs(s.opacity - expected) < 1e-6 && Math.abs(s.computedOpacity - expected) < 1e-5,
      `${pose}: attenuation does not match the effective composited axis weights`);
    report.checks.push({ pose, expected, actual: s.opacity, banks: s.banks });
  }
  // Small physical drag increments must cross an axis handoff without a discrete gain jump.
  await gestureCamera(page, 'reference'); await frame();
  const box = await page.locator('#viewer').boundingBox(); assert.ok(box);
  const gains: number[] = [(await state()).opacity];
  await page.mouse.move(box.x + box.width * .3, box.y + box.height * .5); await page.mouse.down();
  for (let i = 1; i <= 200; i++) {
    await page.mouse.move(box.x + box.width * (.3 + .002 * i), box.y + box.height * .5); await frame();
    gains.push(await page.locator('#viewer').evaluate(node => Number((node as HTMLElement).dataset.cloudOpacity)));
  }
  await page.mouse.up();
  const maxStep = Math.max(...gains.slice(1).map((value, i) => Math.abs(value - gains[i]!)));
  assert.ok(Math.max(...gains) - Math.min(...gains) > .05, 'Drag did not exercise a brightness handoff');
  await writeFile(`${output}/smooth-drag.json`, JSON.stringify({ mouseStepPixels: box.width * .002, gains, maxStep }, null, 2) + '\n');
  assert.ok(maxStep < .075, `Axis brightness jumped during smooth rotation: ${maxStep}`);
  report.checks.push({ smoothDrag: { samples: gains.length, maxStep, minimum: Math.min(...gains), maximum: Math.max(...gains) } });
  await page.locator(`${selectors.solo}[data-cloud-solo="${solo.id}"]`).click(); await control('overall', .6);
  const saved = await state(), savedParts = (await parts()).filter(p => p.checked).map(p => p.id);
  await page.click('#density-tab'); await ready('lmc-clouds', 'density');
  assert.equal(await page.locator(selectors.panel).isVisible(), false, 'Cloud controls leaked into Alignment');
  await page.click('#render-tab'); await ready();
  assert.equal((await state()).selection, saved.selection, 'Tab change lost part selection');
  assert.equal((await state()).brightness, saved.brightness, 'Tab change lost brightness');
  await chooseLabObject(page, 'lmc-clouds-broad'); await ready('lmc-clouds-broad');
  await chooseLabObject(page, 'lmc-clouds'); await ready();
  assert.equal((await state()).selection, saved.selection, 'Subject roundtrip lost part selection');
  assert.equal((await state()).brightness, saved.brightness, 'Subject roundtrip lost brightness');
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
  assert.deepEqual((await parts()).filter(p => p.checked).map(p => p.id), savedParts, 'Reload lost selected components');
  assert.equal((await state()).brightness, saved.brightness, 'Reload lost brightness');
  assert.deepEqual((await state()).forbidden, []); assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  report.checks.push({ parts: choices, halfBrightnessSignalRatio: ratio, persistence: 'tabs, subject roundtrip, reload' });
  report.passed = true;
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); }
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log('CLOUD_CONTROLS_BROWSER_COMPLETE', JSON.stringify({ passed: report.passed, screenshots: report.screenshots.length, failure: report.failure }));
await browser.close(); process.exit(report.passed ? 0 : 1);
