/** Real prepared-density-filter browser checks; no synthetic scene or browser pixel processing. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Route } from 'playwright';
import sharp from 'sharp';

type Filter = { cutoff: number; softness: number; showRemoved: boolean };
declare global { interface Window {
  __densityLeaves?: HTMLElement[];
  __densitySwapObserver?: MutationObserver;
  __densitySwapChanges?: number[];
} }
const baseURL = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = process.argv[3] ?? '.local/nebula-lab/filled-review/cloud-density';
const cutoff = Number(process.env.NEBULA_TEST_DENSITY_CUTOFF ?? '.1');
const softness = Number(process.env.NEBULA_TEST_DENSITY_SOFTNESS ?? '.15');
const endpoint = '**/__nebula/prepare-cloud-density';
const ui = { cutoff: '#cloud-density-cutoff', softness: '#cloud-density-softness',
  removed: '#cloud-density-show-removed', reset: '#reset-cloud-density', apply: '#apply-cloud-density' };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [], failedRequests: [number, string][] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedRequests.push([response.status(), response.url()]); });
const report: { passed: boolean; checks: unknown[]; screenshots: string[]; errors: string[];
  failedRequests: [number, string][]; failure?: string } = { passed: false, checks: [], screenshots: [], errors, failedRequests };
const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function ready(mode = 'photo') {
  await page.waitForFunction(target => { const h = document.querySelector<HTMLElement>('#viewer');
    return h?.dataset.ready === 'true' && h.dataset.subject === 'lmc-clouds' && h.dataset.mode === target;
  }, mode, { timeout: 60000 }); await frame();
}
async function settled(filter: Filter) {
  await page.waitForFunction(expected => {
    const h = document.querySelector<HTMLElement>('#viewer');
    if (document.querySelector('#cloud-density-controls [data-error="true"]')) return true;
    if (h?.dataset.cloudDensityReady !== 'true') return false;
    try { const actual = JSON.parse(h.dataset.cloudDensityFilter ?? 'null');
      return actual && Math.abs(actual.cutoff - expected.cutoff) < 1e-9 &&
        Math.abs(actual.softness - expected.softness) < 1e-9 && actual.showRemoved === expected.showRemoved;
    } catch { return false; }
  }, filter, { timeout: 120000 });
  assert.equal(await page.locator('#cloud-density-controls [data-error="true"]').count(), 0,
    await page.locator('#cloud-density-controls [role="status"]').innerText());
  await frame();
}
async function slider(selector: string, value: number) {
  const control = page.locator(selector), max = Number(await control.getAttribute('max'));
  assert.ok(max === 1 || max === 100, `${selector}: unsupported slider units`);
  await control.fill(String(value * max)); await control.dispatchEvent('input'); await control.dispatchEvent('change');
}
async function setFilter(filter: Filter) {
  await slider(ui.softness, filter.softness); await slider(ui.cutoff, filter.cutoff);
  const togglesRemoved = await page.locator(ui.removed).isChecked() !== filter.showRemoved;
  await page.locator(ui.removed).setChecked(filter.showRemoved);
  if (!togglesRemoved) await page.click(ui.apply);
  await settled(filter);
}
async function state() {
  return page.evaluate(() => {
    const h = document.querySelector<HTMLElement>('#viewer')!;
    const leaves = [...h.querySelectorAll<HTMLElement>('.css-volume-mesh s')];
    const forbidden = [...h.querySelectorAll<HTMLElement>('*')].flatMap(node => {
      const s = getComputedStyle(node), reasons: string[] = [];
      if (['CANVAS', 'SVG'].includes(node.tagName)) reasons.push(node.tagName);
      if (s.filter !== 'none' || s.clipPath !== 'none' || s.maskImage !== 'none' || s.webkitMaskImage !== 'none' ||
          s.mixBlendMode !== 'normal' || s.backgroundImage.includes('gradient')) reasons.push('forbidden-style');
      return reasons;
    });
    return { mode: h.dataset.mode, filter: h.dataset.cloudDensityFilter, readiness: h.dataset.cloudDensityReady,
      distance: h.dataset.distance, revision: h.dataset.cameraRevision, brightness: h.dataset.cloudBrightness,
      selection: h.dataset.cloudSelection, opacity: getComputedStyle(h).opacity,
      roots: h.querySelectorAll('.css-volume-projection').length,
      geometry: leaves.map(n => n.style.transform), textures: leaves.map(n => n.style.backgroundImage),
      camera: [...h.querySelectorAll<HTMLElement>('.css-volume-scene')].map(n => n.style.transform),
      retained: Boolean(window.__densityLeaves?.length === leaves.length && leaves.every((n, i) => n === window.__densityLeaves![i])), forbidden };
  });
}
type State = Awaited<ReturnType<typeof state>>;
function unchangedGeometry(before: State, after: State, label: string) {
  assert.equal(after.retained, true, label + ': leaves were replaced');
  for (const key of ['geometry', 'camera', 'distance', 'revision'] as const)
    assert.deepEqual(after[key], before[key], label + ': camera or geometry changed');
  assert.deepEqual(after.forbidden, [], label + ': forbidden runtime rendering');
}
async function capture(name: string) {
  await frame(); const path = `${output}/${name}.png`;
  const bytes = await page.locator('#viewer').screenshot({ path,
    style: '.floating-panel, .image-overlay-panel { visibility:hidden!important; }' });
  report.screenshots.push(path);
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const luma = Float64Array.from({ length: info.width * info.height }, (_, p) =>
    .2126 * data[3 * p]! + .7152 * data[3 * p + 1]! + .0722 * data[3 * p + 2]!);
  return { data, luma, width: info.width, height: info.height,
    signal: luma.reduce((sum, value) => sum + value, 0) };
}
type Image = Awaited<ReturnType<typeof capture>>;
function difference(a: Image, b: Image) {
  assert.equal(a.data.length, b.data.length); let absolute = 0, changed = 0;
  for (let i = 0; i < a.data.length; i++) { const d = Math.abs(a.data[i]! - b.data[i]!); absolute += d; if (d > 2) changed++; }
  return { meanAbsolute: absolute / a.data.length, changedFraction: changed / a.data.length };
}
function spatialEvidence(before: Image, after: Image) {
  let cx = 0, cy = 0;
  for (let p = 0; p < before.luma.length; p++) { cx += (p % before.width) * before.luma[p]!; cy += Math.floor(p / before.width) * before.luma[p]!; }
  cx /= before.signal; cy /= before.signal;
  const lit = [...before.luma.keys()].filter(p => before.luma[p]! > 5);
  const radius = (p: number) => Math.hypot(p % before.width - cx, Math.floor(p / before.width) - cy);
  lit.sort((a, b) => radius(a) - radius(b));
  const core = lit.slice(0, Math.floor(lit.length * .35)), outer = lit.slice(Math.floor(lit.length * .75));
  const retained = (pixels: number[]) => pixels.reduce((s, p) => s + after.luma[p]!, 0) / pixels.reduce((s, p) => s + before.luma[p]!, 0);
  const dropped = lit.filter(p => after.luma[p]! < before.luma[p]! * .1).length;
  const hueErrors: number[] = [];
  for (const p of lit) {
    if (before.luma[p]! < 30 || after.luma[p]! < before.luma[p]! * .98) continue;
    const a = [...before.data.subarray(p * 3, p * 3 + 3)], b = [...after.data.subarray(p * 3, p * 3 + 3)];
    const aa = Math.max(...a), bb = Math.max(...b);
    hueErrors.push(Math.max(...a.map((v, i) => Math.abs(v / aa - b[i]! / bb))));
  }
  hueErrors.sort((a, b) => a - b);
  return { centroid: [cx, cy], litPixels: lit.length, coreRetention: retained(core), outerRetention: retained(outer),
    stronglyAttenuatedPixels: dropped, retainedBrightPixels: hueErrors.length,
    retainedHueMedianError: hueErrors[Math.floor(hueErrors.length / 2)] ?? null,
    retainedHueP90Error: hueErrors[Math.floor(hueErrors.length * .9)] ?? null };
}
async function beginAtomicMonitor() {
  await page.evaluate(() => {
    const leaves = [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-mesh s')];
    const original = leaves.map(n => n.style.backgroundImage); window.__densitySwapChanges = [0];
    window.__densitySwapObserver = new MutationObserver(() => window.__densitySwapChanges!.push(
      leaves.reduce((sum, n, i) => sum + Number(n.style.backgroundImage !== original[i]), 0)));
    window.__densitySwapObserver.observe(document.querySelector('#viewer')!, { subtree: true, attributes: true, attributeFilter: ['style'] });
  });
}
try {
  await page.goto(`${baseURL}/?subject=lmc-clouds&tab=reconstruction`, { waitUntil: 'domcontentloaded' }); await ready();
  await page.locator(ui.cutoff).waitFor({ state: 'visible', timeout: 60000 });
  if (await page.locator('#cloud-stars-enabled').isVisible()) await page.locator('#cloud-stars-enabled').uncheck();
  await page.click('#cloud-default'); await page.click('#cloud-brightness-reset');
  await page.selectOption('#camera-pose', 'front'); await page.click(ui.reset);
  const neutral: Filter = { cutoff: 0, softness: 0, showRemoved: false };
  // Reset softness is a UI default, not part of neutral-image semantics.
  neutral.softness = Number(await page.locator(ui.softness).inputValue()) / Number(await page.locator(ui.softness).getAttribute('max'));
  await settled(neutral);
  await page.evaluate(() => { window.__densityLeaves = [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-mesh s')]; });
  const initial = await state(), before = await capture('before'); assert.equal(initial.roots, 3); assert.ok(before.signal > 1000);
  const fullUI = `${output}/full-ui.png`; await page.screenshot({ path: fullUI, fullPage: true }); report.screenshots.push(fullUI);
  await beginAtomicMonitor();
  const hard: Filter = { cutoff, softness: 0, showRemoved: false }; await setFilter(hard);
  const hardState = await state(), after = await capture('after'); unchangedGeometry(initial, hardState, 'density cutoff');
  await page.locator(ui.cutoff).waitFor({ state: 'visible' });
  await page.screenshot({ path: `${output}/full-ui-filtered.png`, fullPage: true }); report.screenshots.push(`${output}/full-ui-filtered.png`);
  const changes = await page.evaluate(() => { window.__densitySwapObserver?.disconnect(); return window.__densitySwapChanges!; });
  const finalChanges = hardState.textures.reduce((n, value, i) => n + Number(value !== initial.textures[i]), 0);
  assert.ok(finalChanges > 0, 'Cutoff did not transport new prepared texture URLs');
  assert.ok(changes.every(value => value === 0 || value === finalChanges), 'A partially decoded texture bank was presented');
  assert.ok(difference(before, after).changedFraction > .001, 'Cutoff has no meaningful image effect');
  const spatial = spatialEvidence(before, after); report.checks.push({ hard, difference: difference(before, after), spatial, atomicChangedLeaves: finalChanges });
  assert.ok(spatial.stronglyAttenuatedPixels > 100, 'Cutoff did not remove spatial support');
  assert.ok(spatial.coreRetention > spatial.outerRetention + .03, 'Cutoff is not retaining central light more than outer support');
  assert.ok(spatial.retainedBrightPixels > 50 && spatial.retainedHueMedianError !== null && spatial.retainedHueMedianError < .025,
    'Colors changed materially where bright light is retained');
  const soft: Filter = { cutoff, softness, showRemoved: false }; await setFilter(soft);
  const softened = await capture('softened'); unchangedGeometry(initial, await state(), 'softness');
  assert.ok(difference(after, softened).changedFraction > .0001, 'Softness has no real edge effect');
  const removed: Filter = { ...soft, showRemoved: true }; await setFilter(removed);
  const removedImage = await capture('removed'); unchangedGeometry(initial, await state(), 'removed preview');
  assert.ok(removedImage.signal > before.signal * .001, 'Removed-light preview is empty');
  assert.ok(difference(softened, removedImage).changedFraction > .001, 'Removed preview equals retained image');
  await page.click(ui.reset); await settled(neutral);
  assert.deepEqual((await state()).textures, initial.textures, 'Reset did not restore original resource URLs');
  report.checks.push({ resetRenderDifference: difference(before, await capture('reset')) });
  await setFilter(hard); const filtered = await capture('filtered-again');
  await slider('#cloud-brightness-overall', .5); await frame();
  const half = await capture('filtered-half-brightness'); assert.ok(Math.abs(half.signal / filtered.signal - .5) < .06, 'Brightness no longer attenuates filtered light');
  await slider('#cloud-brightness-overall', 1);
  const piece = page.locator('input[data-cloud-part-id]:checked').first(); await piece.uncheck(); await frame();
  assert.ok(difference(filtered, await capture('filtered-piece-off')).changedFraction > .0001, 'Part selection no longer affects filtered pixels');
  await page.click('#cloud-default');

  // Delay an actual old server response, then ensure a newer filter wins atomically.
  let heldRoute: Route | undefined, release!: () => void, intercepted!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { intercepted = resolve; });
  const staleCutoff = cutoff / 2;
  await page.route(endpoint, async route => {
    const body = route.request().postDataJSON() as { filter: Filter };
    if (!heldRoute && Math.abs(body.filter.cutoff - staleCutoff) < 1e-9) {
      heldRoute = route; const response = await route.fetch(); intercepted(); await hold;
      await route.fulfill({ response }).catch(() => undefined);
    } else await route.continue();
  });
  await slider(ui.cutoff, staleCutoff); await page.click(ui.apply);
  await Promise.race([reached, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Old filter response was not intercepted')), 120000))]);
  await setFilter(soft);
  const newest = await state(); release(); await page.unroute(endpoint); await page.waitForTimeout(500);
  assert.equal((await state()).filter, newest.filter, 'Stale response replaced latest filter state');
  assert.deepEqual((await state()).textures, newest.textures, 'Stale response overwrote latest prepared texture bank');
  // Exact full-bank URL/state identity above proves latest-wins. Chromium can
  // rasterize the same translucent leaves slightly differently after repaint;
  // record screenshots diagnostically rather than require bit-identical pixels.
  report.checks.push({ latestWinsRenderDifference: difference(softened, await capture('latest-wins')) });
  await setFilter(hard);
  await page.click('#density-tab'); await ready('density');
  assert.equal(await page.locator(ui.cutoff).isVisible(), false, 'Reconstruction density filter leaked into Alignment');
  await page.click('#render-tab'); await ready(); await settled(hard);
  assert.deepEqual((await state()).textures, hardState.textures, 'Tab switch lost prepared filter URLs');
  report.checks.push({ tabRenderDifference: difference(filtered, await capture('tab-restored')) });
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await settled(hard);
  assert.deepEqual((await state()).textures, hardState.textures, 'Reload lost prepared filter URLs');
  report.checks.push({ reloadRenderDifference: difference(filtered, await capture('reload-restored')) });
  assert.deepEqual((await state()).forbidden, []); assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  report.checks.push({ softnessDifference: difference(after, softened), removedSignalFraction: removedImage.signal / before.signal,
    filteredHalfBrightnessRatio: half.signal / filtered.signal, persistence: 'tab and reload', staleResponse: 'older real response released after newer filter applied' });
  report.passed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.stack ?? error.message : String(error);
  await page.screenshot({ path: `${output}/failure-ui.png`, fullPage: true }).catch(() => undefined);
}
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log('CLOUD_DENSITY_BROWSER_COMPLETE', JSON.stringify({ passed: report.passed, screenshots: report.screenshots.length, failure: report.failure }));
await browser.close(); process.exit(report.passed ? 0 : 1);
