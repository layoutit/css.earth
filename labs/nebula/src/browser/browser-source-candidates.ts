/** Real source previews: every candidate decodes, shares a camera and never starts processing. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import subjects from '../subjects.json';
import { readObservationRecipe } from '../alignment/observations/recipe';
import { readObservations } from '../alignment/observations-ui/model';
import { readSourceDossier, selectObservationCandidates } from '../alignment/observations-ui/source-dossier';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['m45', 'm1', 'm8'];
const directory = '.local/nebula-lab/source-candidates-browser';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors: string[] = [], writes: string[] = [], results: unknown[] = [], imageRequests: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); if (request.resourceType() === 'image') imageRequests.push(request.url()); });
try {
  for (const id of ids) {
    const subject = subjects.find(row => row.id === id); assert.ok(subject?.observationAlignment);
    const workspace = subject.observationAlignment.candidates ?? subject.observationAlignment;
    assert.ok(workspace.dossier);
    const recipe = readObservationRecipe(JSON.parse(await readFile(workspace.recipe, 'utf8')));
    const observations = readObservations(JSON.parse(await readFile(workspace.manifest, 'utf8')));
    const dossier = readSourceDossier(JSON.parse(await readFile(workspace.dossier, 'utf8')));
    assert.deepEqual(observations.images.map(i => i.id), recipe.images.map(i => i.id));
    assert.deepEqual(dossier.images.map(i => i.id).sort(), recipe.images.map(i => i.id).sort());
    assert.ok(dossier.papers.length >= 3);
    const selected = selectObservationCandidates(observations, dossier.selection);
    const selectedIds = selected.images.map(image => image.id);
    imageRequests.length = 0;
    await page.goto(`http://127.0.0.1:4331/alignment?subject=${id}`);
    await page.locator('#observation-image option').first().waitFor({ state: 'attached' });
    await page.locator('.observation-source-info strong').waitFor();
    await page.locator('.observation-frame img').evaluateAll(nodes => Promise.all(nodes.map(node => (node as HTMLImageElement).decode())));
    assert.deepEqual(await page.locator('#observation-image option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value)), selectedIds);
    for (const excluded of observations.images.filter(image => !selectedIds.includes(image.id))) {
      assert.ok(!imageRequests.some(url => url.endsWith(excluded.layers.original.path)), `${excluded.id}: excluded image was fetched.`);
    }
    const camera = await page.locator('.observation-frame').getAttribute('style');
    for (const image of selected.images) {
      await page.locator('#observation-image').selectOption(image.id);
      assert.equal(await page.locator('.observation-frame').getAttribute('style'), camera, 'Image switching moved the sky.');
      assert.deepEqual(await page.locator('.observation-frame img').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).visibility === 'visible').map(node => node.getAttribute('data-observation'))), [image.id]);
      assert.equal(await page.getByRole('alert').count(), 0);
      assert.ok((await page.getByRole('region', { name: 'Source information' }).textContent())?.includes(dossier.images.find(i => i.id === image.id)!.wavelengths));
      await page.screenshot({ path: `${directory}/${id}-${image.id}.png` });
    }
    await page.locator('#observation-image').selectOption(selected.images[0]!.id);
    await page.getByRole('button', { name: 'Fit image', exact: true }).click();
    await page.locator('summary').filter({ hasText: 'Papers & constraints' }).click();
    assert.equal(await page.locator('.observation-source-info article').count(), dossier.papers.length);
    await page.screenshot({ path: `${directory}/${id}-ready.png` });
    if (subject.alignmentOnly) {
      assert.equal(await page.getByRole('tab', { name: 'Reconstruction', exact: true }).isDisabled(), true);
      await page.goto(`http://127.0.0.1:4331/reconstruction?subject=${id}`);
      await page.locator('#observation-image option').first().waitFor({ state: 'attached' });
      assert.equal(new URL(page.url()).pathname, '/alignment');
    }
    results.push({ id, images: selected.images.length, papers: dossier.papers.length,
      registration: selected.images.map(i => ({ id: i.id, status: i.registration.status })) });
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, [], 'Source browsing started processing.');
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: true, results, errors, writes, browser: browser.version() }, null, 2));
  console.log('NEBULA_SOURCE_CANDIDATES_BROWSER_PASS', JSON.stringify(results));
} finally { await browser.close(); }
