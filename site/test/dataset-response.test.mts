import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { readPreparedObjectBytes } from '../object-page-data.mts';
import { renderDatasetResponse } from '../dataset-response.mts';
import { loadPreparedSceneMarkup } from '../../tools/prepared/load-prepared-scene.mts';
import { handleSearchRequest } from '../search-response.mts';
import searchRoute from '../../netlify/edge-functions/search-route.ts';

const origin = 'https://example.test';
const scene = await loadPreparedSceneMarkup('saturn');
const prepared = await readPreparedObjectBytes('saturn');
const html = `<!doctype html><html><head><style>u { color: red }</style></head><body><!--search-shell:start-->
<input class="planet-sheet-handle" type="checkbox"><section class="planet-information-panel">
<div class="planet-native-tabs"><input type="radio" data-information-tab="dataset"><input type="radio" data-information-tab="factsheet" checked></div>
${['normal', 'ultraviolet', 'cross-section'].map(id => `<button type="submit" name="dataset" value="${id}" aria-pressed="${id === 'normal'}">${id}</button><div data-lens-details="${id}" ${id === 'normal' ? '' : 'hidden'}>${id}</div>`).join('')}
</section><!--search-shell:end--><!--prepared-descriptor:start--><script data-prepared-descriptor type="application/json">${JSON.stringify(scene.descriptor)}</script><!--prepared-descriptor:end-->
<!--prepared-scene:start--><main class="planet-stage ${scene.classes.join(' ')}" data-object-id="saturn" data-prepared-object="saturn" aria-label="Saturn">${scene.html}</main><!--prepared-scene:end--><script src="/app.js"></script></body></html>`;
const read: typeof fetch = async input => {
  const url = new URL(String(input));
  assert.equal(url.origin, origin);
  assert.equal(url.pathname, '/objects/saturn/object.json', 'Only the prepared object request is allowed');
  return new Response(prepared.bytes);
};
test('native selection replaces only the existing prepared presentation and selected controls', async () => {
  for (const id of ['ultraviolet', 'cross-section', 'normal']) {
    const result = await renderDatasetResponse(html, new URL(`/saturn/?dataset=${id}`, origin), 'saturn', read);
    const document = parseHTML(result).document;
    assert.equal(document.querySelectorAll('.polycss-scene').length, 1);
    assert.equal(document.querySelectorAll('[data-prepared-node]').length, scene.nodes);
    assert.equal(document.querySelector('.planet-stage')?.getAttribute('data-prepared-dataset'), id);
    assert.equal(document.querySelector('button[aria-pressed="true"]')?.getAttribute('value'), id);
    assert.equal(document.querySelector('[data-lens-details]:not([hidden])')?.getAttribute('data-lens-details'), id);
    assert.equal(document.querySelector('[data-information-tab][checked]')?.getAttribute('data-information-tab'), 'dataset');
    assert.equal(result.slice(0, result.indexOf('<!--search-shell:start-->')), html.slice(0, html.indexOf('<!--search-shell:start-->')));
    assert.equal(result.slice(result.indexOf('<!--prepared-scene:end-->')), html.slice(html.indexOf('<!--prepared-scene:end-->')));
    assert.equal(document.querySelector('.planet-stage')?.getAttribute('data-view'), id === 'cross-section' ? 'interior' : null);
  }
});
test('invalid requests and corrupt prepared bytes cannot publish another dataset', async () => {
  for (const query of ['dataset=', 'dataset=unknown', 'dataset=normal&dataset=ultraviolet', 'dataset=..%2Fearth']) {
    await assert.rejects(renderDatasetResponse(html, new URL(`/saturn/?${query}`, origin), 'saturn', read), RangeError);
    const transport: typeof fetch = async () => new Response(html, { headers: { 'content-type': 'text/html' } });
    assert.equal((await handleSearchRequest(new Request(`${origin}/saturn/?${query}`), transport)).status, 400);
  }
  const corrupt: typeof fetch = async () => new Response('{}');
  await assert.rejects(renderDatasetResponse(html, new URL('/saturn/?dataset=ultraviolet', origin), 'saturn', corrupt), /hash|sha256|digest|identity/i);
  await assert.rejects(renderDatasetResponse(html, new URL('/saturn/?dataset=ultraviolet', origin), 'earth', read), /identity/);
});
test('Netlify handles dataset and combined search queries without intercepting static assets', () => {
  for (const query of ['dataset=ultraviolet', 'q=Titan&dataset=cross-section&v=view']) {
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
    <input class="planet-sheet-handle" type="checkbox"><section class="planet-information-panel"></section>
    <!--search-shell:end--><!--prepared-descriptor:start--><script data-prepared-descriptor type="application/json">${JSON.stringify(earthScene.descriptor)}</script><!--prepared-descriptor:end-->
    <!--prepared-scene:start--><main class="planet-stage ${earthScene.classes.join(' ')}" data-object-id="earth" data-prepared-object="earth" aria-label="Earth">${earthScene.html}</main><!--prepared-scene:end--></body></html>`;
  const result = await renderDatasetResponse(earthHtml, new URL('/earth/?feature=1159321043', origin), 'earth', transport);
  const document = parseHTML(result).document;
  assert.equal(document.querySelector('[data-feature-tooltip-name]')?.textContent, 'Monaco');
  assert.equal(document.querySelector('[data-feature-tooltip]')?.getAttribute('data-feature-tooltip-pinned'), 'true');
  assert.equal(requests.filter(path => path === '/scenes/earth/earth-features.json').length, 1);
  assert.equal(requests.filter(path => /^\/scenes\/earth\/earth-features-selection-\d+\.json$/u.test(path)).length, 1);
});
