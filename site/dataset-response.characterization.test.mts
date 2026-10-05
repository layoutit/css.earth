import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { characterizationRuntime } from './test/fixtures/characterization-runtime.mts';
import { readPreparedObjectBytes } from './object-page-data.mts';
import { renderDatasetResponse, UnreadableSavedView } from './dataset-response.mts';

const origin = 'https://example.test';
const noRead: typeof fetch = async () => { throw new Error('unexpected fetch'); };

test('untouched pages bypass parsing while drawn pages require the descriptor region', async () => {
  assert.equal(await renderDatasetResponse('plain page', new URL('/', origin), 'saturn', noRead), 'plain page');
  assert.equal(await renderDatasetResponse('plain page', new URL('/?feature=city-42', origin), 'saturn', noRead), 'plain page');
  await assert.rejects(renderDatasetResponse('plain page', new URL('/', origin), 'saturn', noRead, { drawnPage: true }), /Prepared prepared-descriptor is missing/);
  await assert.rejects(renderDatasetResponse('plain page', new URL('/?v=a&v=b', origin), 'saturn', noRead), /Invalid saved view: 2 v parameters/);
  await assert.rejects(renderDatasetResponse('plain page', new URL('/?v=broken', origin), 'saturn', noRead), error => {
    assert.ok(error instanceof UnreadableSavedView);
    assert.equal(error.value, 'broken');
    assert.equal(error.message, 'Invalid saved view: v=broken.');
    return true;
  });
  const value = 'x'.repeat(90);
  assert.equal(new UnreadableSavedView(value).message, `Invalid saved view: v=${'x'.repeat(80)}.`);
});

test('native settings reject malformed selections and publish checkbox and numeric values', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dataset-response-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'src/objects/saturn/prepared');
  await mkdir(directory, { recursive: true });
  const data = { ...characterizationRuntime(), id: 'saturn', controls: { datasets: { defaultDataset: 'normal', controls: [{ id: 'normal', label: 'Normal' }] }, settings: { controls: [
    { kind: 'cycle', name: 'speed', label: 'Speed', state: 'normal' },
    { kind: 'toggle', name: 'shadows', label: 'Shadows', checked: true },
    { kind: 'toggle', name: 'rings', label: 'Rings', checked: true },
  ] } }, variants: [false, true].flatMap(shadows => [false, true].map(rings => ({ ...characterizationRuntime().variants[0], when: { datasetId: 'normal', shadows, rings }, writes: [...characterizationRuntime().variants[0]!.writes, { kind: 'style', target: 2, name: 'opacity', value: String((Number(shadows) + 2 * Number(rings) + 1) / 4) }] }))), textureLevels: undefined };
  const descriptor = { schema: 'cssearth-object@2', id: 'saturn', type: 'layered-body', properties: {}, prepared: { format: 'cssearth-css-object@5', url: 'prepared/object.json' } };
  await writeFile(join(directory, '../object.json'), JSON.stringify(descriptor));
  await writeFile(join(directory, 'runtime.json'), JSON.stringify(data));
  await writeFile(join(directory, 'controls.json'), JSON.stringify(data.controls));
  const scene = { descriptor, html: '' };
  const prepared = await readPreparedObjectBytes('saturn', root);
  const timeouts: number[] = [];
  t.mock.method(AbortSignal, 'timeout', (delay: number) => { timeouts.push(delay); return new AbortController().signal; });
  const html = `<!--search-shell:start--><input class="object-sheet-handle" type="checkbox"><section class="object-information-panel">
    <details data-information-panel="dataset"><button name="dataset" value="normal">Normal</button></details>
    <div class="object-settings"><input type="checkbox" name="shadows" checked><input type="checkbox" name="rings" checked><input type="range" name="speed" value="1"></div>
    </section><!--search-shell:end--><!--prepared-descriptor:start--><script data-prepared-descriptor type="application/json">${JSON.stringify(scene.descriptor)}</script><!--prepared-descriptor:end-->
    <!--prepared-scene:start--><main class="object-stage obsolete" data-object-id="saturn" data-prepared-object="saturn" data-obsolete="yes" aria-label="Saturn">${scene.html}</main><!--prepared-scene:end-->`;
  const requests: { url: string; redirect: RequestRedirect | undefined; signal: boolean }[] = [];
  const read: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), redirect: init?.redirect, signal: init?.signal instanceof AbortSignal });
    return new Response(prepared.bytes);
  };
  for (const query of ['settings=0', 'settings=1&settings=1', 'settings=1&shadows=off', 'settings=1&rings=on&rings=on', 'settings=1&speed=1&speed=2']) {
    await assert.rejects(renderDatasetResponse(html, new URL(`/?${query}`, origin), 'saturn', read), /Invalid setting/);
  }
  const result = parseHTML(await renderDatasetResponse(html, new URL('/?settings=1&speed=2', origin), 'saturn', read)).document;
  const stage = result.querySelector('.object-stage');
  assert.equal(stage?.getAttribute('data-obsolete'), null);
  assert.equal(stage?.getAttribute('aria-label'), 'Saturn');
  assert.equal(stage?.getAttribute('data-prepared-settings'), '{"speed":2,"shadows":false,"rings":false}');
  assert.equal(stage?.getAttribute('data-prepared-dataset'), 'normal');
  assert.equal(result.querySelector('input[name="shadows"]')?.hasAttribute('checked'), false);
  assert.equal(result.querySelector('input[name="rings"]')?.hasAttribute('checked'), false);
  assert.equal(result.querySelector('input[name="speed"]')?.getAttribute('value'), '2');
  assert.ok(requests.length > 0);
  assert.deepEqual(timeouts, requests.map(() => 15_000));
  assert.ok(requests.every(request => request.url === `${origin}/objects/saturn/object.json` && request.redirect === 'error' && request.signal));
  const failed: typeof fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(renderDatasetResponse(html, new URL('/?settings=1', origin), 'saturn', failed), /Prepared dataset could not load/);
  await assert.rejects(renderDatasetResponse(html.replace('<!--search-shell:end-->', ''), new URL('/?settings=1', origin), 'saturn', read), /Prepared search-shell is missing/);
  await assert.rejects(renderDatasetResponse(html.replace('data-object-id="saturn"', 'data-object-id="earth"'), new URL('/?settings=1', origin), 'saturn', read), /Prepared scene identity drifted/);
});

test('city feature ids accept sixteen digits and reject seventeen', async () => {
  await assert.rejects(renderDatasetResponse('plain page', new URL('/?feature=city-1&feature=city-2', origin), 'saturn', noRead), { name: 'RangeError', message: 'Invalid feature selection.' });
  for (const length of [1, 15, 16]) assert.equal(await renderDatasetResponse('plain page', new URL(`/?feature=city-${'1'.repeat(length)}`, origin), 'saturn', noRead), 'plain page');
  for (const length of [0, 17]) await assert.rejects(renderDatasetResponse('plain page', new URL(`/?feature=city-${'1'.repeat(length)}`, origin), 'saturn', noRead), { name: 'RangeError', message: 'Invalid feature selection.' });
});

test('a surface feature without a dataset request checks the information sheet handle', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dataset-feature-characterization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'src/objects/body/prepared');
  await mkdir(directory, { recursive: true });
  const feature = { id: '1', name: 'Landmark', kind: 'point', type: 'Point', code: 'AA', diameterKm: 1,
    longitudeDeg: 0, latitudeDeg: 0, anchorUnits: [1, 0, 0], normal: [1, 0, 0], radiusUnits: 0,
    outline: { kind: 'circle', center: [1, 0, 0], east: [0, 0, 0], north: [0, 0, 0] },
    searchNames: ['landmark'], searchContext: 'point', origin: '', approved: '', quad: '', link: 'https://example.test', credit: '' };
  const catalog = { schema: 'cssearth-prepared-surface-features@1', objectId: 'body', source: 'source', snapshotDate: 'date',
    sourcePage: 'page', license: 'license', qualification: 'qualified', features: [feature] };
  const data = { ...characterizationRuntime(), id: 'body', features: {
    catalog: { url: '/scenes/body/features.json', bytes: 1, count: 1 }, target: 2, datasetIds: ['day'], meshRadiusUnits: 1,
    policy: { minimumZoomShare: 0, minimumDiameterPixels: 1, alwaysVisibleCount: 0, maximumVisible: 1, limbCosine: 0 }, outline: { pieces: 8 },
  } };
  const descriptor = { schema: 'cssearth-object@2', id: 'body', type: 'layered-body', properties: {}, prepared: { format: 'cssearth-css-object@5', url: 'prepared/object.json' } };
  await writeFile(join(directory, '../object.json'), JSON.stringify(descriptor));
  await writeFile(join(directory, 'runtime.json'), JSON.stringify(data));
  await writeFile(join(directory, 'controls.json'), JSON.stringify(data.controls));
  const prepared = await readPreparedObjectBytes('body', root);
  const requests: string[] = [];
  const read: typeof fetch = async input => {
    const path = new URL(String(input)).pathname;
    requests.push(path);
    if (path === '/objects/body/object.json') return new Response(prepared.bytes);
    assert.equal(path, '/scenes/body/features.json');
    return Response.json(catalog);
  };
  const html = `<!--search-shell:start--><input class="object-sheet-handle" type="checkbox"><section class="object-information-panel"></section><!--search-shell:end-->
    <!--prepared-descriptor:start--><script data-prepared-descriptor>${JSON.stringify(descriptor)}</script><!--prepared-descriptor:end-->
    <!--prepared-scene:start--><main class="object-stage" data-object-id="body" data-prepared-object="body"></main><!--prepared-scene:end-->`;
  const result = parseHTML(await renderDatasetResponse(html, new URL('/body/?feature=1', origin), 'body', read)).document;
  assert.equal(result.querySelector('.object-sheet-handle')?.getAttribute('checked'), '');
  assert.equal(result.querySelector('[data-feature-tooltip-name]')?.textContent, 'Landmark');
  assert.equal(result.querySelector('[data-feature-tooltip]')?.getAttribute('data-feature-tooltip-pinned'), 'true');
  assert.equal(result.querySelector('.object-stage')?.getAttribute('data-prepared-dataset'), 'day');
  assert.deepEqual(requests, ['/objects/body/object.json', '/scenes/body/features.json']);
});
