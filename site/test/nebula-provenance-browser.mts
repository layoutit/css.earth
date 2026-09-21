/** The seven shipped volume packages' real source UI, within one retained Sun document. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { validatePreparedVolumeLenses } from '../../src/renderers/css/dist/universe.js';
import { parseSharedView } from '../../src/renderers/css/dist/navigation.js';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import { sourceCitationUrl } from '../../src/platform/source-catalog.mts';
import { SOURCES } from '../sources-catalog.mts';
import { parsePreparedVolumePresentation } from '../volume-presentation.mts';
import { requireRecord } from '../../tools/source-values.mts';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = resolve(process.argv[3] ?? 'output/nebula-provenance-browser');
const ids = ['lmc', 'm1', 'm45', 'm8', 'm42', 'helix', 'm2-9'];
const additionalImages = new Set(['m1/webb-infrared', 'm1/chandra-xray', 'm1/vla-radio', 'm45/noirlab-optical', 'lmc/horalek-widefield']);
const pins: { path: string; bytes: number; sha256: string }[] = [];
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function pin(path: string): Promise<Buffer> {
  const bytes = await readFile(path); pins.push({ path, bytes: bytes.length, sha256: hash(bytes) }); return bytes;
}
async function json(path: string): Promise<unknown> { return JSON.parse((await pin(path)).toString('utf8')); }
await mkdir(output, { recursive: true });
await pin('src/objects/sun/prepared/world-context.json');
const subjects = await Promise.all(ids.map(async id => {
  const payload = validatePreparedVolumeLenses(requireRecord(await json(`src/objects/${id}/prepared/lenses.json`)).data);
  const provenance = validateObjectProvenance(await json(`src/objects/${id}/prepared/provenance.json`), id);
  const presentation = parsePreparedVolumePresentation(await json(`src/objects/${id}/prepared/presentation.json`), payload, provenance);
  await pin(`src/objects/${id}/source/manifest.json`);
  await pin(`src/objects/${id}/object.json`);
  return { id, payload, provenance, presentation };
}));
assert.equal(subjects.reduce((sum, subject) => sum + subject.payload.lenses.length, 0), 23);
for (const path of ['site/test/nebula-provenance-browser.mts', 'site/test/browser-observations.mts',
  'site/components/DatasetDescription.astro', 'site/components/SelectedContent.astro', 'site/components/DatasetContextPanels.astro',
  'site/components/PreparedFocusLenses.astro', 'site/volume-presentation.mts', 'site/dataset-context.mts',
  'site/prepared-sources.json', 'site/prepared-facilities.json']) await pin(path);
const browser = await chromium.launch({ headless: true });
const viewport = { width: 1440, height: 1000 }, deviceScaleFactor = 1;
const page = await browser.newPage({ viewport, deviceScaleFactor, reducedMotion: 'reduce' });
page.setDefaultTimeout(30_000);
const errors: string[] = [], failed: string[] = [], navigations: string[] = [], cases: unknown[] = [], screenshots: unknown[] = [];
const served: { path: string; contentType: string; bytes: number; sha256: string }[] = [];
const pendingResponses: Promise<void>[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url()); });
page.on('response', response => {
  if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  const url = new URL(response.url()), kind = response.request().resourceType();
  if (response.status() !== 200 || url.origin !== new URL(origin).origin ||
    !(['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(kind) || url.pathname.includes('/datasets/'))) return;
  pendingResponses.push((async () => {
    const bytes = await response.body(); served.push({ path: url.pathname + url.search,
      contentType: response.headers()['content-type'] ?? '', bytes: bytes.length, sha256: hash(bytes) });
  })().catch(error => { errors.push(`Could not pin served response ${url.pathname}: ${String(error)}`); }));
});
const report = { result: 'RUNNING', command: `node site/test/nebula-provenance-browser.mts ${origin} ${relative(process.cwd(), output)}`,
  scope: 'Application provenance and source UI for seven volume objects and 23 lenses. This does not qualify scientific reconstruction, image fidelity, absolute brightness, source restoration, mobile layout or unrelated object routes.',
  testedRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirtyFiles: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean),
  origin, browser: browser.version(), viewport, deviceScaleFactor, reducedMotion: 'reduce',
  inputAndCodePins: pins, servedResponseMethod: 'SHA-256 of actual response bodies consumed by this browser: HTML, scripts, styles, fetched data and source previews. Each pinned prepared lens bank also carries its texture resource hashes.',
  servedResponses: served, cases, screenshots, errors, failedResponses: failed, navigationRequests: navigations };
const save = () => writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const camera = async () => {
  const token = new URL(page.url()).searchParams.get('v');
  const decoded = token ? parseSharedView(`v=${token}`) : null;
  assert.ok(decoded, 'The production camera must have its shared URL representation.');
  const transforms = await page.locator('.planet-stage .polycss-camera > .polycss-scene')
    .evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform));
  return { token, decoded: decoded.camera, transforms };
};
const settledCamera = async () => {
  await page.waitForFunction(() => new URL(location.href).searchParams.has('v'));
  let previous = '', unchanged = 0;
  for (let attempt = 0; attempt < 100; attempt++) {
    const current = JSON.stringify(await camera());
    unchanged = current === previous ? unchanged + 1 : 0;
    if (unchanged === 4) return;
    previous = current; await page.waitForTimeout(150);
  }
  throw new Error('The public navigation camera did not settle.');
};

try {
  assert.equal((await page.goto(`${origin}/sun/?focus=lmc`, { waitUntil: 'domcontentloaded' }))?.status(), 200);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', undefined, { timeout: 30_000 });
  await page.locator('[data-focus-lens-bank="lmc"]').waitFor({ state: 'visible' });
  const stage = await page.locator('.planet-stage').elementHandle(); assert.ok(stage);
  for (const { id, payload, provenance, presentation } of subjects) {
    console.log(`NEBULA_PROVENANCE_OBJECT ${id}`);
    if (new URL(page.url()).searchParams.get('focus') !== id) {
      const search = page.locator('.planet-sidebar-search'); await search.fill(id);
      await page.locator(`.planet-object-link[data-prepared-focus-id="${id}"]`).click();
      await page.locator(`[data-focus-lens-bank="${id}"]`).waitFor({ state: 'visible' });
      await search.fill('');
    }
    await settledCamera();
    const bank = page.locator(`[data-focus-lens-bank="${id}"]`), card = page.locator('[data-prepared-focus-card]');
    const runtimeBank = await page.locator(`[data-volume-lens-object="${id}"]`).elementHandle(); assert.ok(runtimeBank);
    assert.equal(await bank.locator('[data-focus-lens]').count(), payload.lenses.length);
    for (const lens of presentation.controls) {
      const before = await camera();
      const button = bank.locator(`[data-focus-lens][value="${lens.id}"]`);
      assert.equal((await button.innerText()).trim(), lens.label, 'Dataset rows name their source image.');
      await button.click();
      await page.waitForFunction(({ id, lens }) => document.querySelector(`[data-volume-lens-object="${id}"]`)?.getAttribute('data-selected-lens') === lens, { id, lens: lens.id });
      const selected = page.locator(`.planet-dataset-context-rail [data-dataset-context-owner="${id}"]:not([hidden]) [data-dataset-context="${lens.id}"]:not([hidden])`);
      await selected.waitFor({ state: 'visible' });
      const detail = bank.locator(`[data-focus-lens-details="${lens.id}"]`);
      await detail.waitFor({ state: 'visible' });
      const summary = (await detail.locator('.planet-lens-details-copy').innerText()).trim();
      const description = await detail.locator('.planet-lens-details-copy').getAttribute('title');
      assert.equal(summary, lens.summary ?? lens.description);
      assert.equal(description, null, 'Nebula datasets use the same visible summary treatment as bodies.');
      assert.match(summary, /model|conditional|inferred|reconstruct|illustrative|simulated|assumed|relative emission/iu,
        `${id}/${lens.id}: visible copy must disclose the interpreted model, beyond a hover title.`);
      const preview = await detail.locator('.planet-lens-texture').evaluate(async node => {
        if (!(node instanceof HTMLImageElement)) throw new TypeError('A source preview must be an image.');
        await node.decode(); return { src: node.currentSrc, width: node.naturalWidth, height: node.naturalHeight, alt: node.alt };
      });
      assert.ok(lens.texture); assert.equal(new URL(preview.src).pathname, lens.texture.url);
      assert.equal(preview.width, lens.texture.width); assert.equal(preview.height, lens.texture.height);
      const ownSources = provenance.sources.filter(source => source.lensId === lens.id);
      const sourceIds = [...new Set(ownSources.flatMap(source => source.sourceBinding?.kind === 'catalogued'
        ? source.sourceBinding.references.filter(ref => ref.role === 'material').map(ref => ref.catalogueId) : []))];
      assert.ok(sourceIds.length > 0);
      for (const sourceId of sourceIds) {
        const source = SOURCES[sourceId]; assert.ok(source);
        const link = selected.locator(`[data-source="${sourceId}"]`).first();
        assert.equal(await link.isVisible(), true); assert.equal(await link.getAttribute('href'), sourceCitationUrl(source));
      }
      const attributions = ownSources.flatMap(source => source.capture?.attributions ?? []);
      assert.ok(attributions.length > 0, `${id}/${lens.id}: its observation must name a capture attribution.`);
      for (const attribution of attributions) {
        const attribute = attribution.kind === 'unresolved' ? 'data-unresolved' : attribution.missionId ? 'data-mission' : 'data-facility';
        const value = attribution.kind === 'unresolved' ? attribution.label : attribution.missionId ?? (attribution.kind === 'facility' ? attribution.facilityId : '');
        assert.ok(value);
        const contributor = selected.locator(`[${attribute}="${value}"]`); assert.ok(await contributor.count());
        if (!await contributor.first().isVisible()) {
          await selected.locator(`[data-information-tab="${value}"]`).click();
          assert.equal(await contributor.first().isVisible(), true);
        }
      }
      const sourceUI = await selected.innerText();
      const linkedSources = await selected.locator('[data-source]').evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute('data-source'), href: node.getAttribute('href'), text: node.textContent?.trim() })));
      await card.getByRole('tab', { name: 'Factsheet', exact: true }).click();
      const facts = card.locator(`[data-focus-facts-bank="${id}"] [data-focus-lens-details="${lens.id}"]`);
      await facts.waitFor({ state: 'visible' });
      const sourcePixels = lens.facts?.find(fact => fact.id === 'source-pixels'); assert.ok(sourcePixels);
      assert.equal((await facts.locator('[data-fact-id="source-pixels"] .planet-fact-value').innerText()).trim(), sourcePixels.value);
      await card.getByRole('tab', { name: 'Datasets', exact: true }).click();
      assert.deepEqual(await camera(), before, 'Source panels and lens changes must retain the camera.');
      assert.equal(new URL(page.url()).pathname, '/sun/'); assert.equal(new URL(page.url()).searchParams.get('focusLens'), lens.id);
      assert.equal(await stage.evaluate(node => node.isConnected), true);
      assert.equal(await runtimeBank.evaluate(node => node.isConnected), true);
      assert.equal(navigations.length, 1, 'Source navigation must retain the one document.');
      const key = `${id}/${lens.id}`;
      if (lens.id === payload.defaultLens || additionalImages.has(key)) {
        const path = `${id}-${lens.id}.jpg`; await page.screenshot({ path: resolve(output, path), type: 'jpeg', quality: 90 });
        const bytes = await readFile(resolve(output, path));
        screenshots.push({ path, claim: `${key}: source preview, visible interpretation and credited contributor`, bytes: bytes.length, sha256: hash(bytes), url: page.url(), camera: await camera() });
      }
      cases.push({ objectId: id, lensId: lens.id, label: lens.label, summary, description, preview, sourcePixels: sourcePixels.value,
        sourceIds, attributions, sourceUI, linkedSources, camera: await camera(), url: page.url(), retained: true });
      await save(); console.log(`NEBULA_PROVENANCE_LENS ${key}`);
    }
  }
  await Promise.all(pendingResponses);
  assert.equal(cases.length, 23); assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  report.result = 'PASS'; console.log('NEBULA_PROVENANCE_PASS 7 objects, 23 lenses, 1 document');
} catch (error) {
  report.result = 'FAIL'; errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
  await page.screenshot({ path: resolve(output, 'failure.jpg'), type: 'jpeg', quality: 90 }).catch(() => {}); throw error;
} finally {
  await Promise.all(pendingResponses); if (errors.length || failed.length) report.result = 'FAIL';
  await save(); await browser.close();
}
