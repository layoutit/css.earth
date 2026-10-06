import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { initialObjectSelection, loadPreparedCssObject, loadPreparedDataset, omittedPreparedNodes, selectedPreparedVariant } from '@cssearth/renderer';
import { readPreparedDatasetBytes, readPreparedObjectBytes } from '../object-page-data.mts';
import { preparedObjectPath } from '../../prepared/prepared-object-path.mts';
import { UnreadableSavedView, renderDatasetResponse } from './dataset-response.mts';
import { loadPreparedSceneMarkup } from '../load-prepared-scene.mts';
import { handleSearchRequest } from './search-response.mts';
import searchRoute from '../search-route.mts';
import { NATIVE_INPUT_STRIPS, NATIVE_TURNING_MESH, nativeInputMarkup, nativeInputStylesheet } from '../../browser/native-input.mts';

const origin = 'https://example.test';
// A refused dataset request never reaches search.
const noSearchData = { pin: null, read: async () => { throw new Error('unused'); }, catalogue: async () => [] };
const scene = await loadPreparedSceneMarkup('saturn');
const prepared = await readPreparedObjectBytes('saturn');
const html = `<!doctype html><html><head><style>u { color: red }</style></head><body><!--search-shell:start-->
<input class="object-sheet-handle" type="checkbox"><section class="object-information-panel">
<section data-information-panel="factsheet">Fact</section>
<details data-information-panel="dataset"><summary>Datasets</summary>
${['normal', 'ultraviolet', 'methane'].map(id => `<button type="submit" name="dataset" value="${id}" aria-pressed="${id === 'normal'}">${id}</button><div data-dataset-details="${id}" ${id === 'normal' ? '' : 'hidden'}>${id}</div>`).join('')}
</details>
</section><!--search-shell:end--><!--prepared-descriptor:start--><script data-prepared-descriptor type="application/json">${JSON.stringify(scene.descriptor)}</script><!--prepared-descriptor:end-->
<!--prepared-scene:start--><main class="object-stage ${scene.classes.join(' ')}" data-object-id="saturn" data-prepared-object="saturn" aria-label="Saturn">${scene.html}</main><!--prepared-scene:end--><script src="/app.js"></script></body></html>`;
const read: typeof fetch = async input => {
  const url = new URL(String(input));
  assert.equal(url.origin, origin);
  // The object transport, and the tables of a dataset it leaves out (dataset-tables.ts in @cssearth/objects).
  const dataset = /^\/objects\/saturn\/datasets\/([a-z0-9-]+)\.json$/u.exec(url.pathname)?.[1];
  if (dataset !== undefined) return new Response(new Uint8Array(await readPreparedDatasetBytes('saturn', dataset)));
  assert.equal(url.pathname, '/objects/saturn/object.json', 'Only the prepared object and dataset requests are allowed');
  return new Response(prepared.bytes);
};
test('native selection replaces only the existing prepared presentation and selected controls', async () => {
  for (const id of ['ultraviolet', 'methane', 'normal']) {
    const result = await renderDatasetResponse(html, new URL(`/saturn/?dataset=${id}`, origin), 'saturn', read);
    const document = parseHTML(result).document;
    assert.equal(document.querySelectorAll('.polycss-scene').length, 1);
    // The markup carries the nodes this dataset shows: what it hides stays out (prepared-omitted-nodes.ts).
    const definition = await loadPreparedCssObject(prepared.descriptor, {
      read: async reference => (await read(new URL(`/objects/saturn/${preparedObjectPath(reference)}`, origin))).arrayBuffer() });
    await loadPreparedDataset(definition, id);
    const variant = selectedPreparedVariant(definition, initialObjectSelection(definition.controls, id));
    assert.equal(document.querySelectorAll('[data-prepared-node]').length, scene.nodes - omittedPreparedNodes(definition.tree, variant).size);
    assert.equal(document.querySelector('.object-stage')?.getAttribute('data-prepared-dataset'), id);
    assert.equal(document.querySelector('button[aria-pressed="true"]')?.getAttribute('value'), id);
    assert.equal(document.querySelector('[data-dataset-details]:not([hidden])')?.getAttribute('data-dataset-details'), id);
    assert.equal(document.querySelector('details[data-information-panel="dataset"][open]')?.getAttribute('data-information-panel'), 'dataset');
    assert.equal(result.slice(0, result.indexOf('<!--search-shell:start-->')), html.slice(0, html.indexOf('<!--search-shell:start-->')));
    assert.equal(result.slice(result.indexOf('<!--prepared-scene:end-->')), html.slice(html.indexOf('<!--prepared-scene:end-->')));
    assert.equal(document.querySelector('.object-stage')?.getAttribute('data-view'), null);
  }
});
test('invalid requests and corrupt prepared bytes cannot publish another dataset', async () => {
  for (const query of ['dataset=', 'dataset=unknown', 'dataset=normal&dataset=ultraviolet', 'dataset=..%2Fearth', 'feature=city-', 'feature=city-lima', 'feature=city-1&feature=2']) {
    await assert.rejects(renderDatasetResponse(html, new URL(`/saturn/?${query}`, origin), 'saturn', read), RangeError);
    const transport: typeof fetch = async () => new Response(html, { headers: { 'content-type': 'text/html' } });
    assert.equal((await handleSearchRequest(new Request(`${origin}/saturn/?${query}`), noSearchData, transport)).status, 400);
  }
  const corrupt: typeof fetch = async () => new Response('{}');
  await assert.rejects(renderDatasetResponse(html, new URL('/saturn/?dataset=ultraviolet', origin), 'saturn', corrupt), /hash|digest|identity/i);
  await assert.rejects(renderDatasetResponse(html, new URL('/saturn/?dataset=ultraviolet', origin), 'earth', read), /identity/);
});
test('a saved view that reads but names no camera the scene can take is answered like an unreadable one', async () => {
  // Written by the app after a drifted camera (2026-10-01): its rotation is not orthonormal, and the function answered 502.
  const view = 'USO-LVLcltOqqz4XrhR64UeuwOjqIxJul5dBQsczQAAAAEAItQrAPK0yv5m2aZdvmLK_77UVFXayRL_A-Ca1JqZrv9gCXYyBU04_wO37ituYMr_tXAMurmOjP-2m68lngwQ_m1Y7vtPxY7_YAJKURpBfAAA';
  await assert.rejects(renderDatasetResponse(html, new URL(`/saturn/?v=${view}`, origin), 'saturn', read), UnreadableSavedView);
});

test('a billboard startup page takes the selected scene and its prepared mark', async () => {
  // ObjectLayout ships an empty stage without data-prepared-object when the object has an arrival billboard.
  const stage = `<main class="object-stage ${scene.classes.join(' ')}" data-object-id="saturn" data-prepared-object="saturn" aria-label="Saturn">${scene.html}</main>`;
  const startup = html.replace(stage, '<main class="object-stage" data-object-id="saturn" aria-label="Saturn"></main>')
    .replace('<!--prepared-scene:end-->', '<!--prepared-scene:end--><script type="application/json" data-startup-discovery>{}</script>');
  assert.notEqual(startup, html, 'the fixture must contain the prepared stage it replaces');
  const document = parseHTML(await renderDatasetResponse(startup, new URL('/saturn/?dataset=ultraviolet', origin), 'saturn', read)).document;
  assert.equal(document.querySelector('.object-stage')?.getAttribute('data-prepared-object'), 'saturn');
  assert.equal(document.querySelector('.object-stage')?.getAttribute('data-prepared-dataset'), 'ultraviolet');
  assert.equal(document.querySelectorAll('.polycss-scene').length, 1);
  // No saved view: the scene takes the fresh-mount pose at the default framing, depth scaled with width and height, and
  // names no saved view for the client to restore.
  assert.match(document.querySelector('.polycss-scene')?.getAttribute('style') ?? '', /transform:\s*translate3d\(.*cqw.*\) scale3d\(([0-9.]+),\1,\1\) matrix3d\(/u);
  assert.match(document.querySelector('.polycss-camera')?.getAttribute('style') ?? '', /perspective:\s*[0-9.]+cqw/u);
  assert.equal(document.querySelector('.object-stage')?.hasAttribute('data-prepared-view'), false);
  // Without the startup marker a stage that lost its prepared mark is still refused.
  const unmarked = startup.replace('<script type="application/json" data-startup-discovery>{}</script>', '');
  await assert.rejects(renderDatasetResponse(unmarked, new URL('/saturn/?dataset=ultraviolet', origin), 'saturn', read), /identity drifted: requested saturn/);
});
test('the drag rule of a page without script finds the spinning meshes a native response draws, with no mark for it', async () => {
  assert.ok(nativeInputStylesheet.includes(`\n  ${NATIVE_TURNING_MESH} {\n    rotate: z `), 'the stylesheet turns the spinning meshes');
  const result = await renderDatasetResponse(html, new URL('/saturn/?dataset=ultraviolet', origin), 'saturn', read);
  const turning = [...parseHTML(result).document.querySelectorAll(NATIVE_TURNING_MESH)].map(node => node.getAttribute('class'));
  assert.deepEqual(turning, ['polycss-mesh saturn-body saturn-body-polar', 'polycss-mesh saturn-body']);
  assert.equal(result.includes('data-native'), false);
});
test('the page without script lays its strips, frame and world stage in the order their anchors need', async () => {
  const layer = parseHTML(`<main>${nativeInputMarkup}</main>`).document;
  assert.equal(layer.querySelectorAll('.native-drag-layer > i').length, NATIVE_INPUT_STRIPS);
  // An anchor has to precede the box that reads it: the strips before the frame, and the sensor before the world stage.
  assert.ok(layer.querySelector('.native-drag-layer > i:last-of-type + .native-drag-frame > .native-drag-sensor'));
  assert.ok(nativeInputStylesheet.includes('.native-drag-layer > i:hover { anchor-name: --native-strip;'));
  const layout = await readFile(new URL('../../layouts/ObjectLayout.astro', import.meta.url), 'utf8');
  const input = layout.indexOf('<noscript set:html={nativeInputMarkup} />');
  assert.ok(input > 0 && input < layout.indexOf('<div class="object-world-stage">'), 'the input layer comes before the world stage');
});
test('a city link is left to the page, which selects the city on arrival', async () => {
  // The native response used to reject every non-numeric feature, so a shared city link answered 400.
  assert.equal(await renderDatasetResponse(html, new URL('/saturn/?feature=city-3435910', origin), 'saturn', read), html);
});
test('The page route sends dataset and combined search queries to the page handler without intercepting static assets', () => {
  for (const query of ['dataset=ultraviolet', 'q=Titan&dataset=methane&v=view']) {
    const destination = searchRoute(new Request(`${origin}/saturn/?${query}`));
    assert.equal(destination?.pathname, '/.netlify/functions/search');
    assert.equal(destination?.searchParams.get('object'), 'saturn');
    assert.equal(searchRoute(new Request(destination!)), undefined);
  }
  assert.equal(searchRoute(new Request(`${origin}/objects/saturn/hash.json?dataset=normal`)), undefined);
});

test('a native search-only Earth selection fetches the base catalogue and exactly one detail bank', async () => {
  const earthScene = await loadPreparedSceneMarkup('earth');
  const earthPrepared = await readPreparedObjectBytes('earth');
  const requests: string[] = [];
  const transport: typeof fetch = async input => {
    const url = new URL(String(input));
    requests.push(url.pathname);
    if (url.pathname === '/objects/earth/object.json') return new Response(earthPrepared.bytes);
    if (url.pathname.startsWith('/scenes/earth/earth-features')) {
      return new Response(await readFile(new URL(`../../public${url.pathname}`, import.meta.url)));
    }
    return new Response(null, { status: 404 });
  };
  const earthHtml = `<!doctype html><html><body><!--search-shell:start-->
    <input class="object-sheet-handle" type="checkbox"><section class="object-information-panel"></section>
    <!--search-shell:end--><!--prepared-descriptor:start--><script data-prepared-descriptor type="application/json">${JSON.stringify(earthScene.descriptor)}</script><!--prepared-descriptor:end-->
    <!--prepared-scene:start--><main class="object-stage ${earthScene.classes.join(' ')}" data-object-id="earth" data-prepared-object="earth" aria-label="Earth">${earthScene.html}</main><!--prepared-scene:end--></body></html>`;
  const result = await renderDatasetResponse(earthHtml, new URL('/earth/?feature=1159321043', origin), 'earth', transport);
  const document = parseHTML(result).document;
  assert.equal(document.querySelector('[data-feature-tooltip-name]')?.textContent, 'Monaco');
  assert.equal(document.querySelector('[data-feature-tooltip]')?.getAttribute('data-feature-tooltip-pinned'), 'true');
  assert.equal(requests.filter(path => path === '/scenes/earth/earth-features.json').length, 1);
  assert.equal(requests.filter(path => /^\/scenes\/earth\/earth-features-selection-\d+\.json$/u.test(path)).length, 1);
});

test('a feature link reads its catalogue from the published assets, not from the page origin', async () => {
  // The deployed site: every prepared file lives at its content address, and `/scenes/...` on the page's origin is 404.
  const earthScene = await loadPreparedSceneMarkup('earth');
  const earthPrepared = await readPreparedObjectBytes('earth');
  const assets: Record<string, string> = {};
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.filename === 'string' && typeof record.sha256 === 'string') assets[record.filename] = record.sha256;
    Object.values(record).forEach(collect);
  };
  collect(JSON.parse(await readFile(new URL('../../../src/objects/earth/inventory.json', import.meta.url), 'utf8')));
  const published = 'https://assets.test', requests: string[] = [];
  const transport: typeof fetch = async input => {
    const url = new URL(String(input));
    requests.push(url.origin === published ? url.href : url.pathname);
    if (url.origin === origin && url.pathname === '/objects/earth/object.json') return new Response(earthPrepared.bytes);
    const address = /^\/runtime-assets\/([a-f0-9]{64})\/(earth-features[a-z0-9-]*\.json)$/u.exec(url.pathname);
    if (url.origin === published && address && assets[address[2]!] === address[1]) {
      return new Response(await readFile(new URL(`../../public/scenes/earth/${address[2]}`, import.meta.url)));
    }
    return new Response(null, { status: 404 });
  };
  const descriptor = { ...earthScene.descriptor, properties: { ...earthScene.descriptor.properties, assetOrigin: { origin: published, assets } } };
  const earthHtml = `<!doctype html><html><body><!--search-shell:start-->
    <input class="object-sheet-handle" type="checkbox"><section class="object-information-panel"></section>
    <!--search-shell:end--><!--prepared-descriptor:start--><script data-prepared-descriptor type="application/json">${JSON.stringify(descriptor)}</script><!--prepared-descriptor:end-->
    <!--prepared-scene:start--><main class="object-stage ${earthScene.classes.join(' ')}" data-object-id="earth" data-prepared-object="earth" aria-label="Earth">${earthScene.html}</main><!--prepared-scene:end--></body></html>`;
  const result = await renderDatasetResponse(earthHtml, new URL('/earth/?feature=1159321043', origin), 'earth', transport);
  assert.equal(parseHTML(result).document.querySelector('[data-feature-tooltip-name]')?.textContent, 'Monaco');
  assert.ok(requests.includes(`${published}/runtime-assets/${assets['earth-features.json']}/earth-features.json`));
  assert.equal(requests.filter(path => path.startsWith('/scenes/')).length, 0);
});
