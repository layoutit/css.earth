// Replayable native-input stress journey. One page, no diagnostic camera writes.
import assert from 'node:assert/strict';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { OBJECTS } from '../objects.mjs';

const seed = Number(process.env.SEED ?? 9072026) >>> 0;
let randomState = seed;
const random = () => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return (randomState >>> 0) / 4294967296; };
const choose = values => values[Math.floor(random() * values.length)];
const dpr = Number(process.env.DPR ?? 1), hops = Number(process.env.HOPS ?? 20);
const origin = process.env.ORIGIN ?? 'http://127.0.0.1:4221';
const output = process.env.OUTPUT ?? `output/playwright/navigation-stress/${seed}-dpr${dpr}`;
const start = choose(OBJECTS.filter(object => object.classification === 'planet'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' });
const page = await browser.newPage({ viewport: { width: 1995, height: 1236 }, deviceScaleFactor: dpr });
const cdp = await page.context().newCDPSession(page);
const report = { seed, dpr, hops, start: start.id, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: browser.version(), actions: [], errors: [], documents: [] };
page.on('pageerror', error => report.errors.push(error.message));
page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) report.documents.push(request.url()); });
page.on('response', response => { if (response.status() >= 400) report.errors.push(`HTTP ${response.status()} ${response.url()}`); });
const state = () => page.evaluate(() => {
  const app = window.__cssEarth;
  if (!app) return { initialized: false };
  const camera = window[`__${app.activeObjectId}`]?.camera;
  const cameraState = camera?.state();
  return { active: app.activeObjectId, selected: app.selectedObjectId, ready: app.ready, error: app.error,
    overview: app.overview, distanceKm: cameraState?.distanceKilometers, camera: cameraState, url: location.href,
    scenes: document.querySelectorAll('.planet-stage > .polycss-camera').length };
});
async function mark(kind, detail = {}) {
  const entry = { kind, ...detail, state: await state() }; report.actions.push(entry);
  await page.evaluate(({ index, kind }) => performance.mark(`cssEarth:stress:${index}:${kind}`), { index: report.actions.length - 1, kind });
  console.log(JSON.stringify(entry));
}
async function ready() {
  await page.waitForFunction(() => window.__cssEarth?.ready || window.__cssEarth?.error, null, { timeout: 40000 });
  const value = await state(); assert.equal(value.error, null); assert.equal(value.scenes, 1);
}
async function drag(duration = 1200) {
  const x = 1100 + random() * 250, y = 400 + random() * 240;
  const dx = (random() - .5) * 600, dy = (random() - .5) * 380;
  await mark('drag-start', { x, y, dx, dy, duration });
  await page.mouse.move(x, y); await page.mouse.down();
  const started = performance.now(), frames = Math.ceil(duration / (1000 / 60));
  for (let i = 1; i <= frames; i++) {
    const delay = started + i * duration / frames - performance.now();
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    await page.mouse.move(x + dx * i / frames, y + dy * Math.sin(i / frames * Math.PI / 2));
  }
  await page.mouse.up(); await mark('drag-end', { elapsedMs: performance.now() - started });
}
async function wheel(delta) {
  await mark('wheel', { delta }); await page.mouse.move(1350, 570); await page.mouse.wheel(0, delta); await page.waitForTimeout(450);
}
async function candidates(preferOrbit) {
  // Geometry reads locate native input targets only; mark them separately from
  // the flight/drag intervals used for timing. Runtime picking remains guarded.
  await page.evaluate(() => performance.mark('cssEarth:stress:target-probe:start'));
  const result = await page.evaluate(({ preferOrbit, salt }) => {
    const active = window.__cssEarth.selectedObjectId;
    const annotations = [...document.querySelectorAll('[data-context-label], [data-context-indicator], [data-context-body]')];
    const chords = preferOrbit ? [...document.querySelectorAll('.context-orbit s, .context-orbit b')]
      .filter(node => node.style.display !== 'none').filter((_, index) => index % 23 === salt % 23).slice(0, 80) : [];
    return [...chords, ...annotations].flatMap(node => {
      const target = node.closest('[data-object-navigate]');
      if (!target || target.ariaDisabled === 'true' || target.dataset.objectNavigate === active ||
          !node.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return [];
      const box = node.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      if (!box.width || !box.height || x < 380 || x > innerWidth - 35 || y < 65 || y > innerHeight - 55 ||
          !document.elementFromPoint(x, y)?.closest('.planet-input-surface')) return [];
      return [{ id: target.dataset.objectNavigate, x, y, kind: target.classList.contains('context-orbit') ? 'orbit' : node.hasAttribute('data-context-label') ? 'label' : 'marker' }];
    });
  }, { preferOrbit, salt: Math.floor(random() * 1000) });
  await page.evaluate(() => performance.mark('cssEarth:stress:target-probe:end'));
  return result;
}
async function precisionWheel() {
  const sign = random() < .5 ? -1 : 1;
  const deltas = Array.from({ length: 12 }, (_, index) => sign * (index < 6 ? index + 1 : 12 - index));
  await mark('precision-wheel-start', { deltas });
  await page.mouse.move(1300, 550);
  for (const delta of deltas) { await page.mouse.wheel(0, delta); await page.waitForTimeout(12); }
  await mark('precision-wheel-end');
}
async function sidebarPick(id) {
  await page.locator('.planet-sidebar-search').fill(id);
  await page.locator(`.planet-object-link[data-object-id="${id}"]:visible`).first().click();
}
async function changeDataset() {
  const ids = await page.locator('.planet-information-panel button[name="lens"]').evaluateAll(nodes => nodes.filter(node => !node.disabled && node.getAttribute('aria-pressed') !== 'true').map(node => node.value));
  if (!ids.length) return;
  const id = choose(ids), button = page.locator(`.planet-information-panel button[name="lens"][value="${id}"]`);
  const details = button.locator('xpath=ancestor::details[1]');
  if (await details.count() && !await details.evaluate(node => node.open)) await details.locator('summary').first().click();
  await mark('dataset-pick', { id }); await button.click();
  await page.waitForFunction(id => {
    const runtime = window[`__${window.__cssEarth.activeObjectId}`];
    const selection = runtime?.runtime.selection();
    return runtime?.lenses?.state().id === id && selection?.committed?.lensId === id && !selection.pending;
  }, id, { timeout: 30000 });
  await mark('dataset-ready', { id });
}
async function pickTarget(hop) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const visible = await candidates(hop % 4 === 0);
    const orbits = visible.filter(target => target.kind === 'orbit');
    if (visible.length) return choose(orbits.length ? orbits : visible);
    await wheel(choose([300, 600, 900]));
    if (attempt % 3 === 2) await drag(500);
  }
  // A real sidebar choice is allowed when the current projection has no body
  // targets; record it explicitly rather than pretending it was a scene pick.
  const current = (await state()).selected;
  return { id: choose(OBJECTS.filter(object => object.id !== current)).id, kind: 'sidebar' };
}
let tracing = false;
try {
  await page.goto(`${origin}${start.route}`); await ready();
  await page.evaluate(() => {
    window.__cssEarthRecorder.start();
    const roots = ['.planet-stage', '.planet-input-surface', '.prepared-universe'].map(selector => document.querySelector(selector));
    const leaves = [...roots[2].querySelectorAll('*')];
    window.__stressIdentity = () => roots.every(node => node.isConnected) && leaves.every(node => node.isConnected);
    window.__stressSelections = [];
    document.addEventListener('objectnavigate', event => window.__stressSelections.push({ id: event.detail.objectId, at: performance.now() }), { capture: true });
    document.elementsFromPoint = () => { throw new Error('Runtime picking forced DOM hit testing'); };
  });
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.frame,toplevel,viz', transferMode: 'ReturnAsStream' }); tracing = true;
  report.documentsBeforeChain = report.documents.length;
  report.timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await mark('start');
  for (let hop = 0; hop < hops; hop++) {
    await ready();
    if (hop % 5 === 2) await changeDataset();
    await drag(choose([1400, 2600, 4200]));
    await wheel(choose([-100, 100, 300, 600]));
    if (hop % 3 === 0) { await precisionWheel(); await wheel(choose([-100, -300])); }
    if (hop % 2 === 0) await drag(choose([800, 1600]));
    const target = await pickTarget(hop);
    await mark('pick', { hop, target });
    const selectionCount = await page.evaluate(() => window.__stressSelections.length);
    if (target.kind === 'sidebar') {
      await sidebarPick(target.id);
    } else {
      await page.mouse.move(target.x, target.y); await page.waitForTimeout(80);
      await page.mouse.click(target.x, target.y);
    }
    const requested = target.kind === 'sidebar' ? [{ id: target.id }] :
      await page.evaluate(count => window.__stressSelections.slice(count), selectionCount);
    assert.ok(requested.length <= 1, 'One native click cannot publish competing selections');
    if (!requested.length) {
      await mark('moving-target-miss', { hop, target });
      report.misses = (report.misses ?? 0) + 1;
      assert.ok(report.misses < hops * 3, 'Repeated misses prevent meaningful scene navigation');
      hop--; continue;
    }
    await mark('selection', { hop, intended: target.id, requested: requested[0].id });
    await page.waitForFunction(() => !window.__cssEarth.ready, null, { timeout: 1500 }).catch(() => {});
    const interrupt = hop % 6 === 3;
    const supersede = hop % 6 === 1;
    // Inertia can move intersecting orbits beneath the pointer between the
    // target probe and click. The published selection owns the ensuing flight.
    let expectedId = requested[0].id;
    if (supersede) {
      await page.waitForTimeout(150 + random() * 450);
      expectedId = choose(OBJECTS.filter(object => object.id !== target.id)).id;
      await mark('supersede', { hop, id: expectedId }); await sidebarPick(expectedId);
    } else if (interrupt) {
      await page.waitForTimeout(120 + random() * 650);
      const mode = choose(['wheel', 'drag', 'escape']); await mark('interrupt', { hop, mode });
      if (mode === 'wheel') await wheel(choose([-100, 100]));
      else if (mode === 'drag') await drag(700);
      else { await page.locator('.planet-input-surface').focus(); await page.keyboard.press('Escape'); }
    } else {
      for (let move = 0; move < 20; move++) {
        await page.mouse.move(900 + random() * 700, 250 + random() * 550);
        await page.waitForTimeout(30);
      }
    }
    await ready();
    const after = await state();
    if (!interrupt) assert.equal(after.active, expectedId, `Native ${target.kind} pick must reach ${expectedId}`);
    assert.equal(await page.evaluate(() => window.__stressIdentity()), true, 'Universe and input retain their identities');
    await mark('landed', { hop, interrupt, supersede });
    if (hop % 5 === 0) await page.screenshot({ path: `${output}/hop-${hop}.png` });
    assert.deepEqual(report.errors, []);
  }
  assert.equal(report.documents.length, report.documentsBeforeChain, 'The entire chain stays in one document');
  assert.equal(await page.evaluate(() => performance.timeOrigin), report.timeOrigin, 'Navigation preserves the document time origin');
} catch (error) { report.failure = error.stack; }
finally {
  if (tracing) {
    const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve)); await cdp.send('Tracing.end');
    const { stream } = await done, file = await open(`${output}/trace.json`, 'w');
    try { for (;;) { const part = await cdp.send('IO.read', { handle: stream }); await file.write(part.data); if (part.eof) break; } }
    finally { await file.close(); await cdp.send('IO.close', { handle: stream }); }
  }
  report.final = await state().catch(() => null);
  const diagnostics = await page.evaluate(() => { window.__cssEarthRecorder?.stop(); return window.__cssEarthRecorder?.lastRecording ?? null; }).catch(() => null);
  await writeFile(`${output}/diagnostics.json`, JSON.stringify(diagnostics));
  await page.screenshot({ path: `${output}/final.png` }).catch(() => {});
  await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
if (report.failure) throw new Error(report.failure);
console.log(`STRESS PASS seed=${seed} DPR=${dpr} hops=${hops}`);
