import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { readPreparedObjectBytes, readSharedBankBytes } from '../object-page-data.mts';
import { renderDatasetResponse } from '../dataset-response.mts';
import { loadPreparedSceneMarkup } from '../../tools/load-prepared-scene.mts';
import { handleSearchRequest } from '../search-response.mts';
import searchRoute from '../../netlify/edge-functions/search-route.ts';
import { isSharedBankKind } from '../../src/platform/prepared-shared.mts';

const origin = 'https://example.test';
const scene = await loadPreparedSceneMarkup('saturn');
const prepared = await readPreparedObjectBytes('saturn');
const html = `<!doctype html><html><head><style>u { color: red }</style></head><body><!--search-shell:start-->
<input class="planet-sheet-handle" type="checkbox"><section class="planet-information-panel">
<input type="radio" data-information-tab="dataset"><input type="radio" data-information-tab="factsheet" checked>
${['normal', 'ultraviolet', 'cross-section'].map(id => `<button type="submit" name="dataset" value="${id}" aria-pressed="${id === 'normal'}">${id}</button><div data-lens-details="${id}" ${id === 'normal' ? '' : 'hidden'}>${id}</div>`).join('')}
</section><!--search-shell:end--><!--prepared-descriptor:start--><script data-prepared-descriptor type="application/json">${JSON.stringify(scene.descriptor)}</script><!--prepared-descriptor:end-->
<!--prepared-scene:start--><main class="planet-stage ${scene.classes.join(' ')}" data-object-id="saturn" data-prepared-object="saturn" data-prepared-sha256="${scene.sha256}" aria-label="Saturn">${scene.html}</main><!--prepared-scene:end--><script src="/app.js"></script></body></html>`;
const read: typeof fetch = async input => {
  const url = new URL(String(input));
  assert.equal(url.origin, origin);
  if (url.pathname === `/objects/saturn/${scene.sha256}.json`) return new Response(prepared.bytes);
  const bank = /^\/shared\/([a-z0-9-]+)\/([a-f0-9]{64})\.json$/u.exec(url.pathname);
  assert.ok(bank, `Only pinned object and bank requests are allowed: ${url.pathname}`);
  const kind = bank[1];
  assert.ok(isSharedBankKind(kind));
  const bytes = await readSharedBankBytes({ kind, sha256: bank[2] });
  assert.ok(bytes);
  return new Response(Uint8Array.from(bytes).buffer);
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
